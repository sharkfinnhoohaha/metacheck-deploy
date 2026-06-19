/**
 * App route template — re-mounts on every navigation inside the authed app, so
 * each page fades/slides in. Gives the "transition on click" feel between
 * Dashboard / Validate / History / Settings. No-op under prefers-reduced-motion.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
