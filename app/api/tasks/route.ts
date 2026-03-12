import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { Comment } from "@/models/Comment";
import { Counter } from "@/models/Counter";
import { BoardStatus } from "@/models/BoardStatus";
import { sendSlackNotification, buildSlackMap } from "@/lib/slack";
import { logActivity } from "@/lib/activity";
import { getSessionOrUnauthorized, requireAdmin } from "@/lib/auth-helpers";

async function getNextCardNumber(): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    "taskCardNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const filter = projectId ? { projectId } : {};
  const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>();

  // Backfill card numbers for existing tasks that don't have one
  for (const t of tasks) {
    if (!t.cardNumber) {
      const num = await getNextCardNumber();
      await Task.findByIdAndUpdate(t._id, { cardNumber: num });
      t.cardNumber = num;
    }
  }

  // Attach comment counts
  const taskIds = tasks.map((t) => t._id);
  const counts = await Comment.aggregate([
    { $match: { taskId: { $in: taskIds } } },
    { $group: { _id: "$taskId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c: { _id: unknown; count: number }) => [String(c._id), c.count]));
  const tasksWithCounts = tasks.map((t) => ({
    ...t,
    commentCount: countMap.get(String(t._id)) || 0,
  }));

  return NextResponse.json(tasksWithCounts);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  await connectDB();
  const body = await req.json();
  if (!body.status) {
    const defaultStatus = await BoardStatus.findOne({ isDefault: true });
    body.status = defaultStatus?.slug || "todo";
  }
  const cardNumber = await getNextCardNumber();
  const task = await Task.create({ ...body, cardNumber });
  const project = await Project.findById(body.projectId);
  const projectName = project?.name || "Unknown Project";

  const slackMap = await buildSlackMap();

  const slackThreadTs = await sendSlackNotification({
    type: "task_created",
    taskTitle: task.title,
    projectName,
    projectId: String(body.projectId),
    taskId: String(task._id),
    assignees: task.assignees?.length ? task.assignees : undefined,
  }, slackMap);

  if (slackThreadTs) {
    await Task.findByIdAndUpdate(task._id, { slackThreadTs });
    task.slackThreadTs = slackThreadTs;
  }

  await logActivity({
    taskId: String(task._id),
    projectId: String(body.projectId),
    user: session!.user.name || "Unknown",
    userEmail: session!.user.email || "",
    action: "created_task",
    details: `Created card "${task.title}"`,
  });

  return NextResponse.json(task, { status: 201 });
}
