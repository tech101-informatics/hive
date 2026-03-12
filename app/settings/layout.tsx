"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns3, Tag, Settings } from "lucide-react";

const settingsNav = [
  { href: "/settings/board", label: "Board Columns", icon: Columns3 },
  { href: "/settings/labels", label: "Labels / Tags", icon: Tag },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();

  return (
    <div className="flex gap-8">
      {/* Side navigation */}
      <div className="w-56 flex-shrink-0 border-r border-border pr-6">
        <div className="bg-bg-surface rounded-lg p-4 h-[calc(80vh_-128px)] sticky top-0">
          <div className="flex items-center gap-2 mb-6 p-2">
            <Settings size={20} className="text-text-secondary" />
            <h2 className="text-lg font-bold text-text-primary">Settings</h2>
          </div>
          <nav className="space-y-1">
            {settingsNav.map(({ href, label, icon: Icon }) => {
              const active = path === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-subtle text-brand"
                      : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
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
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
