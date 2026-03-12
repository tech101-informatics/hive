import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Activity } from "@/models/Activity";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";

const CRON_SECRET = process.env.CRON_SECRET || "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

async function postMessage(text: string) {
  if (SLACK_BOT_TOKEN && SLACK_CHANNEL_ID) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID, text, unfurl_links: false }),
    });
    return;
  }
  if (SLACK_WEBHOOK_URL) {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerMatch = authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && secret !== CRON_SECRET && !bearerMatch) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's activities
  const activities = await Activity.find({
    createdAt: { $gte: today, $lt: tomorrow },
  }).lean();

  // Today's task stats
  const tasksCreated = activities.filter((a) => a.action === "created_task").length;
  const statusChanges = activities.filter((a) => a.action === "status_changed").length;
  const tasksDone = activities.filter(
    (a) => a.action === "status_changed" && a.details?.includes('"done"'),
  ).length;
  const commentsAdded = activities.filter((a) => a.action === "comment_added").length;
  const timeLogged = activities.filter((a) => a.action === "time_logged").length;

  // Overdue tasks
  const overdueTasks = await Task.find({
    deadline: { $lt: today },
    status: { $nin: ["done", "completed"] },
  })
    .sort({ deadline: 1 })
    .limit(10)
    .lean();

  // Upcoming deadlines (next 3 days)
  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const upcomingTasks = await Task.find({
    deadline: { $gte: today, $lte: in3Days },
    status: { $nin: ["done", "completed"] },
  })
    .sort({ deadline: 1 })
    .limit(10)
    .lean();

  // Active projects summary
  const activeProjects = await Project.find({ status: "active" }).lean();
  const totalOpenTasks = await Task.countDocuments({
    status: { $nin: ["done", "completed"] },
  });

  // Build message
  const lines: string[] = [];
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  lines.push(`📊 *Daily Digest — ${dateStr}*`);
  lines.push("");

  // Activity summary
  lines.push("*Today's Activity:*");
  const stats: string[] = [];
  if (tasksCreated) stats.push(`${tasksCreated} cards created`);
  if (tasksDone) stats.push(`${tasksDone} cards completed`);
  if (statusChanges) stats.push(`${statusChanges} status changes`);
  if (commentsAdded) stats.push(`${commentsAdded} comments`);
  if (timeLogged) stats.push(`${timeLogged} time entries`);
  lines.push(stats.length ? `  ${stats.join(" · ")}` : "  No activity today");
  lines.push("");

  // Overview
  lines.push(`*Overview:* ${activeProjects.length} active boards · ${totalOpenTasks} open cards`);
  lines.push("");

  // Overdue
  if (overdueTasks.length) {
    lines.push(`🚨 *Overdue (${overdueTasks.length}):*`);
    for (const t of overdueTasks) {
      const d = new Date(t.deadline!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      lines.push(`  • <${APP_URL}/projects/${t.projectId}/cards/${t._id}|${t.title}> — due ${d}`);
    }
    lines.push("");
  }

  // Upcoming
  if (upcomingTasks.length) {
    lines.push(`📅 *Upcoming (next 3 days):*`);
    for (const t of upcomingTasks) {
      const d = new Date(t.deadline!).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      lines.push(`  • <${APP_URL}/projects/${t.projectId}/cards/${t._id}|${t.title}> — ${d}`);
    }
  }

  const text = lines.join("\n");

  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) {
    return NextResponse.json({ message: "Slack not configured", digest: text });
  }

  await postMessage(text);

  return NextResponse.json({
    sent: true,
    stats: { tasksCreated, tasksDone, statusChanges, commentsAdded, timeLogged },
    overdue: overdueTasks.length,
    upcoming: upcomingTasks.length,
  });
}
