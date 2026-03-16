"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RotateCcw,
  Trash2,
  Archive,
  Flag,
} from "lucide-react";
import { EditTaskModal } from "@/components/EditTaskModal";
import { ConfirmModal } from "@/components/ConfirmModal";

interface ArchivedTask {
  _id: string;
  title: string;
  description: string;
  cardNumber?: number;
  status: "todo" | "in-progress" | "in-review" | "done";
  priority: "low" | "medium" | "high";
  assignees: string[];
  labels?: string[];
  blockedBy?: string[];
  deadline?: string;
  parentId?: string;
  branch?: string;
  pr?: string;
  prUrl?: string;
  checklist?: { _id?: string; text: string; completed: boolean; order: number }[];
  updatedAt: string;
  createdAt: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-danger bg-danger-subtle",
  medium: "text-warning bg-warning-subtle",
  low: "text-success bg-success-subtle",
};

export default function ArchivedCardsPage() {
  const { id: projectId } = useParams();
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ArchivedTask | null>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedTask | null>(null);

  const fetchArchived = async () => {
    const res = await fetch(`/api/tasks/archived?projectId=${projectId}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArchived();
    fetch("/api/board-status")
      .then((r) => r.json())
      .then((d) => setStatuses(Array.isArray(d) ? d : []));
  }, []);

  const viewTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`);
    const data = await res.json();
    if (!data.error) setSelectedTask(data);
  };

  const restoreTask = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    setSelectedTask(null);
    fetchArchived();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/tasks/${deleteTarget._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setSelectedTask(null);
    fetchArchived();
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="p-2 hover:bg-bg-card rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            Archived Cards
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {tasks.length} archived card{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-bg-card">
          <Archive size={32} className="mx-auto text-text-disabled mb-3" />
          <p className="text-text-secondary">No archived cards</p>
          <p className="text-text-disabled text-sm mt-1">
            Archived cards will appear here
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-bg-card overflow-hidden divide-y divide-bg-base">
          {tasks.map((task) => (
            <div
              key={task._id}
              onClick={() => viewTask(task._id)}
              className="flex items-center gap-4 px-4 py-3.5 hover:bg-bg-surface transition-colors group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {task.cardNumber && (
                    <span className="text-xs text-text-disabled font-mono">
                      SP-{task.cardNumber}
                    </span>
                  )}
                  <span className="text-sm font-medium text-text-primary truncate">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 capitalize ${PRIORITY_COLOR[task.priority] || ""}`}
                  >
                    <Flag size={10} />
                    {task.priority}
                  </span>
                  {task.labels?.map((label) => (
                    <span
                      key={label}
                      className="text-xs px-1.5 py-0.5 rounded-full bg-brand-subtle text-brand font-medium"
                    >
                      {label}
                    </span>
                  ))}
                  <span className="text-xs text-text-disabled">
                    Archived{" "}
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restoreTask(task._id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand bg-brand-subtle rounded-lg hover:bg-brand/20 transition-colors opacity-0 group-hover:opacity-100"
              >
                <RotateCcw size={12} /> Restore
              </button>

              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(task);
                  }}
                  className="p-1.5 text-text-disabled hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete permanently"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full detail modal (read-only, reusing EditTaskModal) */}
      {selectedTask && (
        <EditTaskModal
          task={selectedTask}
          allTasks={tasks}
          statuses={statuses}
          boardName=""
          boardStatus=""
          onClose={() => setSelectedTask(null)}
          onUpdated={() => {}}
          readOnly
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Card"
          message={`"${deleteTarget.title}" will be permanently deleted along with all comments and activity. This cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
