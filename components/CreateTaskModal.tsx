"use client";
import { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronDown,
  Tag,
  Flag,
  User,
  Calendar,
  Layers,
  Plus,
  ChevronsUpDown,
  CheckSquare,
  Trash2,
  FileText,
  Link2,
  GitBranch,
  GitPullRequest,
  Ban,
  Paperclip,
  File,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AssigneeDropdown } from "@/components/AssigneeDropdown";

interface BoardColumn {
  _id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
}

interface LabelData {
  _id: string;
  name: string;
  color: string;
  category?: string;
}

interface ChecklistItem {
  text: string;
  completed: boolean;
  order: number;
}

interface Props {
  projectId: string;
  projectName: string;
  statuses: BoardColumn[];
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", cls: "bg-green-100 text-green-700" },
  { value: "medium", label: "Medium", cls: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "High", cls: "bg-red-100 text-red-700" },
];

const PROGRESS_STATUS_OPTIONS = [
  { value: "", label: "None", cls: "bg-gray-100 text-gray-600" },
  { value: "fe", label: "FE", cls: "bg-violet-100 text-violet-700" },
  { value: "be", label: "BE", cls: "bg-sky-100 text-sky-700" },
  { value: "qa", label: "QA", cls: "bg-amber-100 text-amber-700" },
];

