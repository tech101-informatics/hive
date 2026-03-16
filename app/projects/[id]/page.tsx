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
  Bookmark,
  Repeat,
  Download,
  ArchiveRestore,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { AssigneeDropdown } from "@/components/AssigneeDropdown";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableView } from "@/components/TableView";
import { UndoToast } from "@/components/UndoToast";

interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  color: string;
}

interface SavedFilterData {
  _id: string;
  name: string;
  filters: { search: string; priority: string; assignees: string[]; labels: string[] };
}

function SavedViewsDropdown({
  savedFilters,
  activeFilterId,
  onApply,
  onDelete,
}: {
  savedFilters: SavedFilterData[];
  activeFilterId: string | null;
  onApply: (sf: SavedFilterData) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeName = activeFilterId
    ? savedFilters.find((sf) => sf._id === activeFilterId)?.name
    : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
          activeName
            ? "filter-btn-active"
            : "bg-bg-base text-text-secondary hover:bg-bg-surface"
        }`}
      >
        <Bookmark size={13} />
        {activeName || "Views"}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-56 max-h-64 overflow-y-auto py-1.5">
          {activeFilterId && (
            <>
              <button
                type="button"
                onClick={() => {
                  onApply({ _id: "", name: "", filters: { search: "", priority: "", assignees: [], labels: [] } });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-surface transition-colors cursor-pointer"
              >
                Clear view
              </button>
              <div className="h-px bg-bg-base my-0.5" />
            </>
          )}
          {savedFilters.map((sf) => (
            <div
              key={sf._id}
              className={`flex items-center justify-between px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                activeFilterId === sf._id
                  ? "filter-item-active"
                  : "text-text-primary hover:bg-bg-surface"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onApply(sf);
                  setOpen(false);
                }}
                className="flex-1 text-left truncate"
              >
                {sf.name}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(sf._id);
                }}
                className="p-1 text-text-disabled hover:text-danger transition-colors flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "archive" | null
  >(null);
  const [undoToast, setUndoToast] = useState<{ message: string; taskIds: string[] } | null>(null);

  const handleArchive = (taskIds: string[], titles: string[]) => {
    fetchData();
    const msg = titles.length === 1
      ? `"${titles[0]}" archived`
      : `${titles.length} cards archived`;
    setUndoToast({ message: msg, taskIds });
  };

  const undoArchive = async (taskIds: string[]) => {
    for (const id of taskIds) {
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    }
    setUndoToast(null);
    fetchData();
  };

  const [viewMode, setViewMode] = useState<"kanban" | "table">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("hive-view-mode") as "kanban" | "table") || "kanban";
    }
    return "kanban";
  });

  const switchView = (mode: "kanban" | "table") => {
    setViewMode(mode);
    localStorage.setItem("hive-view-mode", mode);
  };

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

  // Saved filters
  const [savedFilters, setSavedFilters] = useState<SavedFilterData[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

  const activeFilterCount =
    (filterPriority ? 1 : 0) +
    filterAssignees.length +
    filterLabels.length +
    (search ? 1 : 0);

  const fetchSavedFilters = () => {
    fetch("/api/saved-filters")
      .then((r) => r.json())
      .then((d) => setSavedFilters(Array.isArray(d) ? d : []))
      .catch(() => setSavedFilters([]));
  };

  useEffect(() => {
    Promise.all([fetch("/api/members"), fetch("/api/labels")]).then(
      async ([mRes, lRes]) => {
        const mData = await mRes.json();
        const lData = await lRes.json();
        setMembers(Array.isArray(mData) ? mData : []);
        setLabels(Array.isArray(lData) ? lData : []);
      }
    );
    fetchSavedFilters();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "n" && !showModal) {
        e.preventDefault();
        setShowModal(true);
      }
      if (e.key === "/" ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const applyFilter = (sf: typeof savedFilters[0]) => {
    setSearch(sf.filters.search || "");
    setFilterPriority(sf.filters.priority || "");
    setFilterAssignees(sf.filters.assignees || []);
    setFilterLabels(sf.filters.labels || []);
    setActiveFilterId(sf._id);
  };

  const saveCurrentFilter = async () => {
    if (!saveFilterName.trim()) return;
    await fetch("/api/saved-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveFilterName.trim(),
        projectId: id,
        filters: { search, priority: filterPriority, assignees: filterAssignees, labels: filterLabels },
      }),
    });
    setSaveFilterName("");
    setShowSaveDialog(false);
    fetchSavedFilters();
  };

  const deleteSavedFilter = async (filterId: string) => {
    await fetch(`/api/saved-filters/${filterId}`, { method: "DELETE" });
    if (activeFilterId === filterId) setActiveFilterId(null);
    fetchSavedFilters();
  };

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
    setActiveFilterId(null);
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
    const archiveHandler = (e: Event) => {
      const { taskIds, titles } = (e as CustomEvent).detail;
      handleArchive(taskIds, titles);
    };
    window.addEventListener("task-updated", handler);
    window.addEventListener("task-archived", archiveHandler);
    return () => {
      window.removeEventListener("task-updated", handler);
      window.removeEventListener("task-archived", archiveHandler);
    };
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projects"
            className="p-2 hover:bg-bg-card rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </Link>
          <span
            className="w-3 h-3 rounded flex-shrink-0"
            style={{ background: project?.color }}
          />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-text-primary tracking-tight truncate">
              {project?.name}
            </h1>
            {project?.description && (
              <p className="text-text-secondary text-sm truncate hidden sm:block">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg bg-bg-card p-0.5">
            <button
              onClick={() => switchView("kanban")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "kanban" ? "bg-bg-base text-text-primary" : "text-text-disabled hover:text-text-secondary"}`}
              title="Kanban view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => switchView("table")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-bg-base text-text-primary" : "text-text-disabled hover:text-text-secondary"}`}
              title="Table view"
            >
              <Table2 size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand text-sm text-white px-3 py-2 rounded-lg hover:bg-brand-hover font-medium transition-colors"
          >
            <Plus size={16} /> Add Card
          </button>
        {isAdmin && (
          <>
            <div className="relative" ref={boardMenuRef}>
              <button
                onClick={() => setBoardMenuOpen((p) => !p)}
                className="p-2 hover:bg-bg-card rounded-lg transition-colors"
              >
                <MoreVertical size={18} className="text-text-secondary" />
              </button>
              {boardMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-48 py-1 overflow-hidden">
                  <Link
                    href={`/projects/${id}/recurring`}
                    onClick={() => setBoardMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    <Repeat size={14} /> Recurring Tasks
                  </Link>
                  <Link
                    href={`/projects/${id}/archived`}
                    onClick={() => setBoardMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    <ArchiveRestore size={14} /> Archived Cards
                  </Link>
                  <a
                    href={`/api/tasks/export?projectId=${id}`}
                    onClick={() => setBoardMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    <Download size={14} /> Export CSV
                  </a>
                  <div className="h-px bg-bg-base mx-2 my-0.5" />
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
          </>
        )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-2xl bg-bg-card p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Saved views dropdown */}
          {savedFilters.length > 0 && (
            <SavedViewsDropdown
              savedFilters={savedFilters}
              activeFilterId={activeFilterId}
              onApply={applyFilter}
              onDelete={deleteSavedFilter}
            />
          )}

          {/* My Cards quick filter */}
          <button
            type="button"
            onClick={() => {
              const myName = session?.user?.name || "";
              if (filterAssignees.length === 1 && filterAssignees[0] === myName) {
                setFilterAssignees([]);
                setActiveFilterId(null);
              } else {
                setFilterAssignees([myName]);
                setActiveFilterId(null);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
              filterAssignees.length === 1 && filterAssignees[0] === session?.user?.name
                ? "filter-btn-active"
                : "bg-bg-base text-text-secondary hover:bg-bg-surface"
            }`}
          >
            <User size={13} />
            My Cards
          </button>

          <div className="relative min-w-[140px] flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards... ( / )"
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
            <>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-danger hover:bg-danger-subtle rounded-lg transition-colors font-medium"
              >
                <X size={12} /> Clear
              </button>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-brand hover:bg-brand-subtle rounded-lg transition-colors font-medium"
              >
                <Bookmark size={12} /> Save View
              </button>
            </>
          )}
        </div>

        {/* Save filter dialog */}
        {showSaveDialog && (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              className="text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand flex-1 max-w-xs"
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              placeholder="View name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentFilter();
                if (e.key === "Escape") setShowSaveDialog(false);
              }}
            />
            <button
              onClick={saveCurrentFilter}
              className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-hover"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="p-1.5 text-text-disabled hover:text-text-secondary"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {activeFilterCount > 0 && (
          <div className="mt-2 text-xs text-text-disabled">
            Showing {filteredTasks.length} of {tasks.length} cards
          </div>
        )}
      </div>

      {viewMode === "kanban" ? (
        <div className="-mx-4 px-4 overflow-x-auto">
          <KanbanBoard
            tasks={filteredTasks}
            columns={columns}
            onTaskUpdated={fetchData}
            onArchive={handleArchive}
            isAdmin={isAdmin}
            boardName={project?.name || ""}
            boardStatus={project?.status || ""}
            members={members}
          />
        </div>
      ) : (
        <TableView
          tasks={filteredTasks}
          columns={columns}
          members={members}
          onTaskUpdated={fetchData}
          onArchive={handleArchive}
        />
      )}

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

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={() => undoArchive(undoToast.taskIds)}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
}
