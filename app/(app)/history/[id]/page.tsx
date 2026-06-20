import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ValidationResult } from "@/lib/validation/types";
import { getGrade } from "@/lib/validation/rules";
import { ReleaseActions } from "./_components/ReleaseActions";

const GRADE_DISPLAY: Record<string, { text: string; bg: string }> = {
  A: { text: "text-green-500", bg: "bg-green-950/60" },
  B: { text: "text-lime-500", bg: "bg-lime-950/60" },
  C: { text: "text-yellow-500", bg: "bg-yellow-950/60" },
  D: { text: "text-orange-500", bg: "bg-orange-950/60" },
  F: { text: "text-rose-500", bg: "bg-rose-950/60" },
};

const SEV_STYLES: Record<string, { dot: string; label: string; border: string }> = {
  critical: { dot: "bg-red", label: "text-red", border: "border-red/15" },
  warning: { dot: "bg-amber", label: "text-amber", border: "border-amber/15" },
  suggestion: { dot: "bg-blue", label: "text-blue", border: "border-blue/15" },
};

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const supabase = supabaseAdmin;

  const { data: release } = await supabase
    .from("releases")
    .select("*")
    .eq("id", id)
    .eq("clerk_id", userId!)
    .single();

  if (!release) notFound();

  // Show only issues still outstanding. Older saved records may include items the
  // user already fixed (flagged `_fixed`); excluding them keeps the grade and
  // counts here consistent with the history list and the saved summary.
  const results = ((release.results ?? []) as (ValidationResult & { _fixed?: boolean })[])
    .filter((r) => !r._fixed);
  const tracks = release.tracks ?? [];
  const grade = getGrade(results);

  const criticals = results.filter((r) => r.severity === "critical");
  const warnings = results.filter((r) => r.severity === "warning");
  const suggestions = results.filter((r) => r.severity === "suggestion");

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-dim mb-8">
        <Link href="/history" className="hover:text-text-muted transition-colors">History</Link>
        <span>/</span>
        <span className="text-text-muted">{release.title}</span>
      </div>

      {/* Grade card */}
      <div className="rounded-xl border border-border bg-bg-card p-6 flex items-center gap-6 mb-6">
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center text-5xl font-bold font-display shrink-0 ${GRADE_DISPLAY[grade.letter]?.bg ?? "bg-surface"} ${GRADE_DISPLAY[grade.letter]?.text ?? "text-text-muted"}`}
        >
          {grade.letter}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-text mb-1 truncate tracking-tight">{release.title}</h1>
          <p className="text-sm text-text-muted mb-1 nums">
            {release.artist} · {release.track_count} track{release.track_count !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-text-dim nums">
            <span className="text-red">{criticals.length} critical</span>
            {" · "}
            <span className="text-amber">{warnings.length} warnings</span>
            {" · "}
            <span className="text-blue">{suggestions.length} suggestions</span>
          </p>
        </div>
        {/* Actions (client component for download triggers) */}
        <ReleaseActions tracks={tracks} results={results} releaseTitle={release.title} />
      </div>

      {/* Results by severity */}
      {(["critical", "warning", "suggestion"] as const).map((sev) => {
        const items = results.filter((r) => r.severity === sev);
        if (!items.length) return null;
        const styles = SEV_STYLES[sev];
        return (
          <div key={sev} className="mb-8">
            <h2 className="flex items-center gap-2 eyebrow mb-3">
              <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
              {sev === "critical" ? "Critical issues" : sev === "warning" ? "Warnings" : "Suggestions"}
              <span className="normal-case tracking-normal text-text-dim/70 nums">({items.length})</span>
            </h2>
            <div className="space-y-2">
              {items.map((result, i) => (
                <div key={i} className={`rounded-xl border p-4 ${styles.border} bg-bg-elevated`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-medium capitalize ${styles.label}`}>{result.severity}</span>
                        <span className="text-xs text-text-dim">·</span>
                        <span className="text-xs text-text-muted">{result.field}</span>
                        {result.trackIndex !== undefined && (
                          <span className="text-xs text-text-dim">track {result.trackIndex + 1}</span>
                        )}
                      </div>
                      <p className="text-sm text-text leading-relaxed">{result.message}</p>
                      {result.suggestion && (
                        <p className="text-xs text-text-muted mt-1.5 font-mono">
                          <span className="text-accent-bright">→</span> {result.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {results.length === 0 && (
        <div className="rounded-xl border border-green/20 bg-green/5 p-8 text-center">
          <p className="text-green text-sm">No issues found — this release is ready to submit.</p>
        </div>
      )}

      {/* Re-validate CTA */}
      <div className="mt-8 pt-8 border-t border-border">
        <Link
          href="/validate"
          className="text-sm text-accent-bright hover:underline"
        >
          ← Validate another release
        </Link>
      </div>
    </div>
  );
}
