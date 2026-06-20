import Link from "next/link";
import { IconArrowRight } from "./icons";

/**
 * Shared marketing nav for the landing page and /features. Anchor links point at
 * "/#…" so they work from any marketing route (on the home page they just scroll).
 */
export function SiteNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/70 bg-bg/60 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-sm font-mono font-bold">M</span>
          </div>
          <span className="font-display text-xl text-text tracking-tight">MetaCheck</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/features" className="hidden sm:block text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Features</Link>
          <Link href="/#demo" className="hidden sm:block text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Demo</Link>
          <Link href="/#pricing" className="hidden sm:block text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Pricing</Link>
          <Link href="/sign-in" className="text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Sign in</Link>
          <Link
            href="/dashboard"
            className="press inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-bright"
          >
            Open app <IconArrowRight size={15} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
