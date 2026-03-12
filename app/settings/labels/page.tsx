"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";

interface Label {
  _id: string;
  name: string;
  color: string;
  category?: string;
}

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#a855f7",
  "#64748b", "#84cc16", "#f97316", "#14b8a6",
];

export default function LabelsSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newCategory, setNewCategory] = useState("");
  const [addError, setAddError] = useState("");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const fetchLabels = async () => {
    const res = await fetch("/api/labels");
    const data = await res.json();
    setLabels(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLabels();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const addLabel = async () => {
    if (!newName.trim()) { setAddError("Name is required"); return; }
    setAddError("");
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor, category: newCategory.trim() || undefined }),
    });
    if (res.ok) {
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setNewCategory("");
      setShowAddForm(false);
      fetchLabels();
      showToast("Label added");
    } else {
      const data = await res.json();
      setAddError(data.error || "Failed to add");
    }
  };

  const deleteLabel = async (id: string) => {
    if (!confirm("Delete this label?")) return;
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
    fetchLabels();
    showToast("Label deleted");
  };

  const startEdit = (label: Label) => {
    setEditingId(label._id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await fetch(`/api/labels/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    setEditingId(null);
    fetchLabels();
    showToast("Label updated");
  };

  // Group labels by category
  const grouped = labels.reduce<Record<string, Label[]>>((acc, l) => {
    const cat = l.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(l);
    return acc;
  }, {});

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Labels / Tags</h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage labels that can be applied to cards across all boards.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover font-medium transition-colors text-sm"
        >
          <Plus size={16} /> Add Label
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-6 bg-bg-card rounded-xl border border-border p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                autoFocus
                className="flex-1 text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
                placeholder="Label name..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLabel();
                  if (e.key === "Escape") setShowAddForm(false);
                }}
              />
              <input
                className="w-32 text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category (optional)"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      newColor === c ? "border-text-primary scale-110 ring-2 ring-text-primary/30" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 text-text-disabled hover:text-text-secondary"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={addLabel}
                  className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </div>
            {addError && <p className="text-danger text-xs">{addError}</p>}
          </div>
        </div>
      )}

      {/* Labels list */}
      {labels.length === 0 ? (
        <div className="text-center py-12 bg-bg-card rounded-xl border border-border">
          <p className="text-text-disabled">No labels yet. Create one to get started.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, catLabels]) => (
          <div key={category} className="mb-6">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1">
              {category}
            </h3>
            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
              {catLabels.map((label) => (
                <div
                  key={label._id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-surface transition-colors"
                >
                  {editingId === label._id ? (
                    <>
                      <div className="relative group flex-shrink-0">
                        <div
                          className="w-5 h-5 rounded-full border-2 border-border shadow-sm cursor-pointer"
                          style={{ backgroundColor: editColor }}
                        />
                        <div className="absolute top-full left-0 mt-2 bg-bg-surface rounded-lg shadow-lg border border-border p-2 hidden group-hover:flex gap-1 z-10">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                                editColor === c ? "border-text-primary scale-110 ring-2 ring-text-primary/30" : "border-transparent"
                              }`}
                              style={{ backgroundColor: c }}
                              onClick={() => setEditColor(c)}
                            />
                          ))}
                        </div>
                      </div>
                      <input
                        autoFocus
                        className="flex-1 text-sm font-medium text-text-primary bg-transparent border border-brand rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-brand"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={saveEdit}
                      />
                    </>
                  ) : (
                    <>
                      <span
                        className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-border shadow-sm"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="flex-1 text-sm font-medium text-text-primary">
                        {label.name}
                      </span>
                    </>
                  )}

                  <button
                    onClick={() => startEdit(label)}
                    className="p-1.5 text-text-disabled hover:text-brand transition-colors flex-shrink-0"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteLabel(label._id)}
                    className="p-1.5 text-text-disabled hover:text-danger transition-colors flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-bg-surface text-text-primary px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-50 border border-border">
          <Check size={14} className="text-success" />
          {toast}
        </div>
      )}
    </div>
  );
}
