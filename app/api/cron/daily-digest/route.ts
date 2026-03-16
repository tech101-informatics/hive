import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Activity } from "@/models/Activity";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { BoardStatus } from "@/models/BoardStatus";
import { RecurringTask } from "@/models/RecurringTask";
import { Counter } from "@/models/Counter";
import { calculateNextRunDate } from "@/lib/recurring";
import { trackInitialStatus, trackInitialAssignees } from "@/lib/time-tracking";

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

  // ── Process recurring tasks ──
  let recurringCreated = 0;
  const now = new Date();
  const dueRecurring = await RecurringTask.find({
    enabled: true,
    nextRunDate: { $lte: now },
  }).lean();

  for (const rt of dueRecurring) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        "taskCardNumber",
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const newTask = await Task.create({
        title: rt.title,
        description: rt.description,
        priority: rt.priority,
        assignees: rt.assignees,
        labels: rt.labels,
        checklist: (rt.checklist || []).map((item: any, i: number) => ({
          text: item.text,
          completed: false,
          order: item.order ?? i,
        })),
        status: rt.status || "todo",
        projectId: rt.projectId,
        cardNumber: counter.seq,
      });

      const tid = String(newTask._id);
      const pid = String(rt.projectId);
      trackInitialStatus(tid, pid, newTask.status).catch(() => {});
      if (rt.assignees?.length) {
        trackInitialAssignees(tid, pid, rt.assignees).catch(() => {});
      }

      await RecurringTask.findByIdAndUpdate(rt._id, {
        nextRunDate: calculateNextRunDate(rt.frequency, now, rt.dayOfWeek, rt.dayOfMonth),
      });
      recurringCreated++;
    } catch (e) {
      console.error(`[RecurringTask] Failed to create from ${rt._id}:`, e);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Board statuses for identifying "in-progress" columns (not first, not "done")
  const boardStatuses = await BoardStatus.find().sort({ order: 1 }).lean();
  const firstSlug = boardStatuses[0]?.slug;
  const inProgressSlugs = boardStatuses
    .filter((s) => s.slug !== firstSlug && s.slug !== "done")
    .map((s) => s.slug);

  // Today's activities
  const activities = await Activity.find({
    createdAt: { $gte: today, $lt: tomorrow },
  }).lean();

  const tasksCreated = activities.filter((a) => a.action === "created_task").length;
  const statusChanges = activities.filter((a) => a.action === "status_changed").length;
  const tasksDone = activities.filter(
    (a) => a.action === "status_changed" && a.details?.includes('"done"'),
  ).length;
  const commentsAdded = activities.filter((a) => a.action === "comment_added").length;
  const timeLogged = activities.filter((a) => a.action === "time_logged").length;

  // Cards in progress — listed individually
  const inProgressTasks = await Task.find({
    status: { $in: inProgressSlugs },
    archived: { $ne: true },
  })
    .sort({ updatedAt: -1 })
    .lean();

  // Counts for other statuses
  const backlogCount = await Task.countDocuments({
    status: firstSlug,
    archived: { $ne: true },
  });
  const doneCount = await Task.countDocuments({
    status: "done",
    archived: { $ne: true },
  });

  // Overdue tasks
  const overdueTasks = await Task.find({
    deadline: { $lt: today },
    status: { $nin: ["done", "completed"] },
    archived: { $ne: true },
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
    archived: { $ne: true },
  })
    .sort({ deadline: 1 })
    .limit(10)
    .lean();

  // Active projects
  const activeProjects = await Project.find({ status: "active" }).lean();

  // Status label lookup
  const statusLabelMap: Record<string, string> = {};
  for (const s of boardStatuses) {
    statusLabelMap[s.slug] = s.label;
  }

  // ── Build message ──
  const lines: string[] = [];
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  lines.push(`*Daily Digest — ${dateStr}*`);
  lines.push("─".repeat(36));
  lines.push("");

  // Activity summary
  lines.push("*Today's Activity*");
  const stats: string[] = [];
  if (tasksCreated) stats.push(`*${tasksCreated}* created`);
  if (tasksDone) stats.push(`*${tasksDone}* completed`);
  if (statusChanges) stats.push(`*${statusChanges}* status changes`);
  if (commentsAdded) stats.push(`*${commentsAdded}* comments`);
  if (timeLogged) stats.push(`*${timeLogged}* time entries`);
  if (recurringCreated > 0) stats.push(`*${recurringCreated}* recurring`);
  lines.push(stats.length ? stats.join("  |  ") : "_No activity today_");
  lines.push("");

  // Counts: backlog + done
  lines.push("*Summary*");
  lines.push(`Backlog: *${backlogCount}*  |  In Progress: *${inProgressTasks.length}*  |  Done: *${doneCount}*`);
  lines.push("");

  // In-progress cards — full list grouped by project
  if (inProgressTasks.length > 0) {
    lines.push(`*In Progress (${inProgressTasks.length})*`);

    // Group by projectId
    const byProject: Record<string, typeof inProgressTasks> = {};
    for (const t of inProgressTasks) {
      const pid = String(t.projectId);
      if (!byProject[pid]) byProject[pid] = [];
      byProject[pid].push(t);
    }

    for (const [projectId, tasks] of Object.entries(byProject)) {
      const project = activeProjects.find((p) => String(p._id) === projectId);
      const projectName = project?.name || "Unknown";
      const boardLink = `<${APP_URL}/projects/${projectId}|${projectName}>`;
      lines.push(`  ${boardLink}`);
      for (const t of tasks) {
        const status = statusLabelMap[t.status] || t.status;
        const assignees = t.assignees?.length ? ` — _${t.assignees.join(", ")}_` : "";
        lines.push(`    - <${APP_URL}/projects/${projectId}/cards/${t._id}|${t.title}>  [${status}]${assignees}`);
      }
    }
    lines.push("");
  }

  // Boards
  if (activeProjects.length > 0) {
    lines.push("*Boards*");
    for (const p of activeProjects) {
      lines.push(`  <${APP_URL}/projects/${p._id}|${p.name}>`);
    }
    lines.push("");
  }

  // Overdue
  if (overdueTasks.length > 0) {
    lines.push(`*Overdue (${overdueTasks.length})*`);
    for (const t of overdueTasks) {
      const d = new Date(t.deadline!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      lines.push(`  - <${APP_URL}/projects/${t.projectId}/cards/${t._id}|${t.title}> — _due ${d}_`);
    }
    lines.push("");
  }

  // Upcoming
  if (upcomingTasks.length > 0) {
    lines.push(`*Upcoming Deadlines (next 3 days)*`);
    for (const t of upcomingTasks) {
      const d = new Date(t.deadline!).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      lines.push(`  - <${APP_URL}/projects/${t.projectId}/cards/${t._id}|${t.title}> — _${d}_`);
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
    recurringCreated,
    inProgress: inProgressTasks.length,
    overdue: overdueTasks.length,
    upcoming: upcomingTasks.length,
  });
}
