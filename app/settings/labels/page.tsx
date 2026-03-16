"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Label {
  _id: string;
  name: string;
  color: string;
  category?: string;
}

const PRESET_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#64748b",
  "#84cc16",
  "#f97316",
  "#14b8a6",
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
    if (!newName.trim()) {
      setAddError("Name is required");
      return;
    }
    setAddError("");
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        color: newColor,
        category: newCategory.trim() || undefined,
      }),
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

  const [deleteLabelTarget, setDeleteLabelTarget] = useState<Label | null>(null);

  const confirmDeleteLabel = async () => {
    if (!deleteLabelTarget) return;
    await fetch(`/api/labels/${deleteLabelTarget._id}`, { method: "DELETE" });
    setDeleteLabelTarget(null);
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
        <p className="text-text-secondary">
          You don&apos;t have permission to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-text-primary tracking-tight">
            Labels / Tags
          </h1>
          <p className="text-text-secondary text-sm mt-1 hidden sm:block">
            Manage labels applied to cards across all boards
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-lg hover:bg-brand-hover font-medium transition-colors text-sm"
        >
          <Plus size={16} /> Add Label
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-5 rounded-2xl bg-bg-card p-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                autoFocus
                className="flex-1 text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setAddError("");
                }}
                placeholder="Label name..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLabel();
                  if (e.key === "Escape") setShowAddForm(false);
                }}
              />
              <input
                className="w-full sm:w-36 text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category (optional)"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                      newColor === c
                        ? "border-text-primary scale-110"
                        : "border-transparent"
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
        <div className="text-center py-12 rounded-2xl bg-bg-card">
          <p className="text-text-disabled">
            No labels yet. Create one to get started.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, catLabels]) => (
          <div key={category} className="mb-5">
            <h3 className="text-xs font-medium text-text-gray-700 uppercase tracking-wider mb-2 px-1">
              {category}
            </h3>
            <div className="rounded-2xl bg-bg-card overflow-hidden divide-y divide-bg-base">
              {catLabels.map((label) => (
                <div
                  key={label._id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface transition-colors group"
                >
                  {editingId === label._id ? (
                    <>
                      <div className="relative group/color flex-shrink-0">
                        <div
                          className="w-5 h-5 rounded-full shadow-sm cursor-pointer ring-2 ring-bg-base"
                          style={{ backgroundColor: editColor }}
                        />
                        <div className="absolute top-full left-0 mt-2 bg-bg-surface rounded-xl shadow-lg p-2 hidden group-hover/color:flex gap-1 z-10">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                                editColor === c
                                  ? "border-text-primary scale-110"
                                  : "border-transparent"
                              }`}
                              style={{ backgroundColor: c }}
                              onClick={() => setEditColor(c)}
                            />
                          ))}
                        </div>
                      </div>
                      <input
                        autoFocus
                        className="flex-1 text-sm font-medium text-text-primary bg-transparent rounded px-2 py-0.5 outline-none ring-2 ring-brand"
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
                        className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-bg-base"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="flex-1 text-sm font-medium text-text-primary">
                        {label.name}
                      </span>
                    </>
                  )}

                  <button
                    onClick={() => startEdit(label)}
                    className="p-1.5 text-text-disabled hover:text-brand transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteLabelTarget(label)}
                    className="p-1.5 text-text-disabled hover:text-danger transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
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
      {deleteLabelTarget && (
        <ConfirmModal
          title="Delete Label"
          message={`"${deleteLabelTarget.name}" will be permanently deleted. Cards using this label will not be affected.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={confirmDeleteLabel}
          onCancel={() => setDeleteLabelTarget(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-bg-card text-text-primary px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2 z-50">
          <Check size={14} className="text-success" />
          {toast}
        </div>
      )}
    </div>
  );
}
