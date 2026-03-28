"use client";

import { useState, useCallback } from "react";

// ─── Validation engine ─────────────────────────────────
const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/;

type Result = {
  rule: string;
  field: string;
  severity: "critical" | "warning" | "suggestion";
  message: string;
  suggestion?: string;
  fixable: boolean;
};

type Track = Record<string, string>;

function validate(t: Track): Result[] {
  const r: Result[] = [];
  const add = (
    rule: string, field: string, severity: Result["severity"],
    message: string, suggestion?: string, fixable = false
  ) => r.push({ rule, field, severity, message, suggestion, fixable });

  if (!t.isrc) add("isrc_missing", "ISRC", "critical", "Missing ISRC — royalty tracking will fail across all platforms.", "Get one from your distributor or usisrc.org");
  else if (!ISRC_RE.test(t.isrc.replace(/-/g, "").toUpperCase())) add("isrc_format", "ISRC", "critical", `"${t.isrc}" is not a valid ISRC. Format: CC-XXX-YY-NNNNN.`);

  if (!t.title?.trim()) add("title_empty", "Title", "critical", "Track title is empty.");
  else {
    if (t.title === t.title.toUpperCase() && t.title.length > 3) {
      const fixed = t.title.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      add("title_caps", "Title", "warning", "ALL CAPS title — most DSPs prefer title case.", fixed, true);
    }
    if (/\bft\.?\s/i.test(t.title) && !/\(feat\.\s/.test(t.title))
      add("title_feat", "Title", "warning", 'Featured artist should use "(feat. Name)" format — "ft." is commonly rejected.');
    if (t.title !== t.title.trim()) add("title_ws", "Title", "warning", "Trailing whitespace detected.", t.title.trim(), true);
  }

  if (!t.artist?.trim()) add("artist_empty", "Artist", "critical", "Primary artist name is empty.");
  if (!t.songwriters?.trim()) add("no_writers", "Songwriters", "critical", "No songwriters listed — blocks publishing royalties via PROs and the MLC.");
  if (!t.producers?.trim()) add("no_producer", "Producers", "warning", "No producer credited — affects master royalties and SoundExchange payments.");

  if (!t.copyright?.trim()) {
    const fix = `℗ ${new Date().getFullYear()} ${t.artist || "Your Name"}`;
    add("no_copyright", "Copyright", "warning", "Copyright line (℗) is missing — required for proper rights ID.", fix, true);
  }

  if (!t.genre) add("no_genre", "Genre", "warning", "Genre missing — hurts playlist discoverability.");
  if (!t.explicit) add("no_explicit", "Explicit", "warning", "Explicit content flag not set — required by all major DSPs.");
  if (!t.language?.trim()) add("no_lang", "Language", "suggestion", "Language not specified — defaults to English but should be explicit.", "en", true);
  if (!t.label?.trim()) add("no_label", "Label", "suggestion", "Label name missing — self-released artists should use their name.", t.artist || undefined, !!t.artist);
  if (t.releaseDate && new Date(t.releaseDate) < new Date()) add("date_past", "Release Date", "suggestion", "Release date is in the past — Spotify editorial needs 7+ days lead time.");

  return r;
}

function grade(results: Result[]) {
  const c = results.filter((r) => r.severity === "critical").length;
  const w = results.filter((r) => r.severity === "warning").length;
  if (c === 0 && w === 0) return { letter: "A", color: "#22c55e", bg: "#052e16" };
  if (c === 0 && w <= 2) return { letter: "B", color: "#84cc16", bg: "#1a2e05" };
  if (c <= 1) return { letter: "C", color: "#eab308", bg: "#2e2505" };
  if (c <= 3) return { letter: "D", color: "#f97316", bg: "#2e1a05" };
  return { letter: "F", color: "#f43f5e", bg: "#2e050d" };
}

// ─── Sample tracks with intentional errors ─────────────
const SAMPLES: { label: string; track: Track }[] = [
  {
    label: "Broken metadata",
    track: {
      title: "MIDNIGHT DRIVE ft. Luna",
      artist: "DJ Horizon",
      isrc: "USS1Z2400001",
      genre: "",
      releaseDate: "2026-01-15",
      songwriters: "",
      producers: "DJ Horizon",
      copyright: "",
      explicit: "",
      language: "",
      label: "",
    },
  },
  {
    label: "Almost clean",
    track: {
      title: "Velvet Rain (feat. Ada Cole)",
      artist: "Neon Waves",
      isrc: "US-S1Z-26-00042",
      genre: "Electronic",
      releaseDate: "2026-05-01",
      songwriters: "Neon Waves, Ada Cole",
      producers: "Neon Waves",
      copyright: "",
      explicit: "false",
      language: "",
      label: "",
    },
  },
  {
    label: "Total disaster",
    track: {
      title: "  UNTITLED TRACK 4  ",
      artist: "",
      isrc: "abc123",
      genre: "Vibes",
      releaseDate: "2024-06-01",
      songwriters: "",
      producers: "",
      copyright: "",
      explicit: "",
      language: "",
      label: "",
    },
  },
];

// ─── Severity styling ──────────────────────────────────
const SEV_STYLE = {
  critical: { badge: "bg-red/15 text-[#fda4af] border-red/20", dot: "#f43f5e" },
  warning: { badge: "bg-amber/15 text-[#fcd34d] border-amber/20", dot: "#f59e0b" },
  suggestion: { badge: "bg-blue/15 text-[#93c5fd] border-blue/20", dot: "#3b82f6" },
};

// ─── Component ─────────────────────────────────────────
export function LiveDemo() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [activeSample, setActiveSample] = useState<number | null>(null);

  const runSample = useCallback((idx: number) => {
    setActiveSample(idx);
    setResults(validate(SAMPLES[idx].track));
  }, []);

  const g = results ? grade(results) : null;
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
        <span className="text-xs font-mono text-text-dim">metacheck — validation engine</span>
      </div>

      {/* Sample selectors */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-xs font-mono text-text-dim mb-3">Try a sample track:</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              onClick={() => runSample(i)}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-medium border transition-all ${
                activeSample === i
                  ? "border-accent bg-accent/10 text-accent-bright"
                  : "border-border-bright text-text-muted hover:border-text-dim hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results area */}
      <div className="px-5 pb-5 min-h-[300px]">
        {results === null ? (
          <div className="flex items-center justify-center h-[260px] text-text-dim text-sm">
            <div className="text-center">
              <p className="text-3xl mb-3 opacity-30">↑</p>
              <p className="font-mono text-xs">Select a sample to see the validator in action</p>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            {/* Grade header */}
            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-bold font-display"
                style={{ background: g!.bg, color: g!.color }}
              >
                {g!.letter}
              </div>
              <div>
                <p className="font-semibold text-text">
                  {g!.letter === "A" ? "Release ready!" : g!.letter === "B" ? "Almost there" : g!.letter === "C" ? "Needs work" : "Major issues found"}
                </p>
                <p className="text-xs font-mono text-text-dim">
                  {criticals.length} critical · {warnings.length} warnings · {suggestions.length} suggestions
                </p>
              </div>
            </div>

            {/* Issues list */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--color-border-bright) transparent" }}>
              {[...criticals, ...warnings, ...suggestions].map((r, i) => {
                const s = SEV_STYLE[r.severity];
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-3 px-4 rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors"
                  >
                    <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${s.badge}`}>
                          {r.field}
                        </span>
                      </div>
                      <p className="text-sm text-text leading-relaxed">{r.message}</p>
                      {r.suggestion && (
                        <p className="text-xs font-mono text-accent-bright mt-1.5 opacity-80">
                          → {r.suggestion}
                        </p>
                      )}
                    </div>
                    {r.fixable && (
                      <span className="shrink-0 text-[10px] font-mono font-semibold text-accent-bright bg-accent/10 px-2 py-1 rounded-md border border-accent/20">
                        Auto-fix
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
