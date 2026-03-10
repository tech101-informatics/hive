"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  GripVertical, Plus, Trash2, Star, Pencil, X, Check, AlertTriangle,
} from "lucide-react";

interface BoardColumn {
  _id: string;
  label: string;
  slug: string;
  color: string;
  order: number;
  isDefault: boolean;
}

const PRESET_COLORS = [
  "#64748b", "#3b82f6", "#a855f7", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#06b6d4",
];

export default function BoardSettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<BoardColumn | null>(null);
  const [deleteTaskCount, setDeleteTaskCount] = useState(0);
  const [migrateToId, setMigrateToId] = useState("");

  // Drag reorder
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fetchColumns = async () => {
    const res = await fetch("/api/board-status");
    const data = await res.json();
    setColumns(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchColumns();
  }, []);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  // --- Rename ---
  const startRename = (col: BoardColumn) => {
    setEditingId(col._id);
    setEditLabel(col.label);
  };

  const saveRename = async () => {
    if (!editingId || !editLabel.trim()) return;
    await fetch(`/api/board-status/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim() }),
    });
    setEditingId(null);
    fetchColumns();
    showToast("Saved");
  };

  // --- Color ---
  const updateColor = async (id: string, color: string) => {
    setColumns((prev) =>
      prev.map((c) => (c._id === id ? { ...c, color } : c))
    );
    await fetch(`/api/board-status/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    showToast("Saved");
  };

  // --- Set Default ---
  const setDefault = async (id: string) => {
    setColumns((prev) =>
      prev.map((c) => ({ ...c, isDefault: c._id === id }))
    );
    await fetch(`/api/board-status/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    fetchColumns();
    showToast("Default updated");
  };

  // --- Delete ---
  const initiateDelete = async (col: BoardColumn) => {
    const res = await fetch(`/api/board-status/${col._id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchColumns();
      showToast("Column deleted");
      return;
    }
    const data = await res.json();
    if (data.taskCount) {
      setDeleteTarget(col);
      setDeleteTaskCount(data.taskCount);
      const other = columns.find((c) => c._id !== col._id);
      setMigrateToId(other?._id || "");
    } else {
      showToast(data.error || "Cannot delete");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !migrateToId) return;
    // Move tasks first
    await fetch(`/api/board-status/${deleteTarget._id}/migrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatusId: migrateToId }),
    });
    // Then delete
    await fetch(`/api/board-status/${deleteTarget._id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    fetchColumns();
    showToast("Column deleted");
  };

  // --- Add ---
  const addColumn = async () => {
    if (!newLabel.trim()) return;
    await fetch("/api/board-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), color: newColor }),
    });
    setNewLabel("");
    setNewColor(PRESET_COLORS[0]);
    setShowAddForm(false);
    fetchColumns();
    showToast("Column added");
  };

  // --- Drag Reorder ---
  const handleDragStart = (idx: number) => setDraggingIdx(idx);

  const handleDrop = async (targetIdx: number) => {
    if (draggingIdx === null || draggingIdx === targetIdx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...columns];
    const [moved] = reordered.splice(draggingIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    setColumns(reordered);
    setDraggingIdx(null);
    setDragOverIdx(null);

    await fetch("/api/board-status/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statuses: reordered.map((c, i) => ({ id: c._id, order: i })),
      }),
    });
    showToast("Saved");
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Board Columns</h1>
          <p className="text-slate-500 text-sm mt-1">
            Configure the columns that appear on your Kanban board.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm"
        >
          <Plus size={16} /> Add Column
        </button>
      </div>

      {/* Column list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {columns.map((col, idx) => (
          <div
            key={col._id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIdx(idx);
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => {
              setDraggingIdx(null);
              setDragOverIdx(null);
            }}
            className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${
              draggingIdx === idx ? "opacity-50" : ""
            } ${dragOverIdx === idx ? "bg-indigo-50" : "hover:bg-slate-50"}`}
          >
            {/* Drag handle */}
            <GripVertical
              size={16}
              className="text-slate-300 cursor-grab active:cursor-grabbing flex-shrink-0"
            />

            {/* Color swatch */}
            <div className="relative group flex-shrink-0">
              <div
                className="w-5 h-5 rounded-full border-2 border-white shadow-sm cursor-pointer"
                style={{ backgroundColor: col.color }}
              />
              <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 p-2 hidden group-hover:flex gap-1 z-10">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      col.color === c
                        ? "border-slate-800 scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => updateColor(col._id, c)}
                  />
                ))}
              </div>
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
              {editingId === col._id ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={editRef}
                    className="text-sm font-medium text-slate-800 bg-transparent border border-indigo-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={saveRename}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {col.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {col.slug}
                  </span>
                </div>
              )}
            </div>

            {/* Default badge or set default */}
            {col.isDefault ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                <Star size={10} className="fill-amber-500" /> Default
              </span>
            ) : (
              <button
                onClick={() => setDefault(col._id)}
                className="text-xs text-slate-400 hover:text-amber-600 transition-colors flex-shrink-0"
                title="Set as default"
              >
                Set Default
              </button>
            )}

            {/* Rename */}
            <button
              onClick={() => startRename(col)}
              className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors flex-shrink-0"
              title="Rename"
            >
              <Pencil size={14} />
            </button>

            {/* Delete */}
            <button
              onClick={() => initiateDelete(col)}
              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Drag rows to reorder columns. Hover the color dot to change colors.
      </p>

      {/* Add column form */}
      {showAddForm && (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Column name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") addColumn();
                if (e.key === "Escape") setShowAddForm(false);
              }}
            />
            <div className="flex items-center gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    newColor === c
                      ? "border-slate-800 scale-110"
                      : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button
              onClick={addColumn}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog with migration */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete Column</h3>
                <p className="text-sm text-slate-500">
                  &ldquo;{deleteTarget.label}&rdquo; has{" "}
                  <strong>{deleteTaskCount}</strong> card
                  {deleteTaskCount !== 1 ? "s" : ""}.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Move existing cards to:
            </p>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
              value={migrateToId}
              onChange={(e) => setMigrateToId(e.target.value)}
            >
              {columns
                .filter((c) => c._id !== deleteTarget._id)
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.label}
                  </option>
                ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Move & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-in z-50">
          <Check size={14} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
