"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, Archive } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

const icons = {
  danger: <Trash2 size={22} className="text-danger" />,
  warning: <Archive size={22} className="text-warning" />,
};

export function ConfirmModal({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(onCancel, 150);
  };

  const confirm = () => {
    setOpen(false);
    setTimeout(onConfirm, 150);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-150 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-sm bg-bg-card rounded-2xl shadow-2xl border border-border p-6 transition-all duration-150 ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
            variant === "danger" ? "bg-danger-subtle" : "bg-warning-subtle"
          }`}
        >
          {icons[variant]}
        </div>

        <h3 className="text-lg font-semibold text-text-primary mb-1">
          {title}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={close}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-bg-surface text-text-primary hover:bg-bg-card transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={confirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-white ${
              variant === "danger"
                ? "bg-danger hover:bg-red-700"
                : "bg-warning hover:bg-amber-600"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
