"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trash2,
  Calendar,
  User,
  Flag,
  Pencil,
  MessageSquare,
  GitBranch,
  Tag,
  Hash,
} from "lucide-react";

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
  labels?: string[];
  parentId?: string;
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
  isDefault: boolean;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-600 bg-red-50",
  medium: "text-yellow-600 bg-yellow-50",
  low: "text-green-600 bg-green-50",
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

  // Clear optimistic overrides once parent tasks have caught up
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

  // Merge parent tasks with optimistic overrides
  const displayedTasks = tasks.map((t) =>
    optimisticStatuses[t._id] ? { ...t, status: optimisticStatuses[t._id] } : t,
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

    // Optimistic — card moves instantly
    setOptimisticStatuses((prev) => ({ ...prev, [taskId]: newStatus }));
    setDraggingId(null);

    // API call in background — don't await, let parent re-fetch
    fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).then((res) => {
      if (!res.ok) {
        // Revert on failure
        setOptimisticStatuses((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    });

    // Tell parent to re-fetch — override stays until parent catches up
    onTaskUpdated();
  };

  const formatCardNumber = (n?: number) =>
    n ? `SP-${String(n).padStart(3, "0")}` : "";

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getMemberAvatar = (name: string) =>
    members.find((m) => m.name === name)?.avatar;

  const openCard = (task: Task) => {
    router.push(`/projects/${projectId}/cards/${task._id}`);
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this card?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    onTaskUpdated();
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.slug}
            className={`rounded-xl p-3 kanban-column flex-shrink-0 w-70 ${dragOverCol === col.slug ? "drag-over" : ""}`}
            style={{ backgroundColor: col.color + "12" }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.slug);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col.slug)}
          >
            <div
              className="rounded-lg px-3 py-1.5 mb-3 flex items-center justify-between"
              style={{ backgroundColor: col.color + "25", color: col.color }}
            >
              <span className="font-semibold text-sm">{col.label}</span>
              <span className="text-xs font-bold opacity-70">
                {tasksByStatus(col.slug).length}
              </span>
            </div>

            <div className="space-y-2">
              {tasksByStatus(col.slug).map((task) => (
                <div
                  key={task._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task._id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={`task-card bg-white rounded-lg p-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${draggingId === task._id ? "opacity-50" : ""}`}
                >
                  {task.cardNumber && (
                    <span className="text-[10px] text-slate-400 font-mono mb-1 block">
                      {formatCardNumber(task.cardNumber)}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p
                      className="font-medium text-slate-800 text-sm leading-snug cursor-pointer hover:text-indigo-600 transition-colors flex-1"
                      onClick={() => openCard(task)}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => openCard(task)}
                        className="p-1 text-slate-300 hover:text-indigo-500 transition-colors"
                        title="Edit card"
                      >
                        <Pencil size={12} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => deleteTask(task._id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <div
                      className="text-slate-500 text-xs mb-2 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    ></div>
                  )}

                  {task.labels && task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.labels.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium"
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
                        (i) => i.completed,
                      ).length;
                      const total = task.checklist.length;
                      return (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${done === total ? "bg-emerald-500" : "bg-indigo-500"}`}
                              style={{ width: `${(done / total) * 100}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-medium whitespace-nowrap ${done === total ? "text-emerald-500" : "text-slate-400"}`}
                          >
                            {done}/{total}
                          </span>
                        </div>
                      );
                    })()}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
                            <img key={name} src={avatar} alt={name} title={name} className="w-5 h-5 rounded-full border border-white flex-shrink-0" />
                          ) : (
                            <span key={name} title={name} className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[8px] font-bold border border-white flex-shrink-0">
                              {initials(name)}
                            </span>
                          );
                        })}
                        {task.assignees.length > 3 && (
                          <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[8px] font-bold border border-white flex-shrink-0">
                            +{task.assignees.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {task.deadline && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {(task.commentCount ?? 0) > 0 && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MessageSquare size={10} />
                        {task.commentCount}
                      </span>
                    )}
                    {task.branch && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <GitBranch size={10} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {tasksByStatus(col.slug).length === 0 && (
              <p className="text-center text-slate-400 text-xs py-4">
                Drop cards here
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
