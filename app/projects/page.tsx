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

  useEffect(() => { fetchProjects(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Boards</h1>
          <p className="text-slate-500 mt-1">{projects.length} board{projects.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            <Plus size={18} /> New Board
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg">No boards yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first board to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link key={project._id} href={`/projects/${project._id}`}>
              <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-indigo-100">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-4 h-4 rounded-full mt-1 flex-shrink-0" style={{ background: project.color }} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-lg truncate">{project.name}</h3>
                    <p className="text-slate-500 text-sm mt-0.5 line-clamp-2">{project.description || "No description"}</p>
                  </div>
                </div>
                {/* Progress bar */}
                {(project.taskCount ?? 0) > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-500">{project.doneCount}/{project.taskCount} cards done</span>
                      <span className="text-xs font-medium text-slate-600">{project.progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${project.progressPercent}%`,
                          background: (project.progressPercent ?? 0) === 100 ? '#10b981' : '#6366f1',
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    project.status === "active" ? "bg-emerald-100 text-emerald-700" :
                    project.status === "completed" ? "bg-slate-100 text-slate-600" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{project.status}</span>
                  <span className="text-xs text-slate-400">{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchProjects(); }}
        />
      )}
    </div>
  );
}
