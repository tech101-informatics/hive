"use client";
import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

interface Preferences {
  task_created: boolean;
  task_assigned: boolean;
  task_status_changed: boolean;
  task_deadline: boolean;
  task_priority_changed: boolean;
  task_labels_changed: boolean;
  comment_added: boolean;
}

const NOTIFICATION_LABELS: {
  key: keyof Preferences;
  label: string;
  description: string;
}[] = [
  {
    key: "task_created",
    label: "Card Created",
    description: "When a new card is created and assigned to you",
  },
  {
    key: "task_assigned",
    label: "Card Assigned",
    description: "When you are assigned to a card",
  },
  {
    key: "task_status_changed",
    label: "Status Changed",
    description: "When a card you're assigned to changes status",
  },
  {
    key: "task_deadline",
    label: "Deadline Reminders",
    description: "When a deadline is set or approaching",
  },
  {
    key: "task_priority_changed",
    label: "Priority Changed",
    description: "When a card's priority changes",
  },
  {
    key: "task_labels_changed",
    label: "Labels Changed",
    description: "When labels are added or removed",
  },
  {
    key: "comment_added",
    label: "Comments",
    description: "When someone comments on your cards",
  },
];

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/notification-preferences")
      .then((r) => r.json())
      .then((d) => {
        setPrefs(
          d.preferences || {
            task_created: true,
            task_assigned: true,
            task_status_changed: true,
            task_deadline: true,
            task_priority_changed: true,
            task_labels_changed: true,
            comment_added: true,
          },
        );
        setLoading(false);
      });
  }, []);

  const togglePref = async (key: keyof Preferences) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    await fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: updated }),
    });
    setSaving(false);
    setToast("Saved");
    setTimeout(() => setToast(""), 1500);
  };

  const allEnabled = prefs ? Object.values(prefs).every(Boolean) : false;
  const noneEnabled = prefs ? Object.values(prefs).every((v) => !v) : false;

  const toggleAll = async (enabled: boolean) => {
    if (!prefs) return;
    const updated = Object.fromEntries(
      Object.keys(prefs).map((k) => [k, enabled]),
    ) as unknown as Preferences;
    setPrefs(updated);
    setSaving(true);
    await fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: updated }),
    });
    setSaving(false);
    setToast("Saved");
    setTimeout(() => setToast(""), 1500);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-text-primary tracking-tight">
            Notifications
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Slack DM notification preferences
          </p>
        </div>
        <button
          onClick={() => toggleAll(!allEnabled)}
          className="text-xs text-brand hover:underline font-medium"
        >
          {allEnabled ? "Disable all" : "Enable all"}
        </button>
      </div>

      <div className="rounded-2xl bg-bg-card overflow-hidden divide-y divide-bg-base">
        {NOTIFICATION_LABELS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 px-3 md:px-4 py-3.5 hover:bg-bg-surface transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{label}</p>
              <p className="text-xs text-text-disabled mt-0.5 hidden sm:block">{description}</p>
            </div>
            <button
              onClick={() => togglePref(key)}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                prefs?.[key] ? "bg-brand" : "bg-bg-base"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  prefs?.[key] ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-disabled mt-3 text-center">
        These settings control Slack DM notifications only. Channel
        notifications are not affected.
      </p>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-bg-card text-text-primary px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2 z-50">
          <Check size={14} className="text-success" />
          {toast}
        </div>
      )}
    </div>
  );
}
