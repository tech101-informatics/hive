import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { sendSlackNotification, buildSlackMap } from "@/lib/slack";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerMatch = authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && secret !== CRON_SECRET && !bearerMatch) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Only send reminders for todo and in-progress cards
  const reminderSlugs = ["todo", "in-progress"];

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Upcoming: in-progress cards with deadlines in the next 24 hours
  const upcomingTasks = await Task.find({
    deadline: { $gte: now, $lte: in24h },
    status: { $in: reminderSlugs },
    archived: { $ne: true },
  }).lean();

  // Overdue: in-progress cards with deadlines in the past
  const overdueTasks = await Task.find({
    deadline: { $lt: now },
    status: { $in: reminderSlugs },
    archived: { $ne: true },
  }).lean();

  const allTasks = [...upcomingTasks, ...overdueTasks];

  if (allTasks.length === 0) {
    return NextResponse.json({ sent: 0, message: "No reminders to send" });
  }

  const slackMap = await buildSlackMap();

  const projectIds = Array.from(new Set(allTasks.map((t) => String(t.projectId))));
  const projects = await Project.find({ _id: { $in: projectIds } }).lean();
  const projectMap = new Map(projects.map((p) => [String(p._id), p.name]));

  let sent = 0;
  for (const task of allTasks) {
    const projectName = projectMap.get(String(task.projectId)) || "Unknown Project";
    const isOverdue = new Date(task.deadline!) < now;
    const deadlineStr = new Date(task.deadline!).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    await sendSlackNotification(
      {
        type: "task_deadline",
        taskTitle: isOverdue ? `[Overdue] ${task.title}` : task.title,
        projectName,
        projectId: String(task.projectId),
        taskId: String(task._id),
        deadline: deadlineStr,
        assignees: task.assignees,
      },
      slackMap,
      task.slackThreadTs || undefined,
    );
    sent++;
  }

  return NextResponse.json({
    sent,
    upcoming: upcomingTasks.length,
    overdue: overdueTasks.length,
  });
}
