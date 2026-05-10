"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2,
  ArrowLeft,
  Send,
  ExternalLink,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";

type SupportStatus =
  | "new"
  | "read"
  | "replied"
  | "awaiting_user"
  | "resolved"
  | "closed";

type SupportCategory = "bug" | "feature" | "billing" | "other";

interface Reply {
  _id?: string;
  body: string;
  authorEmail: string;
  authorName: string;
  authorRole?: "admin" | "customer";
  createdAt: string;
}

interface Ticket {
  _id: string;
  cardNumber: number;
  title: string;
  description: string;
  status: SupportStatus;
  category: SupportCategory;
  source: "dashboard" | "landing";
  submitterEmail: string;
  submitterName: string;
  externalUserId: string | null;
  attachments: string[];
  replies: Reply[];
  linkedTaskId: string | null;
  linkedProjectId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  _id: string;
  name: string;
  color: string;
}

const STATUS_OPTIONS: SupportStatus[] = [
  "new",
  "read",
  "replied",
  "awaiting_user",
  "resolved",
  "closed",
];

const CATEGORY_OPTIONS: SupportCategory[] = ["bug", "feature", "billing", "other"];

const STATUS_STYLES: Record<SupportStatus, string> = {
  new: "bg-brand-subtle text-brand",
  read: "bg-bg-base text-text-secondary",
  replied: "bg-success/15 text-success",
  awaiting_user: "bg-warning/15 text-warning",
  resolved: "bg-bg-base text-text-secondary",
  closed: "bg-bg-base text-text-disabled",
};

