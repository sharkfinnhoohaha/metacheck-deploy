"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/validate", label: "Validate Release", icon: "⟨⟩" },
  { href: "/history", label: "History", icon: "◷" },
  { href: "/settings", label: "Settings", icon: "⊙" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col border-r border-border bg-bg-elevated"
      style={{ width: 240 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-mono font-bold">M</span>
        </div>
        <span className="font-display text-lg text-text tracking-tight">MetaCheck</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "bg-accent/10 text-accent-bright font-medium border border-accent/20"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User button */}
      <div className="px-5 py-4 border-t border-border flex items-center gap-3">
        <UserButton />
        <span className="text-xs text-text-dim">Account</span>
      </div>
    </aside>
  );
}
