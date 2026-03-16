export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CardStatusDuration } from "@/models/CardStatusDuration";
import { MemberCardTime } from "@/models/MemberCardTime";
import { Task } from "@/models/Task";
import { BoardStatus } from "@/models/BoardStatus";
import { Activity } from "@/models/Activity";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const filter: Record<string, unknown> = {};
  if (projectId) filter.projectId = projectId;

  const now = new Date();

  // Get all board statuses (except todo)
  const statuses = await BoardStatus.find({ slug: { $ne: "todo" } }).sort({ order: 1 }).lean();
  const allStatuses = await BoardStatus.find().sort({ order: 1 }).lean();

  // --- Board Time Analytics ---
  const statusDurations = await CardStatusDuration.find(filter).lean();

  const statusTimeMap: Record<string, { totalMs: number; count: number; entries: Array<{ taskId: string; durationMs: number }> }> = {};
  for (const entry of statusDurations) {
    const dur = entry.exitedAt
      ? new Date(entry.exitedAt).getTime() - new Date(entry.enteredAt).getTime()
      : now.getTime() - new Date(entry.enteredAt).getTime();

    if (!statusTimeMap[entry.status]) {
      statusTimeMap[entry.status] = { totalMs: 0, count: 0, entries: [] };
    }
    statusTimeMap[entry.status].totalMs += dur;
    statusTimeMap[entry.status].count += 1;
    statusTimeMap[entry.status].entries.push({
      taskId: String(entry.taskId),
      durationMs: dur,
    });
  }

  const boardTimeStats = statuses.map((s) => {
    const data = statusTimeMap[s.slug];
    return {
      status: s.slug,
      label: s.label,
      color: s.color,
      totalMs: data?.totalMs || 0,
      cardCount: data?.count || 0,
      avgMs: data ? Math.round(data.totalMs / data.count) : 0,
    };
  });

  // --- Per-Card Time Breakdown ---
  const taskIds = Array.from(new Set(statusDurations.map((d) => String(d.taskId))));
  const tasks = await Task.find({ _id: { $in: taskIds } })
    .select("title cardNumber status projectId")
    .lean();
  const taskMap = new Map(tasks.map((t: any) => [String(t._id), t]));

  const cardBreakdown = taskIds.map((taskId) => {
    const task = taskMap.get(taskId);
    const entries = statusDurations.filter((d) => String(d.taskId) === taskId);
    const statusTimes: Record<string, number> = {};
    let totalMs = 0;
    for (const entry of entries) {
      const dur = entry.exitedAt
        ? new Date(entry.exitedAt).getTime() - new Date(entry.enteredAt).getTime()
        : now.getTime() - new Date(entry.enteredAt).getTime();
      statusTimes[entry.status] = (statusTimes[entry.status] || 0) + dur;
      totalMs += dur;
    }
    return {
      taskId,
      title: task?.title || "Unknown",
      cardNumber: task?.cardNumber,
      currentStatus: task?.status,
      statusTimes,
      totalMs,
    };
  }).sort((a, b) => b.totalMs - a.totalMs);

  // --- Member Time Analytics ---
  const memberEntries = await MemberCardTime.find(filter).lean();

  const memberTimeMap: Record<string, { totalMs: number; cardCount: number; cards: Array<{ taskId: string; title: string; cardNumber?: number; durationMs: number }> }> = {};
  for (const entry of memberEntries) {
    const dur = entry.unassignedAt
      ? new Date(entry.unassignedAt).getTime() - new Date(entry.assignedAt).getTime()
      : now.getTime() - new Date(entry.assignedAt).getTime();

    const name = entry.memberName;
    if (!memberTimeMap[name]) {
      memberTimeMap[name] = { totalMs: 0, cardCount: 0, cards: [] };
    }
    memberTimeMap[name].totalMs += dur;
    memberTimeMap[name].cardCount += 1;
    const task = taskMap.get(String(entry.taskId));
    memberTimeMap[name].cards.push({
      taskId: String(entry.taskId),
      title: task?.title || "Unknown",
      cardNumber: task?.cardNumber,
      durationMs: dur,
    });
  }

  const memberStats = Object.entries(memberTimeMap)
    .map(([name, data]) => ({
      memberName: name,
      totalMs: data.totalMs,
      cardCount: data.cardCount,
      avgMsPerCard: data.cardCount > 0 ? Math.round(data.totalMs / data.cardCount) : 0,
      cards: data.cards.sort((a, b) => b.durationMs - a.durationMs),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  // --- Burndown (last 30 days) ---
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const activityFilter: Record<string, unknown> = {
    createdAt: { $gte: thirtyDaysAgo },
  };
  if (projectId) activityFilter.projectId = projectId;

  const recentActivities = await Activity.find(activityFilter)
    .sort({ createdAt: 1 })
    .lean();

  // Count total open cards at start of window
  const taskFilter: Record<string, unknown> = {
    archived: { $ne: true },
  };
  if (projectId) taskFilter.projectId = projectId;

  const totalCardsNow = await Task.countDocuments(taskFilter);
  const doneCardsNow = await Task.countDocuments({ ...taskFilter, status: "done" });

  // Reconstruct daily created/completed from activity logs
  const burndownDays: Array<{ date: string; created: number; completed: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const dayStr = d.toISOString().slice(0, 10);
    const dayActivities = recentActivities.filter((a) => {
      const t = new Date(a.createdAt).getTime();
      return t >= d.getTime() && t < nextD.getTime();
    });

    const created = dayActivities.filter((a) => a.action === "created_task").length;
    const completed = dayActivities.filter(
      (a) => a.action === "status_changed" && a.details?.includes('"done"'),
    ).length;

    burndownDays.push({ date: dayStr, created, completed });
  }

  // Compute running open count working backwards from current state
  const openNow = totalCardsNow - doneCardsNow;
  let runningOpen = openNow;
  const burndown: Array<{ date: string; open: number; created: number; completed: number }> = [];

  // Walk backwards to reconstruct
  const reverseDays = [...burndownDays].reverse();
  const openCounts: number[] = [];
  for (const day of reverseDays) {
    openCounts.unshift(runningOpen);
    // Reverse the day's effect: undo created (+1 open) and undo completed (-1 open)
    runningOpen = runningOpen - day.created + day.completed;
  }

  for (let i = 0; i < burndownDays.length; i++) {
    burndown.push({
      ...burndownDays[i],
      open: openCounts[i],
    });
  }

  // --- Workload Distribution ---
  const openTasks = await Task.find({
    ...taskFilter,
    status: { $ne: "done" },
  })
    .select("assignees status priority")
    .lean();

  const statusLabelMap: Record<string, { label: string; color: string }> = {};
  for (const s of allStatuses) {
    statusLabelMap[s.slug] = { label: s.label, color: s.color };
  }

  const workloadMap: Record<string, { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }> = {};
  for (const task of openTasks) {
    const assignees = task.assignees?.length ? task.assignees : ["Unassigned"];
    for (const name of assignees) {
      if (!workloadMap[name]) {
        workloadMap[name] = { total: 0, byStatus: {}, byPriority: {} };
      }
      workloadMap[name].total += 1;
      workloadMap[name].byStatus[task.status] = (workloadMap[name].byStatus[task.status] || 0) + 1;
      workloadMap[name].byPriority[task.priority] = (workloadMap[name].byPriority[task.priority] || 0) + 1;
    }
  }

  const workload = Object.entries(workloadMap)
    .map(([name, data]) => ({
      memberName: name,
      total: data.total,
      byStatus: data.byStatus,
      byPriority: data.byPriority,
    }))
    .sort((a, b) => b.total - a.total);

  // --- Cycle Time Trend (last 8 weeks) ---
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  // Find cards that reached "done" in the last 8 weeks
  const doneEntries = await CardStatusDuration.find({
    ...filter,
    status: "done",
    enteredAt: { $gte: eightWeeksAgo },
  }).lean();

  // For each done card, compute total pipeline time
  const doneTaskIds = Array.from(new Set(doneEntries.map((d) => String(d.taskId))));
  const allDoneCardDurations = await CardStatusDuration.find({
    taskId: { $in: doneTaskIds },
    ...(projectId ? { projectId } : {}),
  }).lean();

  // Group cycle times by week
  const weeklyMap: Record<string, number[]> = {};
  for (const doneEntry of doneEntries) {
    const taskId = String(doneEntry.taskId);
    const enteredDone = new Date(doneEntry.enteredAt);

    // Week label (Monday-based)
    const weekStart = new Date(enteredDone);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    const weekKey = weekStart.toISOString().slice(0, 10);

    // Total pipeline time for this card
    const cardEntries = allDoneCardDurations.filter((d) => String(d.taskId) === taskId && d.status !== "todo");
    let totalMs = 0;
    for (const e of cardEntries) {
      const dur = e.exitedAt
        ? new Date(e.exitedAt).getTime() - new Date(e.enteredAt).getTime()
        : now.getTime() - new Date(e.enteredAt).getTime();
      totalMs += dur;
    }

    if (!weeklyMap[weekKey]) weeklyMap[weekKey] = [];
    weeklyMap[weekKey].push(totalMs);
  }

  const cycleTimeTrend = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, times]) => ({
      week,
      avgMs: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
      count: times.length,
    }));

  return NextResponse.json({
    boardTimeStats,
    cardBreakdown,
    memberStats,
    burndown,
    workload,
    cycleTimeTrend,
    statusLabelMap,
  });
}
