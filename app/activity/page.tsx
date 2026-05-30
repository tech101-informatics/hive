"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  ArrowRightLeft,
  MessageSquare,
  Flag,
  Tag,
  UserPlus,
  Clock,
  FileEdit,
  Trash2,
  FolderPlus,
  User,
  Zap,
  Calendar,
  X,
  LayoutGrid,
} from "lucide-react";

interface ActivityItem {
  _id: string;
  taskId?: string;
  projectId: string;
  user: string;
  action: string;
  details: string;
  createdAt: string;
}

interface Project {
  _id: string;
  name: string;
  color: string;
}

interface FilterSegmentProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: React.ReactNode;
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * One segment of the unified filter bar: a trigger styled to sit flush inside
 * the tray, plus an anchored popover panel. Closes on outside click / Escape.
 */
function FilterSegment({
  icon,
  label,
  active = false,
  badge,
  panelClassName,
  children,
}: FilterSegmentProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
          active
            ? "filter-btn-active"
            : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
        }`}
      >
        <span className={active ? "text-brand" : "text-text-disabled"}>
          {icon}
        </span>
        {label}
        {badge}
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${
            active ? "text-brand" : "text-text-disabled"
          } ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-2 origin-top-left rounded-xl border border-border-subtle bg-bg-card py-1.5 shadow-xl shadow-black/20 z-[60] animate-[filterPop_120ms_ease-out] ${
            panelClassName ?? "w-56"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const CountChip = ({ n }: { n: number }) => (
  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-brand px-1 text-[11px] font-semibold tabular-nums text-white">
    {n}
  </span>
);

const FilterCheckbox = ({ selected }: { selected: boolean }) => (
  <span
    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded transition-colors ${
      selected ? "bg-brand" : "bg-bg-base ring-1 ring-inset ring-border"
    }`}
  >
    {selected && (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2 5L4 7L8 3"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </span>
);

// ─── Date-range helpers ───────────────────────────────
function toISODate(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dateRangeSummary(from: string, to: string): string | null {
  if (from && to) return `${fmtDay(from)} – ${fmtDay(to)}`;
  if (from) return `From ${fmtDay(from)}`;
  if (to) return `Until ${fmtDay(to)}`;
  return null;
}

const ACTION_META: Record<string, { icon: any; label: string; color: string }> =
  {
    created_task: { icon: Plus, label: "Created", color: "text-success" },
    status_changed: {
      icon: ArrowRightLeft,
      label: "Status",
      color: "text-brand",
    },
    comment_added: {
      icon: MessageSquare,
      label: "Comment",
      color: "text-violet-500",
    },
    priority_changed: { icon: Flag, label: "Priority", color: "text-warning" },
    labels_changed: { icon: Tag, label: "Labels", color: "text-cyan-500" },
    assignees_changed: {
      icon: UserPlus,
      label: "Assigned",
      color: "text-blue-500",
    },
    time_logged: { icon: Clock, label: "Time", color: "text-emerald-500" },
    description_changed: {
      icon: FileEdit,
      label: "Edited",
      color: "text-text-secondary",
    },
    updated_task: {
      icon: FileEdit,
      label: "Updated",
      color: "text-text-secondary",
    },
    deleted_task: { icon: Trash2, label: "Deleted", color: "text-danger" },
    created_project: {
      icon: FolderPlus,
      label: "Board",
      color: "text-success",
    },
  };

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function groupByDate(items: ActivityItem[]): Record<string, ActivityItem[]> {
  const groups: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const d = new Date(item.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (d.toDateString() === today.toDateString()) key = "Today";
    else if (d.toDateString() === yesterday.toDateString()) key = "Yesterday";
    else
      key = d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });

    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

export default function ActivityPage() {
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProject, setSelectedProject] = useState("");
  const [filterUsers, setFilterUsers] = useState<string[]>([]);
  const [filterActions, setFilterActions] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedProject) params.set("projectId", selectedProject);
    if (filterUsers.length) params.set("users", filterUsers.join(","));
    if (filterActions.length) params.set("actions", filterActions.join(","));
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", String(page));
    fetch(`/api/activity?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setActivities(d.activities || []);
        setTotalPages(d.pages || 1);
        if (Array.isArray(d.users)) setUserOptions(d.users);
        setLoading(false);
      });
  }, [page, selectedProject, filterUsers, filterActions, dateFrom, dateTo]);

  const toggleUser = (name: string) => {
    setPage(1);
    setFilterUsers((prev) =>
      prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name],
    );
  };

  const toggleAction = (key: string) => {
    setPage(1);
    setFilterActions((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key],
    );
  };

  const clearAllFilters = () => {
    setPage(1);
    setSelectedProject("");
    setFilterUsers([]);
    setFilterActions([]);
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    !!selectedProject ||
    filterUsers.length > 0 ||
    filterActions.length > 0 ||
    !!dateFrom ||
    !!dateTo;

  if (authStatus === "loading") {
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

  const projectMap = new Map(projects.map((p) => [p._id, p]));
  const grouped = groupByDate(activities);
  const selectedProjectName = projectMap.get(selectedProject)?.name;
  const selectedProjectColor = projectMap.get(selectedProject)?.color;

  const datePresets = () => {
    const today = new Date();
    const shift = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return d;
    };
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return [
      { label: "Today", from: toISODate(today), to: toISODate(today) },
      { label: "7 days", from: toISODate(shift(6)), to: toISODate(today) },
      { label: "30 days", from: toISODate(shift(29)), to: toISODate(today) },
      {
        label: "This month",
        from: toISODate(monthStart),
        to: toISODate(today),
      },
    ];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Activity
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Timeline of all actions across boards
        </p>
      </div>

      {/* Unified filter bar */}
      <div className="flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-xl bg-bg-card p-1">
        {/* Board (single-select) */}
        <FilterSegment
          icon={
            selectedProjectColor ? (
              <span
                className="block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedProjectColor }}
              />
            ) : (
              <LayoutGrid size={13} />
            )
          }
          label={selectedProjectName ?? "All boards"}
          active={!!selectedProject}
          panelClassName="w-56 max-h-72 overflow-y-auto"
        >
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSelectedProject("");
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
              !selectedProject
                ? "filter-item-active"
                : "text-text-primary hover:bg-bg-surface"
            }`}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-text-disabled" />
            All boards
          </button>
          {projects.map((p) => {
            const selected = selectedProject === p._id;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setSelectedProject(p._id);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "filter-item-active"
                    : "text-text-primary hover:bg-bg-surface"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </FilterSegment>

        <span className="mx-0.5 h-5 w-px self-center bg-border-subtle" />

        {/* User (multi-select) */}
        <FilterSegment
          icon={<User size={13} />}
          label="User"
          active={filterUsers.length > 0}
          badge={
            filterUsers.length > 0 ? <CountChip n={filterUsers.length} /> : null
          }
          panelClassName="w-56 max-h-72 overflow-y-auto"
        >
          {filterUsers.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilterUsers([]);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:text-danger"
              >
                Clear selection
              </button>
              <div className="my-1 h-px bg-border-subtle" />
            </>
          )}
          {userOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-disabled">No users</p>
          ) : (
            userOptions.map((name) => {
              const selected = filterUsers.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleUser(name)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-surface ${
                    selected ? "text-brand" : "text-text-primary"
                  }`}
                >
                  <FilterCheckbox selected={selected} />
                  <span className="truncate">{name}</span>
                </button>
              );
            })
          )}
        </FilterSegment>

        {/* Action (multi-select) */}
        <FilterSegment
          icon={<Zap size={13} />}
          label="Action"
          active={filterActions.length > 0}
          badge={
            filterActions.length > 0 ? (
              <CountChip n={filterActions.length} />
            ) : null
          }
          panelClassName="w-56 max-h-72 overflow-y-auto"
        >
          {filterActions.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilterActions([]);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:text-danger"
              >
                Clear selection
              </button>
              <div className="my-1 h-px bg-border-subtle" />
            </>
          )}
          {Object.entries(ACTION_META).map(([key, m]) => {
            const selected = filterActions.includes(key);
            const Icon = m.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleAction(key)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-surface ${
                  selected ? "text-brand" : "text-text-primary"
                }`}
              >
                <FilterCheckbox selected={selected} />
                <Icon size={13} className={m.color} />
                {m.label}
              </button>
            );
          })}
        </FilterSegment>

        {/* Date range */}
        <FilterSegment
          icon={<Calendar size={13} />}
          label={dateRangeSummary(dateFrom, dateTo) ?? "Date"}
          active={!!dateFrom || !!dateTo}
          panelClassName="w-72"
        >
          <div className="px-3 py-1">
            <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border-subtle pb-3">
              {datePresets().map((p) => {
                const isActive = dateFrom === p.from && dateTo === p.to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setDateFrom(p.from);
                      setDateTo(p.to);
                    }}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      isActive
                        ? "filter-btn-active"
                        : "bg-bg-base text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                  From
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => {
                    setPage(1);
                    setDateFrom(e.target.value);
                  }}
                  className="w-full cursor-pointer rounded-lg border border-border bg-bg-base px-2.5 py-1.5 text-sm text-text-primary transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-subtle"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                  To
                </span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => {
                    setPage(1);
                    setDateTo(e.target.value);
                  }}
                  className="w-full cursor-pointer rounded-lg border border-border bg-bg-base px-2.5 py-1.5 text-sm text-text-primary transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-subtle"
                />
              </label>
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setDateFrom("");
                  setDateTo("");
                }}
                className="mt-2.5 w-full rounded-lg py-1.5 text-xs text-danger transition-colors hover:bg-danger-subtle"
              >
                Clear dates
              </button>
            )}
          </div>
        </FilterSegment>

        {hasActiveFilters && (
          <>
            <span className="mx-0.5 h-5 w-px self-center bg-border-subtle" />
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-danger-subtle hover:text-danger"
            >
              <X size={13} />
              Clear all
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 rounded-2xl bg-bg-card">
          <p className="text-text-disabled">No activity yet</p>
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h3 className="text-xs font-medium text-text-disabled uppercase tracking-wider mb-3 px-1">
                {dateLabel}
              </h3>
              <div className="rounded-2xl bg-bg-card overflow-hidden divide-y divide-bg-base">
                {items.map((item) => {
                  const meta = ACTION_META[item.action] || {
                    icon: FileEdit,
                    label: item.action,
                    color: "text-text-secondary",
                  };
                  const Icon = meta.icon;
                  const project = projectMap.get(item.projectId);

                  return (
                    <div
                      key={item._id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-bg-surface transition-colors"
                    >
                      <div
                        className={`mt-0.5 p-1.5 rounded-lg bg-bg-base flex-shrink-0 ${meta.color}`}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary">
                          <span className="font-medium">{item.user}</span>{" "}
                          <span className="text-text-secondary">
                            {item.details || meta.label}
                          </span>
                        </p>
                        {project && (
                          <p className="text-xs text-text-disabled mt-0.5 flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: project.color }}
                            />
                            {project.name}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-text-disabled whitespace-nowrap flex-shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-bg-card disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} className="text-text-secondary" />
              </button>
              <span className="text-sm text-text-secondary tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-bg-card disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} className="text-text-secondary" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
