"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  X,
  LayoutGrid,
  CheckCircle2,
  Flame,
  AlertCircle,
  Clock,
  Timer,
  Plus,
  ArrowRightLeft,
  MessageSquare,
  Flag,
  Tag,
  UserPlus,
  FileEdit,
  Trash2,
  FolderPlus,
  Mail,
  ExternalLink,
} from "lucide-react";

const AVATAR_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899",
  "#8b5cf6", "#14b8a6", "#ef4444", "#f97316", "#3b82f6",
];
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h < 24) return min > 0 ? `${h}h ${min}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}
function formatCompact(ms: number): string {
  if (ms <= 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = h / 24;
  return d >= 10 ? `${Math.round(d)}d` : `${Math.round(d * 10) / 10}d`;
}
function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ACTION_META: Record<string, { icon: any; label: string; color: string }> = {
  created_task: { icon: Plus, label: "Created", color: "text-success" },
  status_changed: { icon: ArrowRightLeft, label: "Status", color: "text-brand" },
  comment_added: { icon: MessageSquare, label: "Comment", color: "text-violet-500" },
  priority_changed: { icon: Flag, label: "Priority", color: "text-warning" },
  labels_changed: { icon: Tag, label: "Labels", color: "text-cyan-500" },
  assignees_changed: { icon: UserPlus, label: "Assigned", color: "text-blue-500" },
  time_logged: { icon: Clock, label: "Time", color: "text-emerald-500" },
  description_changed: { icon: FileEdit, label: "Edited", color: "text-text-secondary" },
  updated_task: { icon: FileEdit, label: "Updated", color: "text-text-secondary" },
  deleted_task: { icon: Trash2, label: "Deleted", color: "text-danger" },
  created_project: { icon: FolderPlus, label: "Board", color: "text-success" },
};

const PRIORITY = {
  high: { label: "High", color: "#f87171" },
  medium: { label: "Medium", color: "#fbbf24" },
  low: { label: "Low", color: "#8b909a" },
};

interface MemberData {
  member: { name: string; email: string; role: string; avatar: string; slackUserId: string };
  summary: {
    openCards: number;
    completedCards: number;
    totalAssigned: number;
    highPriorityOpen: number;
    overdue: number;
    assignmentTimeMs: number;
    avgCycleTimeMs: number;
  };
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  timeInStatus: Record<string, number>;
  cards: Array<{
    taskId: string;
    title: string;
    cardNumber?: number;
    status: string;
    priority: string;
    projectId: string;
    deadline: string | null;
    statusTimes: Record<string, number>;
    totalMs: number;
    archived: boolean;
  }>;
  recentActivity: Array<{
    action: string;
    details?: string;
    createdAt: string;
    taskId: string | null;
    projectId: string;
  }>;
  activityByAction: Record<string, number>;
  throughput: Array<{ week: string; count: number }>;
  statusLabelMap: Record<string, { label: string; color: string }>;
  projectMap: Record<string, { name: string; color: string }>;
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "text-text-primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-bg-base p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-disabled">
        <Icon size={12} />
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-text-disabled">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {meta && <span className="text-xs text-text-disabled">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function StackedBar({
  segments,
  labelMap,
  format,
}: {
  segments: Array<[string, number]>;
  labelMap: Record<string, { label: string; color: string }>;
  format: (n: number) => string;
}) {
  const total = segments.reduce((s, [, v]) => s + v, 0);
  if (total === 0)
    return <p className="text-xs text-text-disabled">No data yet.</p>;
  return (
    <>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg-base">
        {segments.map(([k, v]) => (
          <div
            key={k}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(v / total) * 100}%`,
              backgroundColor: labelMap[k]?.color || "#64748b",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map(([k, v]) => (
          <span
            key={k}
            className="flex items-center gap-1.5 text-[11px] text-text-disabled"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: labelMap[k]?.color || "#64748b" }}
            />
            {labelMap[k]?.label || k}
            <span className="font-medium text-text-secondary tabular-nums">
              {format(v)}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

