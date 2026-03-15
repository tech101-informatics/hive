"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  Loader2,
  MoreVertical,
  Archive,
  Trash2,
} from "lucide-react";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  color: string;
  createdAt: string;
  taskCount?: number;
  doneCount?: number;
  progressPercent?: number;
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "archive";
    projectId: string;
    projectName: string;
  } | null>(null);

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    if (menuId) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuId]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setConfirmAction(null);
    fetchProjects();
  };

  const handleArchive = async (id: string) => {
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setConfirmAction(null);
    fetchProjects();
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            Boards
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {projects.length} board{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand text-white px-3 py-2 text-sm rounded-lg hover:bg-brand-hover font-medium transition-colors"
          >
            <Plus size={16} /> New Board
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban
            size={48}
            className="mx-auto text-text-disabled mb-4"
          />
          <p className="text-text-secondary text-lg">No boards yet</p>
          <p className="text-text-disabled text-sm mt-1">
            Create your first board to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project._id} className="relative group">
              <Link href={`/projects/${project._id}`}>
                <div className="rounded-2xl bg-bg-card p-5 hover:bg-bg-surface transition-colors cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <span
                      className="w-3.5 h-3.5 rounded mt-1 flex-shrink-0"
                      style={{ background: project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text-primary text-base truncate">
                        {project.name}
                      </h3>
                      <p className="text-text-disabled text-sm mt-0.5 line-clamp-2">
                        {project.description || "No description"}
                      </p>
                    </div>
                  </div>
                  {(project.taskCount ?? 0) > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-text-disabled">
                          {project.doneCount}/{project.taskCount} done
                        </span>
                        <span className="text-xs font-medium text-text-secondary tabular-nums">
                          {project.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-bg-base rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${project.progressPercent}%`,
                            background:
                              (project.progressPercent ?? 0) === 100
                                ? "var(--hive-success)"
                                : "var(--hive-brand)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        project.status === "active"
                          ? "bg-success-subtle text-success"
                          : project.status === "completed"
                            ? "bg-bg-base text-text-disabled"
                            : "bg-warning-subtle text-warning"
                      }`}
                    >
                      {project.status}
                    </span>
                    <span className="text-xs text-text-disabled">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>

              {isAdmin && (
                <div
                  className="absolute top-3 right-3"
                  ref={menuId === project._id ? menuRef : undefined}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuId(
                        menuId === project._id ? null : project._id
                      );
                    }}
                    className="p-1.5 rounded-lg bg-bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-bg-surface transition-all"
                  >
                    <MoreVertical
                      size={14}
                      className="text-text-secondary"
                    />
                  </button>
                  {menuId === project._id && (
                    <div className="absolute right-0 top-full mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-40 py-1 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuId(null);
                          setConfirmAction({
                            type: "archive",
                            projectId: project._id,
                            projectName: project.name,
                          });
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                      >
                        <Archive size={14} /> Archive
                      </button>
                      <div className="h-px bg-bg-base mx-2 my-0.5" />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuId(null);
                          setConfirmAction({
                            type: "delete",
                            projectId: project._id,
                            projectName: project.name,
                          });
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-bg-surface transition-colors"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchProjects();
          }}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === "delete"
              ? "Delete Board"
              : "Archive Board"
          }
          message={
            confirmAction.type === "delete"
              ? `"${confirmAction.projectName}" and all its cards will be permanently deleted. This cannot be undone.`
              : `"${confirmAction.projectName}" will be archived and hidden from the board list. You can restore it later.`
          }
          confirmText={
            confirmAction.type === "delete" ? "Delete" : "Archive"
          }
          variant={confirmAction.type === "delete" ? "danger" : "warning"}
          onConfirm={() => {
            if (confirmAction.type === "delete") {
              handleDelete(confirmAction.projectId);
            } else {
              handleArchive(confirmAction.projectId);
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
