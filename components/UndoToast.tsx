"use client";
import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] w-full max-w-sm px-4">
      <div className="bg-bg-surface rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-sm text-text-primary flex-1">{message}</span>
          <button
            onClick={() => {
              onUndo();
            }}
            className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors flex items-center gap-1"
          >
            <RotateCcw size={12} />
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="p-1 text-text-disabled hover:text-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-0.5 bg-bg-base">
          <div
            className="h-full bg-brand transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
