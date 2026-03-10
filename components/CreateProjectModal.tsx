"use client";
import { useState } from "react";
import { X } from "lucide-react";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", description: "", color: "#6366f1", status: "active" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Board name is required"); return; }
    setSaving(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">New Board</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Board Name *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setError(""); }}
              placeholder="e.g. Website Redesign"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="What is this project about?"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Status</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
            {saving ? "Creating..." : "Create Board"}
          </button>
        </div>
      </div>
    </div>
  );
}
