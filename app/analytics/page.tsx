"use client";
import { useEffect, useState } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
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

interface AnalyticsData {
  boardTimeStats: BoardTimeStat[];
  cardBreakdown: CardBreakdown[];
  memberStats: MemberStat[];
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set()
  );
  const [expandedCards, setExpandedCards] = useState(false);
  const [cardSort, setCardSort] = useState<"time" | "card">("time");

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
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

  // Compute summary stats
  const totalPipelineTime = data.boardTimeStats.reduce(
    (sum, s) => sum + s.totalMs,
    0
  );
  const avgCycleTime =
    data.cardBreakdown.length > 0
      ? data.cardBreakdown.reduce((sum, c) => sum + c.totalMs, 0) /
        data.cardBreakdown.length
      : 0;
  const slowestStage = data.boardTimeStats.reduce(
    (max, s) => (s.avgMs > max.avgMs ? s : max),
    data.boardTimeStats[0] || { label: "-", avgMs: 0, color: "#888" }
  );

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

      {/* Summary Stats */}
      {data.boardTimeStats.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-bg-card p-5">
            <p className="text-xs text-text-disabled mb-1">Avg cycle time</p>
            <p className="text-2xl font-semibold text-text-primary tracking-tight">
              {formatDuration(avgCycleTime)}
            </p>
          </div>
          <div className="rounded-2xl bg-bg-card p-5">
            <p className="text-xs text-text-disabled mb-1">Cards tracked</p>
            <p className="text-2xl font-semibold text-text-primary tracking-tight">
              {data.cardBreakdown.length}
            </p>
          </div>
          <div className="rounded-2xl bg-bg-card p-5">
            <p className="text-xs text-text-disabled mb-1">Slowest stage</p>
            <p className="text-2xl font-semibold tracking-tight" style={{ color: slowestStage.color }}>
              {slowestStage.label}
            </p>
            <p className="text-xs text-text-disabled mt-0.5">
              {formatDuration(slowestStage.avgMs)} avg
            </p>
          </div>
        </div>
      )}

      {/* Board Time Stats */}
      <div className="rounded-2xl bg-bg-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-text-secondary">
            Average Time Per Stage
          </h2>
          <span className="text-xs text-text-disabled">Excluding To Do</span>
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
                      {stat.cardCount} card{stat.cardCount !== 1 ? "s" : ""}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Member Time Stats */}
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
                            {card.cardNumber ? `SP-${card.cardNumber}` : ""}{" "}
                            {card.title}
                          </span>
                          <span className="text-text-primary font-medium whitespace-nowrap tabular-nums">
                            {formatDuration(card.durationMs)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-1.5 text-sm mt-1 pt-1.5" style={{ borderTop: '1px solid var(--hive-border-subtle)' }}>
                        <span className="text-text-disabled">Avg per card</span>
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

        {/* Card Breakdown */}
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
              No data yet. Cards will appear here once they move out of To Do.
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
                    {/* Stacked status bar */}
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
    </div>
  );
}
