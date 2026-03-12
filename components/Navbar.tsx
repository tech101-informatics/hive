"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, FolderKanban, Users, CalendarDays, LogOut, Settings, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

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
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="bg-bg-surface border-b border-border sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <img src="/hive-icon.png" alt="Hive" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-text-primary text-lg">Hive</span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-subtle text-brand"
                      : "text-text-secondary hover:bg-bg-card"
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
                    ? "bg-brand-subtle text-brand"
                    : "text-text-secondary hover:bg-bg-card"
                }`}
              >
                <Settings size={16} />
                Settings
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-text-secondary hover:bg-bg-card rounded-lg transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

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
                    <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                      {initials(session.user.name || "U")}
                    </div>
                  )}
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-text-primary leading-tight">
                      {session.user.name}
                    </p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        isAdmin
                          ? "bg-brand-subtle text-brand"
                          : "bg-bg-card text-text-secondary"
                      }`}
                    >
                      {isAdmin ? "Admin" : "Member"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="p-2 text-text-secondary hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
