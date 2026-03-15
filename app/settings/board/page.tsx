"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  GripVertical,
  Plus,
  Trash2,
  Star,
  Pencil,
  X,
  Check,
  AlertTriangle,
  Pipette,
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
  "#64748b",
  "#3b82f6",
  "#a855f7",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
];

export default function BoardSettingsPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const nativeColorRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      )
        setColorPickerId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

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

  const updateColor = async (id: string, color: string) => {
    setColumns((prev) => prev.map((c) => (c._id === id ? { ...c, color } : c)));
    await fetch(`/api/board-status/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    showToast("Saved");
  };

  const setDefault = async (id: string) => {
    setColumns((prev) => prev.map((c) => ({ ...c, isDefault: c._id === id })));
    await fetch(`/api/board-status/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    fetchColumns();
    showToast("Default updated");
  };

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
    await fetch(`/api/board-status/${deleteTarget._id}/migrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatusId: migrateToId }),
    });
    await fetch(`/api/board-status/${deleteTarget._id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    fetchColumns();
    showToast("Column deleted");
  };

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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            Board Columns
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Configure the columns on your Kanban board
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-lg hover:bg-brand-hover font-medium transition-colors text-sm"
        >
          <Plus size={16} /> Add Column
        </button>
      </div>

      {/* Column list */}
      <div className="rounded-2xl bg-bg-card overflow-hidden">
        <div className="divide-y divide-bg-base">
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
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                draggingIdx === idx ? "opacity-50" : ""
              } ${dragOverIdx === idx ? "bg-brand-subtle" : "hover:bg-bg-surface"}`}
            >
              <GripVertical
                size={16}
                className="text-text-disabled cursor-grab active:cursor-grabbing flex-shrink-0"
              />

              <button
                type="button"
                className="w-5 h-5 rounded-full shadow-sm cursor-pointer flex-shrink-0 ring-2 ring-bg-base"
                style={{ backgroundColor: col.color }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPickerPos({ top: rect.bottom + 8, left: rect.left });
                  setColorPickerId(colorPickerId === col._id ? null : col._id);
                }}
              />

              <div className="flex-1 min-w-0">
                {editingId === col._id ? (
                  <input
                    ref={editRef}
                    className="text-sm font-medium text-text-primary bg-transparent rounded px-2 py-0.5 outline-none ring-2 ring-brand"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={saveRename}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {col.label}
                    </span>
                    <span className="text-xs text-text-600 font-mono">
                      {col.slug}
                    </span>
                  </div>
                )}
              </div>

              {col.isDefault ? (
                <span className="flex items-center gap-1 text-xs text-warning bg-warning-subtle px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  <Star size={10} className="fill-warning" /> Default
                </span>
              ) : (
                <button
                  onClick={() => setDefault(col._id)}
                  className="text-xs text-text-disabled hover:text-warning transition-colors flex-shrink-0"
                  title="Set as default"
                >
                  Set Default
                </button>
              )}

              <button
                onClick={() => startRename(col)}
                className="p-1.5 text-text-disabled hover:text-brand transition-colors flex-shrink-0"
                title="Rename"
              >
                <Pencil size={14} />
              </button>

              <button
                onClick={() => initiateDelete(col)}
                className="p-1.5 text-text-disabled hover:text-danger transition-colors flex-shrink-0"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-disabled mt-3 text-center">
        Drag rows to reorder · Click the color dot to change colors
      </p>

      {/* Color picker */}
      {colorPickerId && (
        <div
          ref={colorPickerRef}
          className="fixed z-50 bg-bg-surface rounded-xl shadow-xl p-3"
          style={{ top: pickerPos.top, left: pickerPos.left }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  columns.find((col) => col._id === colorPickerId)?.color === c
                    ? "border-text-primary scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  updateColor(colorPickerId, c);
                  setColorPickerId(null);
                }}
              />
            ))}
          </div>
          <div className="h-px bg-border-subtle my-2" />
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-bg-base"
              style={{
                backgroundColor:
                  columns.find((col) => col._id === colorPickerId)?.color ||
                  "#888",
              }}
            />
            <input
              type="text"
              className="flex-1 text-xs font-mono bg-bg-card text-text-primary rounded px-2 py-1 w-20 outline-none focus:ring-1 focus:ring-brand"
              value={
                columns.find((col) => col._id === colorPickerId)?.color || ""
              }
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                  setColumns((prev) =>
                    prev.map((c) =>
                      c._id === colorPickerId ? { ...c, color: val } : c,
                    ),
                  );
                }
              }}
              onBlur={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{6}$/.test(val) && colorPickerId) {
                  updateColor(colorPickerId, val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value;
                  if (/^#[0-9a-fA-F]{6}$/.test(val) && colorPickerId) {
                    updateColor(colorPickerId, val);
                    setColorPickerId(null);
                  }
                }
              }}
              placeholder="#hex"
            />
            <button
              type="button"
              className="p-1.5 text-text-secondary hover:text-brand transition-colors rounded-lg hover:bg-bg-card"
              title="Pick from screen"
              onClick={() => nativeColorRef.current?.click()}
            >
              <Pipette size={14} />
            </button>
            <input
              ref={nativeColorRef}
              type="color"
              className="sr-only"
              value={
                columns.find((col) => col._id === colorPickerId)?.color ||
                "#888888"
              }
              onChange={(e) => {
                if (colorPickerId) {
                  updateColor(colorPickerId, e.target.value);
                  setColorPickerId(null);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Add column form */}
      {showAddForm && (
        <div className="mt-4 rounded-2xl bg-bg-card p-4">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              className="flex-1 text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
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
                      ? "border-text-primary scale-110"
                      : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
              <label
                className="w-5 h-5 rounded-full border-2 border-dashed border-text-disabled cursor-pointer flex items-center justify-center hover:border-brand transition-colors"
                title="Custom color"
              >
                <Pipette size={10} className="text-text-disabled" />
                <input
                  type="color"
                  className="sr-only"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                />
              </label>
            </div>
            <button
              onClick={addColumn}
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-2 text-text-disabled hover:text-text-secondary"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger-subtle rounded-lg">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">
                  Delete Column
                </h3>
                <p className="text-sm text-text-secondary">
                  &ldquo;{deleteTarget.label}&rdquo; has{" "}
                  <strong>{deleteTaskCount}</strong> card
                  {deleteTaskCount !== 1 ? "s" : ""}.
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-3">
              Move existing cards to:
            </p>
            <select
              className="w-full bg-bg-card text-text-primary rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-brand"
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
                className="flex-1 px-4 py-2 bg-bg-card rounded-lg text-text-secondary hover:bg-bg-base text-sm"
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
        <div className="fixed bottom-6 right-6 bg-bg-card text-text-primary px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2 z-50">
          <Check size={14} className="text-success" />
          {toast}
        </div>
      )}
    </div>
  );
}
