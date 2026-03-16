"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CalendarDays,
  LogOut,
  Settings,
  Sun,
  Moon,
  BarChart3,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Boards", icon: FolderKanban },
  { href: "/members", label: "Team", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function Navbar() {
  const path = usePathname();
  const { data: session, status } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (path === "/login" || path === "/auth-error") return null;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const isAdmin = session?.user?.role === "admin";
  const { theme, toggleTheme } = useTheme();

  const allLinks = [
    ...links,
    ...(isAdmin
      ? [
          { href: "/analytics", label: "Analytics", icon: BarChart3 },
          { href: "/settings/board", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <>
      <nav className="bg-bg-surface border-b border-border sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/hive-icon.png"
                alt="Hive"
                className="w-7 h-7 rounded-lg"
              />
              <span className="font-bold text-text-primary text-lg">
                Hive
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {allLinks.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/" ? path === "/" : path.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-subtle text-brand"
                        : "text-text-secondary hover:bg-bg-card"
                    }`}
                  >
                    <Icon size={15} />
                    <span className="hidden lg:inline">{label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="p-2 text-text-secondary hover:bg-bg-card rounded-lg transition-colors"
                title={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {status === "authenticated" && session?.user && (
                <div className="hidden md:flex items-center gap-2">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-7 h-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                      {initials(session.user.name || "U")}
                    </div>
                  )}
                  <div className="hidden lg:block">
                    <p className="text-xs font-medium text-text-primary leading-tight">
                      {session.user.name}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="p-2 text-text-secondary hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors"
                    title="Sign out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden p-2 text-text-secondary hover:bg-bg-card rounded-lg transition-colors"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-bg-surface z-50 md:hidden transform transition-transform duration-200 ease-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          {status === "authenticated" && session?.user && (
            <div className="flex items-center gap-2.5">
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
              <div>
                <p className="text-sm font-medium text-text-primary leading-tight">
                  {session.user.name}
                </p>
                <p className="text-xs text-text-disabled">
                  {isAdmin ? "Admin" : "Member"}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 text-text-secondary hover:bg-bg-card rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer nav */}
        <div className="px-3 py-4 space-y-0.5">
          {allLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-subtle text-brand"
                    : "text-text-secondary hover:bg-bg-card"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border px-3 py-4">
          <button
            onClick={() => {
              setDrawerOpen(false);
              toggleTheme();
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg-card transition-colors w-full"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          {status === "authenticated" && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-danger hover:bg-danger-subtle transition-colors w-full"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </>
  );
}
