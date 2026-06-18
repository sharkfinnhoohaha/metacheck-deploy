import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();
  // Reads go through the service-role client scoped to the authenticated
  // Clerk user. The app uses Clerk (not Supabase Auth), so the anon client
  // has no JWT for RLS — service-role + explicit clerk_id filter is the
  // correct, secure pattern here (mirrors the /api/releases route).
  const supabase = supabaseAdmin;

  // Fetch usage for this month
  const month = new Date().toISOString().slice(0, 7);
  const [{ data: usage }, { data: userData }, { data: recentReleases }] = await Promise.all([
    supabase.from("usage").select("*").eq("clerk_id", userId!).eq("month", month).single(),
    supabase.from("users").select("tier").eq("clerk_id", userId!).single(),
    supabase
      .from("releases")
      .select("id, title, artist, grade, track_count, created_at, critical_count, warning_count")
      .eq("clerk_id", userId!)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const tier = userData?.tier ?? "free";
  const validations = usage?.validations ?? 0;
  const aiCalls = usage?.ai_calls ?? 0;
  const validationLimit = tier === "free" ? 3 : null;
  const aiLimit = tier === "free" ? 0 : tier === "pro" ? 300 : 1500;

  const GRADE_CLASSES: Record<string, { text: string; bg: string }> = {
    A: { text: "text-green-500", bg: "bg-green-500/10" },
    B: { text: "text-lime-500", bg: "bg-lime-500/10" },
    C: { text: "text-yellow-500", bg: "bg-yellow-500/10" },
    D: { text: "text-orange-500", bg: "bg-orange-500/10" },
    F: { text: "text-rose-500", bg: "bg-rose-500/10" },
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="font-display text-3xl text-text mb-1">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-text-muted text-sm">Here&apos;s your MetaCheck overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {/* Validations */}
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs font-mono text-text-dim mb-3 uppercase tracking-widest">Validations this month</p>
          <p className="text-3xl font-bold text-text font-mono">
            {validations}
            {validationLimit && <span className="text-text-dim text-xl"> / {validationLimit}</span>}
          </p>
          {validationLimit && (
            <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
              {/* eslint-disable-next-line react/forbid-dom-props */}
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min((validations / validationLimit) * 100, 100)}%` }}
              />
            </div>
          )}
          {tier === "free" && validations >= 3 && (
            <p className="mt-2 text-xs text-red font-mono">Limit reached — <Link href="/settings" className="underline">upgrade</Link></p>
          )}
        </div>

        {/* AI Calls */}
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs font-mono text-text-dim mb-3 uppercase tracking-widest">AI fixes used</p>
          <p className="text-3xl font-bold text-text font-mono">
            {aiCalls}
            {aiLimit > 0 && <span className="text-text-dim text-xl"> / {aiLimit}</span>}
          </p>
          {tier === "free" && (
            <p className="mt-2 text-xs text-text-dim font-mono">
              <Link href="/settings" className="text-accent-bright hover:underline">Upgrade to Pro</Link> for AI fixes
            </p>
          )}
        </div>

        {/* Plan */}
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs font-mono text-text-dim mb-3 uppercase tracking-widest">Current plan</p>
          <p className={`text-2xl font-bold font-mono capitalize ${tier === "free" ? "text-text-muted" : "text-accent-bright"}`}>
            {tier}
          </p>
          {tier === "free" && (
            <Link
              href="/settings"
              className="mt-3 inline-block text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 font-mono hover:bg-accent/20 transition-colors"
            >
              Upgrade →
            </Link>
          )}
        </div>
      </div>

      {/* Quick action */}
      <div className="mb-10">
        <Link
          href="/validate"
          className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-bright transition-colors glow-teal"
        >
          <span className="text-xl">⟨⟩</span>
          Validate New Release
        </Link>
      </div>

      {/* Recent releases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm text-text-dim uppercase tracking-widest">Recent Releases</h2>
          <Link href="/history" className="text-xs text-accent-bright hover:underline font-mono">
            View all →
          </Link>
        </div>

        {!recentReleases?.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-text-muted text-sm">No releases validated yet.</p>
            <Link href="/validate" className="mt-2 inline-block text-sm text-accent-bright hover:underline">
              Validate your first release →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
            {recentReleases.map((r, i) => (
              <Link
                key={r.id}
                href={`/history/${r.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold font-display shrink-0 ${GRADE_CLASSES[r.grade]?.bg ?? "bg-surface"} ${GRADE_CLASSES[r.grade]?.text ?? "text-text-muted"}`}
                >
                  {r.grade ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{r.title}</p>
                  <p className="text-xs text-text-muted font-mono truncate">
                    {r.artist} · {r.track_count} track{r.track_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-text-dim">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.critical_count > 0 && (
                    <p className="text-xs text-red font-mono">{r.critical_count} critical</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
