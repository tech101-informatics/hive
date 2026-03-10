"use client";
import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { EditTaskModal } from "@/components/EditTaskModal";

interface Task {
  _id: string;
  title: string;
  description: string;
  projectId: string;
  status: string;
  priority: "low" | "medium" | "high";
  assignees: string[];
  deadline?: string;
  cardNumber?: number;
  parentId?: string;
  branch?: string;
  pr?: string;
  labels?: string[];
  checklist?: any[];
}

interface Project {
  _id: string;
  name: string;
  color: string;
}

interface BoardColumn {
  _id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchData = () => {
    Promise.all([
      fetch("/api/tasks"),
      fetch("/api/projects"),
      fetch("/api/board-status"),
    ]).then(async ([tRes, pRes, cRes]) => {
      const tData = await tRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      setTasks(Array.isArray(tData) ? tData : []);
      setProjects(Array.isArray(pData) ? pData : []);
      setColumns(Array.isArray(cData) ? cData : []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const projectMap = useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((p) => { map[p._id] = p; });
    return map;
  }, [projects]);

  // Group tasks by deadline date string (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (!t.deadline) return;
      const d = t.deadline.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(t);
    });
    return map;
  }, [tasks]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  // Build calendar grid cells
  const cells: { day: number | null; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }
  const remainder = cells.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) cells.push({ day: null, dateStr: "" });
  }

  const openTask = (task: Task) => {
    setSelectedTask(task);
  };

  const handleTaskUpdated = () => {
    fetchData();
    // Refresh the selected task if still open
    if (selectedTask) {
      fetch(`/api/tasks/${selectedTask._id}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setSelectedTask(data);
        });
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  );

  const tasksWithDeadlines = tasks.filter((t) => t.deadline).length;
  const selectedProject = selectedTask ? projectMap[selectedTask.projectId] : null;
  const projectTasks = selectedTask
    ? tasks.filter((t) => t.projectId === selectedTask.projectId)
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500 mt-1">{tasksWithDeadlines} card{tasksWithDeadlines !== 1 ? "s" : ""} with deadlines</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-50 rounded-l-lg transition-colors">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <span className="px-4 py-1.5 text-sm font-semibold text-slate-800 min-w-[160px] text-center">
              {monthLabel}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-50 rounded-r-lg transition-colors">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-slate-500 text-center uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const isToday = cell.dateStr === todayStr;
            const dayTasks = cell.dateStr ? tasksByDate[cell.dateStr] || [] : [];
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;

            return (
              <div
                key={idx}
                className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 ${
                  !cell.day ? "bg-slate-50/50" : isWeekend ? "bg-slate-50/30" : ""
                }`}
              >
                {cell.day && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500"
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] text-slate-400">{dayTasks.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => {
                        const project = projectMap[task.projectId];
                        const projectColor = project?.color || "#6366f1";
                        return (
                          <button
                            key={task._id}
                            onClick={() => openTask(task)}
                            className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate block hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: projectColor + "18",
                              color: projectColor,
                            }}
                            title={`${task.title} (${project?.name || ""})`}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITY_DOT[task.priority]}`} />
                            {task.title}
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="text-[10px] text-slate-400 pl-1.5">
                          +{dayTasks.length - 3} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Task modal */}
      {selectedTask && (
        <EditTaskModal
          task={selectedTask as any}
          allTasks={projectTasks as any}
          statuses={columns}
          boardName={selectedProject?.name || ""}
          boardStatus=""
          onClose={() => setSelectedTask(null)}
          onUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}
