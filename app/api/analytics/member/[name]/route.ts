export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth-helpers";
import { Member } from "@/models/Member";
import { Task } from "@/models/Task";
import { CardStatusDuration } from "@/models/CardStatusDuration";
import { MemberCardTime } from "@/models/MemberCardTime";
import { Activity } from "@/models/Activity";
import { BoardStatus } from "@/models/BoardStatus";
import { Project } from "@/models/Project";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);
  const now = Date.now();

  const [member, allStatuses, projects] = await Promise.all([
    Member.findOne({ name }).lean(),
    BoardStatus.find().sort({ order: 1 }).lean(),
    Project.find().select("name color").lean(),
  ]);

  const statusLabelMap: Record<string, { label: string; color: string }> = {};
  for (const s of allStatuses as any[])
    statusLabelMap[s.slug] = { label: s.label, color: s.color };

  const projectMap: Record<string, { name: string; color: string }> = {};
  for (const p of projects as any[])
    projectMap[String(p._id)] = { name: p.name, color: p.color };

  // Cards currently assigned to this member.
  const tasks = await Task.find({ assignees: name })
    .select("title cardNumber status priority projectId deadline archived createdAt")
    .lean();
  const taskIds = tasks.map((t: any) => t._id);

  // Time each of those cards spent in each status.
  const durations = await CardStatusDuration.find({
    taskId: { $in: taskIds },
  }).lean();
  const perTaskStatus: Record<string, Record<string, number>> = {};
  for (const d of durations as any[]) {
    const dur = d.exitedAt
      ? new Date(d.exitedAt).getTime() - new Date(d.enteredAt).getTime()
      : now - new Date(d.enteredAt).getTime();
    const k = String(d.taskId);
    (perTaskStatus[k] ||= {});
    perTaskStatus[k][d.status] = (perTaskStatus[k][d.status] || 0) + dur;
  }

  const timeInStatus: Record<string, number> = {};
  for (const k in perTaskStatus)
    for (const [st, ms] of Object.entries(perTaskStatus[k]))
      timeInStatus[st] = (timeInStatus[st] || 0) + ms;

  const open = tasks.filter(
    (t: any) => t.status !== "done" && !t.archived,
  );
  const completed = tasks.filter((t: any) => t.status === "done");

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const t of open as any[]) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  }

  const overdue = (open as any[]).filter(
    (t) => t.deadline && new Date(t.deadline).getTime() < now,
  ).length;

  // Total time this member has been assigned to cards.
  const mct = await MemberCardTime.find({ memberName: name }).lean();
  let assignmentTimeMs = 0;
  for (const e of mct as any[])
    assignmentTimeMs += e.unassignedAt
      ? new Date(e.unassignedAt).getTime() - new Date(e.assignedAt).getTime()
      : now - new Date(e.assignedAt).getTime();

  const cards = (tasks as any[])
    .map((t) => {
      const stt = perTaskStatus[String(t._id)] || {};
      const total = Object.values(stt).reduce((a, b) => a + b, 0);
      return {
        taskId: String(t._id),
        title: t.title,
        cardNumber: t.cardNumber,
        status: t.status,
        priority: t.priority,
        projectId: String(t.projectId),
        deadline: t.deadline || null,
        statusTimes: stt,
        totalMs: total,
        archived: !!t.archived,
      };
    })
    .sort((a, b) => b.totalMs - a.totalMs);

  // Average pipeline time of this member's completed cards.
  const completedDurations = (completed as any[])
    .map((t) =>
      Object.values(perTaskStatus[String(t._id)] || {}).reduce(
        (a, b) => a + b,
        0,
      ),
    )
    .filter((x) => x > 0);
  const avgCycleTimeMs = completedDurations.length
    ? Math.round(
        completedDurations.reduce((a, b) => a + b, 0) /
          completedDurations.length,
      )
    : 0;

  // Recent activity by this member.
  const activities = await Activity.find({ user: name })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  const recentActivity = (activities as any[]).map((a) => ({
    action: a.action,
    details: a.details,
    createdAt: a.createdAt,
    taskId: a.taskId ? String(a.taskId) : null,
    projectId: String(a.projectId),
  }));

  // Action breakdown over the last 30 days.
  const thirty = new Date(now - 30 * 86400000);
  const recentAll = await Activity.find({
    user: name,
    createdAt: { $gte: thirty },
  })
    .select("action")
    .lean();
  const activityByAction: Record<string, number> = {};
  for (const a of recentAll as any[])
    activityByAction[a.action] = (activityByAction[a.action] || 0) + 1;

  // Throughput: cards completed per week (last 8 weeks).
  const eightWeeks = new Date(now - 56 * 86400000);
  const weekly: Record<string, number> = {};
  for (const d of durations as any[]) {
    if (d.status !== "done") continue;
    const entered = new Date(d.enteredAt);
    if (entered < eightWeeks) continue;
    const wk = new Date(entered);
    const day = wk.getDay();
    wk.setDate(wk.getDate() + (day === 0 ? -6 : 1 - day));
    wk.setHours(0, 0, 0, 0);
    const key = wk.toISOString().slice(0, 10);
    weekly[key] = (weekly[key] || 0) + 1;
  }
  const throughput = Object.entries(weekly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  return NextResponse.json({
    member: member
      ? {
          name: (member as any).name,
          email: (member as any).email,
          role: (member as any).role,
          avatar: (member as any).avatar,
          slackUserId: (member as any).slackUserId,
        }
      : { name, email: "", role: "", avatar: "", slackUserId: "" },
    summary: {
      openCards: open.length,
      completedCards: completed.length,
      totalAssigned: tasks.length,
      highPriorityOpen: byPriority["high"] || 0,
      overdue,
      assignmentTimeMs,
      avgCycleTimeMs,
    },
    byStatus,
    byPriority,
    timeInStatus,
    cards,
    recentActivity,
    activityByAction,
    throughput,
    statusLabelMap,
    projectMap,
  });
}