const CATEGORY_STYLES: Record<SupportCategory, string> = {
  bug: "bg-danger-subtle text-danger",
  feature: "bg-brand-subtle text-brand",
  billing: "bg-warning/15 text-warning",
  other: "bg-bg-base text-text-secondary",
};

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|$)/i.test(url);
}
function isVideo(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export default function SupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "archive" | "delete">(null);

  // promote-to-card state
  const [projects, setProjects] = useState<Project[]>([]);
  const [showPromote, setShowPromote] = useState(false);
  const [promoteProjectId, setPromoteProjectId] = useState("");
  const [promoting, setPromoting] = useState(false);

  const refresh = async () => {
    const res = await fetch(`/api/support-requests/${id}`);
    if (!res.ok) {
      setError(res.status === 404 ? "Ticket not found" : "Failed to load");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTicket(data);
    setError(null);
    setLoading(false);

    // Auto-mark as read when first viewed
    if (data.status === "new") {
      fetch(`/api/support-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      }).then(() => setTicket((t) => (t ? { ...t, status: "read" } : t)));
    }
  };

  useEffect(() => {
    if (authStatus !== "authenticated" || !isAdmin) return;
    refresh();
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setProjects(list);
        if (list.length > 0) setPromoteProjectId(list[0]._id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authStatus, isAdmin]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
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

  if (error || !ticket) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <p className="text-text-secondary">{error || "Ticket not found"}</p>
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand hover:underline"
        >
          <ArrowLeft size={14} /> Back to support
        </Link>
      </div>
    );
  }

  const updateField = async (patch: Partial<Pick<Ticket, "status" | "category">>) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/support-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setTicket(data);
      }
    } finally {
      setUpdating(false);
    }
  };

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support-requests/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (res.ok) {
        setReply("");
        await refresh();
      }
    } finally {
      setSending(false);
    }
  };

  const requestArchive = () => {
    if (!ticket || busy) return;
    if (ticket.archivedAt) {
      // Unarchive needs no confirmation — it's reversible.
      void doArchive(false);
    } else {
      setConfirmAction("archive");
    }
  };

  const requestDelete = () => {
    if (!ticket || busy) return;
    setConfirmAction("delete");
  };

  const doArchive = async (willArchive: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/support-requests/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: willArchive }),
      });
      if (res.ok) {
        if (willArchive) router.push("/support");
        else await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/support-requests/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/support");
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    if (!promoteProjectId || promoting) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/support-requests/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: promoteProjectId }),
      });
      if (res.ok) {
        await refresh();
        setShowPromote(false);
      } else {
        const e = await res.json();
        alert(e.error || "Failed to promote ticket");
      }
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} /> Back to support
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={requestArchive}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-card disabled:opacity-50 transition-colors"
            title={ticket.archivedAt ? "Unarchive" : "Archive"}
          >
            {ticket.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {ticket.archivedAt ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={requestDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-danger hover:bg-danger-subtle disabled:opacity-50 transition-colors"
            title="Delete forever"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {ticket.archivedAt && (
        <div className="rounded-xl bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning flex items-center gap-1.5">
          <Archive size={13} /> This ticket is archived — hidden from the list and the customer's dashboard.
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl bg-bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-text-disabled font-mono mb-1">
              SR-{ticket.cardNumber}
              <span>&middot;</span>
              <span className="capitalize">from {ticket.source}</span>
            </div>
            <h1 className="text-xl font-semibold text-text-primary leading-snug">
              {ticket.title}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {ticket.submitterName} &middot;{" "}
              <a
                href={`mailto:${ticket.submitterEmail}`}
                className="hover:underline"
              >
                {ticket.submitterEmail}
              </a>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <SelectBadge
              value={ticket.status}
              options={STATUS_OPTIONS}
              styles={STATUS_STYLES}
              labelOf={(v) => v.replace("_", " ")}
              onChange={(v) => updateField({ status: v as SupportStatus })}
              disabled={updating}
            />
            <SelectBadge
              value={ticket.category}
              options={CATEGORY_OPTIONS}
              styles={CATEGORY_STYLES}
              labelOf={(v) => v}
              onChange={(v) => updateField({ category: v as SupportCategory })}
              disabled={updating}
            />
          </div>
        </div>

        <div className="text-sm text-text-primary whitespace-pre-wrap break-words">
          {ticket.description}
        </div>

        {ticket.attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {ticket.attachments.map((a) => (
              <a
                key={a}
                href={a}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden bg-bg-base hover:ring-2 hover:ring-brand transition-all"
              >
                {isImage(a) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a}
                    alt=""
                    className="w-full aspect-video object-cover"
                  />
                ) : isVideo(a) ? (
                  <video
                    src={a}
                    className="w-full aspect-video object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center text-xs text-text-secondary px-2 text-center">
                    <ExternalLink size={14} className="mr-1" />
                    <span className="truncate">{new URL(a).hostname}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 text-xs text-text-disabled">
          <span>Created {new Date(ticket.createdAt).toLocaleString()}</span>
          {ticket.linkedTaskId ? (
            <Link
              href={`/projects/${ticket.linkedProjectId}/cards/${ticket.linkedTaskId}`}
              className="inline-flex items-center gap-1 text-brand hover:underline"
            >
              <ExternalLink size={12} /> Linked card
            </Link>
          ) : (
            <button
              onClick={() => setShowPromote((v) => !v)}
              className="text-text-secondary hover:text-text-primary"
            >
              Promote to card
            </button>
          )}
        </div>

        {showPromote && !ticket.linkedTaskId && (
          <div className="rounded-xl bg-bg-base p-3 flex items-center gap-2">
            <select
              value={promoteProjectId}
              onChange={(e) => setPromoteProjectId(e.target.value)}
              className="flex-1 bg-bg-card text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={promote}
              disabled={promoting || !promoteProjectId}
              className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {promoting ? "Creating…" : "Create card"}
            </button>
            <button
              onClick={() => setShowPromote(false)}
              className="px-2 py-2 rounded-lg text-text-secondary hover:bg-bg-card text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-text-disabled uppercase tracking-wider px-1">
          Replies ({ticket.replies.length})
        </h2>
        {ticket.replies.length === 0 ? (
          <div className="rounded-2xl bg-bg-card p-5 text-center text-sm text-text-disabled">
            No replies yet. The customer sees replies in their dashboard.
          </div>
        ) : (
          <div className="space-y-2">
            {ticket.replies.map((r, i) => {
              const isCustomer = r.authorRole === "customer";
              return (
                <div
                  key={r._id || i}
                  className={`rounded-2xl p-4 ${
                    isCustomer
                      ? "bg-warning/10 border-l-2 border-warning"
                      : "bg-bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-text-primary">
                      {r.authorName}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold ${
                          isCustomer
                            ? "bg-warning/20 text-warning"
                            : "bg-brand-subtle text-brand"
                        }`}
                      >
                        {isCustomer ? "Customer" : "Admin"}
                      </span>
                    </span>
                    <span className="text-text-disabled">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                    {r.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply form */}
        <form onSubmit={submitReply} className="rounded-2xl bg-bg-card p-3 space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply to the customer…"
            rows={3}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-disabled">
              Visible to the customer in their dashboard
            </span>
            <button
              type="submit"
              disabled={!reply.trim() || sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </form>
      </div>

      {confirmAction === "archive" && (
        <ConfirmModal
          variant="warning"
          title="Archive ticket?"
          message={`SR-${ticket.cardNumber} will be hidden from the support list and from the customer's dashboard. You can unarchive it later from the Archived tab.`}
          confirmText="Archive"
          onConfirm={() => {
            setConfirmAction(null);
            void doArchive(true);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === "delete" && (
        <ConfirmModal
          variant="danger"
          title="Delete ticket forever?"
          message={`SR-${ticket.cardNumber} will be permanently removed. This cannot be undone.`}
          confirmText="Delete"
          onConfirm={() => {
            setConfirmAction(null);
            void doDelete();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function SelectBadge<T extends string>({
  value,
  options,
  styles,
  labelOf,
  onChange,
  disabled,
}: {
  value: T;
  options: T[];
  styles: Record<T, string>;
  labelOf: (v: T) => string;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className={`appearance-none cursor-pointer text-xs px-2 py-1 pr-7 rounded-md font-medium capitalize disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand ${styles[value]}`}
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-bg-card text-text-primary">
            {labelOf(o)}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"
      />
    </div>
  );
}
