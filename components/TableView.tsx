"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Flag,
  Calendar,
  ArrowUpDown,
  Ban,
  MessageSquare,
  Archive,
  Trash2,
  ArrowRightLeft,
  X,
} from "lucide-react";

interface Task {
  _id: string;
  title: string;
  status: string;
  priority: "low" | "medium" | "high";
  assignees: string[];
  deadline?: string;
  labels?: string[];
  blockedBy?: string[];
  cardNumber?: number;
  commentCount?: number;
}

interface BoardColumn {
  _id: string;
  slug: string;
  label: string;
  color: string;
}

interface MemberInfo {
  _id: string;
  name: string;
  avatar?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-danger bg-danger-subtle",
  medium: "text-warning bg-warning-subtle",
  low: "text-success bg-success-subtle",
};

type SortKey = "cardNumber" | "title" | "status" | "priority" | "deadline" | "assignees";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function TableView({
  tasks,
  columns,
  members,
  onTaskUpdated,
  onArchive,
}: {
  tasks: Task[];
  columns: BoardColumn[];
  members: MemberInfo[];
  onTaskUpdated?: () => void;
  onArchive?: (taskIds: string[], titles: string[]) => void;
}) {
  const router = useRouter();
  const { id: projectId } = useParams();
  const [sortKey, setSortKey] = useState<SortKey>("cardNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatusMenu, setBulkStatusMenu] = useState(false);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === tasks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tasks.map((t) => t._id)));
    }
  };

  const bulkArchive = async () => {
    const ids = Array.from(selected);
    const titles = ids.map((id) => tasks.find((t) => t._id === id)?.title || "Card");
    for (const id of ids) {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
    }
    setSelected(new Set());
    if (onArchive) {
      onArchive(ids, titles);
    } else {
      onTaskUpdated?.();
    }
  };

  const bulkMove = async (status: string) => {
    for (const id of Array.from(selected)) {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }
    setSelected(new Set());
    setBulkStatusMenu(false);
    onTaskUpdated?.();
  };

  useEffect(() => {
    if (!statusMenuId) return;
    const handleClick = () => setStatusMenuId(null);
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [statusMenuId]);

  const changeStatus = async (taskId: string, newStatus: string) => {
    setStatusMenuId(null);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onTaskUpdated?.();
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const statusOrder = new Map(columns.map((c, i) => [c.slug, i]));

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "cardNumber":
        cmp = (a.cardNumber || 0) - (b.cardNumber || 0);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "status":
        cmp = (statusOrder.get(a.status) || 0) - (statusOrder.get(b.status) || 0);
        break;
      case "priority":
        cmp = (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        break;
      case "deadline":
        cmp = (a.deadline || "").localeCompare(b.deadline || "");
        break;
      case "assignees":
        cmp = (a.assignees?.[0] || "").localeCompare(b.assignees?.[0] || "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const getStatusInfo = (slug: string) => columns.find((c) => c.slug === slug);

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getMemberAvatar = (name: string) =>
    members.find((m) => m.name === name)?.avatar;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-2.5 text-left cursor-pointer hover:text-text-primary transition-colors group"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={12}
          className={`transition-opacity ${sortKey === field ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}
        />
      </span>
    </th>
  );

  return (
    <div className="rounded-2xl bg-bg-card overflow-hidden">
      {/* Mobile card layout */}
      <div className="md:hidden divide-y divide-bg-base">
        {sorted.map((task) => {
          const statusInfo = getStatusInfo(task.status);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          let deadlineClass = "text-text-secondary";
          let deadlineText = "";
          if (task.deadline) {
            const due = new Date(task.deadline);
            due.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
            deadlineText = task.status === "done" ? new Date(task.deadline).toLocaleDateString()
              : diffDays < 0 ? `${Math.abs(diffDays)}d overdue`
              : diffDays === 0 ? "Today"
              : new Date(task.deadline).toLocaleDateString();
            deadlineClass = task.status === "done" ? "text-text-disabled"
              : diffDays < 0 ? "text-danger"
              : diffDays === 0 ? "text-warning"
              : "text-text-secondary";
          }
          return (
            <div
              key={task._id}
              onClick={() => router.push(`/projects/${projectId}/cards/${task._id}`)}
              className="px-4 py-3 hover:bg-bg-surface transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {task.cardNumber && (
                      <span className="text-xs text-text-disabled font-mono">SP-{task.cardNumber}</span>
                    )}
                    {task.blockedBy && task.blockedBy.length > 0 && <Ban size={12} className="text-danger" />}
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ backgroundColor: (statusInfo?.color || "#64748b") + "18", color: statusInfo?.color || "#64748b" }}
                >
                  {statusInfo?.label || task.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize flex items-center gap-1 ${PRIORITY_COLOR[task.priority]}`}>
                  <Flag size={10} />{task.priority}
                </span>
                {task.deadline && (
                  <span className={`text-xs flex items-center gap-1 ${deadlineClass}`}>
                    <Calendar size={10} />{deadlineText}
                  </span>
                )}
                {task.assignees?.length > 0 && (
                  <span className="text-xs text-text-disabled">{task.assignees.slice(0, 2).join(", ")}{task.assignees.length > 2 ? ` +${task.assignees.length - 2}` : ""}</span>
                )}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-text-disabled text-sm">No cards to display</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-disabled font-medium uppercase tracking-wider">
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === tasks.length && tasks.length > 0}
                  onChange={selectAll}
                  className="w-3.5 h-3.5 rounded border-border text-brand focus:ring-brand cursor-pointer"
                />
              </th>
              <SortHeader label="#" field="cardNumber" />
              <SortHeader label="Title" field="title" />
              <SortHeader label="Status" field="status" />
              <SortHeader label="Priority" field="priority" />
              <SortHeader label="Assignees" field="assignees" />
              <SortHeader label="Deadline" field="deadline" />
              <th className="px-3 py-2.5 text-left">Labels</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-base">
            {sorted.map((task) => {
              const statusInfo = getStatusInfo(task.status);
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              let deadlineClass = "text-text-secondary";
              let deadlineText = "";
              if (task.deadline) {
                const due = new Date(task.deadline);
                due.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
                deadlineText = task.status === "done"
                  ? new Date(task.deadline).toLocaleDateString()
                  : diffDays < 0
                    ? `${Math.abs(diffDays)}d overdue`
                    : diffDays === 0
                      ? "Today"
                      : new Date(task.deadline).toLocaleDateString();
                deadlineClass = task.status === "done"
                  ? "text-text-disabled"
                  : diffDays < 0
                    ? "text-danger"
                    : diffDays === 0
                      ? "text-warning"
                      : "text-text-secondary";
              }

              return (
                <tr
                  key={task._id}
                  onClick={() => router.push(`/projects/${projectId}/cards/${task._id}`)}
                  className={`hover:bg-bg-surface transition-colors cursor-pointer ${selected.has(task._id) ? "bg-brand-subtle/30" : ""}`}
                >
                  <td className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(task._id)}
                      onClick={(e) => toggleSelect(task._id, e)}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded border-border text-brand focus:ring-brand cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-text-disabled font-mono text-xs whitespace-nowrap">
                    {task.cardNumber ? `SP-${task.cardNumber}` : ""}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {task.blockedBy && task.blockedBy.length > 0 && (
                        <Ban size={12} className="text-danger flex-shrink-0" />
                      )}
                      <span className="text-text-primary font-medium truncate max-w-xs">
                        {task.title}
                      </span>
                      {(task.commentCount ?? 0) > 0 && (
                        <span className="text-text-disabled flex items-center gap-0.5 flex-shrink-0">
                          <MessageSquare size={10} />
                          <span className="text-xs">{task.commentCount}</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuId(statusMenuId === task._id ? null : task._id);
                        }}
                        className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: (statusInfo?.color || "#64748b") + "18",
                          color: statusInfo?.color || "#64748b",
                        }}
                      >
                        {statusInfo?.label || task.status}
                      </button>
                      {statusMenuId === task._id && (
                        <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-40 py-1">
                          {columns.map((col) => (
                            <button
                              key={col.slug}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                changeStatus(task._id, col.slug);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                                task.status === col.slug ? "bg-bg-surface" : "hover:bg-bg-surface"
                              }`}
                            >
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: col.color + "18",
                                  color: col.color,
                                }}
                              >
                                {col.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize flex items-center gap-1 w-fit ${PRIORITY_COLOR[task.priority]}`}
                    >
                      <Flag size={10} />
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {task.assignees?.length > 0 && (
                      <div className="flex items-center -space-x-1.5">
                        {task.assignees.slice(0, 3).map((name) => {
                          const avatar = getMemberAvatar(name);
                          return avatar ? (
                            <img
                              key={name}
                              src={avatar}
                              alt={name}
                              title={name}
                              className="w-5 h-5 rounded-full ring-1 ring-bg-card flex-shrink-0"
                            />
                          ) : (
                            <span
                              key={name}
                              title={name}
                              className="w-5 h-5 rounded-full bg-brand-subtle flex items-center justify-center text-brand text-xs font-bold ring-1 ring-bg-card flex-shrink-0"
                            >
                              {initials(name)}
                            </span>
                          );
                        })}
                        {task.assignees.length > 3 && (
                          <span className="w-5 h-5 rounded-full bg-bg-base flex items-center justify-center text-text-secondary text-xs font-bold ring-1 ring-bg-card flex-shrink-0">
                            +{task.assignees.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {task.deadline && (
                      <span className={`text-xs flex items-center gap-1 ${deadlineClass}`}>
                        <Calendar size={10} />
                        {deadlineText}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {task.labels?.map((label) => (
                        <span
                          key={label}
                          className="text-xs px-1.5 py-0.5 rounded-full bg-brand-subtle text-brand font-medium"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4">
          <div className="bg-bg-surface rounded-xl shadow-xl flex items-center gap-2 px-4 py-2.5">
            <span className="text-sm text-text-primary font-medium mr-2">
              {selected.size} selected
            </span>
            <div className="relative">
              <button
                onClick={() => setBulkStatusMenu((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-card hover:bg-bg-base rounded-lg transition-colors"
              >
                <ArrowRightLeft size={12} /> Move
              </button>
              {bulkStatusMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-bg-card rounded-xl shadow-lg z-10 w-40 py-1">
                  {columns.map((col) => (
                    <button
                      key={col.slug}
                      onClick={() => bulkMove(col.slug)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg-surface transition-colors text-left"
                    >
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: col.color + "18", color: col.color }}
                      >
                        {col.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={bulkArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning bg-warning-subtle hover:bg-warning/20 rounded-lg transition-colors"
            >
              <Archive size={12} /> Archive
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 text-text-disabled hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
