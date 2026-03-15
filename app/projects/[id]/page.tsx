"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Search,
  X,
  ChevronDown,
  Flag,
  User,
  Tag,
  MoreVertical,
  Archive,
  Trash2,
} from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { AssigneeDropdown } from "@/components/AssigneeDropdown";
import { ConfirmModal } from "@/components/ConfirmModal";

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

function FilterDropdown({
  label,
  icon,
  value,
  onSelect,
  children,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
          value
            ? "filter-btn-active"
            : "bg-bg-base text-text-secondary hover:bg-bg-surface"
        }`}
      >
        {icon}
        {value || label}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-fit min-w-[180px] max-h-64 overflow-y-auto py-1.5">
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer ${
              !value
                ? "filter-item-active"
                : "text-text-primary hover:bg-bg-surface"
            }`}
          >
            All
          </button>
          <div className="h-px bg-bg-base my-0.5" />
          {children}
        </div>
      )}
    </div>
  );
}

interface MultiFilterDropdownProps {
  label: string;
  icon: React.ReactNode;
  values: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  children: React.ReactNode;
}

function MultiFilterDropdown({
  label,
  icon,
  values,
  onToggle,
  onClear,
  children,
}: MultiFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasSelection = values.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
          hasSelection
            ? "filter-btn-active"
            : "bg-bg-base text-text-secondary hover:bg-bg-surface"
        }`}
      >
        {icon}
        {hasSelection ? `${label} (${values.length})` : label}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-fit min-w-54 max-h-64 overflow-y-auto py-1.5">
          {hasSelection && (
            <>
              <button
                type="button"
                onClick={onClear}
                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-bg-surface transition-colors cursor-pointer"
              >
                Clear all
              </button>
              <div className="h-px bg-bg-base my-0.5" />
            </>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const boardMenuRef = useRef<HTMLDivElement>(null);
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "archive" | null
  >(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [members, setMembers] = useState<
    { _id: string; name: string; avatar?: string }[]
  >([]);
  const [labels, setLabels] = useState<
    { _id: string; name: string; color: string }[]
  >([]);

  const activeFilterCount =
    (filterPriority ? 1 : 0) +
    filterAssignees.length +
    filterLabels.length +
    (search ? 1 : 0);

  useEffect(() => {
    Promise.all([fetch("/api/members"), fetch("/api/labels")]).then(
      async ([mRes, lRes]) => {
        const mData = await mRes.json();
        const lData = await lRes.json();
        setMembers(Array.isArray(mData) ? mData : []);
        setLabels(Array.isArray(lData) ? lData : []);
      }
    );
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (
        filterAssignees.length > 0 &&
        !filterAssignees.some((a) => (t.assignees || []).includes(a))
      )
        return false;
      if (
        filterLabels.length > 0 &&
        !filterLabels.some((l) => (t.labels || []).includes(l))
      )
        return false;
      return true;
    });
  }, [tasks, search, filterPriority, filterAssignees, filterLabels]);

  const clearFilters = () => {
    setSearch("");
    setFilterPriority("");
    setFilterAssignees([]);
    setFilterLabels([]);
  };

  const toggleLabel = (name: string) =>
    setFilterLabels((prev) =>
      prev.includes(name) ? prev.filter((l) => l !== name) : [...prev, name]
    );

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

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("task-updated", handler);
    return () => window.removeEventListener("task-updated", handler);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        boardMenuRef.current &&
        !boardMenuRef.current.contains(e.target as Node)
      )
        setBoardMenuOpen(false);
    };
    if (boardMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [boardMenuOpen]);

  const handleDeleteBoard = async () => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setConfirmAction(null);
    router.push("/projects");
  };

  const handleArchiveBoard = async () => {
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setConfirmAction(null);
    router.push("/projects");
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );

  const priorities = [
    { value: "high", label: "High", dot: "bg-red-500" },
    { value: "medium", label: "Medium", dot: "bg-yellow-500" },
    { value: "low", label: "Low", dot: "bg-green-500" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="p-2 hover:bg-bg-card rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="w-3.5 h-3.5 rounded"
              style={{ background: project?.color }}
            />
            <div>
              <h1 className="text-xl font-semibold text-text-primary tracking-tight">
                {project?.name}
              </h1>
              {project?.description && (
                <p className="text-text-secondary text-sm">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-brand text-sm text-white px-3 py-2 rounded-lg hover:bg-brand-hover font-medium transition-colors"
            >
              <Plus size={16} /> Add Card
            </button>
            <div className="relative" ref={boardMenuRef}>
              <button
                onClick={() => setBoardMenuOpen((p) => !p)}
                className="p-2 hover:bg-bg-card rounded-lg transition-colors"
              >
                <MoreVertical size={18} className="text-text-secondary" />
              </button>
              {boardMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-44 py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      setBoardMenuOpen(false);
                      setConfirmAction("archive");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    <Archive size={14} /> Archive Board
                  </button>
                  <div className="h-px bg-bg-base mx-2 my-0.5" />
                  <button
                    onClick={() => {
                      setBoardMenuOpen(false);
                      setConfirmAction("delete");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-bg-surface transition-colors"
                  >
                    <Trash2 size={14} /> Delete Board
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-2xl bg-bg-card p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-bg-base text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
            />
          </div>

          <FilterDropdown
            label="Priority"
            icon={<Flag size={13} />}
            value={
              filterPriority
                ? priorities.find((p) => p.value === filterPriority)?.label ||
                  ""
                : ""
            }
            onSelect={setFilterPriority}
          >
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  setFilterPriority(
                    filterPriority === p.value ? "" : p.value
                  )
                }
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                  filterPriority === p.value
                    ? "filter-item-active"
                    : "text-text-primary hover:bg-bg-base"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                {p.label}
              </button>
            ))}
          </FilterDropdown>

          <AssigneeDropdown
            variant="button"
            members={members}
            selected={filterAssignees}
            onChange={setFilterAssignees}
          />

          <MultiFilterDropdown
            label="Label"
            icon={<Tag size={13} />}
            values={filterLabels}
            onToggle={toggleLabel}
            onClear={() => setFilterLabels([])}
          >
            {labels.map((l) => {
              const selected = filterLabels.includes(l.name);
              return (
                <button
                  key={l._id}
                  type="button"
                  onClick={() => toggleLabel(l.name)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left hover:bg-bg-surface ${
                    selected
                      ? "filter-item-active"
                      : "text-text-primary hover:bg-bg-base"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center ${
                      selected ? "bg-brand" : "bg-bg-base"
                    }`}
                  >
                    {selected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 5L4 7L8 3"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                </button>
              );
            })}
          </MultiFilterDropdown>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-danger hover:bg-danger-subtle rounded-lg transition-colors font-medium"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {activeFilterCount > 0 && (
          <div className="mt-2 text-xs text-text-disabled">
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
          onCreated={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction === "delete" ? "Delete Board" : "Archive Board"
          }
          message={
            confirmAction === "delete"
              ? `"${project?.name}" and all its cards will be permanently deleted. This cannot be undone.`
              : `"${project?.name}" will be archived and hidden. You can restore it later.`
          }
          confirmText={confirmAction === "delete" ? "Delete" : "Archive"}
          variant={confirmAction === "delete" ? "danger" : "warning"}
          onConfirm={
            confirmAction === "delete"
              ? handleDeleteBoard
              : handleArchiveBoard
          }
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
