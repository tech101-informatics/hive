export const dynamic = "force-dynamic";

import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { Member } from "@/models/Member";
import { BoardStatus } from "@/models/BoardStatus";
import { Activity } from "@/models/Activity";
import {
  FolderKanban,
  CheckSquare,
  Users,
  ArrowRight,
  Clock,
  AlertTriangle,
  CircleDot,
  Activity as ActivityIcon,
} from "lucide-react";

async function getDashboardData() {
  await connectDB();

  const boardStatuses = await BoardStatus.find().sort({ order: 1 }).lean();
  const doneSlug = "done";

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalBoards,
    totalCards,
    totalMembers,
    doneCards,
    completedThisWeek,
    overdueCount,
    statusCounts,
    priorityCounts,
    recentBoards,
    recentCards,
    upcomingDeadlines,
    recentActivities,
    taskCounts,
  ] = await Promise.all([
    Project.countDocuments(),
    Task.countDocuments({ archived: { $ne: true } }),
    Member.countDocuments(),
    Task.countDocuments({ status: doneSlug, archived: { $ne: true } }),
    Task.countDocuments({
      status: doneSlug,
      updatedAt: { $gte: weekAgo },
      archived: { $ne: true },
    }),
    Task.countDocuments({
      deadline: { $lt: now },
      status: { $ne: doneSlug },
      archived: { $ne: true },
    }),
    Task.aggregate([
      { $match: { archived: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { archived: { $ne: true } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    Project.find().sort({ createdAt: -1 }).limit(5).lean(),
    Task.find({ archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Task.find({
      deadline: { $gte: now, $lte: nextWeek },
      status: { $ne: doneSlug },
      archived: { $ne: true },
    })
      .sort({ deadline: 1 })
      .limit(5)
      .lean(),
    Activity.find().sort({ createdAt: -1 }).limit(8).lean(),
    Task.aggregate([
      { $match: { archived: { $ne: true } } },
      {
        $group: {
          _id: { projectId: "$projectId", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Build progress map for projects
  const progressMap: Record<string, { total: number; done: number }> = {};
  for (const tc of taskCounts) {
    const pid = String(tc._id.projectId);
    if (!progressMap[pid]) progressMap[pid] = { total: 0, done: 0 };
    progressMap[pid].total += tc.count;
    if (tc._id.status === doneSlug) progressMap[pid].done += tc.count;
  }

  // Build status distribution map
  const statusMap: Record<string, number> = {};
  for (const sc of statusCounts) {
    statusMap[sc._id] = sc.count;
  }

  // Build priority map
  const priorityMap: Record<string, number> = {};
  for (const pc of priorityCounts) {
    priorityMap[pc._id || "medium"] = pc.count;
  }

  return {
    totalBoards,
    totalCards,
    totalMembers,
    doneCards,
    completedThisWeek,
    overdueCount,
    boardStatuses,
    statusMap,
    priorityMap,
    recentBoards,
    recentCards,
    upcomingDeadlines,
    recentActivities,
    progressMap,
  };
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDeadline(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function Dashboard() {
  const data = await getDashboardData();

  const activeCards = data.totalCards - data.doneCards;
  const completionRate =
    data.totalCards > 0
      ? Math.round((data.doneCards / data.totalCards) * 100)
      : 0;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Dashboard
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/projects" className="group rounded-2xl bg-bg-card p-5 transition-all hover:bg-bg-surface">
          <div className="flex items-center justify-between mb-3">
            <FolderKanban size={18} className="text-text-disabled" />
            <ArrowRight
              size={14}
              className="text-text-disabled opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <p className="text-3xl font-semibold text-text-primary tracking-tight">
            {data.totalBoards}
          </p>
          <p className="text-xs text-text-secondary mt-1">Boards</p>
        </Link>

        <Link href="/projects" className="group rounded-2xl bg-bg-card p-5 transition-all hover:bg-bg-surface">
          <div className="flex items-center justify-between mb-3">
            <CheckSquare size={18} className="text-text-disabled" />
            <ArrowRight
              size={14}
              className="text-text-disabled opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <p className="text-3xl font-semibold text-text-primary tracking-tight">
            {activeCards}
          </p>
          <p className="text-xs text-text-secondary mt-1">Active cards</p>
        </Link>

        <div className="rounded-2xl bg-bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <CircleDot size={18} className="text-success" />
            <span className="text-xs text-success font-medium">
              +{data.completedThisWeek} this week
            </span>
          </div>
          <p className="text-3xl font-semibold text-text-primary tracking-tight">
            {completionRate}
            <span className="text-lg text-text-secondary font-normal">%</span>
          </p>
          <p className="text-xs text-text-secondary mt-1">Completion rate</p>
        </div>

        <Link href="/members" className="group rounded-2xl bg-bg-card p-5 transition-all hover:bg-bg-surface">
          <div className="flex items-center justify-between mb-3">
            <Users size={18} className="text-text-disabled" />
            <ArrowRight
              size={14}
              className="text-text-disabled opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <p className="text-3xl font-semibold text-text-primary tracking-tight">
            {data.totalMembers}
          </p>
          <p className="text-xs text-text-secondary mt-1">Team members</p>
        </Link>
      </div>

      {/* Pipeline + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Pipeline */}
        <div className="lg:col-span-2 rounded-2xl bg-bg-card p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">
            Pipeline
          </h2>
          <div className="space-y-3">
            {data.boardStatuses.map((status: any) => {
              const count = data.statusMap[status.slug] || 0;
              const pct =
                data.totalCards > 0
                  ? Math.round((count / data.totalCards) * 100)
                  : 0;
              return (
                <div key={status.slug} className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-sm text-text-primary w-28 truncate">
                    {status.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-bg-base overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                        backgroundColor: status.color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-sm text-text-secondary tabular-nums w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="rounded-2xl bg-bg-card p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">
            By Priority
          </h2>
          <div className="space-y-4">
            {[
              { key: "high", label: "High", color: "#f87171" },
              { key: "medium", label: "Medium", color: "#fbbf24" },
              { key: "low", label: "Low", color: "#34d399" },
            ].map((p) => {
              const count = data.priorityMap[p.key] || 0;
              return (
                <div key={p.key} className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm text-text-primary flex-1">
                    {p.label}
                  </span>
                  <span className="text-sm text-text-secondary tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {data.overdueCount > 0 && (
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--hive-border-subtle)' }}>
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle size={14} />
                <span className="text-sm font-medium">
                  {data.overdueCount} overdue
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boards + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Boards */}
        <div className="lg:col-span-2 rounded-2xl bg-bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text-secondary">
              Recent Boards
            </h2>
            <Link
              href="/projects"
              className="text-xs text-text-disabled hover:text-brand transition-colors"
            >
              View all
            </Link>
          </div>
          {data.recentBoards.length === 0 ? (
            <p className="text-text-disabled text-sm py-4">
              No boards yet.
            </p>
          ) : (
            <div className="space-y-1">
              {data.recentBoards.map((p: any) => {
                const pid = p._id.toString();
                const progress = data.progressMap[pid] || {
                  total: 0,
                  done: 0,
                };
                const pct =
                  progress.total > 0
                    ? Math.round((progress.done / progress.total) * 100)
                    : 0;
                return (
                  <Link
                    key={pid}
                    href={`/projects/${pid}`}
                    className="flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-xl hover:bg-bg-base transition-colors group"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded flex-shrink-0"
                      style={{ background: p.color }}
                    />
                    <span className="text-sm text-text-primary font-medium truncate flex-1 group-hover:text-brand transition-colors">
                      {p.name}
                    </span>
                    {progress.total > 0 && (
                      <div className="flex items-center gap-2.5 w-24 md:w-36">
                        <div className="flex-1 h-1.5 rounded-full bg-bg-base overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background:
                                pct === 100
                                  ? "var(--hive-success)"
                                  : "var(--hive-brand)",
                            }}
                          />
                        </div>
                        <span className="text-xs text-text-disabled tabular-nums">
                          {progress.done}/{progress.total}
                        </span>
                      </div>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === "active"
                          ? "bg-success-subtle text-success"
                          : p.status === "completed"
                            ? "bg-bg-base text-text-disabled"
                            : "bg-warning-subtle text-warning"
                      }`}
                    >
                      {p.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-2xl bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-text-disabled" />
            <h2 className="text-sm font-medium text-text-secondary">
              Upcoming Deadlines
            </h2>
          </div>
          {data.upcomingDeadlines.length === 0 ? (
            <p className="text-text-disabled text-sm py-4">
              No upcoming deadlines
            </p>
          ) : (
            <div className="space-y-3">
              {data.upcomingDeadlines.map((t: any) => {
                const isToday =
                  formatDeadline(t.deadline) === "Today";
                const isTomorrow =
                  formatDeadline(t.deadline) === "Tomorrow";
                return (
                  <div key={t._id.toString()} className="flex items-start gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        isToday
                          ? "bg-danger"
                          : isTomorrow
                            ? "bg-warning"
                            : "bg-text-disabled"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {t.title}
                      </p>
                      <p
                        className={`text-xs mt-0.5 ${
                          isToday
                            ? "text-danger"
                            : isTomorrow
                              ? "text-warning"
                              : "text-text-disabled"
                        }`}
                      >
                        {formatDeadline(t.deadline)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Cards + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Cards */}
        <div className="rounded-2xl bg-bg-card p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">
            Recent Cards
          </h2>
          {data.recentCards.length === 0 ? (
            <p className="text-text-disabled text-sm py-4">No cards yet.</p>
          ) : (
            <div className="space-y-1">
              {data.recentCards.map((t: any) => {
                const statusDef = data.boardStatuses.find(
                  (s: any) => s.slug === t.status
                );
                const statusColor = statusDef?.color || "#64748b";
                const statusLabel = statusDef?.label || t.status;
                return (
                  <div
                    key={t._id.toString()}
                    className="flex items-center gap-3 px-3 py-2 -mx-1 rounded-xl"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        t.priority === "high"
                          ? "bg-red-500"
                          : t.priority === "medium"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                    />
                    {t.cardNumber && (
                      <span className="text-xs text-text-disabled tabular-nums">
                        SP-{t.cardNumber}
                      </span>
                    )}
                    <span className="text-sm text-text-primary truncate flex-1">
                      {t.title}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{
                        backgroundColor: statusColor + "18",
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="rounded-2xl bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ActivityIcon size={14} className="text-text-disabled" />
            <h2 className="text-sm font-medium text-text-secondary">
              Activity
            </h2>
          </div>
          {data.recentActivities.length === 0 ? (
            <p className="text-text-disabled text-sm py-4">
              No activity yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentActivities.map((a: any) => (
                <div key={a._id.toString()} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-disabled mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">{a.user.split(" ")[0]}</span>
                      {" "}
                      <span className="text-text-secondary">
                        {formatActionLabel(a.action).toLowerCase()}
                      </span>
                      {a.details && (
                        <span className="text-text-secondary">
                          {" "}&mdash; {a.details}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-disabled mt-0.5">
                      {formatRelativeTime(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
