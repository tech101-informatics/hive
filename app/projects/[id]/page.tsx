"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, Search, X, ChevronDown, Flag, User, Tag } from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskModal } from "@/components/CreateTaskModal";

interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  color: string;
}

interface FilterDropdownProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onSelect: (v: string) => void;
  children: React.ReactNode;
}

function FilterDropdown({ label, icon, value, onSelect, children }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors whitespace-nowrap ${
          value
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
        }`}
      >
        {icon}
        {value || label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[60] min-w-[180px] max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => { onSelect(""); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
              !value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          <div className="h-px bg-slate-100 my-0.5" />
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterLabel, setFilterLabel] = useState<string>("");
  const [members, setMembers] = useState<{ _id: string; name: string; avatar?: string }[]>([]);
  const [labels, setLabels] = useState<{ _id: string; name: string; color: string }[]>([]);

  const activeFilterCount = [filterPriority, filterAssignee, filterLabel, search].filter(Boolean).length;

  useEffect(() => {
    Promise.all([fetch("/api/members"), fetch("/api/labels")])
      .then(async ([mRes, lRes]) => {
        const mData = await mRes.json();
        const lData = await lRes.json();
        setMembers(Array.isArray(mData) ? mData : []);
        setLabels(Array.isArray(lData) ? lData : []);
      });
  }, []);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && !(t.assignees || []).includes(filterAssignee)) return false;
      if (filterLabel && !(t.labels || []).includes(filterLabel)) return false;
      return true;
    });
  }, [tasks, search, filterPriority, filterAssignee, filterLabel]);

  const clearFilters = () => {
    setSearch("");
    setFilterPriority("");
    setFilterAssignee("");
    setFilterLabel("");
  };

  const fetchData = async () => {
    const [pRes, tRes, cRes] = await Promise.all([
      fetch(`/api/projects/${id}`),
      fetch(`/api/tasks?projectId=${id}`),
      fetch("/api/board-status"),
    ]);
    const pData = await pRes.json();
    const tData = await tRes.json();
    const cData = await cRes.json();
    setProject(pData?.error ? null : pData);
    setTasks(Array.isArray(tData) ? tData : []);
    setColumns(Array.isArray(cData) ? cData : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("task-updated", handler);
    return () => window.removeEventListener("task-updated", handler);
  }, []);

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  );

  const priorities = [
    { value: "high", label: "High", dot: "bg-red-500" },
    { value: "medium", label: "Medium", dot: "bg-yellow-500" },
    { value: "low", label: "Low", dot: "bg-green-500" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ background: project?.color }} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{project?.name}</h1>
              {project?.description && <p className="text-slate-500 text-sm">{project.description}</p>}
            </div>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-sm text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            <Plus size={16} /> Add Card
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-4 bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors"
            />
          </div>

          {/* Priority dropdown */}
          <FilterDropdown
            label="Priority"
            icon={<Flag size={13} />}
            value={filterPriority ? priorities.find((p) => p.value === filterPriority)?.label || "" : ""}
            onSelect={setFilterPriority}
          >
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setFilterPriority(filterPriority === p.value ? "" : p.value)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                  filterPriority === p.value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                {p.label}
              </button>
            ))}
          </FilterDropdown>

          {/* Assignee dropdown */}
          <FilterDropdown
            label="Assignee"
            icon={<User size={13} />}
            value={filterAssignee}
            onSelect={setFilterAssignee}
          >
            {members.map((m) => (
              <button
                key={m._id}
                type="button"
                onClick={() => setFilterAssignee(filterAssignee === m.name ? "" : m.name)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                  filterAssignee === m.name ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m.avatar ? (
                  <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full flex-shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[9px] font-bold flex-shrink-0">
                    {initials(m.name)}
                  </span>
                )}
                {m.name}
              </button>
            ))}
          </FilterDropdown>

          {/* Label dropdown */}
          <FilterDropdown
            label="Label"
            icon={<Tag size={13} />}
            value={filterLabel}
            onSelect={setFilterLabel}
          >
            {labels.map((l) => (
              <button
                key={l._id}
                type="button"
                onClick={() => setFilterLabel(filterLabel === l.name ? "" : l.name)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                  filterLabel === l.name ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                {l.name}
              </button>
            ))}
          </FilterDropdown>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Active filter count */}
        {activeFilterCount > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Showing {filteredTasks.length} of {tasks.length} cards
          </div>
        )}
      </div>

      <div className="-mx-4 px-4 overflow-x-auto">
        <KanbanBoard
          tasks={filteredTasks}
          columns={columns}
          onTaskUpdated={fetchData}
          isAdmin={isAdmin}
          boardName={project?.name || ""}
          boardStatus={project?.status || ""}
          members={members}
        />
      </div>

      {showModal && (
        <CreateTaskModal
          projectId={id as string}
          projectName={project?.name || ""}
          statuses={columns}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}
