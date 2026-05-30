"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  TrendingDown,
  Users,
  Timer,
  BarChart3,
  Zap,
  AlertTriangle,
} from "lucide-react";

// Deterministic avatar styling derived from a member's name.
const AVATAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#ef4444",
  "#f97316",
  "#3b82f6",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface BoardTimeStat {
  status: string;
  label: string;
  color: string;
  totalMs: number;
  cardCount: number;
  avgMs: number;
}

interface CardBreakdown {
  taskId: string;
  title: string;
  cardNumber?: number;
  currentStatus?: string;
  statusTimes: Record<string, number>;
  totalMs: number;
}

interface MemberCard {
  taskId: string;
  title: string;
  cardNumber?: number;
  durationMs: number;
}

interface MemberStat {
  memberName: string;
  totalMs: number;
  cardCount: number;
  avgMsPerCard: number;
  cards: MemberCard[];
}

interface BurndownDay {
  date: string;
  open: number;
  created: number;
  completed: number;
}

interface WorkloadEntry {
  memberName: string;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

interface CycleTimeWeek {
  week: string;
  avgMs: number;
  count: number;
}

interface AnalyticsData {
  boardTimeStats: BoardTimeStat[];
  cardBreakdown: CardBreakdown[];
  memberStats: MemberStat[];
  burndown: BurndownDay[];
  workload: WorkloadEntry[];
  cycleTimeTrend: CycleTimeWeek[];
  statusLabelMap: Record<string, { label: string; color: string }>;
}

interface Project {
  _id: string;
  name: string;
  color: string;
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

// Compact single-unit duration for dense heatmap cells (e.g. "2.1d", "5h").
function formatCompact(ms: number): string {
  if (ms <= 0) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = hours / 24;
  return days >= 10 ? `${Math.round(days)}d` : `${Math.round(days * 10) / 10}d`;
}

function formatDurationLong(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} days ${remHours}h` : `${days} days`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const openMember = (name: string) =>
    router.push(`/analytics/members/${encodeURIComponent(name)}`);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set()
  );
  const [expandedCards, setExpandedCards] = useState(false);
  const [cardSort, setCardSort] = useState<"time" | "card">("time");
  const [activeTab, setActiveTab] = useState<"overview" | "pipeline" | "team">(
    "overview"
  );

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((p) => setProjects(Array.isArray(p) ? p : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = selectedProject
      ? `/api/analytics?projectId=${selectedProject}`
      : "/api/analytics";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [selectedProject]);

  const toggleMember = (name: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">
          You don&apos;t have permission to access this page.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const maxBoardTime = Math.max(
    ...data.boardTimeStats.map((s) => s.avgMs),
    1
  );
  // Per-card time-in-each-status, keyed by taskId — joined into the member
  // breakdown so we can show how long each member's cards sat in each column.
  const taskStatusTimes = new Map<string, Record<string, number>>(
    data.cardBreakdown.map((c) => [c.taskId, c.statusTimes])
  );

  const sortedCards =
    cardSort === "time"
      ? [...data.cardBreakdown].sort((a, b) => b.totalMs - a.totalMs)
      : [...data.cardBreakdown].sort(
          (a, b) => (b.cardNumber || 0) - (a.cardNumber || 0)
        );
  const visibleCards = expandedCards ? sortedCards : sortedCards.slice(0, 10);

  // Summary stats
  const avgCycleTime =
    data.cardBreakdown.length > 0
      ? data.cardBreakdown.reduce((sum, c) => sum + c.totalMs, 0) /
        data.cardBreakdown.length
      : 0;
  const slowestStage = data.boardTimeStats.reduce(
    (max, s) => (s.avgMs > max.avgMs ? s : max),
    data.boardTimeStats[0] || { label: "-", avgMs: 0, color: "#888" }
  );

  // Burndown stats
  const burndownMax = Math.max(...data.burndown.map((d) => d.open), 1);
  const totalCreated30d = data.burndown.reduce((s, d) => s + d.created, 0);
  const totalCompleted30d = data.burndown.reduce(
    (s, d) => s + d.completed,
    0
  );
  const velocity = totalCompleted30d > 0 ? (totalCompleted30d / 30).toFixed(1) : "0";

  // Workload stats
  const totalOpenCards = data.workload.reduce((s, w) => s + w.total, 0);

  // Cycle time trend
  const maxCycleTime = Math.max(
    ...data.cycleTimeTrend.map((w) => w.avgMs),
    1
  );

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "pipeline" as const, label: "Pipeline", icon: Timer },
    { id: "team" as const, label: "Team", icon: Users },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            Analytics
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Development speed & team performance
          </p>
        </div>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-bg-card text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand appearance-none cursor-pointer pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b909a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-bg-card p-1 w-full md:w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-bg-base text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-bg-card p-5">
              <p className="text-xs text-text-disabled mb-1">Avg cycle time</p>
              <p className="text-2xl font-semibold text-text-primary tracking-tight">
                {formatDuration(avgCycleTime)}
              </p>
            </div>
            <div className="rounded-2xl bg-bg-card p-5">
              <p className="text-xs text-text-disabled mb-1">
                Velocity (30d)
              </p>
              <p className="text-2xl font-semibold text-text-primary tracking-tight">
                {velocity}
                <span className="text-sm text-text-disabled font-normal ml-1">
                  /day
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-bg-card p-5">
              <p className="text-xs text-text-disabled mb-1">Open cards</p>
              <p className="text-2xl font-semibold text-text-primary tracking-tight">
                {totalOpenCards}
              </p>
            </div>
            <div className="rounded-2xl bg-bg-card p-5">
              <p className="text-xs text-text-disabled mb-1">Slowest stage</p>
              <p
                className="text-2xl font-semibold tracking-tight"
                style={{ color: slowestStage.color }}
              >
                {slowestStage.label}
              </p>
              <p className="text-xs text-text-disabled mt-0.5">
                {formatDuration(slowestStage.avgMs)} avg
              </p>
            </div>
          </div>

          {/* Burndown Chart */}
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-medium text-text-secondary">
                  Burndown — Last 30 Days
                </h2>
                <p className="text-xs text-text-disabled mt-0.5">
                  {totalCreated30d} created, {totalCompleted30d} completed
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-disabled">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  Open cards
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  Completed
                </span>
              </div>
            </div>

            {data.burndown.length > 0 ? (
              <div className="relative">
                {/* Chart area */}
                <div className="flex items-end gap-px h-40">
                  {data.burndown.map((day, i) => {
                    const barHeight = (day.open / burndownMax) * 100;
                    const isToday = i === data.burndown.length - 1;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center justify-end relative group"
                      >
                        {/* Completed dots */}
                        {day.completed > 0 && (
                          <div className="absolute -top-1 w-2 h-2 rounded-full bg-success" />
                        )}
                        {/* Bar */}
                        <div
                          className={`w-full rounded-t transition-all ${
                            isToday ? "bg-brand" : "bg-brand/40"
                          }`}
                          style={{ height: `${Math.max(barHeight, 2)}%` }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-bg-surface rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                            <p className="font-medium text-text-primary">
                              {formatShortDate(day.date)}
                            </p>
                            <p className="text-text-secondary">
                              {day.open} open
                            </p>
                            {day.created > 0 && (
                              <p className="text-text-disabled">
                                +{day.created} created
                              </p>
                            )}
                            {day.completed > 0 && (
                              <p className="text-success">
                                -{day.completed} completed
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* X-axis labels */}
                <div className="flex justify-between mt-2 text-xs text-text-disabled">
                  <span>{formatShortDate(data.burndown[0].date)}</span>
                  <span>
                    {formatShortDate(
                      data.burndown[Math.floor(data.burndown.length / 2)]
                        .date
                    )}
                  </span>
                  <span>Today</span>
                </div>
              </div>
            ) : (
              <p className="text-text-disabled text-sm py-8 text-center">
                No data yet
              </p>
            )}
          </div>

          {/* Cycle Time Trend */}
          {data.cycleTimeTrend.length > 1 && (
            <div className="rounded-2xl bg-bg-card p-5">
              <h2 className="text-sm font-medium text-text-secondary mb-5">
                Cycle Time Trend — Weekly
              </h2>

              <div className="flex items-end gap-3 h-32">
                {data.cycleTimeTrend.map((week) => {
                  const barHeight = (week.avgMs / maxCycleTime) * 100;
                  return (
                    <div
                      key={week.week}
                      className="flex-1 flex flex-col items-center gap-1.5 group"
                    >
                      <span className="text-xs font-medium text-text-primary tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatDuration(week.avgMs)}
                      </span>
                      <div className="w-full flex-1 flex flex-col justify-end">
                        <div
                          className="w-full bg-violet-500/50 rounded-t transition-all group-hover:bg-violet-500/70"
                          style={{
                            height: `${Math.max(barHeight, 4)}%`,
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-text-disabled">
                          {formatWeekLabel(week.week)}
                        </p>
                        <p className="text-xs text-text-disabled">
                          {week.count} card{week.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PIPELINE TAB ── */}
      {activeTab === "pipeline" && (
        <>
          {/* Board Time Stats */}
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-text-secondary">
                Average Time Per Stage
              </h2>
              <span className="text-xs text-text-disabled">
                Excluding To Do
              </span>
            </div>

            {data.boardTimeStats.length === 0 ? (
              <p className="text-text-disabled text-sm py-4">
                No data yet. Move cards between columns to start tracking.
              </p>
            ) : (
              <div className="space-y-4">
                {data.boardTimeStats.map((stat) => (
                  <div key={stat.status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stat.color }}
                        />
                        <span className="text-sm text-text-primary">
                          {stat.label}
                        </span>
                        <span className="text-xs text-text-disabled">
                          {stat.cardCount} card
                          {stat.cardCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatDurationLong(stat.avgMs)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-base rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max((stat.avgMs / maxBoardTime) * 100, 2)}%`,
                          backgroundColor: stat.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-Card Breakdown */}
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-text-secondary">
                Per-Card Breakdown
              </h2>
              <button
                onClick={() =>
                  setCardSort(cardSort === "time" ? "card" : "time")
                }
                className="flex items-center gap-1 text-xs text-text-disabled hover:text-text-secondary transition-colors"
              >
                <ArrowUpDown size={12} />
                {cardSort === "time" ? "By time" : "By card #"}
              </button>
            </div>

