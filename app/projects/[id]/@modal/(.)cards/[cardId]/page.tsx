"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditTaskModal } from "@/components/EditTaskModal";
import { Loader2 } from "lucide-react";

export default function CardModalPage() {
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  if (!task) return null;

  return (
    <EditTaskModal
      task={task}
      allTasks={allTasks}
      statuses={statuses}
      boardName={project?.name || ""}
      boardStatus={project?.status || ""}
      onClose={() => router.back()}
      onUpdated={() => {
        window.dispatchEvent(new CustomEvent("task-updated"));
      }}
      onArchive={(taskIds, titles) => {
        window.dispatchEvent(new CustomEvent("task-archived", { detail: { taskIds, titles } }));
      }}
    />
  );
}
