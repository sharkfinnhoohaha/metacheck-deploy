import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

const GRADE_CLASSES: Record<string, { text: string; bg: string }> = {
  A: { text: "text-green-500", bg: "bg-green-500/10" },
  B: { text: "text-lime-500", bg: "bg-lime-500/10" },
  C: { text: "text-yellow-500", bg: "bg-yellow-500/10" },
  D: { text: "text-orange-500", bg: "bg-orange-500/10" },
  F: { text: "text-rose-500", bg: "bg-rose-500/10" },
};

export default async function HistoryPage() {
  const { userId } = await auth();
  const supabase = supabaseAdmin;

  const { data: userData } = await supabase
    .from("users")
    .select("tier")
    .eq("clerk_id", userId!)
    .single();

  if (userData?.tier === "free") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl text-text mb-2">History</h1>
        <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-4xl mb-4">◷</p>
          <h2 className="font-display text-2xl text-text mb-2">History is a Pro feature</h2>
          <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
            Save unlimited validations, review past releases, and re-run checks with the latest rules.
          </p>
          <Link
            href="/settings"
            className="inline-block px-6 py-3 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-bright transition-colors glow-teal"
          >
            Upgrade to Pro →
          </Link>
        </div>
      </div>
    );
  }

  const { data: releases } = await supabase
    .from("releases")
    .select("id, title, artist, grade, track_count, created_at, critical_count, warning_count, suggestion_count")
    .eq("clerk_id", userId!)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-text mb-1">History</h1>
          <p className="text-text-muted text-sm">{releases?.length ?? 0} validations saved</p>
        </div>
        <Link
          href="/validate"
          className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
        >
          + New Validation
        </Link>
      </div>

      {!releases?.length ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-text-muted text-sm mb-3">No saved releases yet.</p>
          <Link href="/validate" className="text-sm text-accent-bright hover:underline">
            Validate your first release →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_80px_100px_120px_40px] gap-4 px-5 py-3 border-b border-border">
            <div />
            <p className="text-xs font-mono text-text-dim uppercase tracking-widest">Release</p>
            <p className="text-xs font-mono text-text-dim uppercase tracking-widest">Tracks</p>
            <p className="text-xs font-mono text-text-dim uppercase tracking-widest">Issues</p>
            <p className="text-xs font-mono text-text-dim uppercase tracking-widest">Date</p>
            <div />
          </div>

          {releases.map((r, i) => (
            <div
              key={r.id}
              className={`grid grid-cols-[40px_1fr_80px_100px_120px_40px] items-center gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold font-display ${GRADE_CLASSES[r.grade]?.bg ?? "bg-surface"} ${GRADE_CLASSES[r.grade]?.text ?? "text-text-muted"}`}
              >
                {r.grade ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text truncate">{r.title}</p>
                <p className="text-xs text-text-muted font-mono truncate">{r.artist}</p>
              </div>
              <p className="text-sm font-mono text-text-muted">{r.track_count}</p>
              <p className="text-sm font-mono">
                {r.critical_count > 0 && <span className="text-red">{r.critical_count}C </span>}
                {r.warning_count > 0 && <span className="text-amber">{r.warning_count}W </span>}
                {r.suggestion_count > 0 && <span className="text-blue">{r.suggestion_count}S</span>}
              </p>
              <p className="text-xs font-mono text-text-dim">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
              <Link
                href={`/history/${r.id}`}
                className="text-xs text-accent-bright hover:underline font-mono"
              >
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
