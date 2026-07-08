"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { validateTrack, getGrade as computeGrade } from "@/lib/validation/rules";
import { preflightVerdict } from "@/lib/validation/permanence";
import type { TrackMeta, ValidationResult, AiFix } from "@/lib/validation/types";
import { resolveResultFieldKey } from "@/lib/validation/fieldKeys";
import { IconSearch, IconSparkles, IconCheck, IconArrowRight, IconLock } from "./_components/icons";

// Free live lookups before the public demo nudges the visitor to sign up. The
// live song lookup is the core paid value, so the demo proves it's real on a few
// tracks, then gates. (Server-side IP abuse limiting lives in the search route.)
const DEMO_LOOKUP_LIMIT = 3;
const LOOKUPS_KEY = "metacheck_demo_lookups";

// Fields a public iTunes/Apple catalog lookup can actually surface. We ONLY audit
// these so the demo never reports false "missing songwriters/producers/copyright"
// issues on an already-released song — those credits aren't retrievable from a
// public lookup, so flagging them as problems would be misleading. (ISRC is added
// only when the lookup actually returned one — see validate() below.)
const PUBLIC_FIELDS = new Set(["Title", "Artist", "Album", "Genre", "Duration", "Release Date"]);

// Shape of a track returned by the iTunes-backed /api/music/search endpoint.
type SearchItem = {
  id: string | number;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  releaseDate?: string;
  duration?: string;
  isrc?: string;
  artwork?: string;
};

// Run the real engine, then keep only the checks a public lookup can honestly
// make. ISRC checks are kept only when the lookup actually returned an ISRC —
// otherwise we don't know it (the released song surely has one) and flagging it
// "missing" would be a false alarm.
function validate(t: TrackMeta): ValidationResult[] {
  const hasIsrc = !!t.isrc?.trim();
  return validateTrack(t).filter(
    (r) => PUBLIC_FIELDS.has(r.field) || (hasIsrc && r.field === "ISRC")
  );
}

function grade(results: ValidationResult[]) {
  const g = computeGrade(results);
  return { letter: g.letter, color: g.color, bg: g.bg };
}

// ─── Severity styling ──────────────────────────────────
const SEV_STYLE = {
  critical: { badge: "bg-red/15 text-[#fda4af] border-red/20", dotClass: "bg-rose-500" },
  warning: { badge: "bg-amber/15 text-[#fcd34d] border-amber/20", dotClass: "bg-amber-500" },
  suggestion: { badge: "bg-blue/15 text-[#93c5fd] border-blue/20", dotClass: "bg-blue-500" },
};

// ─── Grade display classes ───────────────────────────────
const GRADE_DISPLAY: Record<string, { text: string; bg: string }> = {
  A: { text: "text-green-500", bg: "bg-green-950/60" },
  B: { text: "text-lime-500", bg: "bg-lime-950/60" },
  C: { text: "text-yellow-500", bg: "bg-yellow-950/60" },
  D: { text: "text-orange-500", bg: "bg-orange-950/60" },
  F: { text: "text-rose-500", bg: "bg-rose-950/60" },
};