export function CreateTaskModal({
  projectId,
  projectName,
  statuses,
  onClose,
  onCreated,
}: Props) {
  const defaultSlug =
    statuses.find((s) => s.isDefault)?.slug || statuses[0]?.slug || "todo";
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    progressStatus: "",
    assignees: [] as string[],
    labels: [] as string[],
    deadline: "",
    status: defaultSlug,
    parentId: "",
    branch: "",
    prUrl: "",
    blockedBy: [] as string[],
    checklist: [] as ChecklistItem[],
  });
  const [members, setMembers] = useState<
    { _id: string; name: string; avatar?: string }[]
  >([]);
  const [allLabels, setAllLabels] = useState<LabelData[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Attachments — queued for upload after task creation
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showProgressDropdown, setShowProgressDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const [labelSearch, setLabelSearch] = useState("");

  // Templates
  const [templates, setTemplates] = useState<
    {
      _id: string;
      name: string;
      title: string;
      description: string;
      priority: string;
      labels: string[];
      checklist: ChecklistItem[];
    }[]
  >([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Parent card
  const [allTasks, setAllTasks] = useState<
    { _id: string; title: string; cardNumber?: number }[]
  >([]);
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const parentCardRef = useRef<HTMLDivElement>(null);

  // Blocked by
  const [showBlockedByDropdown, setShowBlockedByDropdown] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState("");
  const blockedByRef = useRef<HTMLDivElement>(null);

  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const progressDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/members"),
      fetch("/api/labels"),
      fetch(`/api/card-templates?projectId=${projectId}`),
      fetch(`/api/tasks?projectId=${projectId}`),
    ]).then(async ([mRes, lRes, tRes, tasksRes]) => {
      const mData = await mRes.json();
      const lData = await lRes.json();
      const tData = await tRes.json();
      const tasksData = await tasksRes.json();
      setMembers(Array.isArray(mData) ? mData : []);
      setAllLabels(Array.isArray(lData) ? lData : []);
      setTemplates(Array.isArray(tData) ? tData : []);
      setAllTasks(Array.isArray(tasksData) ? tasksData : []);
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        showPriorityDropdown &&
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(e.target as Node)
      )
        setShowPriorityDropdown(false);
      if (
        showProgressDropdown &&
        progressDropdownRef.current &&
        !progressDropdownRef.current.contains(e.target as Node)
      )
        setShowProgressDropdown(false);
      if (
        showStatusDropdown &&
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      )
        setShowStatusDropdown(false);
      if (
        showLabelDropdown &&
        labelDropdownRef.current &&
        !labelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowLabelDropdown(false);
        setLabelSearch("");
      }
      if (
        showTemplateDropdown &&
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(e.target as Node)
      )
        setShowTemplateDropdown(false);
      if (
        showParentDropdown &&
        parentCardRef.current &&
        !parentCardRef.current.contains(e.target as Node)
      ) {
        setShowParentDropdown(false);
        setParentSearch("");
      }
      if (
        showBlockedByDropdown &&
        blockedByRef.current &&
        !blockedByRef.current.contains(e.target as Node)
      ) {
        setShowBlockedByDropdown(false);
        setBlockerSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [
    showPriorityDropdown,
    showProgressDropdown,
    showStatusDropdown,
    showLabelDropdown,
    showTemplateDropdown,
    showParentDropdown,
    showBlockedByDropdown,
  ]);

  const applyTemplate = (t: (typeof templates)[0]) => {
    setForm((prev) => ({
      ...prev,
      title: t.title || prev.title,
      description: t.description || prev.description,
      priority: t.priority || prev.priority,
      labels: t.labels?.length ? t.labels : prev.labels,
      checklist: t.checklist?.length
        ? t.checklist.map((c, i) => ({
            text: c.text,
            completed: false,
            order: i,
          }))
        : prev.checklist,
    }));
    setShowTemplateDropdown(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError("Card title is required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        projectId,
        deadline: form.deadline || undefined,
        labels: form.labels.length > 0 ? form.labels : undefined,
        checklist: form.checklist.length > 0 ? form.checklist : undefined,
        parentId: form.parentId || undefined,
        branch: form.branch || undefined,
        prUrl: form.prUrl || undefined,
        blockedBy: form.blockedBy.length > 0 ? form.blockedBy : undefined,
      }),
    });

    // Upload queued files after task is created
    if (pendingFiles.length > 0 && res.ok) {
      const task = await res.json();
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/tasks/${task._id}/attachments`, {
          method: "POST",
          body: fd,
        });
      }
    }

    setSaving(false);
    onCreated();
  };

  const statusCol = statuses.find((s) => s.slug === form.status);
  const statusOpt = statusCol
    ? { value: statusCol.slug, label: statusCol.label, color: statusCol.color }
    : { value: form.status, label: form.status, color: "#64748b" };
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === form.priority)!;
  const progressOpt = PROGRESS_STATUS_OPTIONS.find((p) => p.value === form.progressStatus) || PROGRESS_STATUS_OPTIONS[0];
  const mentionUsersList = members.map((m) => ({ id: m._id, label: m.name }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Full overlay panel */}
      <div
        className={`fixed inset-0 md:inset-4 lg:inset-8 bg-bg-surface md:rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-200 ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-bg-card">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-text-primary">Create Card</span>
            <span className="text-text-disabled">&middot;</span>
            <span className="text-text-secondary">{projectName}</span>
          </div>
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <div className="relative" ref={templateDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowTemplateDropdown((p) => !p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-bg-surface transition-colors"
                >
                  <FileText size={12} />
                  Template
                  <ChevronDown size={10} />
                </button>
                {showTemplateDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-56 py-1 max-h-48 overflow-y-auto">
                    {templates.map((t) => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-hover disabled:opacity-50 font-medium transition-colors text-xs"
            >
              {saving ? "Creating..." : "Create Card"}
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-bg-surface rounded-lg transition-colors"
            >
              <X size={18} className="text-text-disabled" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-4 md:pt-5">
          {/* Title */}
          <input
            autoFocus
            className="w-full text-xl md:text-2xl font-bold text-text-primary bg-transparent border-0 outline-none placeholder:text-text-disabled mb-1"
            value={form.title}
            onChange={(e) => {
              setForm({ ...form, title: e.target.value });
              setError("");
            }}
            placeholder="Card title..."
          />
          {error && <p className="text-danger text-xs mb-2">{error}</p>}

          {/* On boards section */}
          <div className="bg-bg-card rounded-xl mb-6 overflow-hidden mt-4">
            <div className="px-3 md:px-4 py-2 bg-bg-base/50">
              <span className="text-sm font-semibold text-text-primary">
                On boards (1)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="px-3 md:px-4 py-1 font-medium">Board</th>
                    <th className="px-3 md:px-4 py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-bg-base">
                    <td className="px-3 md:px-4 py-1">
                      <span className="text-text-primary font-medium text-xs md:text-sm">
                        {projectName}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-1">
                      <span
                        className="inline-block rounded-full text-xs font-semibold"
                        style={{ color: statusOpt.color }}
                      >
                        {statusOpt.label}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {showFields && (
            <div className="space-y-0">
              {/* Status */}
              <div className="flex items-center py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                  <Layers size={15} />
                  <span>Status</span>
                </div>
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown((p) => !p)}
                    className="text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: statusOpt.color + "18",
                      color: statusOpt.color,
                    }}
                  >
                    {statusOpt.label}
                    <ChevronDown size={10} className="inline ml-1" />
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-40 py-1">
                      {statuses.map((s) => (
                        <button
                          key={s.slug}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, status: s.slug }));
                            setShowStatusDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                            form.status === s.slug
                              ? "bg-bg-surface"
                              : "hover:bg-bg-surface"
                          }`}
                        >
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: s.color + "18",
                              color: s.color,
                            }}
                          >
                            {s.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                  <Flag size={15} />
                  <span>Priority</span>
                </div>
                <div className="relative" ref={priorityDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowPriorityDropdown((p) => !p)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-opacity hover:opacity-80 ${priorityOpt.cls}`}
                  >
                    {priorityOpt.label}
                    <ChevronDown size={10} className="inline ml-1" />
                  </button>
                  {showPriorityDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-40 py-1">
                      {PRIORITY_OPTIONS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, priority: p.value }));
                            setShowPriorityDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                            form.priority === p.value
                              ? "bg-bg-surface"
                              : "hover:bg-bg-surface"
                          }`}
                        >
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.cls}`}
                          >
                            {p.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Status */}
              <div className="flex items-center py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                  <Layers size={15} />
                  <span>Progress</span>
                </div>
                <div className="relative" ref={progressDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowProgressDropdown((p) => !p)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-opacity hover:opacity-80 ${progressOpt.cls}`}
                  >
                    {progressOpt.label}
                    <ChevronDown size={10} className="inline ml-1" />
                  </button>
                  {showProgressDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-40 py-1">
                      {PROGRESS_STATUS_OPTIONS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, progressStatus: p.value }));
                            setShowProgressDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                            form.progressStatus === p.value
                              ? "bg-bg-surface"
                              : "hover:bg-bg-surface"
                          }`}
                        >
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.cls}`}
                          >
                            {p.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignees */}
              <div className="flex items-start py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                  <User size={15} />
                  <span>Assignees</span>
                </div>
                <AssigneeDropdown
                  members={members}
                  selected={form.assignees}
                  onChange={(updated) =>
                    setForm((prev) => ({ ...prev, assignees: updated }))
                  }
                />
              </div>

              {/* Deadline */}
              <div className="flex items-center py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                  <Calendar size={15} />
                  <span>Deadline</span>
                </div>
                <input
                  type="date"
                  className="text-sm bg-transparent border-0 outline-none cursor-pointer text-text-primary"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </div>

              {/* Labels */}
              <div className="flex items-start py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                  <Tag size={15} />
                  <span>Labels</span>
                </div>
                <div
                  className="flex-1 relative flex items-center gap-1"
                  ref={labelDropdownRef}
                >
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {form.labels.map((label) => {
                      const labelData = allLabels.find((t) => t.name === label);
                      const labelColor = labelData?.color || "#6366f1";
                      return (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: labelColor + "18",
                            color: labelColor,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: labelColor }}
                          />
                          {label}
                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                labels: prev.labels.filter((l) => l !== label),
                              }));
                            }}
                            className="hover:opacity-60 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLabelDropdown((p) => !p)}
                    className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Add label
                  </button>
                  {showLabelDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-64 max-h-72 flex flex-col">
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={labelSearch}
                          onChange={(e) => setLabelSearch(e.target.value)}
                          placeholder="Search labels..."
                          className="w-full text-sm bg-bg-base text-text-primary rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand placeholder:text-text-disabled"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto py-1">
                        {(() => {
                          const filtered = allLabels
                            .filter((t) => !form.labels.includes(t.name))
                            .filter((t) =>
                              t.name
                                .toLowerCase()
                                .includes(labelSearch.toLowerCase()),
                            );
                          if (filtered.length === 0) {
                            return (
                              <p className="px-3 py-3 text-xs text-text-disabled text-center">
                                No labels found
                              </p>
                            );
                          }
                          const grouped: Record<string, LabelData[]> = {};
                          filtered.forEach((t) => {
                            const cat = t.category || "Other";
                            if (!grouped[cat]) grouped[cat] = [];
                            grouped[cat].push(t);
                          });
                          return Object.entries(grouped).map(
                            ([category, catLabels]) => (
                              <div key={category}>
                                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-text-disabled uppercase tracking-wider">
                                  {category}
                                </p>
                                {catLabels.map((t) => (
                                  <button
                                    key={t._id}
                                    type="button"
                                    onClick={() => {
                                      setForm((prev) => ({
                                        ...prev,
                                        labels: [...prev.labels, t.name],
                                      }));
                                      setLabelSearch("");
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-surface transition-colors text-left"
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: t.color }}
                                    />
                                    {t.name}
                                  </button>
                                ))}
                              </div>
                            ),
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Parent card */}
              <div className="flex items-start py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                  <Link2 size={15} />
                  <span>Parent Card</span>
                </div>
                <div className="flex-1 relative" ref={parentCardRef}>
                  {form.parentId ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-subtle text-brand font-medium mb-1">
                      {allTasks.find((t) => t._id === form.parentId)?.cardNumber
                        ? `SP-${allTasks.find((t) => t._id === form.parentId)?.cardNumber}`
                        : ""}{" "}
                      {allTasks.find((t) => t._id === form.parentId)?.title ||
                        "Unknown"}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, parentId: "" }))
                        }
                        className="hover:opacity-60 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowParentDropdown((p) => !p)}
                    className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> {form.parentId ? "Change" : "Set parent"}
                  </button>
                  {showParentDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-[calc(100vw-3rem)] max-w-72 max-h-48 flex flex-col">
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={parentSearch}
                          onChange={(e) => setParentSearch(e.target.value)}
                          placeholder="Search cards..."
                          className="w-full text-sm bg-bg-base text-text-primary rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand placeholder:text-text-disabled"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto py-1">
                        {form.parentId && (
                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, parentId: "" }));
                              setShowParentDropdown(false);
                              setParentSearch("");
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-surface transition-colors"
                          >
                            None
                          </button>
                        )}
                        {allTasks
                          .filter(
                            (t) =>
                              !parentSearch ||
                              t.title
                                .toLowerCase()
                                .includes(parentSearch.toLowerCase()) ||
                              (t.cardNumber &&
                                `SP-${t.cardNumber}`
                                  .toLowerCase()
                                  .includes(parentSearch.toLowerCase())),
                          )
                          .slice(0, 15)
                          .map((t) => (
                            <button
                              key={t._id}
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  parentId: t._id,
                                }));
                                setShowParentDropdown(false);
                                setParentSearch("");
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                                form.parentId === t._id
                                  ? "filter-item-active"
                                  : "text-text-primary hover:bg-bg-surface"
                              }`}
                            >
                              <span className="text-text-disabled text-xs font-mono">
                                {t.cardNumber ? `SP-${t.cardNumber}` : ""}
                              </span>
                              <span className="truncate">{t.title}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Branch */}
              <div className="flex items-center py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                  <GitBranch size={15} />
                  <span>Branch</span>
                </div>
                <input
                  type="text"
                  className="flex-1 text-sm bg-transparent border-0 outline-none text-text-primary placeholder:text-text-disabled font-mono"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  placeholder="feature/..."
                />
              </div>

              {/* PR URL */}
              <div className="flex items-center py-3 border-t border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                  <GitPullRequest size={15} />
                  <span>PR URL</span>
                </div>
                <input
                  type="text"
                  className="flex-1 text-sm bg-transparent border-0 outline-none text-text-primary placeholder:text-text-disabled"
                  value={form.prUrl}
                  onChange={(e) => setForm({ ...form, prUrl: e.target.value })}
                  placeholder="https://github.com/..."
                />
              </div>

              {/* Blocked By */}
              <div className="flex items-start py-3 border-t border-b border-bg-base">
                <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                  <Ban size={15} />
                  <span>Blocked By</span>
                </div>
                <div className="flex-1 relative" ref={blockedByRef}>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {form.blockedBy.map((blockerId) => {
                      const blockerTask = allTasks.find(
                        (t) => t._id === blockerId,
                      );
                      return (
                        <span
                          key={blockerId}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger-subtle text-danger font-medium"
                        >
                          {blockerTask?.cardNumber
                            ? `SP-${blockerTask.cardNumber}`
                            : ""}{" "}
                          {blockerTask?.title || "Unknown"}
                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                blockedBy: prev.blockedBy.filter(
                                  (id) => id !== blockerId,
                                ),
                              }));
                            }}
                            className="hover:opacity-60 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBlockedByDropdown((p) => !p)}
                    className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Add blocker
                  </button>
                  {showBlockedByDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-[calc(100vw-3rem)] max-w-72 max-h-48 flex flex-col">
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={blockerSearch}
                          onChange={(e) => setBlockerSearch(e.target.value)}
                          placeholder="Search cards..."
                          className="w-full text-sm bg-bg-base text-text-primary rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand placeholder:text-text-disabled"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto py-1">
                        {allTasks
                          .filter((t) => !form.blockedBy.includes(t._id))
                          .filter(
                            (t) =>
                              !blockerSearch ||
                              t.title
                                .toLowerCase()
                                .includes(blockerSearch.toLowerCase()) ||
                              (t.cardNumber &&
                                `SP-${t.cardNumber}`
                                  .toLowerCase()
                                  .includes(blockerSearch.toLowerCase())),
                          )
                          .slice(0, 15)
                          .map((t) => (
                            <button
                              key={t._id}
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  blockedBy: [...prev.blockedBy, t._id],
                                }));
                                setBlockerSearch("");
                                setShowBlockedByDropdown(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-surface transition-colors text-left"
                            >
                              <span className="text-text-disabled text-xs font-mono">
                                {t.cardNumber ? `SP-${t.cardNumber}` : ""}
                              </span>
                              <span className="truncate">{t.title}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Separator toggle */}
          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-bg-base" />
            <button
              type="button"
              onClick={() => setShowFields((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-card text-xs text-text-secondary hover:bg-bg-base transition-colors whitespace-nowrap"
            >
              {showFields ? "Hide" : "Show"} fields
              <ChevronsUpDown size={12} />
            </button>
          </div>

          {/* Description */}
          <div className="mt-6">
            <RichTextEditor
              mode="field"
              initialContent=""
              onChange={(html) =>
                setForm((prev) => ({ ...prev, description: html }))
              }
              placeholder="Add a description..."
              mentionUsers={mentionUsersList}
            />
          </div>

          {/* Attachments */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Paperclip size={16} className="text-text-secondary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Attachments
                </h3>
                {pendingFiles.length > 0 && (
                  <span className="text-xs text-text-disabled font-medium">
                    {pendingFiles.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => createFileInputRef.current?.click()}
                className="text-xs text-brand hover:text-brand-hover font-medium flex items-center gap-1"
              >
                <Plus size={12} /> Add file
              </button>
              <input
                ref={createFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      setError("File too large (max 10MB)");
                      return;
                    }
                    setPendingFiles((prev) => [...prev, file]);
                  }
                  if (createFileInputRef.current)
                    createFileInputRef.current.value = "";
                }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv"
              />
            </div>
            {pendingFiles.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                {pendingFiles.map((file, idx) => {
                  const isImage = file.type.startsWith("image/");
                  return (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden bg-bg-base aspect-square p-2"
                    >
                      {isImage ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2">
                          <File size={24} className="text-text-disabled" />
                          <span className="text-xs text-text-disabled text-center truncate w-full px-1">
                            {file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                        <div className="w-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate font-medium">
                            {file.name}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingFiles((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-600 text-white rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="mt-6 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare size={16} className="text-text-secondary" />
              <h3 className="text-sm font-semibold text-text-primary">
                Subtasks
              </h3>
              {form.checklist.length > 0 && (
                <span className="text-xs text-text-disabled font-medium">
                  {form.checklist.filter((i) => i.completed).length}/
                  {form.checklist.length}
                </span>
              )}
            </div>

            {form.checklist.length > 0 &&
              (() => {
                const done = form.checklist.filter((i) => i.completed).length;
                const total = form.checklist.length;
                return (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1.5 bg-border-subtle rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${done === total ? "bg-success" : "bg-brand"}`}
                        style={{ width: `${(done / total) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${done === total ? "text-success" : "text-text-disabled"}`}
                    >
                      {Math.round((done / total) * 100)}%
                    </span>
                  </div>
                );
              })()}

            <div className="space-y-1">
              {form.checklist
                .sort((a, b) => a.order - b.order)
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-bg-card transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => {
                        setForm((prev) => ({
                          ...prev,
                          checklist: prev.checklist.map((ci, i) =>
                            i === idx
                              ? { ...ci, completed: !ci.completed }
                              : ci,
                          ),
                        }));
                      }}
                      className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          checklist: prev.checklist.map((ci, i) =>
                            i === idx ? { ...ci, text: e.target.value } : ci,
                          ),
                        }));
                      }}
                      className={`flex-1 text-sm bg-transparent border-0 outline-none ${
                        item.completed
                          ? "line-through text-text-disabled"
                          : "text-text-primary"
                      }`}
                    />
                    <button
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          checklist: prev.checklist.filter((_, i) => i !== idx),
                        }));
                      }}
                      className="p-1 text-text-disabled hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Plus size={16} className="text-text-disabled" />
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newChecklistItem.trim()) {
                    e.preventDefault();
                    setForm((prev) => ({
                      ...prev,
                      checklist: [
                        ...prev.checklist,
                        {
                          text: newChecklistItem.trim(),
                          completed: false,
                          order: prev.checklist.length,
                        },
                      ],
                    }));
                    setNewChecklistItem("");
                  }
                }}
                placeholder="Add an item..."
                className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-text-disabled text-text-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
