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

  // Board statuses (column definitions)
  const boardStatuses = await BoardStatus.find().sort({ order: 1 }).lean();
  const statusLabelMap: Record<string, string> = {};
  for (const s of boardStatuses) statusLabelMap[s.slug] = s.label;

  // Active projects
  const activeProjects = await Project.find({ status: "active" }).lean();

  // Count cards per status per project (single aggregation)
  const statusCounts = await Task.aggregate([
    { $match: { archived: { $ne: true } } },
    { $group: { _id: { projectId: "$projectId", status: "$status" }, count: { $sum: 1 } } },
  ]);

  // Build a map: projectId -> { slug: count }
  const projectStatusMap: Record<string, Record<string, number>> = {};
  for (const row of statusCounts) {
    const pid = String(row._id.projectId);
    if (!projectStatusMap[pid]) projectStatusMap[pid] = {};
    projectStatusMap[pid][row._id.status] = row.count;
  }

  // Overall counts across all projects
  const overallCounts: Record<string, number> = {};
  for (const s of boardStatuses) overallCounts[s.slug] = 0;
  for (const row of statusCounts) {
    overallCounts[row._id.status] = (overallCounts[row._id.status] || 0) + row.count;
  }
  const totalCards = Object.values(overallCounts).reduce((a, b) => a + b, 0);

  // Overdue & upcoming — counts only
  const overdueCount = await Task.countDocuments({
    deadline: { $lt: today },
    status: { $nin: ["done", "completed"] },
    archived: { $ne: true },
  });
  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const upcomingCount = await Task.countDocuments({
    deadline: { $gte: today, $lte: in3Days },
    status: { $nin: ["done", "completed"] },
    archived: { $ne: true },
  });

  // ── Build Slack Block Kit message ──
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `Daily Digest — ${dateStr}`, emoji: true },
  });

  // Key metrics — compact row
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Total*\n${totalCards}` },
      { type: "mrkdwn", text: `*Overdue*\n${overdueCount}` },
    ],
  });

  blocks.push({ type: "divider" });

  // Per-project breakdown — one block per project, status counts inline
  for (const p of activeProjects) {
    const pid = String(p._id);
    const counts = projectStatusMap[pid] || {};
    const statusLine = boardStatuses
      .map((s) => `${s.label}: *${counts[s.slug] || 0}*`)
      .join("  ·  ");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${p.name}*\n${statusLine}`,
      },
    });
  }

  if (recurringCreated > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_${recurringCreated} recurring task${recurringCreated > 1 ? "s" : ""} created today_` }],
    });
  }

  // Fallback plain text
  const text = `Daily Digest — ${dateStr} | Total: ${totalCards} | Overdue: ${overdueCount} | Upcoming: ${upcomingCount}`;

  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) {
    return NextResponse.json({ message: "Slack not configured", digest: text, blocks });
  }

  await postMessage(text, blocks);

  return NextResponse.json({
    sent: true,
    totalCards,
    overdueCount,
    upcomingCount,
    recurringCreated,
  });
}
