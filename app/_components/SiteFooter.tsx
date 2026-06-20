import Link from "next/link";

/** Shared marketing footer for the landing page and /features. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-dim">
        <span>&copy; {new Date().getFullYear()} Overlook Strategy</span>
        <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
          <Link href="/features" className="hover:text-text-muted transition-colors">Features</Link>
          <Link href="/release-planner" className="hover:text-text-muted transition-colors">Release planner</Link>
          <Link href="/terms" className="hover:text-text-muted transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-text-muted transition-colors">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
