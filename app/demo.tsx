"use client";

import { useState, useCallback } from "react";
import { validateTrack, getGrade as computeGrade } from "@/lib/validation/rules";
import type { TrackMeta, ValidationResult } from "@/lib/validation/types";

function validate(t: Record<string, string>): ValidationResult[] {
  return validateTrack(t as unknown as TrackMeta);
}

function grade(results: ValidationResult[]) {
  const g = computeGrade(results);
  return { letter: g.letter, color: g.color, bg: g.bg };
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
                className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-bold font-display ${GRADE_DISPLAY[g!.letter]?.bg ?? "bg-surface"} ${GRADE_DISPLAY[g!.letter]?.text ?? "text-text-muted"}`}
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
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {[...criticals, ...warnings, ...suggestions].map((r, i) => {
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
