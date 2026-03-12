"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, FolderKanban, Loader2 } from "lucide-react";
import { CreateProjectModal } from "@/components/CreateProjectModal";

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

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Boards</h1>
          <p className="text-text-secondary mt-1">
            {projects.length} board{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 text-sm rounded-lg hover:bg-brand-hover font-medium transition-colors"
          >
            <Plus size={18} /> New Board
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban size={48} className="mx-auto text-text-disabled mb-4" />
          <p className="text-text-secondary text-lg">No boards yet</p>
          <p className="text-text-secondary text-sm mt-1">
            Create your first board to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link key={project._id} href={`/projects/${project._id}`}>
              <div className="bg-bg-card rounded-xl p-6 hover:border-brand/30 transition-colors cursor-pointer">
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                    style={{ background: project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary text-lg truncate">
                      {project.name}
                    </h3>
                    <p className="text-text-secondary text-sm mt-0.5 line-clamp-2">
                      {project.description || "No description"}
                    </p>
                  </div>
                </div>
                {(project.taskCount ?? 0) > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-text-secondary">
                        {project.doneCount}/{project.taskCount} cards done
                      </span>
                      <span className="text-xs font-medium text-text-secondary">
                        {project.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-border-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${project.progressPercent}%`,
                          background:
                            (project.progressPercent ?? 0) === 100
                              ? "#34d399"
                              : "#395bea",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      project.status === "active"
                        ? "bg-success-subtle text-success"
                        : project.status === "completed"
                          ? "bg-border text-text-secondary"
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
    </div>
  );
}
