"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Repeat,
  Pause,
  Play,
  X,
} from "lucide-react";

interface RecurringTask {
  _id: string;
  title: string;
  description: string;
  priority: string;
  assignees: string[];
  labels: string[];
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number;
  dayOfMonth?: number;
  nextRunDate: string;
  enabled: boolean;
  status: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function RecurringTasksPage() {
  const { id: projectId } = useParams();
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    frequency: "weekly" as "daily" | "weekly" | "monthly",
    dayOfWeek: 1,
    dayOfMonth: 1,
  });
  const [saving, setSaving] = useState(false);

  const fetchTasks = async () => {
    const res = await fetch(`/api/recurring-tasks?projectId=${projectId}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/recurring-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        projectId,
        dayOfWeek: form.frequency === "weekly" ? form.dayOfWeek : undefined,
        dayOfMonth: form.frequency === "monthly" ? form.dayOfMonth : undefined,
      }),
    });
    setSaving(false);
    setForm({ title: "", description: "", priority: "medium", frequency: "weekly", dayOfWeek: 1, dayOfMonth: 1 });
    setShowForm(false);
    fetchTasks();
  };

  const toggleEnabled = async (task: RecurringTask) => {
    await fetch(`/api/recurring-tasks/${task._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !task.enabled }),
    });
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/recurring-tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const formatSchedule = (task: RecurringTask) => {
    if (task.frequency === "daily") return "Every day";
    if (task.frequency === "weekly") return `Every ${DAYS[task.dayOfWeek || 0]}`;
    if (task.frequency === "monthly") return `Monthly on the ${task.dayOfMonth || 1}${ordinal(task.dayOfMonth || 1)}`;
    return task.frequency;
  };

  const ordinal = (n: number) => {
    if (n > 3 && n < 21) return "th";
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
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

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${projectId}`}
            className="p-2 hover:bg-bg-card rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              Recurring Tasks
            </h1>
            <p className="text-text-secondary text-sm mt-0.5">
              Cards created automatically on a schedule
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-lg hover:bg-brand-hover font-medium transition-colors text-sm"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl bg-bg-card p-5 mb-5 space-y-3">
          <input
            autoFocus
            className="w-full text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Card title..."
            onKeyDown={(e) => {
              if (e.key === "Enter") createTask();
              if (e.key === "Escape") setShowForm(false);
            }}
          />
          <textarea
            className="w-full text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand resize-none"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="text-sm bg-bg-base text-text-primary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as any })}
              className="text-sm bg-bg-base text-text-primary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            {form.frequency === "weekly" && (
              <select
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                className="text-sm bg-bg-base text-text-primary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            )}
            {form.frequency === "monthly" && (
              <select
                value={form.dayOfMonth}
                onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                className="text-sm bg-bg-base text-text-primary rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={createTask}
              disabled={saving || !form.title.trim()}
              className="bg-brand text-white px-4 py-1.5 rounded-lg hover:bg-brand-hover text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-bg-card">
          <Repeat size={32} className="mx-auto text-text-disabled mb-3" />
          <p className="text-text-secondary">No recurring tasks yet</p>
          <p className="text-text-disabled text-sm mt-1">
            Cards will be created automatically on the schedule you set
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-bg-card overflow-hidden divide-y divide-bg-base">
          {tasks.map((task) => (
            <div
              key={task._id}
              className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${
                task.enabled ? "hover:bg-bg-surface" : "opacity-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-text-disabled">
                    {formatSchedule(task)}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                    task.priority === "high"
                      ? "text-danger bg-danger-subtle"
                      : task.priority === "medium"
                        ? "text-warning bg-warning-subtle"
                        : "text-success bg-success-subtle"
                  }`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-text-disabled">
                    Next: {new Date(task.nextRunDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleEnabled(task)}
                className={`p-1.5 rounded-lg transition-colors ${
                  task.enabled
                    ? "text-success hover:bg-success-subtle"
                    : "text-text-disabled hover:bg-bg-base"
                }`}
                title={task.enabled ? "Pause" : "Resume"}
              >
                {task.enabled ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={() => deleteTask(task._id)}
                className="p-1.5 text-text-disabled hover:text-danger transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
