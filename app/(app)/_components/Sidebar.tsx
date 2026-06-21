"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { IconGrid, IconCheckShield, IconClock, IconSliders, IconBolt, IconNote } from "@/app/_components/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: IconGrid },
  { href: "/validate", label: "Validate", Icon: IconCheckShield },
  { href: "/history", label: "History", Icon: IconClock },
  { href: "/settings", label: "Settings", Icon: IconSliders },
  { href: "/support", label: "Support", Icon: IconNote },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const nav = isAdmin
    ? [...NAV, { href: "/admin", label: "Admin", Icon: IconBolt }, { href: "/admin/support", label: "Support inbox", Icon: IconNote }]
    : NAV;
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col border-r border-border bg-bg-elevated/70 backdrop-blur-xl z-30">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-mono font-bold">M</span>
        </div>
        <span className="font-display text-xl text-text tracking-tight">MetaCheck</span>
      </Link>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "bg-accent/10 text-accent-bright font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              <Icon size={18} className={active ? "text-accent-bright" : "text-text-dim group-hover:text-text-muted transition-colors"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User button */}
      <div className="px-4 py-4 border-t border-border flex items-center gap-3">
        <UserButton />
        <span className="text-xs text-text-dim">Account</span>
      </div>
    </aside>
  );
}
