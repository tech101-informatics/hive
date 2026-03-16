"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trash2,
  Archive,
  Calendar,
  User,
  Flag,
  Pencil,
  MessageSquare,
  GitBranch,
  GitPullRequest,
  Tag,
  Hash,
  MoreVertical,
  Ban,
} from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: "low" | "medium" | "high";
  assignees: string[];
  deadline?: string;
  branch?: string;
  pr?: string;
  prUrl?: string;
  labels?: string[];
  parentId?: string;
  blockedBy?: string[];
  commentCount?: number;
  cardNumber?: number;
  checklist?: {
    _id?: string;
    text: string;
    completed: boolean;
    order: number;
  }[];
}

interface BoardColumn {
  _id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  wipLimit?: number;
  isDefault: boolean;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-danger bg-danger-subtle",
  medium: "text-warning bg-warning-subtle",
  low: "text-success bg-success-subtle",
};

interface MemberInfo {
  _id: string;
  name: string;
  avatar?: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  columns: BoardColumn[];
  onTaskUpdated: () => void;
  isAdmin?: boolean;
  boardName?: string;
  boardStatus?: string;
  members?: MemberInfo[];
}

export function KanbanBoard({
  tasks,
  columns,
  onTaskUpdated,
  isAdmin = false,
  boardName = "",
  boardStatus = "",
  members = [],
}: KanbanBoardProps) {
  const router = useRouter();
  const { id: projectId } = useParams();
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, string>
  >({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "archive";
    taskId: string;
    taskTitle: string;
  } | null>(null);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!cardMenuId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-card-menu]")) return;
      setCardMenuId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [cardMenuId]);

  useEffect(() => {
    setOptimisticStatuses((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, status] of Object.entries(next)) {
        const parentTask = tasks.find((t) => t._id === id);
        if (parentTask && parentTask.status === status) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const displayedTasks = tasks.map((t) =>
    optimisticStatuses[t._id]
      ? { ...t, status: optimisticStatuses[t._id] }
      : t
  );

  const tasksByStatus = (status: string) =>
    displayedTasks.filter((t) => t.status === status);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggingId) return;
    const task = tasks.find((t) => t._id === draggingId);
    if (!task || task.status === newStatus) return;
    const taskId = draggingId;

    setOptimisticStatuses((prev) => ({ ...prev, [taskId]: newStatus }));
    setDraggingId(null);

    fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).then((res) => {
      if (!res.ok) {
        setOptimisticStatuses((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    });

    onTaskUpdated();
  };

  const formatCardNumber = (n?: number) =>
    n ? `SP-${String(n).padStart(3, "0")}` : "";

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getMemberAvatar = (name: string) =>
    members.find((m) => m.name === name)?.avatar;

  const openCard = (task: Task) => {
    router.push(`/projects/${projectId}/cards/${task._id}`);
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    onTaskUpdated();
  };

  const archiveTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    onTaskUpdated();
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)]">
        {columns.map((col) => (
          <div
            key={col.slug}
            className={`rounded-xl p-3 kanban-column flex-shrink-0 w-70 flex flex-col ${dragOverCol === col.slug ? "drag-over" : ""}`}
            style={{ backgroundColor: col.color + "60" }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.slug);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col.slug)}
          >
            {(() => {
              const count = tasksByStatus(col.slug).length;
              const overWip = col.wipLimit && col.wipLimit > 0 && count > col.wipLimit;
              return (
                <div
                  className={`rounded-lg px-3 py-1.5 mb-3 flex items-center justify-between flex-shrink-0 ${overWip ? "ring-2 ring-warning" : ""}`}
                  style={{ backgroundColor: col.color + "55" }}
                >
                  <span className="font-semibold text-sm text-text-primary">
                    {col.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {overWip && (
                      <span className="text-xs text-warning font-medium">
                        WIP
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${overWip ? "bg-warning text-white" : ""}`}
                      style={overWip ? {} : {
                        backgroundColor: col.color + "35",
                        color: col.color,
                      }}
                    >
                      {count}{col.wipLimit && col.wipLimit > 0 ? `/${col.wipLimit}` : ""}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
              {tasksByStatus(col.slug).map((task) => (
                <div
                  key={task._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task._id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={`task-card bg-bg-card rounded-lg p-3 transition-all ${draggingId === task._id ? "opacity-40" : ""} ${task.blockedBy?.length ? "border-l-2 border-danger" : ""}`}
                >
                  {task.cardNumber && (
                    <span className="text-xs text-text-disabled font-mono mb-1 block">
                      {formatCardNumber(task.cardNumber)}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p
                      className="font-medium text-text-primary text-sm leading-snug cursor-pointer hover:text-brand transition-colors flex-1"
                      onClick={() => openCard(task)}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => openCard(task)}
                        className="p-1 text-text-disabled hover:text-brand transition-colors"
                        title="Edit card"
                      >
                        <Pencil size={12} />
                      </button>
                      {isAdmin && (
                        <div className="relative" data-card-menu>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardMenuId(
                                cardMenuId === task._id ? null : task._id
                              );
                            }}
                            className="p-1 text-text-disabled hover:text-text-primary transition-colors"
                          >
                            <MoreVertical size={13} />
                          </button>
                          {cardMenuId === task._id && (
                            <div className="absolute right-0 top-full mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-36 py-1 overflow-hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCardMenuId(null);
                                  setConfirmAction({
                                    type: "archive",
                                    taskId: task._id,
                                    taskTitle: task.title,
                                  });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                              >
                                <Archive size={13} /> Archive
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCardMenuId(null);
                                  setConfirmAction({
                                    type: "delete",
                                    taskId: task._id,
                                    taskTitle: task.title,
                                  });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-bg-surface transition-colors"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <div
                      className="text-text-secondary text-xs mb-2 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    ></div>
                  )}

                  {task.labels && task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.labels.map((label) => (
                        <span
                          key={label}
                          className="text-xs px-1.5 py-0.5 rounded-full bg-brand-subtle text-brand font-medium"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {task.checklist &&
                    task.checklist.length > 0 &&
                    (() => {
                      const done = task.checklist.filter(
                        (i) => i.completed
                      ).length;
                      const total = task.checklist.length;
                      return (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 bg-bg-base rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${done === total ? "bg-success" : "bg-brand"}`}
                              style={{
                                width: `${(done / total) * 100}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-xs font-medium whitespace-nowrap ${done === total ? "text-success" : "text-text-secondary"}`}
                          >
                            {done}/{total}
                          </span>
                        </div>
                      );
                    })()}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {task.blockedBy && task.blockedBy.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 text-danger bg-danger-subtle">
                        <Ban size={10} />
                        Blocked
                      </span>
                    )}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 capitalize ${PRIORITY_COLOR[task.priority]}`}
                    >
                      <Flag size={10} />
                      {task.priority}
                    </span>
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
                    {task.deadline && (() => {
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      const due = new Date(task.deadline);
                      due.setHours(0, 0, 0, 0);
                      const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
                      const colorClass = task.status === "done"
                        ? "text-text-disabled"
                        : diffDays < 0
                          ? "text-danger bg-danger-subtle px-1.5 py-0.5 rounded"
                          : diffDays === 0
                            ? "text-warning bg-warning-subtle px-1.5 py-0.5 rounded"
                            : diffDays <= 2
                              ? "text-warning"
                              : "text-text-secondary";
                      return (
                        <span className={`text-xs flex items-center gap-1 ${colorClass}`}>
                          <Calendar size={10} />
                          {diffDays < 0 ? `${Math.abs(diffDays)}d overdue` : diffDays === 0 ? "Today" : new Date(task.deadline).toLocaleDateString()}
                        </span>
                      );
                    })()}
                    {(task.commentCount ?? 0) > 0 && (
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <MessageSquare size={10} />
                        {task.commentCount}
                      </span>
                    )}
                    {task.branch && (
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <GitBranch size={10} />
                      </span>
                    )}
                    {task.prUrl && (
                      <a
                        href={task.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-brand hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GitPullRequest size={10} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {tasksByStatus(col.slug).length === 0 && (
              <p className="text-center text-text-disabled text-xs py-4 flex-shrink-0">
                Drop cards here
              </p>
            )}
          </div>
        ))}
      </div>

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === "delete"
              ? "Delete Card"
              : "Archive Card"
          }
          message={
            confirmAction.type === "delete"
              ? `"${confirmAction.taskTitle}" will be permanently deleted. This action cannot be undone.`
              : `"${confirmAction.taskTitle}" will be archived and hidden from the board. You can restore it later.`
          }
          confirmText={
            confirmAction.type === "delete" ? "Delete" : "Archive"
          }
          variant={confirmAction.type === "delete" ? "danger" : "warning"}
          onConfirm={() => {
            if (confirmAction.type === "delete") {
              deleteTask(confirmAction.taskId);
            } else {
              archiveTask(confirmAction.taskId);
            }
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