            {data.cardBreakdown.length === 0 ? (
              <p className="text-text-disabled text-sm py-4">
                No data yet. Cards will appear here once they move out of To
                Do.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleCards.map((card) => (
                    <div
                      key={card.taskId}
                      className="px-3 py-2.5 rounded-xl bg-bg-base"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-text-primary font-medium truncate mr-3">
                          {card.cardNumber ? (
                            <span className="text-text-disabled mr-1.5 text-xs">
                              SP-{card.cardNumber}
                            </span>
                          ) : null}
                          {card.title}
                        </span>
                        <span className="text-sm font-semibold text-text-primary whitespace-nowrap tabular-nums">
                          {formatDuration(card.totalMs)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden flex">
                        {data.boardTimeStats.map((stat) => {
                          const time = card.statusTimes[stat.status] || 0;
                          if (time === 0) return null;
                          const pct = (time / card.totalMs) * 100;
                          return (
                            <div
                              key={stat.status}
                              className="h-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: stat.color,
                                opacity: 0.7,
                              }}
                              title={`${stat.label}: ${formatDuration(time)}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {data.boardTimeStats.map((stat) => {
                          const time = card.statusTimes[stat.status];
                          if (!time) return null;
                          return (
                            <span
                              key={stat.status}
                              className="text-xs text-text-disabled flex items-center gap-1"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ backgroundColor: stat.color }}
                              />
                              {stat.label}: {formatDuration(time)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {sortedCards.length > 10 && (
                  <button
                    onClick={() => setExpandedCards(!expandedCards)}
                    className="mt-3 text-sm text-brand hover:underline w-full text-center"
                  >
                    {expandedCards
                      ? "Show less"
                      : `Show all ${sortedCards.length} cards`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Legend */}
          {data.boardTimeStats.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap px-1">
              <span className="text-xs text-text-disabled">Legend</span>
              {data.boardTimeStats.map((stat) => (
                <span
                  key={stat.status}
                  className="flex items-center gap-1.5 text-xs text-text-secondary"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  {stat.label}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TEAM TAB ── */}
      {activeTab === "team" && (
        <>
          {/* Workload Distribution */}
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-text-secondary">
                Current Workload
              </h2>
              <span className="text-xs text-text-disabled">
                {totalOpenCards} open card
                {totalOpenCards !== 1 ? "s" : ""} across{" "}
                {data.workload.length} member
                {data.workload.length !== 1 ? "s" : ""}
              </span>
            </div>

            {data.workload.length === 0 ? (
              <p className="text-text-disabled text-sm py-4">
                No open cards assigned.
              </p>
            ) : (
              (() => {
                const assignedMembers = data.workload.filter(
                  (w) => w.memberName !== "Unassigned"
                );
                const avg =
                  assignedMembers.reduce((s, w) => s + w.total, 0) /
                  Math.max(assignedMembers.length, 1);

                // Columns: statuses holding at least one card, in board order.
                const present = new Set<string>();
                data.workload.forEach((w) =>
                  Object.keys(w.byStatus).forEach((s) => present.add(s))
                );
                const columns = Object.keys(data.statusLabelMap).filter((s) =>
                  present.has(s)
                );
                present.forEach((s) => {
                  if (!columns.includes(s)) columns.push(s);
                });

                const maxCell = Math.max(
                  1,
                  ...data.workload.flatMap((w) => Object.values(w.byStatus))
                );

                const tint = (color: string, value: number) =>
                  value <= 0
                    ? "transparent"
                    : `color-mix(in srgb, ${color} ${Math.round(
                        16 + (value / maxCell) * 64
                      )}%, transparent)`;

                return (
                  <div className="overflow-x-auto">
                    <table
                      className="w-full border-separate"
                      style={{ borderSpacing: "0 6px" }}
                    >
                      <thead>
                        <tr>
                          <th className="pb-1 pl-1 text-left text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                            Member
                          </th>
                          {columns.map((s) => {
                            const info = data.statusLabelMap[s];
                            return (
                              <th key={s} className="px-1 pb-1">
                                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-text-secondary">
                                  <span
                                    className="inline-block h-1.5 w-1.5 rounded-full"
                                    style={{
                                      backgroundColor: info?.color || "#64748b",
                                    }}
                                  />
                                  {info?.label || s}
                                </div>
                              </th>
                            );
                          })}
                          <th className="pb-1 pr-1 text-right text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.workload.map((member) => {
                          const isUnassigned =
                            member.memberName === "Unassigned";
                          const isOverloaded =
                            !isUnassigned && member.total > avg * 1.5;
                          const highCount = member.byPriority["high"] || 0;

                          return (
                            <tr key={member.memberName} className="group">
                              <td className="py-1 pr-3">
                                <div
                                  onClick={() =>
                                    !isUnassigned &&
                                    openMember(member.memberName)
                                  }
                                  className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors ${
                                    isUnassigned
                                      ? ""
                                      : "cursor-pointer group-hover:bg-bg-surface"
                                  }`}
                                >
                                  {isUnassigned ? (
                                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-border text-text-disabled">
                                      <Users size={12} />
                                    </span>
                                  ) : (
                                    <span
                                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                      style={{
                                        backgroundColor: avatarColor(
                                          member.memberName
                                        ),
                                      }}
                                    >
                                      {initials(member.memberName)}
                                    </span>
                                  )}
                                  <span
                                    className={`whitespace-nowrap text-sm font-medium ${
                                      isUnassigned
                                        ? "italic text-text-disabled"
                                        : "text-text-primary"
                                    }`}
                                  >
                                    {member.memberName}
                                  </span>
                                  {isOverloaded && (
                                    <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-warning-subtle px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                      <AlertTriangle size={9} />
                                      Heavy
                                    </span>
                                  )}
                                  {highCount > 0 && (
                                    <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-danger-subtle px-1.5 py-0.5 text-[10px] font-medium text-danger">
                                      <Zap size={9} />
                                      {highCount} high
                                    </span>
                                  )}
                                </div>
                              </td>
                              {columns.map((s) => {
                                const v = member.byStatus[s] || 0;
                                const info = data.statusLabelMap[s];
                                return (
                                  <td key={s} className="px-0.5">
                                    <div
                                      className="mx-auto min-w-[40px] rounded-md py-2 text-center text-[12px] font-medium tabular-nums"
                                      style={{
                                        backgroundColor: tint(
                                          info?.color || "#64748b",
                                          v
                                        ),
                                        color:
                                          v > 0
                                            ? "var(--hive-text-primary)"
                                            : "var(--hive-text-disabled)",
                                      }}
                                    >
                                      {v > 0 ? v : "·"}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="py-1 pl-3 pr-1 text-right">
                                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-text-primary">
                                  {member.total}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>

          {/* Time Per Member */}
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="mb-5">
              <h2 className="text-sm font-medium text-text-secondary">
                Time Per Member
              </h2>
              <p className="text-xs text-text-disabled mt-0.5">
                Hours each member&apos;s cards spent in each status. Click a row
                to break it down per card.
              </p>
            </div>

            {data.memberStats.length === 0 ? (
              <p className="text-text-disabled text-sm py-4">
                No data yet. Assign members to cards to start tracking.
              </p>
            ) : (
              (() => {
                // Per-member time-in-status aggregates.
                const memberRows = data.memberStats.map((member) => {
                  const agg: Record<string, number> = {};
                  for (const card of member.cards) {
                    const st = taskStatusTimes.get(card.taskId);
                    if (!st) continue;
                    for (const [status, ms] of Object.entries(st)) {
                      agg[status] = (agg[status] || 0) + ms;
                    }
                  }
                  const total = Object.values(agg).reduce((s, v) => s + v, 0);
                  return { member, agg, total };
                });

                // Columns: statuses that actually accrued time, in board order.
                const present = new Set<string>();
                memberRows.forEach((r) =>
                  Object.keys(r.agg).forEach((s) => present.add(s))
                );
                const columns = Object.keys(data.statusLabelMap).filter((s) =>
                  present.has(s)
                );
                present.forEach((s) => {
                  if (!columns.includes(s)) columns.push(s);
                });

                const maxCell = Math.max(
                  1,
                  ...memberRows.flatMap((r) => Object.values(r.agg))
                );
                memberRows.sort((a, b) => b.total - a.total);

                const tint = (color: string, value: number, max: number) =>
                  value <= 0
                    ? "transparent"
                    : `color-mix(in srgb, ${color} ${Math.round(
                        16 + (value / max) * 64
                      )}%, transparent)`;

                return (
                  <div className="overflow-x-auto">
                    <table
                      className="w-full border-separate"
                      style={{ borderSpacing: "0 6px" }}
                    >
                      <thead>
                        <tr>
                          <th className="pb-1 pl-1 text-left text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                            Member
                          </th>
                          {columns.map((s) => {
                            const info = data.statusLabelMap[s];
                            return (
                              <th key={s} className="px-1 pb-1">
                                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-text-secondary">
                                  <span
                                    className="inline-block h-1.5 w-1.5 rounded-full"
                                    style={{
                                      backgroundColor: info?.color || "#64748b",
                                    }}
                                  />
                                  {info?.label || s}
                                </div>
                              </th>
                            );
                          })}
                          <th className="pb-1 pr-1 text-right text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberRows.map(({ member, agg, total }) => {
                          const expanded = expandedMembers.has(
                            member.memberName
                          );
                          const cardRows = member.cards
                            .map((card) => {
                              const st = taskStatusTimes.get(card.taskId) || {};
                              const ctotal = Object.values(st).reduce(
                                (s, v) => s + v,
                                0
                              );
                              return { card, st, ctotal };
                            })
                            .filter((c) => c.ctotal > 0)
                            .sort((a, b) => b.ctotal - a.ctotal);
                          const cardMax = Math.max(
                            1,
                            ...cardRows.flatMap((c) => Object.values(c.st))
                          );

                          const out = [
                            <tr key={member.memberName} className="group">
                              <td className="py-1 pr-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleMember(member.memberName)
                                    }
                                    aria-label="Toggle card breakdown"
                                    className="flex-shrink-0 rounded p-0.5 text-text-disabled transition-colors hover:bg-bg-surface hover:text-text-secondary"
                                  >
                                    {expanded ? (
                                      <ChevronDown size={13} />
                                    ) : (
                                      <ChevronRight size={13} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMember(member.memberName)
                                    }
                                    className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-0.5 pr-2 transition-colors hover:bg-bg-surface"
                                  >
                                    <span
                                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                      style={{
                                        backgroundColor: avatarColor(
                                          member.memberName
                                        ),
                                      }}
                                    >
                                      {initials(member.memberName)}
                                    </span>
                                    <span className="whitespace-nowrap text-sm font-medium text-text-primary">
                                      {member.memberName}
                                    </span>
                                    <span className="text-[11px] text-text-disabled">
                                      {member.cardCount}
                                    </span>
                                  </button>
                                </div>
                              </td>
                              {columns.map((s) => {
                                const v = agg[s] || 0;
                                const info = data.statusLabelMap[s];
                                return (
                                  <td key={s} className="px-0.5">
                                    <div
                                      className="mx-auto min-w-[44px] rounded-md py-2 text-center text-[11px] tabular-nums"
                                      style={{
                                        backgroundColor: tint(
                                          info?.color || "#64748b",
                                          v,
                                          maxCell
                                        ),
                                        color:
                                          v > 0
                                            ? "var(--hive-text-primary)"
                                            : "var(--hive-text-disabled)",
                                      }}
                                    >
                                      {v > 0 ? formatCompact(v) : "·"}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="py-1 pl-3 pr-1 text-right">
                                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-text-primary">
                                  {total > 0 ? formatDuration(total) : "—"}
                                </span>
                              </td>
                            </tr>,
                          ];

                          if (expanded) {
                            cardRows.forEach(({ card, st, ctotal }, i) => {
                              out.push(
                                <tr key={`${card.taskId}-${i}`}>
                                  <td className="py-0.5 pl-10 pr-3">
                                    <span className="block max-w-[220px] truncate text-xs text-text-secondary">
                                      {card.cardNumber
                                        ? `SP-${card.cardNumber} `
                                        : ""}
                                      {card.title}
                                    </span>
                                  </td>
                                  {columns.map((s) => {
                                    const v =
                                      (st as Record<string, number>)[s] || 0;
                                    const info = data.statusLabelMap[s];
                                    return (
                                      <td key={s} className="px-0.5">
                                        <div
                                          className="mx-auto min-w-[44px] rounded py-1 text-center text-[10px] tabular-nums"
                                          style={{
                                            backgroundColor: tint(
                                              info?.color || "#64748b",
                                              v,
                                              cardMax
                                            ),
                                            color:
                                              v > 0
                                                ? "var(--hive-text-secondary)"
                                                : "var(--hive-text-disabled)",
                                          }}
                                        >
                                          {v > 0 ? formatCompact(v) : ""}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="py-0.5 pl-3 pr-1 text-right">
                                    <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary">
                                      {formatDuration(ctotal)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          }

                          return out;
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        </>
      )}
    </div>
  );
}
