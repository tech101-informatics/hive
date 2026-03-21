import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postMessage(text: string, blocks?: any[]) {
  const payload: Record<string, unknown> = { text, unfurl_links: false };
  if (blocks) payload.blocks = blocks;

  if (SLACK_BOT_TOKEN && SLACK_CHANNEL_ID) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID, ...payload }),
    });
    return;
  }
  if (SLACK_WEBHOOK_URL) {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  // Board statuses for identifying "in-progress" columns (not first, not "done")
  const boardStatuses = await BoardStatus.find().sort({ order: 1 }).lean();
  const firstSlug = boardStatuses[0]?.slug;
  const inProgressSlugs = boardStatuses
    .filter((s) => s.slug !== firstSlug && s.slug !== "done")
    .map((s) => s.slug);

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

  // ── Build Slack Block Kit message ──
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalActive = backlogCount + inProgressTasks.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `Daily Digest — ${dateStr}`, emoji: true },
  });

  // Summary table
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Backlog*\n${backlogCount}` },
      { type: "mrkdwn", text: `*In Progress*\n${inProgressTasks.length}` },
      { type: "mrkdwn", text: `*Done*\n${doneCount}` },
      { type: "mrkdwn", text: `*Total Active*\n${totalActive}` },
      { type: "mrkdwn", text: `*Overdue*\n${overdueTasks.length}` },
      { type: "mrkdwn", text: `*Upcoming*\n${upcomingTasks.length}` },
    ],
  });

  blocks.push({ type: "divider" });

  // In-progress cards grouped by project
  if (inProgressTasks.length > 0) {
    const byProject: Record<string, typeof inProgressTasks> = {};
    for (const t of inProgressTasks) {
      const pid = String(t.projectId);
      if (!byProject[pid]) byProject[pid] = [];
      byProject[pid].push(t);
    }

    for (const [projectId, tasks] of Object.entries(byProject)) {
      const project = activeProjects.find((p) => String(p._id) === projectId);
      const projectName = project?.name || "Unknown";

      const rows = tasks.map((t) => {
        const cardNo = t.cardNumber ? `SP-${String(t.cardNumber).padStart(3, "0")}` : "";
        const status = statusLabelMap[t.status] || t.status;
        const priority = t.priority === "high" ? "!!!" : t.priority === "medium" ? "!!" : "!";
        const assignees = t.assignees?.length ? t.assignees.join(", ") : "—";
        const link = `<${APP_URL}/projects/${projectId}/cards/${t._id}|${t.title}>`;
        return `\`${cardNo}\`  ${link}\n      _${status}_  ·  ${priority}  ·  ${assignees}`;
      });

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<${APP_URL}/projects/${projectId}|${projectName}>*  ·  ${tasks.length} in progress\n\n${rows.join("\n\n")}`,
        },
      });
    }

    blocks.push({ type: "divider" });
  }

  // Overdue
  if (overdueTasks.length > 0) {
    const rows = overdueTasks.map((t) => {
      const d = new Date(t.deadline!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const cardNo = t.cardNumber ? `SP-${String(t.cardNumber).padStart(3, "0")}` : "";
      const assignees = t.assignees?.length ? t.assignees.join(", ") : "—";
      return `\`${cardNo}\`  <${APP_URL}/projects/${t.projectId}/cards/${t._id}|${t.title}>  ·  _due ${d}_  ·  ${assignees}`;
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Overdue (${overdueTasks.length})*\n\n${rows.join("\n")}`,
      },
    });

    blocks.push({ type: "divider" });
  }

  // Upcoming deadlines
  if (upcomingTasks.length > 0) {
    const rows = upcomingTasks.map((t) => {
      const d = new Date(t.deadline!).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const cardNo = t.cardNumber ? `SP-${String(t.cardNumber).padStart(3, "0")}` : "";
      const assignees = t.assignees?.length ? t.assignees.join(", ") : "—";
      return `\`${cardNo}\`  <${APP_URL}/projects/${t.projectId}/cards/${t._id}|${t.title}>  ·  _${d}_  ·  ${assignees}`;
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Upcoming Deadlines (next 3 days)*\n\n${rows.join("\n")}`,
      },
    });
  }

  // Fallback plain text
  const text = `Daily Digest — ${dateStr} | Backlog: ${backlogCount} | In Progress: ${inProgressTasks.length} | Done: ${doneCount} | Overdue: ${overdueTasks.length}`;

  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) {
    return NextResponse.json({ message: "Slack not configured", digest: text, blocks });
  }

  await postMessage(text, blocks);

  return NextResponse.json({
    sent: true,
    stats: { backlogCount, inProgress: inProgressTasks.length, doneCount },
    recurringCreated,
    overdue: overdueTasks.length,
    upcoming: upcomingTasks.length,
  });
}
