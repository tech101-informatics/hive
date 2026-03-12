"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditTaskModal } from "@/components/EditTaskModal";
import { Loader2 } from "lucide-react";

export default function CardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const cardId = params.cardId as string;

  const [task, setTask] = useState<any>(null);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/${cardId}`).then((r) => r.json()),
      fetch(`/api/tasks?projectId=${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch("/api/board-status").then((r) => r.json()),
    ]).then(([taskData, tasksData, projectData, statusData]) => {
      setTask(taskData?.error ? null : taskData);
      setAllTasks(Array.isArray(tasksData) ? tasksData : []);
      setProject(projectData?.error ? null : projectData);
      setStatuses(Array.isArray(statusData) ? statusData : []);
      setLoading(false);
    });
  }, [cardId, projectId]);

  const navigateToBoard = () => router.push(`/projects/${projectId}`);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Card not found.</p>
        <button onClick={navigateToBoard} className="mt-4 text-brand hover:underline text-sm">
          Back to board
        </button>
      </div>
    );
  }

  return (
    <EditTaskModal
      task={task}
      allTasks={allTasks}
      statuses={statuses}
      boardName={project?.name || ""}
      boardStatus={project?.status || ""}
      onClose={navigateToBoard}
      onUpdated={() => {
        window.dispatchEvent(new CustomEvent("task-updated"));
      }}
      onDeleted={() => {
        window.dispatchEvent(new CustomEvent("task-updated"));
        navigateToBoard();
      }}
    />
  );
}
