"use client";
import { useState } from "react";
import { X } from "lucide-react";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Board name is required");
      return;
    }
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">
            New Board
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-card rounded-lg"
          >
            <X size={18} className="text-text-secondary" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              Board Name *
            </label>
            <input
              className="w-full bg-bg-card text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-text-disabled"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setError("");
              }}
              placeholder="e.g. Website Redesign"
            />
            {error && <p className="text-danger text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              Description
            </label>
            <textarea
              className="w-full bg-bg-card text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand resize-none placeholder:text-text-disabled"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What is this project about?"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-1 ring-text-disabled ring-offset-bg-surface" : "hover:scale-110"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              Status
            </label>
            <select
              className="w-full bg-bg-card text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value })
              }
            >
              <option className="bg-bg-card text-text-primary" value="active">
                Active
              </option>
              <option
                className="bg-bg-card text-text-primary"
                value="on-hold"
              >
                On Hold
              </option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-bg-card rounded-lg text-text-secondary hover:bg-bg-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? "Creating..." : "Create Board"}
          </button>
        </div>
      </div>
    </div>
  );
}
