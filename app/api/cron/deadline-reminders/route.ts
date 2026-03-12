import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { sendSlackNotification, buildSlackMap } from "@/lib/slack";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.nextUrl.searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find tasks with deadlines in the next 24 hours that are not done
  const tasks = await Task.find({
    deadline: { $gte: now, $lte: in24h },
    status: { $nin: ["done", "completed"] },
  }).lean();

  if (tasks.length === 0) {
    return NextResponse.json({ sent: 0, message: "No upcoming deadlines" });
  }

  const slackMap = await buildSlackMap();

  // Group tasks by project for efficient project name lookup
  const projectIds = Array.from(new Set(tasks.map((t) => String(t.projectId))));
  const projects = await Project.find({ _id: { $in: projectIds } }).lean();
  const projectMap = new Map(projects.map((p) => [String(p._id), p.name]));

  let sent = 0;
  for (const task of tasks) {
    const projectName = projectMap.get(String(task.projectId)) || "Unknown Project";
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
        taskTitle: task.title,
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

  return NextResponse.json({ sent, message: `Sent ${sent} deadline reminders` });
}