export function MemberDetailModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
    fetch(`/api/analytics/member/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d?.error ? null : d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [name]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusSegs = data
    ? Object.entries(data.byStatus).sort((a, b) => b[1] - a[1])
    : [];
  const timeSegs = data
    ? Object.entries(data.timeInStatus).sort((a, b) => b[1] - a[1])
    : [];
  const maxWeek = data
    ? Math.max(1, ...data.throughput.map((w) => w.count))
    : 1;

  const openCard = (projectId: string, taskId: string) =>
    router.push(`/projects/${projectId}/cards/${taskId}`);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />
      <div
        className={`fixed inset-0 z-50 flex flex-col bg-bg-surface shadow-2xl transition-all duration-200 md:inset-4 md:rounded-2xl lg:inset-8 ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border bg-bg-card px-5 py-3 md:rounded-t-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: avatarColor(name) }}
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold text-text-primary">
                  {name}
                </h2>
                {data?.member?.role && (
                  <span className="rounded-md bg-bg-base px-1.5 py-0.5 text-[11px] text-text-secondary">
                    {data.member.role}
                  </span>
                )}
              </div>
              {data?.member?.email && (
                <div className="flex items-center gap-1 text-xs text-text-disabled">
                  <Mail size={11} />
                  {data.member.email}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 transition-colors hover:bg-bg-surface"
          >
            <X size={18} className="text-text-disabled" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-brand" size={28} />
            </div>
          ) : !data ? (
            <div className="py-20 text-center text-text-secondary">
              Couldn&apos;t load analytics for this member.
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-5">
              {/* Summary tiles */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatTile
                  label="Open"
                  value={data.summary.openCards}
                  icon={LayoutGrid}
                />
                <StatTile
                  label="Completed"
                  value={data.summary.completedCards}
                  icon={CheckCircle2}
                  tone="text-success"
                />
                <StatTile
                  label="High prio"
                  value={data.summary.highPriorityOpen}
                  icon={Flame}
                  tone={
                    data.summary.highPriorityOpen > 0
                      ? "text-danger"
                      : "text-text-primary"
                  }
                />
                <StatTile
                  label="Overdue"
                  value={data.summary.overdue}
                  icon={AlertCircle}
                  tone={
                    data.summary.overdue > 0 ? "text-danger" : "text-text-primary"
                  }
                />
                <StatTile
                  label="Assigned"
                  value={formatDuration(data.summary.assignmentTimeMs)}
                  icon={Clock}
                />
                <StatTile
                  label="Avg cycle"
                  value={
                    data.summary.avgCycleTimeMs
                      ? formatDuration(data.summary.avgCycleTimeMs)
                      : "—"
                  }
                  sub="completed cards"
                  icon={Timer}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Workload by status */}
                <Section
                  title="Open cards by status"
                  meta={`${data.summary.openCards} open`}
                >
                  <StackedBar
                    segments={statusSegs}
                    labelMap={data.statusLabelMap}
                    format={(n) => String(n)}
                  />
                </Section>

                {/* Time in status */}
                <Section title="Time in each status">
                  <StackedBar
                    segments={timeSegs}
                    labelMap={data.statusLabelMap}
                    format={formatCompact}
                  />
                </Section>
              </div>

              {/* Priority + Throughput */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Open priority mix">
                  {Object.keys(data.byPriority).length === 0 ? (
                    <p className="text-xs text-text-disabled">No open cards.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(["high", "medium", "low"] as const).map((p) => {
                        const count = data.byPriority[p] || 0;
                        const total = data.summary.openCards || 1;
                        return (
                          <div key={p} className="flex items-center gap-3">
                            <span className="w-14 text-xs text-text-secondary">
                              {PRIORITY[p].label}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-base">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(count / total) * 100}%`,
                                  backgroundColor: PRIORITY[p].color,
                                }}
                              />
                            </div>
                            <span className="w-6 text-right text-xs font-medium tabular-nums text-text-secondary">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>

                <Section
                  title="Throughput"
                  meta="cards done · last 8 weeks"
                >
                  {data.throughput.length === 0 ? (
                    <p className="text-xs text-text-disabled">
                      No cards completed recently.
                    </p>
                  ) : (
                    <div className="flex h-24 items-end gap-1.5">
                      {data.throughput.map((w) => (
                        <div
                          key={w.week}
                          className="group flex flex-1 flex-col items-center gap-1"
                          title={`Week of ${w.week}: ${w.count}`}
                        >
                          <span className="text-[10px] tabular-nums text-text-disabled">
                            {w.count}
                          </span>
                          <div
                            className="w-full rounded-t bg-brand transition-all"
                            style={{
                              height: `${Math.max((w.count / maxWeek) * 72, 4)}px`,
                            }}
                          />
                          <span className="text-[9px] text-text-disabled">
                            {new Date(w.week).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              {/* Assigned cards */}
              <Section
                title="Assigned cards"
                meta={`${data.cards.length} total`}
              >
                {data.cards.length === 0 ? (
                  <p className="text-xs text-text-disabled">No assigned cards.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.cards.map((c) => {
                      const sInfo = data.statusLabelMap[c.status];
                      const proj = data.projectMap[c.projectId];
                      const overdue =
                        c.deadline &&
                        c.status !== "done" &&
                        new Date(c.deadline).getTime() < Date.now();
                      return (
                        <button
                          key={c.taskId}
                          onClick={() => openCard(c.projectId, c.taskId)}
                          className="group flex w-full items-center gap-3 rounded-lg bg-bg-base px-3 py-2 text-left transition-colors hover:bg-bg-surface"
                        >
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                PRIORITY[c.priority as keyof typeof PRIORITY]
                                  ?.color || "#8b909a",
                            }}
                            title={`${c.priority} priority`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                            {c.cardNumber ? (
                              <span className="text-text-disabled">
                                SP-{c.cardNumber}{" "}
                              </span>
                            ) : null}
                            {c.title}
                          </span>
                          {proj && (
                            <span className="hidden items-center gap-1 text-[11px] text-text-disabled sm:flex">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: proj.color }}
                              />
                              {proj.name}
                            </span>
                          )}
                          {overdue && (
                            <span className="flex-shrink-0 rounded bg-danger-subtle px-1.5 py-0.5 text-[10px] font-medium text-danger">
                              Overdue
                            </span>
                          )}
                          {sInfo && (
                            <span
                              className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${sInfo.color} 18%, transparent)`,
                                color: sInfo.color,
                              }}
                            >
                              {sInfo.label}
                            </span>
                          )}
                          {c.totalMs > 0 && (
                            <span className="hidden w-12 flex-shrink-0 text-right text-xs tabular-nums text-text-secondary md:block">
                              {formatCompact(c.totalMs)}
                            </span>
                          )}
                          <ExternalLink
                            size={13}
                            className="flex-shrink-0 text-text-disabled opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Activity */}
              <Section
                title="Recent activity"
                meta={
                  Object.values(data.activityByAction).reduce((a, b) => a + b, 0)
                    ? `${Object.values(data.activityByAction).reduce(
                        (a, b) => a + b,
                        0,
                      )} actions · 30d`
                    : undefined
                }
              >
                {Object.keys(data.activityByAction).length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {Object.entries(data.activityByAction)
                      .sort((a, b) => b[1] - a[1])
                      .map(([action, count]) => {
                        const meta = ACTION_META[action] || {
                          icon: FileEdit,
                          label: action,
                          color: "text-text-secondary",
                        };
                        const Icon = meta.icon;
                        return (
                          <span
                            key={action}
                            className="flex items-center gap-1.5 rounded-lg bg-bg-base px-2.5 py-1 text-xs text-text-secondary"
                          >
                            <Icon size={12} className={meta.color} />
                            {meta.label}
                            <span className="font-semibold tabular-nums text-text-primary">
                              {count}
                            </span>
                          </span>
                        );
                      })}
                  </div>
                )}
                {data.recentActivity.length === 0 ? (
                  <p className="text-xs text-text-disabled">No activity yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.recentActivity.map((a, i) => {
                      const meta = ACTION_META[a.action] || {
                        icon: FileEdit,
                        label: a.action,
                        color: "text-text-secondary",
                      };
                      const Icon = meta.icon;
                      const proj = data.projectMap[a.projectId];
                      return (
                        <div key={i} className="flex items-start gap-2.5">
                          <div
                            className={`mt-0.5 rounded-md bg-bg-base p-1.5 ${meta.color}`}
                          >
                            <Icon size={12} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text-secondary">
                              {a.details || meta.label}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-text-disabled">
                              {relTime(a.createdAt)}
                              {proj && (
                                <>
                                  <span>·</span>
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: proj.color }}
                                  />
                                  {proj.name}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
