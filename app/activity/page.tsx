"use client";
import { useEffect, useState } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
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
    else key = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProject, setSelectedProject] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = selectedProject
      ? `/api/activity?projectId=${selectedProject}&page=${page}`
      : `/api/activity?page=${page}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setActivities(d.activities || []);
        setTotalPages(d.pages || 1);
        setLoading(false);
      });
  }, [page, selectedProject]);

  const projectMap = new Map(projects.map((p) => [p._id, p]));
  const grouped = groupByDate(activities);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            Activity
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Timeline of all actions across boards
          </p>
        </div>
        <select
          value={selectedProject}
          onChange={(e) => {
            setSelectedProject(e.target.value);
            setPage(1);
          }}
          className="bg-bg-card text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand appearance-none cursor-pointer pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b909a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="">All Boards</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
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
                          <span className="font-medium">{item.user}</span>
                          {" "}
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
