"use client";
import { useEffect, useState } from "react";
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
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";

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
  const maxMemberTime = Math.max(
    ...data.memberStats.map((s) => s.totalMs),
    1
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
  const maxWorkload = Math.max(...data.workload.map((w) => w.total), 1);
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
              <div className="space-y-3">
                {data.workload.map((member) => {
                  const avg = totalOpenCards / Math.max(data.workload.filter(w => w.memberName !== "Unassigned").length, 1);
                  const isOverloaded = member.memberName !== "Unassigned" && member.total > avg * 1.5;
                  const highCount = member.byPriority["high"] || 0;

                  return (
                    <div key={member.memberName}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              member.memberName === "Unassigned"
                                ? "text-text-disabled italic"
                                : "text-text-primary"
                            }`}
                          >
                            {member.memberName}
                          </span>
                          {isOverloaded && (
                            <span className="text-xs text-warning flex items-center gap-1">
                              <AlertTriangle size={10} />
                              Heavy
                            </span>
                          )}
                          {highCount > 0 && (
                            <span className="text-xs text-danger flex items-center gap-1">
                              <Zap size={10} />
                              {highCount} high
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-text-primary tabular-nums">
                          {member.total} card
                          {member.total !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Stacked status bar */}
                      <div className="w-full h-3 rounded-full overflow-hidden flex bg-bg-base">
                        {Object.entries(member.byStatus).map(
                          ([status, count]) => {
                            const statusInfo = data.statusLabelMap[status];
                            const pct = (count / member.total) * 100;
                            return (
                              <div
                                key={status}
                                className="h-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor:
                                    statusInfo?.color || "#64748b",
                                  opacity: 0.7,
                                }}
                                title={`${statusInfo?.label || status}: ${count}`}
                              />
                            );
                          }
                        )}
                      </div>

                      {/* Status breakdown */}
                      <div className="flex gap-3 mt-1 flex-wrap">
                        {Object.entries(member.byStatus).map(
                          ([status, count]) => {
                            const statusInfo = data.statusLabelMap[status];
                            return (
                              <span
                                key={status}
                                className="text-xs text-text-disabled flex items-center gap-1"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full inline-block"
                                  style={{
                                    backgroundColor:
                                      statusInfo?.color || "#64748b",
                                  }}
                                />
                                {statusInfo?.label || status}: {count}
                              </span>
                            );
                          }
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Per Member */}
          <div className="rounded-2xl bg-bg-card p-5">
            <h2 className="text-sm font-medium text-text-secondary mb-5">
              Time Per Member
            </h2>

            {data.memberStats.length === 0 ? (
              <p className="text-text-disabled text-sm py-4">
                No data yet. Assign members to cards to start tracking.
              </p>
            ) : (
              <div className="space-y-3">
                {data.memberStats.map((member) => (
                  <div key={member.memberName}>
                    <button
                      onClick={() => toggleMember(member.memberName)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {expandedMembers.has(member.memberName) ? (
                            <ChevronDown
                              size={14}
                              className="text-text-disabled"
                            />
                          ) : (
                            <ChevronRight
                              size={14}
                              className="text-text-disabled"
                            />
                          )}
                          <span className="text-sm font-medium text-text-primary">
                            {member.memberName}
                          </span>
                          <span className="text-xs text-text-disabled">
                            {member.cardCount} card
                            {member.cardCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-text-primary tabular-nums">
                          {formatDuration(member.totalMs)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-bg-base rounded-full overflow-hidden ml-5">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-violet-500"
                          style={{
                            width: `${Math.max((member.totalMs / maxMemberTime) * 100, 2)}%`,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </button>

                    {expandedMembers.has(member.memberName) && (
                      <div className="mt-2 ml-5 space-y-1">
                        {member.cards.map((card, i) => (
                          <div
                            key={`${card.taskId}-${i}`}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-bg-base text-sm"
                          >
                            <span className="text-text-secondary truncate mr-3">
                              {card.cardNumber
                                ? `SP-${card.cardNumber}`
                                : ""}{" "}
                              {card.title}
                            </span>
                            <span className="text-text-primary font-medium whitespace-nowrap tabular-nums">
                              {formatDuration(card.durationMs)}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3 py-1.5 text-sm mt-1 pt-1.5 border-t border-bg-base">
                          <span className="text-text-disabled">
                            Avg per card
                          </span>
                          <span className="text-text-secondary font-medium tabular-nums">
                            {formatDuration(member.avgMsPerCard)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
