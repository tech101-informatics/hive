"use client";
import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, Tag, Flag, User, Calendar, Layers } from "lucide-react";

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
}

interface Props {
  projectId: string;
  projectName: string;
  statuses: BoardColumn[];
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", dot: "bg-green-500" },
  { value: "medium", label: "Medium", dot: "bg-yellow-500" },
  { value: "high", label: "High", dot: "bg-red-500" },
];

export function CreateTaskModal({ projectId, projectName, statuses, onClose, onCreated }: Props) {
  const defaultSlug = statuses.find((s) => s.isDefault)?.slug || statuses[0]?.slug || "todo";
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignees: [] as string[],
    labels: [] as string[],
    deadline: "",
    status: defaultSlug,
  });
  const [members, setMembers] = useState<{ _id: string; name: string }[]>([]);
  const [allLabels, setAllLabels] = useState<LabelData[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const assigneeRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetch("/api/members"), fetch("/api/labels")])
      .then(async ([mRes, lRes]) => {
        const mData = await mRes.json();
        const lData = await lRes.json();
        setMembers(Array.isArray(mData) ? mData : []);
        setAllLabels(Array.isArray(lData) ? lData : []);
      });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setShowAssigneeDropdown(false);
      if (labelRef.current && !labelRef.current.contains(e.target as Node)) setShowLabelDropdown(false);
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setShowPriorityDropdown(false);
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setShowStatusDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleAssignee = (name: string) => {
    setForm((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(name)
        ? prev.assignees.filter((a) => a !== name)
        : [...prev.assignees, name],
    }));
  };

  const toggleLabel = (name: string) => {
    setForm((prev) => ({
      ...prev,
      labels: prev.labels.includes(name)
        ? prev.labels.filter((l) => l !== name)
        : [...prev.labels, name],
    }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Card title is required"); return; }
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        projectId,
        deadline: form.deadline || undefined,
        labels: form.labels.length > 0 ? form.labels : undefined,
      }),
    });
    setSaving(false);
    onCreated();
  };

  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === form.priority);
  const currentStatus = statuses.find((s) => s.slug === form.status);

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Create Card</h2>
            <p className="text-text-secondary text-xs mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-card rounded-lg transition-colors">
            <X size={18} className="text-text-secondary" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <input
              autoFocus
              className="w-full text-lg font-medium text-text-primary bg-transparent border-0 border-b-2 border-border pb-2 focus:outline-none focus:border-brand transition-colors placeholder:text-text-disabled"
              value={form.title}
              onChange={(e) => { setForm({ ...form, title: e.target.value }); setError(""); }}
              placeholder="Card title..."
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            />
            {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">Description</label>
            <textarea
              className="w-full border border-border bg-bg-card text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand resize-none transition-colors placeholder:text-text-disabled"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add a description..."
            />
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div ref={priorityRef} className="relative">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">Priority</label>
              <button
                type="button"
                onClick={() => setShowPriorityDropdown((p) => !p)}
                className="w-full border border-border bg-bg-card rounded-lg px-3 py-2 text-left flex items-center gap-2 hover:border-border transition-colors"
              >
                <Flag size={13} className="text-text-secondary" />
                <span className={`w-2 h-2 rounded-full ${currentPriority?.dot}`} />
                <span className="text-sm text-text-primary flex-1">{currentPriority?.label}</span>
                <ChevronDown size={12} className={`text-text-secondary transition-transform ${showPriorityDropdown ? "rotate-180" : ""}`} />
              </button>
              {showPriorityDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setForm({ ...form, priority: p.value }); setShowPriorityDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                        form.priority === p.value ? "bg-brand-subtle text-brand" : "text-text-primary hover:bg-bg-surface"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div ref={statusRef} className="relative">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">Status</label>
              <button
                type="button"
                onClick={() => setShowStatusDropdown((p) => !p)}
                className="w-full border border-border bg-bg-card rounded-lg px-3 py-2 text-left flex items-center gap-2 hover:border-border transition-colors"
              >
                <Layers size={13} className="text-text-secondary" />
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatus?.color }} />
                <span className="text-sm text-text-primary flex-1">{currentStatus?.label}</span>
                <ChevronDown size={12} className={`text-text-secondary transition-transform ${showStatusDropdown ? "rotate-180" : ""}`} />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                  {statuses.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => { setForm({ ...form, status: s.slug }); setShowStatusDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                        form.status === s.slug ? "bg-brand-subtle text-brand" : "text-text-primary hover:bg-bg-surface"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div ref={assigneeRef} className="relative">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">Assignees</label>
            <button
              type="button"
              onClick={() => setShowAssigneeDropdown((p) => !p)}
              className="w-full border border-border bg-bg-card rounded-lg px-3 py-2 text-left flex items-center gap-2 hover:border-border transition-colors"
            >
              <User size={13} className="text-text-secondary flex-shrink-0" />
              {form.assignees.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                  {form.assignees.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 bg-bg-card text-text-primary text-xs px-2 py-0.5 rounded-full">
                      <span className="w-4 h-4 rounded-full bg-brand-subtle flex items-center justify-center text-brand text-[8px] font-bold">
                        {initials(a)}
                      </span>
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-text-disabled flex-1">Select assignees...</span>
              )}
              <ChevronDown size={12} className={`text-text-secondary flex-shrink-0 transition-transform ${showAssigneeDropdown ? "rotate-180" : ""}`} />
            </button>
            {showAssigneeDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto py-1">
                {members.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => toggleAssignee(m.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-surface transition-colors text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                      form.assignees.includes(m.name)
                        ? "bg-brand border-brand text-white"
                        : "border-border"
                    }`}>
                      {form.assignees.includes(m.name) && "✓"}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-brand-subtle flex items-center justify-center text-brand text-[9px] font-bold flex-shrink-0">
                      {initials(m.name)}
                    </span>
                    <span className="text-text-primary">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Labels */}
          {allLabels.length > 0 && (
            <div ref={labelRef} className="relative">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">Labels</label>
              <button
                type="button"
                onClick={() => setShowLabelDropdown((p) => !p)}
                className="w-full border border-border bg-bg-card rounded-lg px-3 py-2 text-left flex items-center gap-2 hover:border-border transition-colors"
              >
                <Tag size={13} className="text-text-secondary flex-shrink-0" />
                {form.labels.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                    {form.labels.map((l) => {
                      const ld = allLabels.find((al) => al.name === l);
                      return (
                        <span
                          key={l}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: ld?.color || "#6366f1" }}
                        >
                          {l}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-text-disabled flex-1">Add labels...</span>
                )}
                <ChevronDown size={12} className={`text-text-secondary flex-shrink-0 transition-transform ${showLabelDropdown ? "rotate-180" : ""}`} />
              </button>
              {showLabelDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto py-1">
                  {allLabels.map((l) => (
                    <button
                      key={l._id}
                      type="button"
                      onClick={() => toggleLabel(l.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-surface transition-colors text-left"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        form.labels.includes(l.name)
                          ? "bg-brand border-brand text-white"
                          : "border-border"
                      }`}>
                        {form.labels.includes(l.name) && "✓"}
                      </span>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="text-text-primary">{l.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">Deadline</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
              <input
                type="date"
                className="w-full border border-border bg-bg-card text-text-primary rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm text-text-secondary hover:bg-bg-card transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-hover disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? "Creating..." : "Create Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
