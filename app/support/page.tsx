"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, LifeBuoy, Archive } from "lucide-react";

type SupportStatus =
  | "new"
  | "read"
  | "replied"
  | "awaiting_user"
  | "resolved"
  | "closed";

type SupportCategory = "bug" | "feature" | "billing" | "other";

interface Ticket {
  _id: string;
  cardNumber: number;
  title: string;
  status: SupportStatus;
  category: SupportCategory;
  source: "dashboard" | "landing";
  submitterEmail: string;
  submitterName: string;
  replies: { createdAt: string }[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabValue = "" | SupportStatus | "archived";

const STATUS_TABS: { value: TabValue; label: string }[] = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "awaiting_user", label: "Awaiting User" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

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

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function SupportListPage() {
  const { data: session, status: authStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("");

  useEffect(() => {
    if (authStatus !== "authenticated" || !isAdmin) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (tab === "archived") params.set("archived", "true");
    else if (tab) params.set("status", tab);
    const qs = params.toString();
    const url = `/api/support-requests${qs ? `?${qs}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setTickets(Array.isArray(d) ? d : []);
        setLoading(false);
      });
  }, [tab, authStatus, isAdmin]);

  if (authStatus === "loading") {
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

  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
    if (t.value === "archived") acc[t.value] = 0; // separate fetch — count not visible from current list
    else if (t.value === "") acc[t.value] = tickets.length;
    else acc[t.value] = tickets.filter((x) => x.status === t.value).length;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-subtle text-brand">
            <LifeBuoy size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Support
            </h1>
            <p className="text-text-secondary text-sm mt-0.5">
              Customer support tickets
            </p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.value
                ? "bg-brand-subtle text-brand"
                : "text-text-secondary hover:bg-bg-card"
            }`}
          >
            {t.value === "archived" && <Archive size={13} />}
            {t.label}
            {tab === "" && t.value !== "" && t.value !== "archived" && counts[t.value] > 0 && (
              <span className="ml-1 text-xs text-text-disabled tabular-nums">
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 rounded-2xl bg-bg-card">
          <p className="text-text-disabled">No tickets</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-bg-card overflow-hidden divide-y divide-bg-base">
          {tickets.map((t) => {
            const lastActivity =
              t.replies.length > 0
                ? t.replies[t.replies.length - 1].createdAt
                : t.createdAt;
            return (
              <Link
                key={t._id}
                href={`/support/${t._id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface transition-colors"
              >
                <span className="text-xs font-mono text-text-disabled tabular-nums w-14 flex-shrink-0">
                  SR-{t.cardNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {t.title}
                  </p>
                  <p className="text-xs text-text-disabled mt-0.5 truncate">
                    {t.submitterName} &middot; {t.submitterEmail}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-medium ${CATEGORY_STYLES[t.category]} hidden sm:inline-block`}
                >
                  {t.category}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_STYLES[t.status]}`}
                >
                  {t.status.replace("_", " ")}
                </span>
                <span className="text-xs text-text-disabled whitespace-nowrap flex-shrink-0 w-20 text-right">
                  {formatRelativeTime(lastActivity)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
