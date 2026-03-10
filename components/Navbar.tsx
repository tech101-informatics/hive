"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, FolderKanban, Users, CalendarDays, LogOut, Settings } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Boards", icon: FolderKanban },
  { href: "/members", label: "Team", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export function Navbar() {
  const path = usePathname();
  const { data: session, status } = useSession();

  // Don't show navbar on login/auth-error pages
  if (path === "/login" || path === "/auth-error") return null;

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const isAdmin = session?.user?.role === "admin";

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FolderKanban size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">ProjectHub</span>
          </div>

          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/settings/board"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  path.startsWith("/settings")
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Settings size={16} />
                Settings
              </Link>
            )}
          </div>

          {status === "authenticated" && session?.user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-8 h-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {initials(session.user.name || "U")}
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-800 leading-tight">
                    {session.user.name}
                  </p>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      isAdmin
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isAdmin ? "Admin" : "Member"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
