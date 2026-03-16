"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns3, Tag, Bell } from "lucide-react";

const settingsNav = [
  { href: "/settings/board", label: "Board Columns", icon: Columns3 },
  { href: "/settings/labels", label: "Labels / Tags", icon: Tag },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 pb-8">
      {/* Side navigation — horizontal on mobile, sidebar on desktop */}
      <div className="md:w-52 flex-shrink-0">
        <div className="rounded-2xl bg-bg-card p-2 md:p-4 md:sticky md:top-20">
          <h2 className="text-sm font-medium text-text-secondary mb-2 md:mb-3 px-2 hidden md:block">
            Settings
          </h2>
          <nav className="flex md:flex-col gap-0.5 overflow-x-auto">
            {settingsNav.map(({ href, label, icon: Icon }) => {
              const active = path === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "bg-brand-subtle text-brand"
                      : "text-text-secondary hover:bg-bg-base hover:text-text-primary"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">{children}</div>
    </div>
  );
}
