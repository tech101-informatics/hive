import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { Member } from "@/models/Member";
import { BoardStatus } from "@/models/BoardStatus";
import { FolderKanban, CheckSquare, Users, TrendingUp } from "lucide-react";

async function getStats() {
  await connectDB();
  const boardStatuses = await BoardStatus.find().sort({ order: 1 }).lean();
  const lastStatus = boardStatuses[boardStatuses.length - 1];
  const doneSlug = lastStatus?.slug || "done";

  const [totalBoards, totalCards, totalMembers, doneCards] = await Promise.all([
    Project.countDocuments(),
    Task.countDocuments(),
    Member.countDocuments(),
    Task.countDocuments({ status: doneSlug }),
  ]);
  const recentBoards = await Project.find().sort({ createdAt: -1 }).limit(5).lean();
  const recentCards = await Task.find().sort({ createdAt: -1 }).limit(5).lean();

  // Per-project progress
  const taskCounts = await Task.aggregate([
    { $group: { _id: { projectId: "$projectId", status: "$status" }, count: { $sum: 1 } } },
  ]);
  const progressMap: Record<string, { total: number; done: number }> = {};
  for (const tc of taskCounts) {
    const pid = String(tc._id.projectId);
    if (!progressMap[pid]) progressMap[pid] = { total: 0, done: 0 };
    progressMap[pid].total += tc.count;
    if (tc._id.status === doneSlug) progressMap[pid].done += tc.count;
  }

  return { totalBoards, totalCards, totalMembers, doneCards, recentBoards, recentCards, boardStatuses, progressMap };
}

export default async function Dashboard() {
  const stats = await getStats();

  const cards = [
    { label: "Total Boards", value: stats.totalBoards, icon: FolderKanban, color: "bg-indigo-500", href: "/projects" },
    { label: "Total Cards", value: stats.totalCards, icon: CheckSquare, color: "bg-emerald-500", href: "/projects" },
    { label: "Completed Cards", value: stats.doneCards, icon: TrendingUp, color: "bg-violet-500", href: "/projects" },
    { label: "Team Members", value: stats.totalMembers, icon: Users, color: "bg-orange-500", href: "/members" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`${c.color} rounded-lg p-3 text-white`}>
              <c.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{c.value}</p>
              <p className="text-sm text-slate-500">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Boards */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800 text-lg">Recent Boards</h2>
            <Link href="/projects" className="text-indigo-600 text-sm hover:underline">View all</Link>
          </div>
          {stats.recentBoards.length === 0 ? (
            <p className="text-slate-400 text-sm">No boards yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentBoards.map((p: any) => {
                const pid = p._id.toString();
                const progress = stats.progressMap[pid] || { total: 0, done: 0 };
                const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
                return (
                  <li key={pid}>
                    <Link href={`/projects/${pid}`} className="block hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        <span className="text-slate-700 hover:text-indigo-600 font-medium truncate flex-1">{p.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "active" ? "bg-emerald-100 text-emerald-700" :
                          p.status === "completed" ? "bg-slate-100 text-slate-600" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>{p.status}</span>
                      </div>
                      {progress.total > 0 && (
                        <div className="flex items-center gap-2 mt-1.5 ml-6">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: pct === 100 ? '#10b981' : '#6366f1',
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 w-12 text-right">{progress.done}/{progress.total}</span>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent Cards */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-slate-800 text-lg">Recent Cards</h2>
          </div>
          {stats.recentCards.length === 0 ? (
            <p className="text-slate-400 text-sm">No cards yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentCards.map((t: any) => {
                const statusDef = stats.boardStatuses.find((s: any) => s.slug === t.status);
                const statusColor = statusDef?.color || "#64748b";
                const statusLabel = statusDef?.label || t.status;
                return (
                  <li key={t._id.toString()} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      t.priority === "high" ? "bg-red-500" :
                      t.priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                    }`} />
                    <span className="text-slate-700 truncate">{t.title}</span>
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: statusColor + "20", color: statusColor }}
                    >
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
