"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  X,
  Trash2,
  Archive,
  MessageSquare,
  Flag,
  User,
  Calendar,
  Link2,
  GitBranch,
  GitPullRequest,
  Tag,
  Copy,
  Link,
  Check,
  ChevronDown,
  CheckSquare,
  Plus,
  ChevronsUpDown,
  Clock,
  History,
  MoreVertical,
  Ban,
  FileText,
  Search,
  Paperclip,
  Download,
  Image,
  File,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AssigneeDropdown, MemberAvatar } from "@/components/AssigneeDropdown";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AttachmentViewer } from "@/components/AttachmentViewer";

interface ChecklistItem {
  _id?: string;
  text: string;
  completed: boolean;
  order: number;
}

interface LabelData {
  _id: string;
  name: string;
  color: string;
  category?: string;
}

interface Task {
  _id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "in-review" | "done";
  priority: "low" | "medium" | "high";
  assignees: string[];
  deadline?: string;
  parentId?: string;
  branch?: string;
  pr?: string;
  labels?: string[];
  blockedBy?: string[];
  cardNumber?: number;
  checklist?: ChecklistItem[];
}

interface CommentData {
  _id: string;
  author: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

interface BoardColumn {
  _id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
}

interface Props {
  task: Task;
  allTasks: Task[];
  statuses: BoardColumn[];
  boardName: string;
  boardStatus: string;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: () => void;
  onArchive?: (taskIds: string[], titles: string[]) => void;
  readOnly?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", cls: "bg-green-100 text-green-700" },
  { value: "medium", label: "Medium", cls: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "High", cls: "bg-red-100 text-red-700" },
];

export function EditTaskModal({
  task,
  allTasks,
  statuses,
  boardName,
  boardStatus: _boardStatus,
  onClose,
  onUpdated,
  onDeleted,
  onArchive,
  readOnly = false,
}: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    assignees: string[];
    deadline: string;
    status: string;
    parentId: string;
    branch: string;
    pr: string;
    labels: string[];
    blockedBy: string[];
    checklist: ChecklistItem[];
  }>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    assignees: task.assignees || [],
    deadline: task.deadline ? task.deadline.slice(0, 10) : "",
    status: task.status,
    parentId: task.parentId || "",
    branch: task.branch || "",
    pr: task.pr || "",
    labels: task.labels || [],
    blockedBy: task.blockedBy || [],
    checklist: task.checklist || [],
  });
  const [members, setMembers] = useState<
    { _id: string; name: string; avatar?: string; email?: string }[]
  >([]);
  const [allLabels, setAllLabels] = useState<LabelData[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  const [showFields, setShowFields] = useState(true);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Parent card
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const parentCardRef = useRef<HTMLDivElement>(null);

  // Dependencies
  const [showBlockedByDropdown, setShowBlockedByDropdown] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState("");
  const blockedByRef = useRef<HTMLDivElement>(null);

  // Save as template
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<
    {
      _id: string;
      name: string;
      url: string;
      type: string;
      size: number;
      uploadedBy: string;
      createdAt: string;
    }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState<"number" | "link" | null>(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  // Time tracking
  const [timeLogs, setTimeLogs] = useState<
    {
      _id: string;
      user: string;
      userEmail: string;
      minutes: number;
      description: string;
      date: string;
    }[]
  >([]);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeDesc, setTimeDesc] = useState("");
  const [timeDate, setTimeDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Activity log
  const [activities, setActivities] = useState<
    {
      _id: string;
      user: string;
      action: string;
      details: string;
      createdAt: string;
    }[]
  >([]);
  const [rightTab, setRightTab] = useState<"comments" | "activity">("comments");
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "archive" | null
  >(null);
  const [showCardMenu, setShowCardMenu] = useState(false);
  const cardMenuRef = useRef<HTMLDivElement>(null);
  const isAdmin = session?.user?.role === "admin";
  const canEdit = !readOnly;

  const cardNumberFormatted = task.cardNumber
    ? `SP-${String(task.cardNumber).padStart(3, "0")}`
    : `SP-${task._id.slice(-4).toUpperCase()}`;

  const copyToClipboard = (text: string, type: "number" | "link") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        copyMenuRef.current &&
        !copyMenuRef.current.contains(e.target as Node)
      ) {
        setShowCopyMenu(false);
      }
    };
    if (showCopyMenu)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCopyMenu]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        cardMenuRef.current &&
        !cardMenuRef.current.contains(e.target as Node)
      ) {
        setShowCardMenu(false);
      }
    };
    if (showCardMenu)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCardMenu]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []));
    fetch("/api/labels")
      .then((r) => r.json())
      .then((data) => setAllLabels(Array.isArray(data) ? data : []));
    fetchComments();
    fetchTimeLogs();
    fetchActivities();
    fetchAttachments();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        showPriorityDropdown &&
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPriorityDropdown(false);
      }
      if (
        showLabelDropdown &&
        labelDropdownRef.current &&
        !labelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowLabelDropdown(false);
        setLabelSearch("");
      }
      if (
        showBlockedByDropdown &&
        blockedByRef.current &&
        !blockedByRef.current.contains(e.target as Node)
      ) {
        setShowBlockedByDropdown(false);
        setBlockerSearch("");
      }
      if (
        showParentDropdown &&
        parentCardRef.current &&
        !parentCardRef.current.contains(e.target as Node)
      ) {
        setShowParentDropdown(false);
        setParentSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [
    showPriorityDropdown,
    showLabelDropdown,
    showBlockedByDropdown,
    showParentDropdown,
  ]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  const updateField = (field: string, value: string) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const autoSave = (data: Record<string, unknown>) => {
    if (readOnly) return;
    fetch(`/api/tasks/${task._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(() => onUpdated());
  };

  const fetchComments = async () => {
    const res = await fetch(`/api/tasks/${task._id}/comments`);
    const data = await res.json();
    setComments(Array.isArray(data) ? data : []);
  };

  const fetchAttachments = async () => {
    const res = await fetch(`/api/tasks/${task._id}/attachments`);
    const data = await res.json();
    setAttachments(Array.isArray(data) ? data : []);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/tasks/${task._id}/attachments`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    fetchAttachments();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteAttachment = async (attachmentId: string) => {
    await fetch(`/api/tasks/${task._id}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    fetchAttachments();
  };

  const fetchTimeLogs = async () => {
    const res = await fetch(`/api/tasks/${task._id}/timelogs`);
    const data = await res.json();
    setTimeLogs(Array.isArray(data) ? data : []);
  };

  const fetchActivities = async () => {
    const res = await fetch(`/api/activities?taskId=${task._id}&limit=30`);
    const data = await res.json();
    setActivities(Array.isArray(data) ? data : []);
  };

  const handleAddTimeLog = async () => {
    const mins = parseInt(timeMinutes, 10);
    if (!mins || mins < 1) return;
    const res = await fetch(`/api/tasks/${task._id}/timelogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minutes: mins,
        description: timeDesc,
        date: timeDate,
      }),
    });
    if (res.ok) {
      setTimeMinutes("");
      setTimeDesc("");
      setTimeDate(new Date().toISOString().slice(0, 10));
      setShowTimeForm(false);
      fetchTimeLogs();
      fetchActivities();
    }
  };

  const handleDeleteTimeLog = async (logId: string) => {
    await fetch(`/api/timelogs/${logId}`, { method: "DELETE" });
    fetchTimeLogs();
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const totalMinutes = timeLogs.reduce((sum, l) => sum + l.minutes, 0);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError("Card title is required");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      deadline: form.deadline || undefined,
      parentId: form.parentId || null,
      branch: form.branch || "",
      pr: form.pr || "",
      labels: form.labels,
      checklist: form.checklist,
    };
    const res = await fetch(`/api/tasks/${task._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      onUpdated();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update card");
    }
  };

  const handleAddComment = async (html: string) => {
    if (!html.trim()) return;
    setPostingComment(true);
    await fetch(`/api/tasks/${task._id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: html }),
    });
    setPostingComment(false);
    await fetchComments();
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    fetchComments();
  };

  const handleDeleteTask = async () => {
    await fetch(`/api/tasks/${task._id}`, { method: "DELETE" });
    setConfirmAction(null);
    onDeleted ? onDeleted() : onClose();
  };

  const handleArchiveTask = async () => {
    await fetch(`/api/tasks/${task._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    setConfirmAction(null);
    if (onArchive) {
      onArchive([task._id], [task.title]);
    } else {
      onUpdated();
    }
    onClose();
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getMemberAvatar = (name: string): string | undefined =>
    members.find((m) => m.name === name)?.avatar ||
    (name === session?.user?.name
      ? (session?.user?.image ?? undefined)
      : undefined);

  const Avatar = ({
    name,
    size = "w-5 h-5",
    textSize = "text-xs",
    bg = "bg-brand-subtle",
    color = "text-brand",
  }: {
    name: string;
    size?: string;
    textSize?: string;
    bg?: string;
    color?: string;
  }) => (
    <MemberAvatar
      name={name}
      avatar={getMemberAvatar(name)}
      size={size}
      textSize={textSize}
      bg={bg}
      color={color}
    />
  );

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const statusCol = statuses.find((s) => s.slug === form.status);
  const statusOpt = statusCol
    ? { value: statusCol.slug, label: statusCol.label, color: statusCol.color }
    : { value: form.status, label: form.status, color: "#64748b" };
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === form.priority)!;
  const parentCard = allTasks.find((t) => t._id === form.parentId);
  const parentCandidates = allTasks.filter((t) => t._id !== task._id);
  const mentionUsersList = members.map((m) => ({ id: m._id, label: m.name }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Full overlay panel */}
      <div
        className={`fixed inset-0 md:inset-4 lg:inset-8 bg-bg-surface md:rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-200 ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-bg-card md:rounded-t-2xl">
          <div className="flex items-center gap-2 text-sm">
            <div className="relative" ref={copyMenuRef}>
              <button
                onClick={() => setShowCopyMenu((p) => !p)}
                className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg hover:bg-bg-surface transition-colors cursor-pointer"
              >
                <span className="font-mono font-semibold text-text-secondary">
                  {cardNumberFormatted}
                </span>
                <ChevronDown size={12} className="text-text-disabled" />
              </button>
              {showCopyMenu && (
                <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-lg shadow-lg border border-border py-1 w-48 z-[60]">
                  <button
                    onClick={() => {
                      copyToClipboard(cardNumberFormatted, "number");
                      setShowCopyMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    {copied === "number" ? (
                      <Check size={14} className="text-success" />
                    ) : (
                      <Copy size={14} className="text-text-disabled" />
                    )}
                    Copy id
                  </button>
                  <button
                    onClick={() => {
                      copyToClipboard(window.location.href, "link");
                      setShowCopyMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    {copied === "link" ? (
                      <Check size={14} className="text-success" />
                    ) : (
                      <Link size={14} className="text-text-disabled" />
                    )}
                    Copy card URL
                  </button>
                </div>
              )}
            </div>
            <span className="font-medium text-text-primary">{form.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {readOnly && (
              <span className="text-xs text-text-disabled bg-bg-base px-2.5 py-1 rounded-lg">
                Read-only
              </span>
            )}
            {canEdit && dirty && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-hover disabled:opacity-50 font-medium transition-colors text-xs"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
            {canEdit && isAdmin && (
              <div className="relative" ref={cardMenuRef}>
                <button
                  onClick={() => setShowCardMenu((p) => !p)}
                  className="p-2 hover:bg-bg-surface rounded-lg transition-colors"
                >
                  <MoreVertical size={16} className="text-text-disabled" />
                </button>
                {showCardMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-bg-card rounded-xl shadow-lg z-[100] w-48 py-1">
                    <button
                      onClick={() => {
                        setShowCardMenu(false);
                        setShowSaveTemplate(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
                    >
                      <FileText size={14} /> Save as Template
                    </button>
                    <div className="h-px bg-bg-base mx-2 my-0.5" />
                    <button
                      onClick={() => {
                        setShowCardMenu(false);
                        setConfirmAction("archive");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
                    >
                      <Archive size={14} /> Archive
                    </button>
                    <button
                      onClick={() => {
                        setShowCardMenu(false);
                        setConfirmAction("delete");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-bg-surface transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-bg-surface rounded-lg transition-colors"
            >
              <X size={18} className="text-text-disabled" />
            </button>
          </div>
        </div>

        {/* Two-column layout — stacks on mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden md:rounded-b-2xl">
          {/* LEFT — Card details */}
          <div className="flex-1 md:flex-1 overflow-y-auto p-4 md:p-8 pt-4 md:pt-5 min-h-0">
            {/* Title */}
            <input
              className="w-full text-xl md:text-2xl font-bold text-text-primary bg-transparent border-0 outline-none placeholder:text-text-disabled mb-1"
              value={form.title}
              onChange={(e) => {
                if (!canEdit) return;
                updateField("title", e.target.value);
                setError("");
              }}
              readOnly={readOnly}
              placeholder="Card title..."
            />
            {error && <p className="text-danger text-xs mb-2">{error}</p>}

            {/* On boards section */}
            <div className="bg-bg-card border border-border rounded-xl mb-6 overflow-hidden mt-4">
              <div className="px-3 md:px-4 py-2 border-b border-border bg-bg-surface/50">
                <span className="text-sm font-semibold text-text-primary">
                  On boards (1)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary">
                      <th className="px-3 md:px-4 py-1 font-medium hidden sm:table-cell">
                        Parent
                      </th>
                      <th className="px-3 md:px-4 py-1 font-medium">Board</th>
                      <th className="px-3 md:px-4 py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border-subtle">
                      <td className="px-3 md:px-4 py-1 hidden sm:table-cell">
                        {parentCard ? (
                          <span className="inline-flex items-center gap-1 bg-bg-surface text-text-primary px-2 py-0.5 rounded text-xs font-medium">
                            <Link2 size={10} />
                            <span className="truncate max-w-[120px]">
                              {parentCard.title}
                            </span>
                          </span>
                        ) : (
                          <span className="text-text-disabled text-xs">
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-1">
                        <span className="text-text-primary font-medium text-xs md:text-sm">
                          {boardName || "—"}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-1">
                        <span
                          className="inline-block rounded-full text-xs font-semibold"
                          style={{ color: statusOpt.color }}
                        >
                          {statusOpt.label}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {showFields && (
              <div className="space-y-0">
                {/* Priority */}
                <div className="flex items-center py-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                    <Flag size={15} />
                    <span>Priority</span>
                  </div>
                  <div className="relative" ref={priorityDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowPriorityDropdown((p) => !p)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-opacity hover:opacity-80 ${priorityOpt.cls}`}
                    >
                      {priorityOpt.label}
                      <ChevronDown size={10} className="inline ml-1" />
                    </button>
                    {showPriorityDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-[60] w-40 py-1">
                        {PRIORITY_OPTIONS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                priority: p.value as any,
                              }));
                              autoSave({ priority: p.value });
                              setShowPriorityDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                              form.priority === p.value
                                ? "bg-bg-surface"
                                : "hover:bg-bg-surface"
                            }`}
                          >
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.cls}`}
                            >
                              {p.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignees */}
                <div className="flex items-start py-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                    <User size={15} />
                    <span>Assignees</span>
                  </div>
                  <AssigneeDropdown
                    members={members}
                    selected={form.assignees}
                    onChange={(updated) => {
                      setForm((prev) => ({ ...prev, assignees: updated }));
                      autoSave({ assignees: updated });
                    }}
                  />
                </div>

                {/* Deadline */}
                <div className="flex items-center py-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                    <Calendar size={15} />
                    <span>Deadline</span>
                  </div>
                  <input
                    type="date"
                    className="text-sm bg-transparent border-0 outline-none cursor-pointer text-text-primary"
                    value={form.deadline}
                    onChange={(e) => {
                      updateField("deadline", e.target.value);
                      autoSave({ deadline: e.target.value || undefined });
                    }}
                  />
                </div>

                {/* Parent card */}
                <div className="flex items-start py-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                    <Link2 size={15} />
                    <span>Parent Card</span>
                  </div>
                  <div
                    className="flex-1 relative flex items-center gap-2"
                    ref={parentCardRef}
                  >
                    {form.parentId ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-subtle text-brand font-medium">
                        {parentCard?.cardNumber
                          ? `SP-${parentCard.cardNumber}`
                          : ""}{" "}
                        {parentCard?.title || "Unknown"}
                        <button
                          type="button"
                          onClick={() => updateField("parentId", "")}
                          className="hover:opacity-60 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowParentDropdown((p) => !p)}
                      className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1 mt-1"
                    >
                      <Plus size={12} />{" "}
                      {form.parentId ? "Change" : "Set parent"}
                    </button>
                    {showParentDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-[calc(100vw-3rem)] max-w-72 max-h-48 flex flex-col">
                        <div className="px-3 py-2">
                          <input
                            type="text"
                            value={parentSearch}
                            onChange={(e) => setParentSearch(e.target.value)}
                            placeholder="Search cards..."
                            className="w-full text-sm bg-bg-base text-text-primary rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand placeholder:text-text-disabled"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto py-1">
                          {form.parentId && (
                            <button
                              type="button"
                              onClick={() => {
                                updateField("parentId", "");
                                setShowParentDropdown(false);
                                setParentSearch("");
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-surface transition-colors"
                            >
                              None
                            </button>
                          )}
                          {parentCandidates
                            .filter(
                              (t) =>
                                !parentSearch ||
                                t.title
                                  .toLowerCase()
                                  .includes(parentSearch.toLowerCase()) ||
                                (t.cardNumber &&
                                  `SP-${t.cardNumber}`
                                    .toLowerCase()
                                    .includes(parentSearch.toLowerCase())),
                            )
                            .slice(0, 15)
                            .map((t) => (
                              <button
                                key={t._id}
                                type="button"
                                onClick={() => {
                                  updateField("parentId", t._id);
                                  setShowParentDropdown(false);
                                  setParentSearch("");
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                                  form.parentId === t._id
                                    ? "filter-item-active"
                                    : "text-text-primary hover:bg-bg-surface"
                                }`}
                              >
                                <span className="text-text-disabled text-xs font-mono">
                                  {t.cardNumber ? `SP-${t.cardNumber}` : ""}
                                </span>
                                <span className="truncate">{t.title}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Branch */}
                <div className="flex items-center py-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                    <GitBranch size={15} />
                    <span>Branch</span>
                  </div>
                  <input
                    type="text"
                    className="text-sm bg-transparent border-0 outline-none text-text-primary flex-1 placeholder:text-text-disabled"
                    value={form.branch}
                    onChange={(e) => updateField("branch", e.target.value)}
                    placeholder="e.g. feature/my-branch"
                  />
                </div>

                {/* PR */}
                <div className="flex items-center py-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary">
                    <GitPullRequest size={15} />
                    <span>PR</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <input
                      type="text"
                      className="text-sm bg-transparent border-0 outline-none text-text-primary flex-1 placeholder:text-text-disabled min-w-0"
                      value={form.pr}
                      onChange={(e) => updateField("pr", e.target.value)}
                      placeholder="https://github.com/..."
                      readOnly={readOnly}
                    />
                    {form.pr && form.pr.startsWith("http") && (
                      <a
                        href={form.pr}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:text-brand-hover flex-shrink-0"
                        title="Open PR"
                      >
                        <Link size={14} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Labels */}
                <div className="flex items-start py-3 border-t border-b border-border-subtle">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                    <Tag size={15} />
                    <span>Labels</span>
                  </div>
                  <div
                    className="flex-1 relative flex items-center flex-wrap"
                    ref={labelDropdownRef}
                  >
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {form.labels.map((label) => {
                        const labelData = allLabels.find(
                          (t) => t.name === label,
                        );
                        const labelColor = labelData?.color || "#6366f1";
                        return (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: labelColor + "18",
                              color: labelColor,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: labelColor }}
                            />
                            {label}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = form.labels.filter(
                                  (l) => l !== label,
                                );
                                setForm((prev) => ({
                                  ...prev,
                                  labels: updated,
                                }));
                                autoSave({ labels: updated });
                              }}
                              className="hover:opacity-60 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLabelDropdown((p) => !p)}
                      className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} /> Add label
                    </button>
                    {showLabelDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-[60] w-64 max-h-72 flex flex-col">
                        <div className="px-3 py-2 border-b border-border">
                          <input
                            type="text"
                            value={labelSearch}
                            onChange={(e) => setLabelSearch(e.target.value)}
                            placeholder="Search labels..."
                            className="w-full text-sm bg-bg-card border border-border text-text-primary rounded px-2 py-1 outline-none focus:border-border placeholder:text-text-disabled"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto py-1">
                          {(() => {
                            const filtered = allLabels
                              .filter((t) => !form.labels.includes(t.name))
                              .filter((t) =>
                                t.name
                                  .toLowerCase()
                                  .includes(labelSearch.toLowerCase()),
                              );
                            if (filtered.length === 0) {
                              return (
                                <p className="px-3 py-3 text-xs text-text-disabled text-center">
                                  No labels found
                                </p>
                              );
                            }
                            const grouped: Record<string, LabelData[]> = {};
                            filtered.forEach((t) => {
                              const cat = t.category || "Other";
                              if (!grouped[cat]) grouped[cat] = [];
                              grouped[cat].push(t);
                            });
                            return Object.entries(grouped).map(
                              ([category, catLabels]) => (
                                <div key={category}>
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-text-disabled uppercase tracking-wider">
                                    {category}
                                  </p>
                                  {catLabels.map((t) => (
                                    <button
                                      key={t._id}
                                      type="button"
                                      onClick={() => {
                                        const updated = [
                                          ...form.labels,
                                          t.name,
                                        ];
                                        setForm((prev) => ({
                                          ...prev,
                                          labels: updated,
                                        }));
                                        autoSave({ labels: updated });
                                        setLabelSearch("");
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-surface transition-colors text-left"
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: t.color }}
                                      />
                                      {t.name}
                                    </button>
                                  ))}
                                </div>
                              ),
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Blocked By */}
                <div className="flex items-start py-3 border-t border-bg-base">
                  <div className="flex items-center gap-2.5 w-28 md:w-40 text-sm text-text-secondary pt-0.5">
                    <Ban size={15} />
                    <span>Blocked By</span>
                  </div>
                  <div className="flex-1 relative" ref={blockedByRef}>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {form.blockedBy.map((blockerId) => {
                        const blockerTask = allTasks.find(
                          (t) => t._id === blockerId,
                        );
                        return (
                          <span
                            key={blockerId}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger-subtle text-danger font-medium"
                          >
                            {blockerTask?.cardNumber
                              ? `SP-${blockerTask.cardNumber}`
                              : ""}{" "}
                            {blockerTask?.title || "Unknown"}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = form.blockedBy.filter(
                                  (id) => id !== blockerId,
                                );
                                setForm((prev) => ({
                                  ...prev,
                                  blockedBy: updated,
                                }));
                                autoSave({ blockedBy: updated });
                              }}
                              className="hover:opacity-60 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBlockedByDropdown((p) => !p)}
                      className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} /> Add blocker
                    </button>
                    {showBlockedByDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-[calc(100vw-3rem)] max-w-72 max-h-48 flex flex-col">
                        <div className="px-3 py-2">
                          <input
                            type="text"
                            value={blockerSearch}
                            onChange={(e) => setBlockerSearch(e.target.value)}
                            placeholder="Search cards..."
                            className="w-full text-sm bg-bg-base text-text-primary rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-brand placeholder:text-text-disabled"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto py-1">
                          {allTasks
                            .filter(
                              (t) =>
                                t._id !== task._id &&
                                !form.blockedBy.includes(t._id),
                            )
                            .filter(
                              (t) =>
                                !blockerSearch ||
                                t.title
                                  .toLowerCase()
                                  .includes(blockerSearch.toLowerCase()) ||
                                (t.cardNumber &&
                                  `SP-${t.cardNumber}`
                                    .toLowerCase()
                                    .includes(blockerSearch.toLowerCase())),
                            )
                            .slice(0, 15)
                            .map((t) => (
                              <button
                                key={t._id}
                                type="button"
                                onClick={() => {
                                  const updated = [...form.blockedBy, t._id];
                                  setForm((prev) => ({
                                    ...prev,
                                    blockedBy: updated,
                                  }));
                                  autoSave({ blockedBy: updated });
                                  setBlockerSearch("");
                                  setShowBlockedByDropdown(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-surface transition-colors text-left"
                              >
                                <span className="text-text-disabled text-xs font-mono">
                                  {t.cardNumber ? `SP-${t.cardNumber}` : ""}
                                </span>
                                <span className="truncate">{t.title}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Separator toggle */}
            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => setShowFields((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-xs text-text-secondary hover:bg-bg-card transition-colors whitespace-nowrap"
              >
                {showFields ? "Hide" : "Show"} fields
                <ChevronsUpDown size={12} />
              </button>
            </div>

            {/* Description */}
            <div className="mt-6">
              {readOnly ? (
                form.description ? (
                  <div
                    className="text-sm text-text-secondary prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: form.description }}
                  />
                ) : (
                  <p className="text-sm text-text-disabled italic">
                    No description
                  </p>
                )
              ) : (
                <RichTextEditor
                  mode="field"
                  initialContent={form.description}
                  onChange={(html) => updateField("description", html)}
                  placeholder="Add a description..."
                  mentionUsers={mentionUsersList}
                />
              )}
            </div>

            {/* Attachments */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip size={16} className="text-text-secondary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Attachments
                </h3>
                {attachments.length > 0 && (
                  <span className="text-xs text-text-disabled font-medium">
                    {attachments.length}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv"
              />

              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2">
                {attachments.map((att, attIdx) => {
                  const isMedia =
                    att.type === "image" ||
                    !!att.name.match(
                      /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)$/i,
                    );
                  const isImage =
                    att.type === "image" ||
                    !!att.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

                  return (
                    <div
                      key={att._id}
                      className="relative group rounded-lg overflow-hidden cursor-pointer bg-bg-base aspect-square"
                      onClick={() => {
                        if (isMedia) {
                          setViewerIndex(attIdx);
                        } else {
                          window.open(att.url, "_blank");
                        }
                      }}
                    >
                      {isImage ? (
                        <img
                          src={att.url.replace(
                            "/upload/",
                            "/upload/w_200,h_200,c_thumb,q_auto,f_auto/",
                          )}
                          alt={att.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2">
                          <File size={24} className="text-text-disabled" />
                          <span className="text-xs text-text-disabled text-center truncate w-full px-1">
                            {att.name.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                        <div className="w-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate font-medium">
                            {att.name}
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 bg-black/50 hover:bg-black/70 text-white rounded transition-colors"
                          title="Download"
                        >
                          <Download size={12} />
                        </a>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAttachment(att._id);
                            }}
                            className="p-1 bg-black/50 hover:bg-red-600 text-white rounded transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add tile — always last in the grid */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg border-2 border-dashed border-bg-base hover:border-brand/40 aspect-square flex flex-col items-center justify-center gap-1 text-text-disabled hover:text-brand transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={20} />
                    <span className="text-xs font-medium">
                      {uploading ? "..." : "Add"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Checklist */}
            <div className="mt-6 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare size={16} className="text-text-secondary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Subtasks
                </h3>
                {form.checklist.length > 0 && (
                  <span className="text-xs text-text-disabled font-medium">
                    {form.checklist.filter((i) => i.completed).length}/
                    {form.checklist.length}
                  </span>
                )}
              </div>

              {form.checklist.length > 0 &&
                (() => {
                  const done = form.checklist.filter((i) => i.completed).length;
                  const total = form.checklist.length;
                  return (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-1.5 bg-border-subtle rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${done === total ? "bg-success" : "bg-brand"}`}
                          style={{ width: `${(done / total) * 100}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium ${done === total ? "text-success" : "text-text-disabled"}`}
                      >
                        {Math.round((done / total) * 100)}%
                      </span>
                    </div>
                  );
                })()}

              <div className="space-y-1">
                {form.checklist
                  .sort((a, b) => a.order - b.order)
                  .map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-bg-card transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => {
                          const updatedChecklist = form.checklist.map(
                            (ci, i) =>
                              i === idx
                                ? { ...ci, completed: !ci.completed }
                                : ci,
                          );
                          setForm((prev) => ({
                            ...prev,
                            checklist: updatedChecklist,
                          }));
                          // Auto-save checkbox state
                          fetch(`/api/tasks/${task._id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              checklist: updatedChecklist,
                            }),
                          }).then(() => onUpdated());
                        }}
                        className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            checklist: prev.checklist.map((ci, i) =>
                              i === idx ? { ...ci, text: e.target.value } : ci,
                            ),
                          }));
                          setDirty(true);
                        }}
                        className={`flex-1 text-sm bg-transparent border-0 outline-none ${
                          item.completed
                            ? "line-through text-text-disabled"
                            : "text-text-primary"
                        }`}
                      />
                      <button
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            checklist: prev.checklist.filter(
                              (_, i) => i !== idx,
                            ),
                          }));
                          setDirty(true);
                        }}
                        className="p-1 text-text-disabled hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Plus size={16} className="text-text-disabled" />
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newChecklistItem.trim()) {
                      e.preventDefault();
                      setForm((prev) => ({
                        ...prev,
                        checklist: [
                          ...prev.checklist,
                          {
                            text: newChecklistItem.trim(),
                            completed: false,
                            order: prev.checklist.length,
                          },
                        ],
                      }));
                      setNewChecklistItem("");
                      setDirty(true);
                    }
                  }}
                  placeholder="Add an item..."
                  className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-text-disabled text-text-primary"
                />
              </div>
            </div>

            {/* Time Tracking */}
            <div className="mt-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-text-secondary" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Time Tracked
                  </h3>
                  {totalMinutes > 0 && (
                    <span className="text-xs bg-brand-subtle text-brand px-2 py-0.5 rounded-full font-medium">
                      {formatDuration(totalMinutes)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimeForm((p) => !p)}
                  className="text-xs text-brand hover:text-brand-hover font-medium flex items-center gap-1"
                >
                  <Plus size={12} /> Log time
                </button>
              </div>

              {showTimeForm && (
                <div className="bg-bg-card rounded-lg p-3 mb-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs uppercase tracking-wider text-text-disabled font-semibold mb-1">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={timeMinutes}
                        onChange={(e) => setTimeMinutes(e.target.value)}
                        placeholder="30"
                        className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg-card text-text-primary focus:outline-none focus:ring-1 focus:ring-border"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-text-disabled font-semibold mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={timeDate}
                        onChange={(e) => setTimeDate(e.target.value)}
                        className="text-sm border border-border rounded-md px-2 py-1.5 bg-bg-card text-text-primary focus:outline-none focus:ring-1 focus:ring-border"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={timeDesc}
                    onChange={(e) => setTimeDesc(e.target.value)}
                    placeholder="What did you work on?"
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg-card text-text-primary focus:outline-none focus:ring-1 focus:ring-border"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTimeForm(false)}
                      className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTimeLog}
                      className="px-3 py-1 text-xs bg-brand text-white rounded-md hover:bg-brand-hover font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {timeLogs.length > 0 ? (
                <div className="space-y-1.5">
                  {timeLogs.map((log) => (
                    <div
                      key={log._id}
                      className="flex items-start gap-2 group py-1.5 px-2 rounded-lg hover:bg-bg-card transition-colors"
                    >
                      <Avatar
                        name={log.user}
                        size="w-8 h-8"
                        textSize="text-xs"
                        bg="bg-bg-card"
                        color="text-text-disabled"
                      />
                      <div className="leading-normal -mt-1">
                        <span className="text-xs text-text-disabled">
                          {log.user} &middot;&nbsp;
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-brand">
                            {formatDuration(log.minutes)}
                          </span>
                          {log.description && (
                            <span className="text-xs text-text-secondary truncate">
                              {log.description}
                            </span>
                          )}
                        </div>
                      </div>
                      {(log.userEmail === session?.user?.email ||
                        session?.user?.role === "admin") && (
                        <button
                          onClick={() => handleDeleteTimeLog(log._id)}
                          className="p-1 text-text-disabled hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-disabled">
                  No time logged yet.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — Comments & Activity panel */}
          <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-border bg-bg-surface">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setRightTab("comments")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                  rightTab === "comments"
                    ? "text-brand border-b-2 border-brand"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <MessageSquare size={14} />
                Comments
                {comments.length > 0 && (
                  <span className="text-xs bg-border text-text-secondary px-1.5 py-0.5 rounded-full font-medium">
                    {comments.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightTab("activity");
                  fetchActivities();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                  rightTab === "activity"
                    ? "text-brand border-b-2 border-brand"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <History size={14} />
                Activity
              </button>
            </div>

            {rightTab === "comments" ? (
              <>
                {/* Comments list */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {comments.length > 0 ? (
                    <div className="space-y-5">
                      {comments.map((c) => (
                        <div key={c._id} className="flex gap-3">
                          <Avatar
                            name={c.author}
                            size="w-8 h-8"
                            textSize="text-xs"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">
                                {c.author}
                              </span>
                              <span className="text-xs text-text-disabled">
                                {timeAgo(c.createdAt)}
                              </span>
                              {(c.authorEmail === session?.user?.email ||
                                session?.user?.role === "admin") && (
                                <button
                                  onClick={() => handleDeleteComment(c._id)}
                                  className="ml-auto p-1 text-text-disabled hover:text-danger transition-colors rounded"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            <div
                              className="text-sm text-text-secondary mt-1 prose prose-sm prose-invert max-w-none break-words comments [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5"
                              dangerouslySetInnerHTML={{ __html: c.content }}
                            />
                          </div>
                        </div>
                      ))}
                      <div ref={commentsEndRef} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-text-disabled">
                        Be the first one to add a comment.
                      </p>
                    </div>
                  )}
                </div>

                {/* Comment input */}
                {canEdit && (
                  <div className="border-t border-border p-4">
                    <RichTextEditor
                      onSubmit={handleAddComment}
                      disabled={postingComment}
                      placeholder="Add a comment..."
                      mentionUsers={mentionUsersList}
                    />
                  </div>
                )}
              </>
            ) : (
              /* Activity feed */
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {activities.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-4">
                      {activities.map((a) => (
                        <div key={a._id} className="flex gap-3 relative">
                          <div className="z-10">
                            <Avatar
                              name={a.user}
                              size="w-8 h-8"
                              textSize="text-xs"
                              bg="bg-bg-card"
                              color="text-text-disabled"
                            />
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <p className="text-sm text-text-primary">
                              <span className="font-medium">{a.user}</span>{" "}
                              <span className="text-text-secondary">
                                {a.details}
                              </span>
                            </p>
                            <span className="text-xs text-text-disabled">
                              {timeAgo(a.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-text-disabled">
                      No activity yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save as Template dialog */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 z-[102] flex items-center justify-center p-4">
          <div className="bg-bg-card rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              Save as Template
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Save this card&apos;s structure as a reusable template.
            </p>
            <input
              autoFocus
              className="w-full text-sm bg-bg-base text-text-primary placeholder:text-text-disabled rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand mb-4"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && templateName.trim()) {
                  fetch(`/api/tasks/${task._id}/save-as-template`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: templateName.trim() }),
                  }).then(() => {
                    setShowSaveTemplate(false);
                    setTemplateName("");
                  });
                }
                if (e.key === "Escape") setShowSaveTemplate(false);
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="flex-1 px-4 py-2 bg-bg-base rounded-lg text-text-secondary hover:bg-bg-surface text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!templateName.trim()) return;
                  fetch(`/api/tasks/${task._id}/save-as-template`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: templateName.trim() }),
                  }).then(() => {
                    setShowSaveTemplate(false);
                    setTemplateName("");
                  });
                }}
                className="flex-1 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {viewerIndex !== null && (
        <AttachmentViewer
          attachments={attachments}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction === "delete" ? "Delete Card" : "Archive Card"}
          message={
            confirmAction === "delete"
              ? `"${task.title}" will be permanently deleted along with all comments and activity. This cannot be undone.`
              : `"${task.title}" will be archived and hidden from the board. You can restore it later.`
          }
          confirmText={confirmAction === "delete" ? "Delete" : "Archive"}
          variant={confirmAction === "delete" ? "danger" : "warning"}
          onConfirm={
            confirmAction === "delete" ? handleDeleteTask : handleArchiveTask
          }
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
