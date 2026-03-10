"use client";
import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";

interface BoardColumn {
  _id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
}

interface Props {
  projectId: string;
  projectName: string;
  statuses: BoardColumn[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskModal({ projectId, projectName, statuses, onClose, onCreated }: Props) {
  const defaultSlug = statuses.find((s) => s.isDefault)?.slug || statuses[0]?.slug || "todo";
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", assignees: [] as string[], deadline: "", status: defaultSlug,
  });
  const [members, setMembers] = useState<{ _id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/members").then(r => r.json()).then(setMembers);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    if (showAssigneeDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAssigneeDropdown]);

  const toggleAssignee = (name: string) => {
    setForm(prev => ({
      ...prev,
      assignees: prev.assignees.includes(name)
        ? prev.assignees.filter(a => a !== name)
        : [...prev.assignees, name],
    }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Card title is required"); return; }
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, projectId, deadline: form.deadline || undefined }),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">New Card</h2>
            <p className="text-slate-500 text-sm">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Title *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); setError(""); }}
              placeholder="e.g. Design landing page"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Card details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Priority</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {statuses.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div ref={assigneeRef} className="relative">
            <label className="text-sm font-medium text-slate-700 block mb-1">Assign To</label>
            <button
              type="button"
              onClick={() => setShowAssigneeDropdown(p => !p)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span className="text-sm text-slate-700 truncate">
                {form.assignees.length > 0 ? form.assignees.join(", ") : "Select assignees..."}
              </span>
              <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
            </button>
            {showAssigneeDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                {members.map(m => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => toggleAssignee(m.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                      form.assignees.includes(m.name)
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300"
                    }`}>
                      {form.assignees.includes(m.name) && "✓"}
                    </span>
                    <span className="text-slate-700">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Deadline</label>
            <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
            {saving ? "Creating..." : "Create Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