export function LiveDemo() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<TrackMeta | null>(null);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [aiFixes, setAiFixes] = useState<AiFix[]>([]);
  // The public demo is anonymous, so /api/ai/fix serves deterministic rule-based
  // fixes (source: "rules"). Surface that honestly + nudge to sign up for real AI.
  const [aiRanRules, setAiRanRules] = useState(false);
  const [lookupsUsed, setLookupsUsed] = useState(0);

  // Restore the visitor's lookup count so the limit survives reloads.
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem(LOOKUPS_KEY) || "0", 10);
      if (Number.isFinite(n) && n > 0) setLookupsUsed(n);
    } catch { /* localStorage unavailable — start fresh */ }
  }, []);

  const remaining = Math.max(0, DEMO_LOOKUP_LIMIT - lookupsUsed);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectTrack = (item: SearchItem) => {
    // Out of free lookups — the input is disabled and the gate is shown, but
    // guard here too so nothing slips through.
    if (remaining <= 0) {
      setSearchResults([]);
      setQuery("");
      return;
    }
    // Build the track from ONLY what the public lookup actually returned. We no
    // longer fabricate songwriters/producers/copyright/explicit/language — those
    // aren't knowable from a catalog lookup, and inventing blanks made the demo
    // falsely flag released songs as missing credits.
    const track: TrackMeta = {
      title: item.title,
      artist: item.artist,
      album: item.album,
      genre: item.genre || "",
      releaseDate: item.releaseDate?.split("T")[0] || "",
      duration: item.duration || "",
      isrc: item.isrc || "", // Often empty from iTunes — handled honestly in validate()
    };
    setCurrentTrack(track);
    setResults(validate(track));
    setSearchResults([]);
    setQuery("");
    setAiFixes([]);
    setAiRanRules(false);

    // Count this lookup toward the free limit (persisted across reloads).
    const next = lookupsUsed + 1;
    setLookupsUsed(next);
    try {
      localStorage.setItem(LOOKUPS_KEY, String(next));
    } catch { /* localStorage unavailable — limit is best-effort */ }

    // Hand the checked release off to /validate so signup continues, not restarts.
    try {
      localStorage.setItem("metacheck_pending_release", JSON.stringify({ track, ts: Date.now() }));
    } catch { /* localStorage unavailable — handoff is best-effort */ }
  };

  const runAiFix = async () => {
    if (!currentTrack || !results) return;
    setIsFixing(true);
    try {
      // Note: This calls our AI fix route.
      // We'll modify the route to allow demo mode bypass if needed,
      // or just assume the user is testing in a way that works.
      const res = await fetch("/api/ai/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: [currentTrack],
          results: results,
        }),
      });
      const data = await res.json();
      if (data.data?.fixes) {
        setAiFixes(data.data.fixes);
        setAiRanRules(data.data.source === "rules");
      } else if (data.error) {
        console.error("AI Fix error:", data.error);
        alert(data.error);
      }
    } catch (err) {
      console.error("AI Fix error:", err);
    } finally {
      setIsFixing(false);
    }
  };

  const applyFix = (fix: AiFix) => {
    if (!currentTrack) return;
    // fix.field may be a real TrackMeta key ("releaseDate") or a human label
    // ("Release Date") from a real model response. Resolve it so multi-word
    // fields actually apply instead of writing to a junk property.
    const fieldKey = resolveResultFieldKey(fix.field) ?? (fix.field as keyof TrackMeta);
    const updated = { ...currentTrack, [fieldKey]: fix.fixed };
    setCurrentTrack(updated);
    setResults(validate(updated));
    // Remove only the applied fix by identity — filtering on `field` would drop
    // every queued fix sharing that field if a future demo returns more than one.
    setAiFixes((prev) => prev.filter((f) => f !== fix));
  };

  const g = results ? grade(results) : null;
  const verdict = results ? preflightVerdict(results) : null;
  const criticals = results?.filter((r) => r.severity === "critical") ?? [];
  const warnings = results?.filter((r) => r.severity === "warning") ?? [];
  const suggestions = results?.filter((r) => r.severity === "suggestion") ?? [];

  return (
    <div className="rounded-2xl border border-border bg-bg-card overflow-hidden glow-teal">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-bg-elevated">
        <div className="flex gap-1.5 mr-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green/60" />
        </div>
        <span className="text-xs font-mono text-text-dim">metacheck — live engine</span>
      </div>

      {/* Search area */}
      <div className="px-5 pt-5 pb-3 relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={remaining <= 0}
            placeholder={
              remaining <= 0
                ? "Free demo checks used — sign up to keep checking"
                : "Search any song to audit its metadata (e.g. 'The Weeknd Blinding Lights')"
            }
            className="w-full px-4 py-4 bg-bg border border-border-bright rounded-xl text-base text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isSearching && (
            <div className="absolute right-4 top-3.5">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {remaining > 0 && (
          <p className="mt-2 text-[11px] text-text-dim">
            {remaining} free {remaining === 1 ? "check" : "checks"} left · audits public catalog metadata
          </p>
        )}

        {/* Dropdown results */}
        {searchResults.length > 0 && (
          <div className="pop-in absolute left-5 right-5 top-[calc(100%-8px)] z-20 bg-bg-card border border-border rounded-xl shadow-2xl max-h-[300px] overflow-y-auto overflow-x-hidden">
            {searchResults.map((item) => (
              <button
                key={item.id}
                onClick={() => selectTrack(item)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface text-left transition-colors border-b border-border last:border-0"
              >
                {item.artwork && (
                  // Small decorative thumbnail in demo data; next/image not warranted here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.artwork} alt="" className="w-10 h-10 rounded-md object-cover" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{item.title}</p>
                  <p className="text-xs text-text-muted truncate">{item.artist} • {item.album}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results area */}
      <div className="px-5 pb-5 min-h-[350px]">
        {!currentTrack ? (
          remaining <= 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center max-w-xs">
                <div className="w-14 h-14 rounded-full bg-accent/10 text-accent-bright flex items-center justify-center mx-auto mb-5">
                  <IconSparkles size={26} />
                </div>
                <p className="text-sm font-semibold text-text mb-1">You&apos;ve used your {DEMO_LOOKUP_LIMIT} free demo checks</p>
                <p className="text-xs text-text-muted mb-5 leading-relaxed">
                  Sign up free to keep checking — and to audit your own <span className="text-text">unreleased</span> release: songwriters, splits, copyright, explicit and more that a public lookup can&apos;t see.
                </p>
                <Link
                  href="/sign-up"
                  className="press glow-teal inline-flex items-center gap-1.5 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-bright transition-colors"
                >
                  Sign up free <IconArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-text-dim text-sm">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-accent/5 text-accent-bright/50 flex items-center justify-center mx-auto mb-6">
                  <IconSearch size={28} />
                </div>
                <p className="text-xs text-text-dim">Search for any track to run a metadata audit</p>
              </div>
            </div>
          )
        ) : (
          <div className="mt-3">
            {/* Grade header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-bold font-display ${GRADE_DISPLAY[g!.letter]?.bg ?? "bg-surface"} ${GRADE_DISPLAY[g!.letter]?.text ?? "text-text-muted"}`}
                >
                  {g!.letter}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text">
                      {g!.letter === "A" ? "Release ready!" : g!.letter === "B" ? "Almost there" : g!.letter === "C" ? "Needs work" : "Major issues found"}
                    </p>
                    {verdict && verdict.permanentCount > 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-red/10 text-red border-red/25">
                        {verdict.permanentCount} permanent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-dim nums">
                    {criticals.length} critical · {warnings.length} warnings · {suggestions.length} suggestions
                  </p>
                </div>
              </div>
              <button
                onClick={runAiFix}
                disabled={isFixing || results?.length === 0}
                className="press inline-flex items-center gap-1.5 px-4 py-2 bg-accent/10 border border-accent/20 text-accent-bright rounded-lg text-xs font-semibold hover:bg-accent/20 transition-all disabled:opacity-50"
              >
                <IconSparkles size={14} /> {isFixing ? "AI is fixing…" : "Fix with AI"}
              </button>
            </div>

            {/* AI Fixes highlight */}
            {aiFixes.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-bright">Suggested fixes</p>
                  {aiRanRules && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-text-dim">
                      <IconLock size={11} /> Sign up for AI-written fixes
                    </span>
                  )}
                </div>
                {aiFixes.map((fix, i) => (
                  <div key={i} className="p-3 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-text-muted mb-1">Fix <span className="font-bold text-text">{fix.field}</span>: <span className="line-through">{fix.original}</span></p>
                      <p className="text-sm font-medium text-accent-bright">→ {fix.fixed}</p>
                    </div>
                    <button
                      onClick={() => applyFix(fix)}
                      className="shrink-0 px-3 py-1.5 bg-accent text-white rounded-md text-[10px] font-bold hover:bg-accent-bright transition-colors"
                    >
                      APPLY
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Issues list */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {results?.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-green/10 text-green flex items-center justify-center mx-auto mb-3">
                    <IconCheck size={22} />
                  </div>
                  <p className="text-sm text-text-muted">No issues in the public metadata — this release is already live, so its catalog data is clean.</p>
                </div>
              ) : (
                [...criticals, ...warnings, ...suggestions].map((r, i) => {
                  const s = SEV_STYLE[r.severity];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-3 px-4 rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors"
                    >
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${s.badge}`}>
                            {r.field}
                          </span>
                        </div>
                        <p className="text-sm text-text leading-relaxed">{r.message}</p>
                        {r.suggestion && !aiFixes.some(f => resolveResultFieldKey(f.field) === resolveResultFieldKey(r.field)) && (
                          <p className="text-xs font-mono text-accent-bright mt-1.5 opacity-80">
                            → {r.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Honest scope note — what a public lookup can and can't see. */}
            <p className="mt-4 pt-3 border-t border-border text-[11px] text-text-dim leading-relaxed">
              This demo audits only the metadata a public catalog exposes (title, artist, genre, duration, release date, ISRC).
              Songwriters, splits, copyright, explicit and language live in your distributor file — check your own release to audit those before you submit.
            </p>

            {/* Conversion bridge — the "aha" just happened; carry the user into
                sign-up. The checked release is already stashed in localStorage
                (selectTrack), so /validate resumes it after auth. */}
            <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text font-medium">
                  {results?.length === 0
                    ? "Want to check your own unreleased tracks?"
                    : "Fix these on your own release in one click."}
                </p>
                <p className="text-xs text-text-dim mt-0.5">
                  Free account · we&apos;ll pick up right where you left off · no credit card.
                </p>
              </div>
              <Link
                href="/sign-up"
                className="press glow-teal shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
              >
                Check my release free <IconArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
