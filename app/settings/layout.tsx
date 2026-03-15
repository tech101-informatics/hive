"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns3, Tag } from "lucide-react";

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
    <div className="flex gap-6 pb-8">
      {/* Side navigation */}
      <div className="w-52 flex-shrink-0">
        <div className="rounded-2xl bg-bg-card p-4 sticky top-20">
          <h2 className="text-sm font-medium text-text-secondary mb-3 px-2">
            Settings
          </h2>
          <nav className="space-y-0.5">
            {settingsNav.map(({ href, label, icon: Icon }) => {
              const active = path === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
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
