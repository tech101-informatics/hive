"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Users, Loader2, Trash2, Search, Check, X, Link2, RefreshCw, Send } from "lucide-react";

interface Member {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  slackUserId: string;
}

interface SlackUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  alreadyAdded: boolean;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlackPicker, setShowSlackPicker] = useState(false);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackSearch, setSlackSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editSlackMember, setEditSlackMember] = useState<Member | null>(null);
  const [editSlackId, setEditSlackId] = useState("");
  const [testingDM, setTestingDM] = useState<string | null>(null);

  const fetchMembers = async () => {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const openSlackPicker = async () => {
    setShowSlackPicker(true);
    setSlackLoading(true);
    setSlackSearch("");
    const res = await fetch("/api/slack/users");
    const data = await res.json();
    setSlackUsers(Array.isArray(data) ? data : []);
    setSlackLoading(false);
  };

  const addSlackUser = async (user: SlackUser) => {
    setAdding(user.id);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        role: "Member",
        avatar: user.avatar,
        slackUserId: user.id,
      }),
    });
    console.log("Add member response:", res);
    if (res.ok) {
      setSlackUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, alreadyAdded: true } : u)),
      );
      fetchMembers();
    }

    setAdding(null);
  };

  const deleteMember = async (id: string) => {
    if (!confirm("Remove this member?")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    fetchMembers();
  };

  const linkMySlack = async () => {
    setLinking(true);
    setLinkResult(null);
    const res = await fetch("/api/members/link-slack", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setLinkResult({ ok: true, message: data.message || "Slack linked!" });
      fetchMembers();
    } else {
      setLinkResult({ ok: false, message: data.error || "Failed to link" });
    }
    setLinking(false);
    setTimeout(() => setLinkResult(null), 4000);
  };

  const syncAllSlack = async () => {
    setSyncing(true);
    // Sync Slack IDs and roles in parallel
    const [slackRes, rolesRes] = await Promise.all([
      fetch("/api/members/sync-slack", { method: "POST" }),
      fetch("/api/members/sync-roles", { method: "POST" }),
    ]);
    const slackData = await slackRes.json();
    const rolesData = await rolesRes.json();
    const messages: string[] = [];
    if (slackRes.ok) messages.push(`Slack: ${slackData.matched}/${slackData.total} linked`);
    if (rolesRes.ok && rolesData.updated > 0) messages.push(`Roles: ${rolesData.updated} updated`);
    if (messages.length) {
      setLinkResult({ ok: true, message: messages.join(" · ") });
    } else if (!slackRes.ok) {
      setLinkResult({ ok: false, message: slackData.error || "Sync failed" });
    } else {
      setLinkResult({ ok: true, message: "Everything is up to date" });
    }
    fetchMembers();
    setSyncing(false);
    setTimeout(() => setLinkResult(null), 4000);
  };

  const saveSlackId = async () => {
    if (!editSlackMember || !editSlackId.trim()) return;
    const res = await fetch("/api/members/set-slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editSlackMember.email, slackUserId: editSlackId.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setLinkResult({ ok: true, message: `Slack linked for ${editSlackMember.name}` });
      fetchMembers();
    } else {
      setLinkResult({ ok: false, message: data.error || "Failed to link" });
    }
    setEditSlackMember(null);
    setEditSlackId("");
    setTimeout(() => setLinkResult(null), 4000);
  };

  const testDM = async (member: Member) => {
    setTestingDM(member._id);
    const res = await fetch("/api/slack/test-dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slackUserId: member.slackUserId, memberName: member.name }),
    });
    const data = await res.json();
    if (res.ok) {
      setLinkResult({ ok: true, message: `Test DM sent to ${member.name}` });
    } else {
      setLinkResult({ ok: false, message: data.error || "Failed to send test DM" });
    }
    setTestingDM(null);
    setTimeout(() => setLinkResult(null), 4000);
  };

  const myMember = members.find(
    (m) => m.email.toLowerCase() === session?.user?.email?.toLowerCase(),
  );

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  const colors = [
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-blue-500",
  ];

  const filteredSlackUsers = slackUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(slackSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(slackSearch.toLowerCase()),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Members</h1>
          <p className="text-slate-500 mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Link my Slack — shown if current user has no slackUserId */}
          {myMember && !myMember.slackUserId && (
            <button
              onClick={linkMySlack}
              disabled={linking}
              className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm"
            >
              <Link2 size={16} />
              {linking ? "Linking..." : "Link my Slack"}
            </button>
          )}
          {/* Sync all — admin only */}
          {isAdmin && (
            <button
              onClick={syncAllSlack}
              disabled={syncing}
              className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Slack"}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={openSlackPicker}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm"
            >
              <Plus size={18} /> Add from Slack
            </button>
          )}
        </div>
      </div>

      {/* Status toast */}
      {linkResult && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            linkResult.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {linkResult.message}
        </div>
      )}

      {/* Slack User Picker Modal */}
      {showSlackPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Add from Slack
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Select workspace members to add to your team
                </p>
              </div>
              <button
                onClick={() => setShowSlackPicker(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-100">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={slackSearch}
                  onChange={(e) => setSlackSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {slackLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-indigo-500" size={28} />
                </div>
              ) : filteredSlackUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={36} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">
                    {slackUsers.length === 0
                      ? "No Slack users found. Check your SLACK_BOT_TOKEN."
                      : "No matches found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredSlackUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-9 h-9 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                          {initials(user.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user.email}
                        </p>
                      </div>
                      {user.alreadyAdded ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                          <Check size={12} /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => addSlackUser(user)}
                          disabled={adding === user.id}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                        >
                          {adding === user.id ? "Adding..." : "Add"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-20">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg">No team members yet</p>
          {isAdmin && (
            <p className="text-slate-400 text-sm mt-1">
              Click &quot;Add from Slack&quot; to import your team
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((m, i) => (
            <div
              key={m._id}
              className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4"
            >
              {m.avatar ? (
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="w-12 h-12 rounded-full flex-shrink-0"
                />
              ) : (
                <div
                  className={`${colors[i % colors.length]} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}
                >
                  {initials(m.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {m.name}
                </p>
                <p className="text-slate-500 text-sm truncate">{m.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {m.role}
                  </span>
                  {m.slackUserId ? (
                    <button
                      type="button"
                      onClick={() => { if (isAdmin) { setEditSlackMember(m); setEditSlackId(m.slackUserId); } }}
                      className={`text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full ${isAdmin ? "cursor-pointer hover:bg-green-100" : ""}`}
                      title={isAdmin ? `Slack ID: ${m.slackUserId} — click to edit` : `Slack ID: ${m.slackUserId}`}
                    >
                      Slack
                    </button>
                  ) : isAdmin ? (
                    <button
                      type="button"
                      onClick={() => { setEditSlackMember(m); setEditSlackId(""); }}
                      className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full hover:bg-slate-200 cursor-pointer"
                    >
                      + Link Slack
                    </button>
                  ) : null}
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-1">
                  {m.slackUserId && (
                    <button
                      onClick={() => testDM(m)}
                      disabled={testingDM === m._id}
                      className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Send test DM"
                    >
                      <Send size={14} className={testingDM === m._id ? "animate-pulse" : ""} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMember(m._id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Slack ID Modal */}
      {editSlackMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Link Slack Account</h2>
            <p className="text-sm text-slate-500 mb-4">{editSlackMember.name} ({editSlackMember.email})</p>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Slack User ID</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                value={editSlackId}
                onChange={(e) => setEditSlackId(e.target.value)}
                placeholder="e.g. U0A41A52L13"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">Find in Slack: click profile → More → Copy member ID</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setEditSlackMember(null); setEditSlackId(""); }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveSlackId}
                disabled={!editSlackId.trim()}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
