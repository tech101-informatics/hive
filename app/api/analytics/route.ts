export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CardStatusDuration } from "@/models/CardStatusDuration";
import { MemberCardTime } from "@/models/MemberCardTime";
import { Task } from "@/models/Task";
import { BoardStatus } from "@/models/BoardStatus";
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

  // --- Board Time Analytics ---
  const statusDurations = await CardStatusDuration.find(filter).lean();

  // Build per-status averages
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

  return NextResponse.json({
    boardTimeStats,
    cardBreakdown,
    memberStats,
  });
}
