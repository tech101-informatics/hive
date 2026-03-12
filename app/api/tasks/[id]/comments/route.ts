import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Comment } from "@/models/Comment";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { sendSlackNotification, buildSlackMap } from "@/lib/slack";
import { logActivity } from "@/lib/activity";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

async function resolveTaskId(id: string): Promise<string | null> {
  if (/^SP-\d+$/i.test(id)) {
    const num = parseInt(id.replace(/^SP-/i, ""), 10);
    const task = await Task.findOne({ cardNumber: num }).select("_id");
    return task ? String(task._id) : null;
  }
  return id;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const taskId = await resolveTaskId(id);
  if (!taskId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const comments = await Comment.find({ taskId }).sort({ createdAt: 1 });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const taskId = await resolveTaskId(id);
  if (!taskId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const comment = await Comment.create({
    taskId,
    author: session!.user.name || "Unknown",
    authorEmail: session!.user.email || "",
    content: content.trim(),
  });

  // Slack notification + activity log
  const task = await Task.findById(taskId);
  if (task) {
    const project = await Project.findById(task.projectId);
    const slackMap = await buildSlackMap();
    await sendSlackNotification({
      type: "comment_added",
      taskTitle: task.title,
      projectName: project?.name || "Unknown Project",
      projectId: String(task.projectId),
      taskId: String(taskId),
      author: session!.user.name || "Unknown",
      assignees: task.assignees,
    }, slackMap, task.slackThreadTs || undefined);
    await logActivity({
      taskId: String(taskId),
      projectId: String(task.projectId),
      user: session!.user.name || "Unknown",
      userEmail: session!.user.email || "",
      action: "comment_added",
      details: `Commented on "${task.title}"`,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
