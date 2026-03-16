"use client";
import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface Attachment {
  _id: string;
  name: string;
  url: string;
  type: string;
}

function isMediaFile(att: Attachment): boolean {
  return (
    att.type === "image" ||
    !!att.name.match(/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)$/i)
  );
}

function isVideo(att: Attachment): boolean {
  return !!att.name.match(/\.(mp4|webm|mov)$/i);
}

function getPreviewUrl(url: string): string {
  if (!url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/w_1200,c_limit,q_auto,f_auto/");
}

export function AttachmentViewer({
  attachments,
  currentIndex,
  onClose,
  onNavigate,
}: {
  attachments: Attachment[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const current = attachments[currentIndex];
  const mediaItems = attachments.filter(isMediaFile);
  const mediaIndex = mediaItems.findIndex((a) => a._id === current?._id);
  const hasMedia = mediaItems.length > 0;

  const goPrev = useCallback(() => {
    if (mediaIndex > 0) {
      const prevMedia = mediaItems[mediaIndex - 1];
      const globalIdx = attachments.findIndex((a) => a._id === prevMedia._id);
      onNavigate(globalIdx);
    }
  }, [mediaIndex, mediaItems, attachments, onNavigate]);

  const goNext = useCallback(() => {
    if (mediaIndex < mediaItems.length - 1) {
      const nextMedia = mediaItems[mediaIndex + 1];
      const globalIdx = attachments.findIndex((a) => a._id === nextMedia._id);
      onNavigate(globalIdx);
    }
  }, [mediaIndex, mediaItems, attachments, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!current) return null;

  const isMedia = isMediaFile(current);

  // Non-media files: trigger download and close
  if (!isMedia) {
    window.open(current.url, "_blank");
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-white/80 truncate">
            {current.name}
          </span>
          {hasMedia && mediaItems.length > 1 && (
            <span className="text-xs text-white/50 tabular-nums">
              {mediaIndex + 1} / {mediaItems.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Download"
          >
            <Download size={18} />
          </a>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {mediaIndex > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {mediaIndex < mediaItems.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Content */}
      <div className="relative z-0 max-w-[90vw] max-h-[85vh] flex items-center justify-center">
        {isVideo(current) ? (
          <video
            src={current.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg"
          />
        ) : (
          <img
            src={getPreviewUrl(current.url)}
            alt={current.name}
            className="max-w-full max-h-[85vh] rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  );
}
