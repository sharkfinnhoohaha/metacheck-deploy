"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Papa from "papaparse";
import type { TrackMeta, ValidationResult, ArtworkCheckResult } from "@/lib/validation/types";
import { validateRelease, getGrade } from "@/lib/validation/rules";
import { PROFILES, getProfile } from "@/lib/validation/profiles";
import { checkArtworkFile, scanArtworkText } from "@/lib/validation/artwork";
import { checkSyncReadiness, CATEGORY_LABEL, type SyncCategory } from "@/lib/validation/sync";
import { resolveResultFieldKey } from "@/lib/validation/fieldKeys";
import { classifyPermanence, preflightVerdict, type PermanenceLevel } from "@/lib/validation/permanence";
import { diffMigration } from "@/lib/validation/migration";
import { checkAudioFile, type AudioReport } from "@/lib/audio/check";
import { exportCsv } from "@/lib/export/csv";
import { IconCheck, IconClapper, IconArrowRight, IconUpload, IconChevronDown, IconBolt, IconSparkles, IconFingerprint } from "@/app/_components/icons";

// ── CSV column auto-mapping ───────────────────────────────────────────────────
const CSV_MAP: Record<string, keyof TrackMeta> = {
  "track title": "title", "song name": "title", "title": "title",
  "track number": "trackNumber", "track #": "trackNumber", "#": "trackNumber",
  "artist": "artist", "primary artist": "artist", "artist name": "artist",
  "featured artists": "featuredArtists", "featuring": "featuredArtists",
  "album": "album", "release title": "album",
  "isrc": "isrc", "isrc code": "isrc",
  "upc": "upc", "upc/ean": "upc", "barcode": "upc",
  "genre": "genre", "primary genre": "genre",
  "release date": "releaseDate", "street date": "releaseDate",
  "songwriter(s)": "songwriters", "writers": "songwriters", "songwriters": "songwriters",
  "splits": "splits", "writer splits": "splits", "publishing splits": "splits",
  "iswc": "iswc", "iswc code": "iswc",
  "producer(s)": "producers", "producers": "producers",
  "composers": "composers", "composer(s)": "composers",
  "copyright": "copyright", "℗ line": "copyright", "p line": "copyright",
  "explicit": "explicit", "explicit content": "explicit",
  "language": "language", "audio language": "language",
  "label": "label", "label name": "label", "record label": "label",
  "duration": "duration", "length": "duration",
};

function mapCsvRow(row: Record<string, string>): TrackMeta {
  const track: Partial<TrackMeta> = { title: "", artist: "" };
  for (const [col, val] of Object.entries(row)) {
    const key = CSV_MAP[col.toLowerCase().trim()];
    if (key) (track as Record<string, string>)[key] = val;
  }
  return track as TrackMeta;
}

// ── Empty track factory ───────────────────────────────────────────────────────
function emptyTrack(trackNumber?: number): TrackMeta {
  return {
    trackNumber: trackNumber?.toString() ?? "",
    title: "", artist: "", featuredArtists: "", album: "",
    isrc: "", upc: "", genre: "", releaseDate: "", label: "",
    songwriters: "", splits: "", iswc: "", producers: "", composers: "", copyright: "",
    explicit: "", language: "", duration: "", aiDisclosure: "",
    bpm: "", musicalKey: "", moodTags: "", instrumentalAvailable: "",
    cleanVersionAvailable: "", stemsAvailable: "", oneStopClearance: "", licensingContact: "",
  };
}

// A realistic release with planted issues so a brand-new user sees the engine
// catch real problems (and offer one-click fixes) without typing anything.
function sampleTrack(): TrackMeta {
  return {
    ...emptyTrack(1),
    title: "midnight drive",            // all-lowercase → fixable title-case
    artist: "Jane Doe",
    album: "Neon Nights",
    isrc: "",                            // missing → critical (generic profile)
    genre: "Music",                     // too generic → suggestion
    releaseDate: "",                    // missing → editorial-window warning
    songwriters: "Jane Doe, Mike",      // "Mike" single token → legal-name nudge
    splits: "Jane Doe 60%, Mike 30%",   // totals 90% → critical
    producers: "",                      // missing → warning
    copyright: "",                      // missing → fixable warning
    explicit: "",                       // unset → warning
    duration: "3:45",
  };
}

// ── Field configs for the form ────────────────────────────────────────────────
const FIELDS: { key: keyof TrackMeta; label: string; placeholder?: string; required?: boolean }[] = [
  { key: "trackNumber", label: "Track #", placeholder: "1" },
  { key: "title", label: "Title", placeholder: "Song Title", required: true },
  { key: "artist", label: "Artist", placeholder: "Artist Name", required: true },
  { key: "featuredArtists", label: "Featured Artists", placeholder: "feat. Name (leave blank if none)" },
  { key: "album", label: "Album / EP Title", placeholder: "Release Title" },
  { key: "isrc", label: "ISRC", placeholder: "US-XXX-26-00001" },
  { key: "upc", label: "UPC / Barcode", placeholder: "123456789012" },
  { key: "genre", label: "Genre", placeholder: "Pop" },
  { key: "releaseDate", label: "Release Date", placeholder: "YYYY-MM-DD" },
  { key: "label", label: "Label", placeholder: "Label Name or Artist Name" },
  { key: "songwriters", label: "Songwriters", placeholder: "Writer One, Writer Two" },
  { key: "splits", label: "Writer Splits", placeholder: "Writer One 50%, Writer Two 50%" },
  { key: "iswc", label: "ISWC", placeholder: "T-123.456.789-0" },
  { key: "producers", label: "Producers", placeholder: "Producer Name" },
  { key: "composers", label: "Composers", placeholder: "Composer Name" },
  { key: "copyright", label: "Copyright (℗)", placeholder: `℗ ${new Date().getFullYear()} Artist Name` },
  { key: "explicit", label: "Explicit", placeholder: "true / false / clean" },
  { key: "language", label: "Language", placeholder: "en" },
  { key: "duration", label: "Duration", placeholder: "3:45" },
  { key: "aiDisclosure", label: "AI Disclosure", placeholder: "none / ai-assisted / ai-vocals / fully-ai" },
];

// The engine→TrackMeta field map lives in lib/validation/fieldKeys.ts so the
// public demo shares the exact same source of truth. Here we extend it with a
// fallback that also matches against the form labels.
function resolveFieldKey(field: string): keyof TrackMeta | undefined {
  return (
    resolveResultFieldKey(field) ??
    FIELDS.find((f) => f.label.toLowerCase() === field.toLowerCase())?.key
  );
}

// ── Severity styles ───────────────────────────────────────────────────────────
// Calm, token-based treatment: a single coloured dot + muted label, no saturated
// "badge soup". Borders carry only a whisper of the severity hue.
const SEV: Record<string, { dot: string; label: string; border: string }> = {
  critical: { dot: "bg-red", label: "text-red", border: "border-red/15" },
  warning: { dot: "bg-amber", label: "text-amber", border: "border-amber/15" },
  suggestion: { dot: "bg-blue", label: "text-blue", border: "border-blue/15" },
};

// ── Grade display classes ─────────────────────────────────────────────
const GRADE_DISPLAY: Record<string, { text: string; bg: string }> = {
  A: { text: "text-green-500", bg: "bg-green-950/60" },
  B: { text: "text-lime-500", bg: "bg-lime-950/60" },
  C: { text: "text-yellow-500", bg: "bg-yellow-950/60" },
  D: { text: "text-orange-500", bg: "bg-orange-950/60" },
  F: { text: "text-rose-500", bg: "bg-rose-950/60" },
};

// ── TrackForm component ───────────────────────────────────────────────────────
function TrackForm({
  track, idx, onChange, onRemove, showRemove,
}: {
  track: TrackMeta; idx: number;
  onChange: (idx: number, key: keyof TrackMeta, val: string) => void;
  onRemove?: (idx: number) => void;
  showRemove: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-muted">Track {idx + 1}</h3>
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove?.(idx)}
            className="text-xs text-red/70 hover:text-red transition-colors"
          >
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === "songwriters" || f.key === "producers" || f.key === "splits" ? "sm:col-span-2" : ""}>
            <label className="block text-xs text-text-dim mb-1.5">
              {f.label}{f.required && <span className="text-red/70 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={(track[f.key] as string) ?? ""}
              onChange={(e) => onChange(idx, f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Permanence chips (the "it's forever" framing) ─────────────────────────────
const PERMANENCE_CHIP: Record<PermanenceLevel, { label: string; cls: string }> = {
  permanent: { label: "Permanent", cls: "bg-red/10 text-red border-red/25" },
  recoverable: { label: "Editable later", cls: "bg-amber/10 text-amber border-amber/25" },
  advisory: { label: "Optional", cls: "bg-blue/10 text-blue border-blue/25" },
};

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({
  result, onApplyFix, showPermanence = true,
}: {
  result: ValidationResult & { _fixed?: boolean };
  onApplyFix?: (result: ValidationResult) => void;
  showPermanence?: boolean;
}) {
  const s = SEV[result.severity];
  const perm = classifyPermanence(result);
  const chip = PERMANENCE_CHIP[perm.level];
  const blocking = result.severity === "critical" || result.severity === "warning";
  return (
    <div className={`rounded-xl border p-4 ${s.border} bg-bg-elevated`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium capitalize ${s.label}`}>{result.severity}</span>
              <span className="text-xs text-text-dim">·</span>
              <span className="text-xs text-text-muted">{result.field}</span>
              {result.trackIndex !== undefined && (
                <span className="text-xs text-text-dim">track {result.trackIndex + 1}</span>
              )}
              {showPermanence && !result._fixed && (
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip.cls}`}>{chip.label}</span>
              )}
            </div>
            <p className="text-sm text-text leading-relaxed">{result.message}</p>
            {result.suggestion && (
              <p className="text-xs text-text-muted mt-1.5 font-mono">
                <span className="text-accent-bright">→</span> {result.suggestion}
              </p>
            )}
            {showPermanence && perm.level === "permanent" && blocking && !result._fixed && (
              <p className="text-xs text-red/80 mt-2 leading-relaxed border-l-2 border-red/25 pl-2.5">{perm.costToUndo}</p>
            )}
          </div>
        </div>
        {onApplyFix && result.fixable && !result._fixed && (
          <button
            onClick={() => onApplyFix(result)}
            className="press shrink-0 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 hover:bg-accent/20 transition-colors"
          >
            Apply fix
          </button>
        )}
        {result._fixed && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green/10 text-green border border-green/20">
            <IconCheck size={13} /> Fixed
          </span>
        )}
      </div>
    </div>
  );
}

// ── Artwork result row ────────────────────────────────────────────────────────
const ARTWORK_SEV: Record<string, { dot: string; text: string }> = {
  critical: { dot: "bg-rose-500", text: "text-[#fda4af]" },
  warning: { dot: "bg-amber-500", text: "text-[#fcd34d]" },
  suggestion: { dot: "bg-blue-500", text: "text-[#93c5fd]" },
  success: { dot: "bg-green-500", text: "text-green-400" },
};

function ArtworkRow({ a }: { a: ArtworkCheckResult }) {
  const s = ARTWORK_SEV[a.severity] ?? ARTWORK_SEV.suggestion;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface/50 px-4 py-3">
      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
      <p className={`text-sm leading-relaxed ${a.severity === "success" ? s.text : "text-text"}`}>{a.message}</p>
    </div>
  );
}

// ── Upgrade prompt (shown when the free AI taste is spent) ─────────────────────
function UpgradeCard({ context }: { context: string }) {
  return (
    <div className="gradient-border rounded-xl bg-accent/5 p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent-bright flex items-center justify-center shrink-0">
          <IconSparkles size={18} />
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-text mb-1">You&apos;ve used your free AI {context} this month</h4>
          <p className="text-sm text-text-muted mb-4">
            Upgrade to Pro for unlimited AI fixes &amp; briefs, release history, PDF reports and distributor
            profiles — $9/mo. A single missed ISRC costs more than a year of Pro.
          </p>
          <a
            href="/api/checkout?tier=pro"
            className="press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
          >
            Upgrade to Pro <IconArrowRight size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Sync-Ready panel ──────────────────────────────────────────────────────────
const SYNC_TOGGLES: { key: keyof TrackMeta; label: string }[] = [
  { key: "instrumentalAvailable", label: "Instrumental" },
  { key: "cleanVersionAvailable", label: "Clean version" },
  { key: "stemsAvailable", label: "Stems" },
  { key: "oneStopClearance", label: "One-stop clearance" },
];

function isYesVal(v?: string) {
  const s = (v || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "available";
}

function SyncPanel({
  track, onChange,
}: {
  track: TrackMeta;
  onChange: (key: keyof TrackMeta, val: string) => void;
}) {
  const r = checkSyncReadiness(track);
  const tone =
    r.score >= 80 ? { text: "text-green-400", ring: "var(--color-green)", chip: "bg-green/10 text-green border-green/20" }
    : r.score >= 50 ? { text: "text-amber-400", ring: "var(--color-amber)", chip: "bg-amber/10 text-amber border-amber/20" }
    : { text: "text-rose-400", ring: "var(--color-red)", chip: "bg-red/10 text-red border-red/20" };
  const cats: SyncCategory[] = ["clearable", "usable", "discoverable"];
  const unmet = r.checks.filter((c) => !c.earned);

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div
          className="relative w-28 h-28 rounded-full shrink-0 grid place-items-center"
          style={{ background: `conic-gradient(${tone.ring} ${r.score * 3.6}deg, var(--color-surface) 0deg)` }}
        >
          <div className="absolute inset-[6px] rounded-full bg-bg-card grid place-items-center">
            <span className={`font-display text-4xl ${tone.text}`}>{r.score}</span>
          </div>
        </div>
        <div className="text-center sm:text-left">
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${tone.chip} mb-2`}>{r.tier}</span>
          <p className="text-sm text-text-muted max-w-sm leading-relaxed">
            How licensable this track is for film, TV, ads &amp; games — scored on how easily a supervisor can
            <span className="text-text"> clear</span>, <span className="text-text">use</span>, and <span className="text-text">find</span> it.
          </p>
        </div>
      </div>

      {/* Category bars */}
      <div className="grid sm:grid-cols-3 gap-3">
        {cats.map((c) => {
          const b = r.breakdown[c];
          const pct = b.possible ? Math.round((b.earned / b.possible) * 100) : 0;
          return (
            <div key={c} className="rounded-xl border border-border bg-surface/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text">{CATEGORY_LABEL[c]}</span>
                <span className="text-xs text-text-dim">{b.earned}/{b.possible}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                {/* eslint-disable-next-line react/forbid-dom-props */}
                <div className="h-full rounded-full bg-accent-bright transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-border bg-surface/30 p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: "bpm" as const, label: "BPM", ph: "120" },
            { key: "musicalKey" as const, label: "Key", ph: "A minor" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-text-dim mb-1.5">{f.label}</label>
              <input
                value={(track[f.key] as string) ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.ph}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs text-text-dim mb-1.5">Licensing contact</label>
            <input
              value={track.licensingContact ?? ""}
              onChange={(e) => onChange("licensingContact", e.target.value)}
              placeholder="sync@yourlabel.com"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1.5">Mood / scene tags</label>
          <input
            value={track.moodTags ?? ""}
            onChange={(e) => onChange("moodTags", e.target.value)}
            placeholder="uplifting, cinematic, hopeful, driving"
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SYNC_TOGGLES.map((t) => {
            const on = isYesVal(track[t.key] as string);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key, on ? "" : "true")}
                className={`press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  on ? "bg-accent/15 text-accent-bright border-accent/30" : "bg-bg border-border text-text-muted hover:text-text"
                }`}
              >
                {on && <IconCheck size={14} />}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* What's missing */}
      {unmet.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">To raise the score</p>
          {unmet.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-bg-elevated px-4 py-3">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                c.severity === "critical" ? "bg-rose-500" : c.severity === "warning" ? "bg-amber-500" : "bg-blue-500"
              }`} />
              <p className="text-sm text-text leading-relaxed">{c.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Audio pre-flight panel (the moat: reads the actual waveform) ──────────────
function fmtSignedDb(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}

function AudioPanel({
  report, checking, error, name, track, onUpload, onUseDetected,
}: {
  report: AudioReport | null;
  checking: boolean;
  error: string | null;
  name: string | null;
  track: TrackMeta;
  onUpload: () => void;
  onUseDetected: (key: keyof TrackMeta, val: string) => void;
}) {
  const tk = report?.analysis.tempoKey;
  const showBpm = !!(tk?.bpm && tk.bpmConfidence >= 0.6 && !(track.bpm || "").trim());
  const showKey = !!(tk?.key && tk.keyConfidence >= 0.55 && !(track.musicalKey || "").trim());

  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center shrink-0"><IconBolt size={16} /></span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-text">Audio pre-flight</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-bright border border-accent/20">New</span>
            </div>
            <p className="text-xs text-text-dim mt-0.5">Drop your master — loudness, true-peak &amp; clipping, checked in your browser. The file never leaves your device.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onUpload}
          className="press shrink-0 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors"
        >
          {name ? "Change file" : "Upload master"}
        </button>
      </div>

      {name && <p className="text-xs font-mono text-text-dim mb-3 truncate">{name}</p>}
      {checking && <p className="text-sm text-text-muted">Decoding &amp; measuring loudness… (a few seconds for a full track)</p>}
      {error && <p className="text-sm text-red">{error}</p>}

      {report && (
        <div className="space-y-4">
          {/* Headline stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Loudness", value: `${report.analysis.loudness.integratedLufs}`, unit: "LUFS" },
              { label: "True peak", value: fmtSignedDb(report.analysis.loudness.truePeakDbtp), unit: "dBTP" },
              { label: "Range", value: `${report.analysis.loudness.loudnessRangeLu}`, unit: "LU" },
              { label: "Sample rate", value: `${(report.analysis.sampleRate / 1000).toFixed(1)}`, unit: "kHz" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-surface/40 px-3 py-2.5">
                <p className="text-[11px] text-text-dim">{s.label}</p>
                <p className="text-lg text-text font-display tracking-tight leading-tight nums">
                  {s.value}<span className="text-xs text-text-dim ml-1">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Verdict rows (reuse the artwork row treatment — same shape) */}
          <div className="space-y-2">
            {report.results.map((a, i) => (
              <ArtworkRow key={i} a={a} />
            ))}
          </div>

          {/* Per-DSP normalization matrix */}
          <div className="rounded-lg border border-border bg-surface/30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="eyebrow">What each platform does to your loudness</p>
            </div>
            <div className="divide-y divide-border">
              {report.matrix.map((row) => (
                <div key={row.dsp} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-text">{row.dsp}</span>
                  <span className={`text-xs nums ${row.gainDb <= -1 ? "text-amber" : row.gainDb >= 1 ? "text-blue" : "text-green-400"}`}>{row.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detected BPM / key → offer to fill the Sync-Ready fields */}
          {(showBpm || showKey) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-dim">Detected (estimate):</span>
              {showBpm && (
                <button
                  type="button"
                  onClick={() => onUseDetected("bpm", String(tk!.bpm))}
                  className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  Use {tk!.bpm} BPM
                </button>
              )}
              {showKey && (
                <button
                  type="button"
                  onClick={() => onUseDetected("musicalKey", tk!.key!)}
                  className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  Use key {tk!.key}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Migration Pre-Flight panel (switching distributors / re-uploading) ────────
const MIG_SEV: Record<string, string> = {
  critical: "bg-red", warning: "bg-amber", suggestion: "bg-text-dim", success: "bg-green-500",
};

type OldRelease = { isrc: string; upc: string; title: string; artist: string; duration: string };

function MigrationPanel({ newTrack }: { newTrack: TrackMeta }) {
  const [old, setOld] = useState<OldRelease>({ isrc: "", upc: "", title: "", artist: "", duration: "" });
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<{ title: string; artist: string; album: string; duration: string }[]>([]);

  const report = diffMigration(old, {
    isrc: newTrack.isrc, upc: newTrack.upc, title: newTrack.title, artist: newTrack.artist, duration: newTrack.duration,
  });

  const runSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setHits((json.results ?? []).slice(0, 5));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = (h: { title: string; artist: string; duration: string }) => {
    // Autofill the old DISPLAY fields (the stores don't expose ISRC/UPC, so those
    // stay manual). Duration comes back in seconds from the proxy.
    setOld((o) => ({ ...o, title: h.title, artist: h.artist, duration: h.duration }));
    setHits([]);
    setQ("");
  };

  const setField = (k: keyof OldRelease, v: string) => setOld((o) => ({ ...o, [k]: v }));

  return (
    <div className="mt-5 pt-5 border-t border-border space-y-5">
      {/* Verdict */}
      <div className={`rounded-xl border p-4 ${
        report.safe ? "border-green/30 bg-green-950/20"
          : report.fields.some((f) => f.severity === "critical") ? "border-red/30 bg-rose-950/20"
          : report.hasOldData && report.blocking > 0 ? "border-amber/30 bg-amber-950/15"
          : "border-border bg-surface/30"
      }`}>
        <h4 className="font-display text-lg text-text tracking-tight leading-tight">{report.headline}</h4>
        <p className="text-sm text-text-muted mt-1 leading-relaxed">{report.subline}</p>
      </div>

      {/* Old release inputs + search autofill */}
      <div className="rounded-xl border border-border bg-surface/30 p-4 space-y-3">
        <p className="eyebrow">Your existing (live) release</p>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search the stores to autofill title/artist/duration…"
            className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors"
          />
          <button type="button" onClick={runSearch} disabled={searching} className="press shrink-0 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors disabled:opacity-50">
            {searching ? "…" : "Search"}
          </button>
        </div>
        {hits.length > 0 && (
          <div className="space-y-1">
            {hits.map((h, i) => (
              <button key={i} type="button" onClick={() => pick(h)} className="w-full text-left px-3 py-2 rounded-lg border border-border bg-bg hover:border-accent/50 transition-colors">
                <span className="text-sm text-text">{h.title}</span>
                <span className="text-xs text-text-dim"> · {h.artist} · {h.album}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {([
            { k: "isrc", label: "Old ISRC", ph: "from your old distributor" },
            { k: "upc", label: "Old UPC", ph: "from your old distributor" },
            { k: "title", label: "Old title", ph: "exact title" },
            { k: "artist", label: "Old artist", ph: "exact artist" },
            { k: "duration", label: "Old duration", ph: "3:45" },
          ] as { k: keyof OldRelease; label: string; ph: string }[]).map((f) => (
            <div key={f.k} className={f.k === "duration" ? "col-span-2 sm:col-span-1" : ""}>
              <label className="block text-xs text-text-dim mb-1">{f.label}</label>
              <input
                value={old[f.k]}
                onChange={(e) => setField(f.k, e.target.value)}
                placeholder={f.ph}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-dim">The stores don&apos;t expose ISRC/UPC — paste those from your old distributor&apos;s dashboard. Title/artist/duration can be auto-filled by search.</p>
      </div>

      {/* Field diff */}
      {report.hasOldData && (
        <div className="space-y-2">
          <p className="eyebrow">Old vs. new upload</p>
          {report.fields.map((f) => (
            <div key={f.key} className="rounded-lg border border-border bg-bg-elevated px-4 py-3">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${MIG_SEV[f.severity]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-text-muted">{f.label}</span>
                    {f.oldValue && <span className="text-xs font-mono text-text-dim">old: <span className="text-text-muted">{f.oldValue}</span></span>}
                    {f.newValue && <span className="text-xs font-mono text-text-dim">new: <span className="text-text-muted">{f.newValue}</span></span>}
                  </div>
                  <p className="text-sm text-text leading-relaxed mt-1">{f.note}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Takedown order */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <p className="eyebrow mb-2">The safe order — getting this backwards is what loses streams</p>
        <ol className="space-y-1.5">
          {report.takedownSteps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-text-muted leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent-bright text-xs flex items-center justify-center mt-0.5">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Mode = "single" | "multi" | "csv" | "batch";

type BriefData = {
  verdict: string;
  headline?: string;
  summary?: string;
  exposure?: { issue: string; cost: string }[];
  fixOrder?: string[];
};

// A validated release within a batch/catalog upload.
type BatchRelease = {
  title: string;
  tracks: TrackMeta[];
  results: ValidationResult[];
  grade: ReturnType<typeof getGrade>;
};

// Rights/credit fields whose issues can block or misroute royalties (vs. purely
// cosmetic formatting). Used to surface a catalog-wide "royalty risk" count.
const ROYALTY_RISK_FIELDS = new Set(
  ["isrc", "upc", "songwriters", "producers", "composers", "splits", "iswc", "copyright"]
);

const GRADE_POINTS: Record<string, number> = { A: 100, B: 86, C: 72, D: 58, F: 38 };

export type CatalogHealth = {
  score: number;          // 0–100, average of per-release grade points
  releases: number;
  tracks: number;
  cleanReleases: number;  // grade A/B, no criticals
  atRisk: number;         // grade D/F or any critical
  royaltyRisk: number;    // releases with an unresolved rights/credit issue
  criticals: number;
};

// Portfolio-level rollup for batch/catalog mode — the "Catalog Health Score".
function computeCatalogHealth(batch: BatchRelease[]): CatalogHealth {
  const releases = batch.length || 1;
  const score = Math.round(
    batch.reduce((sum, b) => sum + (GRADE_POINTS[b.grade.letter] ?? 60), 0) / releases
  );
  const hasCritical = (b: BatchRelease) => b.results.some((r) => r.severity === "critical");
  return {
    score,
    releases: batch.length,
    tracks: batch.reduce((n, b) => n + b.tracks.length, 0),
    cleanReleases: batch.filter((b) => (b.grade.letter === "A" || b.grade.letter === "B") && !hasCritical(b)).length,
    atRisk: batch.filter((b) => b.grade.letter === "D" || b.grade.letter === "F" || hasCritical(b)).length,
    royaltyRisk: batch.filter((b) =>
      b.results.some((r) => r.severity !== "suggestion" && ROYALTY_RISK_FIELDS.has(r.field.toLowerCase()))
    ).length,
    criticals: batch.reduce((n, b) => n + b.results.filter((r) => r.severity === "critical").length, 0),
  };
}

// Group flat CSV rows into releases by album (falling back to UPC, then a single
// bucket) so a label can QC a whole catalog from one spreadsheet.
function groupReleases(tracks: TrackMeta[]): Record<string, TrackMeta[]> {
  const groups: Record<string, TrackMeta[]> = {};
  tracks.forEach((t) => {
    const key = t.album?.trim() || t.upc?.trim() || "Untitled Release";
    (groups[key] ||= []).push(t);
  });
  return groups;
}

// Group a flat catalog into releases and validate each against the given
// profile. Shared by the CSV parse and the profile-switcher so changing the
// distributor re-grades the catalog in place instead of forcing a re-upload.
function buildBatch(flatTracks: TrackMeta[], profile: ReturnType<typeof getProfile>): BatchRelease[] {
  return Object.entries(groupReleases(flatTracks)).map(([title, grp]) => {
    const grpTracks = grp.map((t, i) => ({ ...t, trackNumber: t.trackNumber || String(i + 1) }));
    const res = validateRelease(grpTracks, profile);
    return { title, tracks: grpTracks, results: res, grade: getGrade(res) };
  });
}

export default function ValidatePage() {
  const [mode, setMode] = useState<Mode>("single");
  const [profileId, setProfileId] = useState<string>("generic");
  const [tracks, setTracks] = useState<TrackMeta[]>([emptyTrack(1)]);
  const [results, setResults] = useState<(ValidationResult & { _fixed?: boolean })[] | null>(null);
  const [fixedTracks, setFixedTracks] = useState<TrackMeta[]>([]);
  const [batch, setBatch] = useState<BatchRelease[] | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<Set<number>>(new Set());
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFixes, setAiFixes] = useState<import("@/lib/validation/types").AiFix[] | null>(null);
  const [aiImpact, setAiImpact] = useState<string | null>(null);
  const [aiUpgrade, setAiUpgrade] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefUpgrade, setBriefUpgrade] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Artwork QC
  const [artworkName, setArtworkName] = useState<string | null>(null);
  const [artworkResults, setArtworkResults] = useState<ArtworkCheckResult[] | null>(null);
  const [artworkChecking, setArtworkChecking] = useState(false);
  const [artworkTextResults, setArtworkTextResults] = useState<ArtworkCheckResult[] | null>(null);
  const [artworkScanning, setArtworkScanning] = useState(false);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  // Audio pre-flight (loudness / true-peak / clipping) — 100% client-side.
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioReport, setAudioReport] = useState<AudioReport | null>(null);
  const [audioChecking, setAudioChecking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  // Sync-Ready (music-supervision) panel — opt-in to keep the page uncluttered.
  const [showSync, setShowSync] = useState(false);
  // Migration Pre-Flight panel — opt-in (only relevant when switching distributors).
  const [showMigration, setShowMigration] = useState(false);
  // Onboarding: paste-a-row box + "picked up where you left off" handoff banner.
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [handoff, setHandoff] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Load a track straight into the single-track form AND grade it immediately, so
  // the user sees a result without a separate "Run" click.
  const loadAndGrade = useCallback((track: TrackMeta) => {
    const t = { ...emptyTrack(1), ...track };
    setMode("single");
    setTracks([t]);
    setFixedTracks([t]);
    const raw = validateRelease([t], getProfile(profileId));
    setResults(raw.map((r) => ({ ...r, _fixed: false })));
    setBatch(null);
    setAiFixes(null);
    setAiImpact(null);
    setAiUpgrade(false);
    setBrief(null);
    setBriefUpgrade(false);
    setSavedId(null);
  }, [profileId]);

  const loadSample = useCallback(() => {
    setHandoff(false);
    loadAndGrade(sampleTrack());
  }, [loadAndGrade]);

  // Parse a pasted spreadsheet row (header-aware) or "Title - Artist" free text.
  const loadFromPaste = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const parsed = Papa.parse<Record<string, string>>(trimmed, { header: true, skipEmptyLines: true });
    if (parsed.data?.length && (parsed.meta?.fields?.length ?? 0) > 1) {
      loadAndGrade(mapCsvRow(parsed.data[0]));
    } else {
      const [title, artist] = trimmed.split(/\s+[-–—]\s+/);
      loadAndGrade({ ...emptyTrack(1), title: (title || trimmed).trim(), artist: (artist || "").trim() });
    }
    setShowPaste(false);
    setPasteText("");
  };

  // On mount: ?sample=1 deep-link, or a release the user checked in the public
  // demo before signing up (handed off via localStorage, recent only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("sample") === "1") {
      loadSample();
      return;
    }
    try {
      const raw = localStorage.getItem("metacheck_pending_release");
      if (raw) {
        localStorage.removeItem("metacheck_pending_release");
        const { track, ts } = JSON.parse(raw);
        if (track && (track.title || track.artist) && Date.now() - (ts ?? 0) < 2 * 60 * 60 * 1000) {
          loadAndGrade(track);
          setHandoff(true);
        }
      }
    } catch { /* ignore malformed handoff */ }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track mutations
  const updateTrack = useCallback((idx: number, key: keyof TrackMeta, val: string) => {
    setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
    setResults(null);
  }, []);

  // Sync-Ready fields (bpm/key/mood/contact/toggles) don't feed the rule engine,
  // so editing them must NOT clear an existing validation result below the panel.
  const updateTrackKeepResults = useCallback((idx: number, key: keyof TrackMeta, val: string) => {
    setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
  }, []);

  const addTrack = () => setTracks((prev) => [...prev, emptyTrack(prev.length + 1)]);
  const removeTrack = (idx: number) => setTracks((prev) => prev.filter((_, i) => i !== idx));

  // CSV upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (!parsed.data.length) {
          setCsvError("CSV file is empty or malformed.");
          return;
        }
        const mapped = parsed.data.map(mapCsvRow);
        if (mode === "batch") {
          // Catalog mode: split into releases and validate each independently.
          // Retain the flat rows so a later profile switch can re-grade in place.
          setTracks(mapped.map((t, i) => ({ ...t, trackNumber: t.trackNumber || String(i + 1) })));
          setBatch(buildBatch(mapped, getProfile(profileId)));
          setExpandedBatch(new Set());
        } else {
          setTracks(mapped.map((t, i) => ({ ...t, trackNumber: t.trackNumber || String(i + 1) })));
          setResults(null);
        }
      },
      error: (err) => setCsvError(err.message),
    });
  };

  // Run validation. Yield a frame after flipping `isRunning` so the "Scanning…"
  // state actually paints before the (synchronous, potentially heavy on a large
  // CSV) engine run blocks the main thread — previously both toggles batched into
  // one tick and the loading state never rendered.
  const runValidation = async () => {
    setIsRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const raw = validateRelease(tracks, getProfile(profileId));
      setResults(raw.map((r) => ({ ...r, _fixed: false })));
      setFixedTracks([...tracks]);
      setAiFixes(null);
      setAiImpact(null);
      setAiUpgrade(false);
      setBrief(null);
      setBriefUpgrade(false);
      setSavedId(null);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Artwork QC ────────────────────────────────────────────────────
  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArtworkName(file.name);
    setArtworkFile(file);
    setArtworkTextResults(null);
    setArtworkChecking(true);
    try {
      setArtworkResults(await checkArtworkFile(file));
    } catch {
      setArtworkResults([{ severity: "warning", rule: "artwork_error", message: "Couldn't analyse this image — try a different JPG or PNG." }]);
    } finally {
      setArtworkChecking(false);
    }
  };

  const runArtworkTextScan = async () => {
    if (!artworkFile) return;
    setArtworkScanning(true);
    try {
      setArtworkTextResults(await scanArtworkText(artworkFile));
    } catch {
      setArtworkTextResults([{ severity: "warning", rule: "artwork_ocr_error", message: "Text scan failed to run — you can still check the artwork by eye for URLs or handles." }]);
    } finally {
      setArtworkScanning(false);
    }
  };

  // ── Audio pre-flight ──────────────────────────────────────────────
  // Decode + measure entirely client-side; the master is never uploaded. Cross-
  // checks against the typed track[0] (duration / BPM / key) where present.
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioName(file.name);
    setAudioError(null);
    setAudioReport(null);
    setAudioChecking(true);
    // Yield a frame so the "Decoding…" state paints before the synchronous DSP runs.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      setAudioReport(await checkAudioFile(file, tracks[0]));
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Couldn't analyse this audio file.");
    } finally {
      setAudioChecking(false);
    }
  };

  const toggleBatch = (i: number) =>
    setExpandedBatch((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  // Apply a single fix, then re-run the engine. Re-validating (rather than just
  // flagging the issue `_fixed`) keeps the grade/counts honest: a fix can satisfy
  // its own rule but also trip or clear OTHER rules on the same field. This mirrors
  // applyAiFix so both fix paths behave identically.
  const applyFix = (result: ValidationResult) => {
    if (!result.suggestion) return;
    const idx = result.trackIndex ?? 0;
    const fieldKey = resolveFieldKey(result.field);
    if (!fieldKey) return; // unknown field — can't apply it
    // Derive from the LIVE `tracks` (not the frozen `fixedTracks` snapshot), so
    // Sync-Ready edits made after validation — bpm/key/mood/contact/toggles via
    // updateTrackKeepResults — survive. This genuinely mirrors applyAiFix.
    const updated = tracks.map((t, i) => i === idx ? { ...t, [fieldKey]: result.suggestion! } : t);
    setFixedTracks(updated);
    setTracks(updated);
    setResults(validateRelease(updated, getProfile(profileId)).map((r) => ({ ...r, _fixed: false })));
    setSavedId(null); // release changed — any prior save is now stale
  };

  // Auto-fix all fixable, then re-validate once. Same re-grade rationale as applyFix.
  const applyAllFixes = () => {
    const fixable = results?.filter((r) => r.fixable && r.suggestion) ?? [];
    // Base off the LIVE `tracks` so post-validation Sync-Ready edits aren't wiped
    // (see applyFix). `fixedTracks` is a stale snapshot from validation time.
    let updated = [...tracks];
    // Two fixable rules can target the same cell (e.g. several Title rules). Apply
    // the FIRST per cell; re-validation then reports whether the rest still fire.
    const writtenCells = new Set<string>();
    fixable.forEach((r) => {
      const idx = r.trackIndex ?? 0;
      const fieldKey = resolveFieldKey(r.field);
      if (!fieldKey) return;
      const cell = `${idx}:${fieldKey}`;
      if (writtenCells.has(cell)) return;
      updated = updated.map((t, i) => i === idx ? { ...t, [fieldKey]: r.suggestion! } : t);
      writtenCells.add(cell);
    });
    setFixedTracks(updated);
    setTracks(updated);
    setResults(validateRelease(updated, getProfile(profileId)).map((r) => ({ ...r, _fixed: false })));
    setSavedId(null); // release changed — any prior save is now stale
  };

  // AI suggestions
  const runAiFixes = async () => {
    setAiLoading(true);
    setAiUpgrade(false);
    try {
      const res = await fetch("/api/ai/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks, results }),
      });
      const json = await res.json();
      // Free-tier AI taste exhausted → show an upgrade card, not an error.
      if (res.status === 403 && json.upgrade) {
        setAiUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || "AI request failed");
      setAiFixes(json.data?.fixes ?? []);
      setAiImpact(typeof json.data?.impact === "string" ? json.data.impact : null);
    } catch (err) {
      console.error("AI Fix Error:", err);
      alert(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  // AI Submission Readiness Brief — a manager-grade "is this ready and why" verdict.
  const runBrief = async () => {
    setBriefLoading(true);
    setBriefUpgrade(false);
    try {
      const active = results?.filter((r) => !r._fixed) ?? [];
      const res = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: fixedTracks, results: active, distributor: getProfile(profileId).name }),
      });
      const json = await res.json();
      if (res.status === 403 && json.upgrade) {
        setBriefUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Brief request failed");
      setBrief((json.data?.brief as BriefData) ?? null);
    } catch (err) {
      console.error("AI Brief Error:", err);
      alert(err instanceof Error ? err.message : "Brief request failed");
    } finally {
      setBriefLoading(false);
    }
  };

  // Apply AI fix. `fix.field` may arrive as a TrackMeta key ("releaseDate")
  // from a well-formed model response, or as a human label ("Release Date" →
  // "release date") from the rule-based fallback — resolveFieldKey handles
  // both so multi-word fields don't silently write to a junk property.
  const applyAiFix = (fix: import("@/lib/validation/types").AiFix) => {
    const fieldKey = resolveFieldKey(fix.field) ?? (fix.field as keyof TrackMeta);
    const updated = tracks.map((t, i) => (i === fix.trackIndex ? { ...t, [fieldKey]: fix.fixed } : t));
    setTracks(updated);
    setFixedTracks(updated);
    setAiFixes((prev) => prev?.filter((f) => f !== fix) ?? null);
    // Re-grade so the grade card, counts and issue list reflect the applied fix
    // (one AI fix can clear several related rules — re-running the engine is the
    // robust way to keep the results in sync).
    setResults(validateRelease(updated, getProfile(profileId)).map((r) => ({ ...r, _fixed: false })));
    setSavedId(null); // release changed — any prior save is now stale
  };

  // Save to history
  const saveToHistory = async () => {
    if (!results) return;
    setSaving(true);
    try {
      // Save the post-fix state: grade and counts reflect issues still
      // outstanding, not ones the user already resolved before saving.
      const active = results.filter((r) => !r._fixed);
      const grade = getGrade(active);
      const release = {
        title: tracks[0]?.album || tracks[0]?.title || "Untitled Release",
        artist: tracks[0]?.artist || "",
        track_count: tracks.length,
        grade: grade.letter,
        critical_count: active.filter((r) => r.severity === "critical").length,
        warning_count: active.filter((r) => r.severity === "warning").length,
        suggestion_count: active.filter((r) => r.severity === "suggestion").length,
        tracks: fixedTracks,
        results: active,
      };
      const res = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(release),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSavedId(json.data?.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Grade and summary counts must reflect issues that are still outstanding —
  // i.e. exclude anything the user has already applied a fix for. Otherwise the
  // grade card stays stuck on the original (e.g. "F · 5 critical") even after
  // "Auto-fix All", and the same stale numbers get written to history on save.
  const activeResults = results?.filter((r) => !r._fixed) ?? [];
  const grade = results ? getGrade(activeResults) : null;
  const verdict = results ? preflightVerdict(activeResults) : null;
  const criticals = activeResults.filter((r) => r.severity === "critical");
  const warnings = activeResults.filter((r) => r.severity === "warning");
  const suggestions = activeResults.filter((r) => r.severity === "suggestion");
  const fixableCount = results?.filter((r) => r.fixable && !r._fixed).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="font-display text-4xl text-text mb-2 tracking-tight">Validate release</h1>
        <p className="text-text-muted">Scan your metadata for errors before submitting to your distributor.</p>
      </div>

      {/* Mode selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["single", "multi", "csv", "batch"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setTracks(m === "csv" || m === "batch" ? [] : [emptyTrack(1)]);
              setResults(null);
              setBatch(null);
            }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              mode === m
                ? "border-accent bg-accent/10 text-accent-bright"
                : "border-border text-text-muted hover:border-border-bright hover:text-text"
            }`}
          >
            {m === "single" ? "Single Track" : m === "multi" ? "Multi-Track" : m === "csv" ? "Upload CSV" : "Batch / Catalog"}
          </button>
        ))}
      </div>

      {/* Distributor profile selector */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <label htmlFor="profile" className="text-sm text-text-muted">Distributor ruleset</label>
        <select
          id="profile"
          value={profileId}
          onChange={(e) => {
            const id = e.target.value;
            setProfileId(id);
            setResults(null);
            // In catalog mode, re-grade the already-loaded catalog under the new
            // ruleset instead of forcing a full re-upload.
            setBatch(mode === "batch" && tracks.length ? buildBatch(tracks, getProfile(id)) : null);
          }}
          className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text focus:outline-none focus:border-accent transition-colors"
        >
          {Object.values(PROFILES).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="text-xs text-text-dim">Tunes which checks count as critical.</span>
      </div>

      {/* CSV Upload (single-release CSV or batch/catalog) */}
      {(mode === "csv" || mode === "batch") && (
        <div className="mb-6">
          <div
            className="rounded-2xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-surface/30 transition-colors p-10 text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent-bright flex items-center justify-center mx-auto mb-4">
              <IconUpload size={22} />
            </div>
            <p className="text-text-muted text-sm mb-1">Click to upload or drag &amp; drop your CSV</p>
            <p className="text-xs text-text-dim">
              {mode === "batch"
                ? "Multiple releases — rows are grouped into releases by album, each QC'd separately"
                : "DistroKid, TuneCore, CD Baby export formats supported"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              aria-label="Upload CSV file"
              className="hidden"
              onChange={handleCsvUpload}
            />
          </div>
          {csvError && <p className="mt-2 text-sm text-red">{csvError}</p>}
          {mode === "csv" && tracks.length > 0 && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-green/10 border border-green/20">
              <p className="text-sm text-green">{tracks.length} tracks loaded from CSV</p>
            </div>
          )}
          {mode === "batch" && batch && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-green/10 border border-green/20">
              <p className="text-sm text-green">
                {batch.length} release{batch.length === 1 ? "" : "s"} ·{" "}
                {batch.reduce((n, b) => n + b.tracks.length, 0)} tracks loaded
              </p>
            </div>
          )}
        </div>
      )}

      {/* Onboarding: demo handoff banner + quick-start row */}
      {handoff && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <IconSparkles size={16} className="text-accent-bright shrink-0" />
          <p className="text-sm text-text-muted">Picked up where you left off — here&apos;s the release you checked in the demo.</p>
        </div>
      )}
      {(mode === "single" || mode === "multi") && !results && (
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadSample}
              className="press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-sm font-medium hover:bg-accent/20 transition-colors"
            >
              <IconBolt size={15} /> Load sample release
            </button>
            <button
              onClick={() => setShowPaste((v) => !v)}
              className="press px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors"
            >
              Paste a row
            </button>
            <span className="text-xs text-text-dim">New here? Try a sample to watch it catch real issues in one click.</span>
          </div>
          {showPaste && (
            <div className="mt-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste a row from your DistroKid / CD Baby / TuneCore export — or just type: Midnight Drive - Jane Doe"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors font-mono"
              />
              <button
                onClick={() => loadFromPaste(pasteText)}
                className="press mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
              >
                Check it <IconArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Track forms */}
      {mode !== "batch" && (mode !== "csv" || tracks.length > 0) && (
        <div className="space-y-4 mb-6">
          {tracks.map((track, idx) => (
            <TrackForm
              key={idx}
              track={track}
              idx={idx}
              onChange={updateTrack}
              onRemove={removeTrack}
              showRemove={mode === "multi" && tracks.length > 1}
            />
          ))}
          {mode === "multi" && (
            <button
              type="button"
              onClick={addTrack}
              className="w-full py-3 rounded-xl border border-dashed border-border-bright text-sm text-text-muted hover:text-text hover:border-accent/50 transition-all"
            >
              + Add track
            </button>
          )}
        </div>
      )}

      {/* Run button */}
      {tracks.length > 0 && (
        <button
          onClick={runValidation}
          disabled={isRunning}
          className="press w-full py-4 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-bright transition-colors glow-teal disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {isRunning ? "Scanning…" : <>Run validation <IconArrowRight size={16} /></>}
        </button>
      )}

      {/* Audio pre-flight (loudness / true-peak / clipping) — the moat */}
      {mode !== "batch" && (
        <>
          <AudioPanel
            report={audioReport}
            checking={audioChecking}
            error={audioError}
            name={audioName}
            track={tracks[0] ?? emptyTrack(1)}
            onUpload={() => audioInputRef.current?.click()}
            onUseDetected={(key, val) => updateTrackKeepResults(0, key, val)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg,.aiff"
            aria-label="Upload audio master"
            className="hidden"
            onChange={handleAudioUpload}
          />
        </>
      )}

      {/* Artwork QC */}
      {mode !== "batch" && (
        <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-medium text-text">Artwork QC</h3>
              <p className="text-xs text-text-dim mt-0.5">Cover art is rejected as often as metadata — check specs + scan for URLs/handles.</p>
            </div>
            <button
              type="button"
              onClick={() => artworkInputRef.current?.click()}
              className="press shrink-0 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors"
            >
              {artworkName ? "Change image" : "Upload artwork"}
            </button>
            <input
              ref={artworkInputRef}
              type="file"
              accept="image/jpeg,image/png"
              aria-label="Upload cover artwork"
              className="hidden"
              onChange={handleArtworkUpload}
            />
          </div>
          {artworkName && <p className="text-xs font-mono text-text-dim mb-3 truncate">{artworkName}</p>}
          {artworkChecking && <p className="text-sm text-text-muted">Checking specs…</p>}
          {artworkResults && (
            <div className="space-y-2">
              {artworkResults.map((a, i) => (
                <ArtworkRow key={i} a={a} />
              ))}
            </div>
          )}
          {artworkResults && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={runArtworkTextScan}
                disabled={artworkScanning}
                className="press px-4 py-2 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
              >
                {artworkScanning ? "Scanning text…" : "Scan for URLs / handles (OCR)"}
              </button>
              <span className="text-xs text-text-dim">runs in your browser; first scan loads the OCR engine.</span>
            </div>
          )}
          {artworkTextResults && (
            <div className="mt-3 space-y-2">
              {artworkTextResults.map((a, i) => (
                <ArtworkRow key={i} a={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync-Ready score (music supervision) */}
      {mode !== "batch" && tracks.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-bg-elevated p-5">
          <button
            type="button"
            onClick={() => setShowSync((v) => !v)}
            className="w-full flex items-center gap-3 text-left"
          >
            <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center shrink-0">
              <IconClapper size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-text">Sync-Ready score</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-bright border border-accent/20">New</span>
              </div>
              <p className="text-xs text-text-dim mt-0.5">
                Is {tracks.length > 1 ? "track 1" : "this track"} ready to pitch for film &amp; TV licensing? {showSync ? "" : "Tap to check."}
              </p>
            </div>
            <span className={`text-text-dim transition-transform duration-300 ${showSync ? "rotate-90" : ""}`}>
              <IconArrowRight size={18} />
            </span>
          </button>
          {showSync && (
            <div className="mt-5 pt-5 border-t border-border">
              <SyncPanel track={tracks[0]} onChange={(key, val) => updateTrackKeepResults(0, key, val)} />
            </div>
          )}
        </div>
      )}

      {/* Migration Pre-Flight (switching distributors / re-uploading a remaster) */}
      {mode !== "batch" && tracks.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-bg-elevated p-5">
          <button
            type="button"
            onClick={() => setShowMigration((v) => !v)}
            className="w-full flex items-center gap-3 text-left"
          >
            <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center shrink-0">
              <IconFingerprint size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-text">Switching distributors?</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-bright border border-accent/20">New</span>
              </div>
              <p className="text-xs text-text-dim mt-0.5">
                Re-uploading or moving distributor? Check it won&apos;t reset your streams. {showMigration ? "" : "Tap to check."}
              </p>
            </div>
            <span className={`text-text-dim transition-transform duration-300 ${showMigration ? "rotate-90" : ""}`}>
              <IconArrowRight size={18} />
            </span>
          </button>
          {showMigration && <MigrationPanel newTrack={tracks[0] ?? emptyTrack(1)} />}
        </div>
      )}

      {/* Batch / catalog results */}
      {mode === "batch" && batch && (() => { const health = computeCatalogHealth(batch); return (
        <div className="mt-8 space-y-3">
          {/* Catalog Health Score */}
          <div className="rounded-xl border border-border bg-bg-card p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-4">
                <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 font-display ${
                  health.score >= 85 ? "bg-green-950/60 text-green-500"
                    : health.score >= 70 ? "bg-yellow-950/60 text-yellow-500"
                    : "bg-rose-950/60 text-rose-500"
                }`}>
                  <span className="text-3xl font-bold leading-none nums">{health.score}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">/ 100</span>
                </div>
                <div>
                  <h2 className="font-display text-2xl text-text tracking-tight">Catalog health</h2>
                  <p className="text-sm text-text-muted nums">
                    {health.releases} release{health.releases === 1 ? "" : "s"} · {health.tracks} tracks ·{" "}
                    <span className="text-green-500">{health.cleanReleases} clean</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:ml-auto">
                <div className="rounded-lg border border-border bg-surface/50 px-4 py-2.5 text-center min-w-[7rem]">
                  <p className="nums text-xl font-semibold text-rose-400">{health.atRisk}</p>
                  <p className="text-[11px] text-text-dim leading-tight mt-0.5">releases at risk</p>
                </div>
                <div className="rounded-lg border border-border bg-surface/50 px-4 py-2.5 text-center min-w-[7rem]">
                  <p className="nums text-xl font-semibold text-amber">{health.royaltyRisk}</p>
                  <p className="text-[11px] text-text-dim leading-tight mt-0.5">with royalty-risk gaps</p>
                </div>
              </div>
            </div>
            {health.royaltyRisk > 0 && (
              <p className="text-xs text-text-muted leading-relaxed mt-4 pt-4 border-t border-border">
                <span className="text-amber font-medium">{health.royaltyRisk} release{health.royaltyRisk === 1 ? " has" : "s have"}</span>{" "}
                missing or malformed rights data — ISRC/UPC codes, credits, or writer splits.
                These are exactly the gaps that send streams to the unmatched-royalty black box. Fix them before they cost you.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <h2 className="font-display text-2xl text-text tracking-tight">Catalog QC</h2>
            <button
              onClick={() => exportCsv(batch.flatMap((b) => b.tracks))}
              className="press px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors"
            >
              Export all CSV
            </button>
          </div>
          {batch.map((rel, i) => {
            const crit = rel.results.filter((r) => r.severity === "critical").length;
            const warn = rel.results.filter((r) => r.severity === "warning").length;
            const sugg = rel.results.filter((r) => r.severity === "suggestion").length;
            const open = expandedBatch.has(i);
            return (
              <div key={i} className="rounded-xl border border-border bg-bg-card overflow-hidden">
                <button
                  onClick={() => toggleBatch(i)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface/40 transition-colors"
                >
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold font-display shrink-0 ${GRADE_DISPLAY[rel.grade.letter]?.bg ?? "bg-surface"} ${GRADE_DISPLAY[rel.grade.letter]?.text ?? "text-text-muted"}`}>
                    {rel.grade.letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text font-medium truncate">{rel.title}</p>
                    <p className="text-xs text-text-dim nums">
                      {rel.tracks.length} track{rel.tracks.length === 1 ? "" : "s"} ·{" "}
                      <span className="text-red">{crit} critical</span> ·{" "}
                      <span className="text-amber">{warn} warnings</span> ·{" "}
                      <span className="text-blue">{sugg} suggestions</span>
                    </p>
                  </div>
                  <span className={`text-text-dim shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}><IconChevronDown size={18} /></span>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                    {rel.results.length === 0 ? (
                      <p className="text-sm text-text-muted">No issues found.</p>
                    ) : (
                      rel.results.map((result, j) => <ResultCard key={j} result={result} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ); })()}

      {/* Results */}
      {results && grade && (
        <div className="mt-10 space-y-6">
          {/* Pre-flight verdict — the "is this permanent?" headline */}
          {verdict && (
            <div className={`rounded-2xl border p-6 ${
              verdict.safe
                ? "border-green/30 bg-green-950/30"
                : verdict.permanentCount > 0
                  ? "border-red/30 bg-rose-950/30"
                  : "border-amber/30 bg-amber-950/20"
            }`}>
              <div className="flex items-start gap-4">
                <span className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  verdict.safe ? "bg-green/15 text-green" : verdict.permanentCount > 0 ? "bg-red/15 text-red" : "bg-amber/15 text-amber"
                }`}>
                  {verdict.safe ? <IconCheck size={20} /> : <IconBolt size={20} />}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-2xl text-text tracking-tight leading-tight">{verdict.headline}</h2>
                  <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{verdict.subline}</p>
                  {(verdict.permanentCount > 0 || verdict.recoverableCount > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {verdict.permanentCount > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full border border-red/25 bg-red/10 text-red nums">{verdict.permanentCount} permanent</span>
                      )}
                      {verdict.recoverableCount > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full border border-amber/25 bg-amber/10 text-amber nums">{verdict.recoverableCount} editable later</span>
                      )}
                      {verdict.advisoryCount > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full border border-blue/25 bg-blue/10 text-blue nums">{verdict.advisoryCount} optional</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Grade card */}
          <div className="rounded-xl border border-border bg-bg-card p-6 flex items-center gap-6">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center text-5xl font-bold font-display shrink-0 ${GRADE_DISPLAY[grade.letter]?.bg ?? "bg-surface"} ${GRADE_DISPLAY[grade.letter]?.text ?? "text-text-muted"}`}
            >
              {grade.letter}
            </div>
            <div>
              <h2 className="font-display text-2xl text-text mb-1 tracking-tight">{grade.label}</h2>
              <p className="text-sm text-text-muted nums">
                <span className="text-red">{criticals.length} critical</span>
                {" · "}
                <span className="text-amber">{warnings.length} warnings</span>
                {" · "}
                <span className="text-blue">{suggestions.length} suggestions</span>
                {" · "}
                <span className="text-accent-bright">{fixableCount} auto-fixable</span>
              </p>
            </div>
            <div className="ml-auto flex flex-col sm:flex-row gap-2">
              {fixableCount > 0 && (
                <button
                  onClick={applyAllFixes}
                  className="press px-4 py-2 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-sm font-medium hover:bg-accent/20 transition-colors"
                >
                  Auto-fix all ({fixableCount})
                </button>
              )}
              <button
                onClick={() => exportCsv(fixedTracks)}
                className="press px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors"
              >
                Export CSV
              </button>
              {!savedId ? (
                <button
                  onClick={saveToHistory}
                  disabled={saving}
                  className="press px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted hover:text-text transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save to history"}
                </button>
              ) : (
                <a
                  href={`/history/${savedId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green/10 border border-green/20 text-sm text-green hover:bg-green/20 transition-colors"
                >
                  <IconCheck size={14} /> Saved · View
                </a>
              )}
            </div>
          </div>

          {/* AI Submission Readiness Brief */}
          <div className="rounded-xl border border-border bg-bg-elevated p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center"><IconClapper size={16} /></span>
                <div>
                  <h3 className="text-sm font-medium text-text">AI submission brief</h3>
                  <p className="text-xs text-text-dim">Is this ready to ship — and what each issue costs you?</p>
                </div>
              </div>
              {!brief && !briefUpgrade && (
                <button
                  onClick={runBrief}
                  disabled={briefLoading}
                  className="press shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-bright transition-colors disabled:opacity-50"
                >
                  <IconSparkles size={14} /> {briefLoading ? "Writing brief…" : "Generate brief"}
                </button>
              )}
            </div>
            {briefUpgrade && <UpgradeCard context="run" />}
            {brief && (
              <div className="space-y-4 mt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    brief.verdict === "ready" ? "bg-green/10 text-green border-green/20"
                      : brief.verdict === "close" ? "bg-amber/10 text-amber border-amber/20"
                      : "bg-red/10 text-red border-red/20"
                  }`}>
                    {brief.verdict === "ready" ? "Ready to submit" : brief.verdict === "close" ? "Almost ready" : "Not ready"}
                  </span>
                  {brief.headline && <p className="text-sm text-text font-medium">{brief.headline}</p>}
                </div>
                {brief.summary && <p className="text-sm text-text-muted leading-relaxed">{brief.summary}</p>}
                {Array.isArray(brief.exposure) && brief.exposure.length > 0 && (
                  <div>
                    <p className="eyebrow mb-2">What it costs you</p>
                    <div className="space-y-2">
                      {brief.exposure.map((e, i) => (
                        <div key={i} className="rounded-lg border border-border bg-surface/40 px-4 py-3">
                          <p className="text-sm text-text">{e.issue}</p>
                          <p className="text-xs text-text-muted mt-0.5">{e.cost}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(brief.fixOrder) && brief.fixOrder.length > 0 && (
                  <div>
                    <p className="eyebrow mb-2">Fix in this order</p>
                    <ol className="space-y-1.5">
                      {brief.fixOrder.map((f, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-text-muted">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent-bright text-xs flex items-center justify-center">{i + 1}</span>
                          {f}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI fixes */}
          <div className="rounded-xl border border-border bg-bg-elevated p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-text">AI fixes</h3>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-bright border border-accent/20"><IconSparkles size={11} /> 1 free / mo</span>
              </div>
              <button
                onClick={runAiFixes}
                disabled={aiLoading}
                className="press inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-bright transition-colors disabled:opacity-50"
              >
                {aiLoading ? "Analysing…" : <>Get AI fixes <IconArrowRight size={14} /></>}
              </button>
            </div>
            {aiUpgrade && <UpgradeCard context="fix" />}
            {aiImpact && !aiUpgrade && (
              <div className="mb-3 rounded-lg border border-amber/20 bg-amber/5 px-4 py-3">
                <p className="text-[11px] text-amber font-medium uppercase tracking-[0.12em] mb-1">What this costs you</p>
                <p className="text-sm text-text-muted leading-relaxed">{aiImpact}</p>
              </div>
            )}
            {aiFixes && aiFixes.length === 0 && (
              <p className="text-sm text-text-muted">No additional AI suggestions — metadata looks good.</p>
            )}
            {aiFixes && aiFixes.length > 0 && (
              <div className="space-y-3">
                {aiFixes.map((fix, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-text-dim mb-1.5">
                        Track {fix.trackIndex + 1} · {fix.field}
                      </p>
                      <p className="text-sm text-text-muted line-through mb-0.5 font-mono">{fix.original}</p>
                      <p className="text-sm text-accent-bright font-mono">{fix.fixed}</p>
                      <p className="text-xs text-text-dim mt-1.5">{fix.reason}</p>
                    </div>
                    <button
                      onClick={() => applyAiFix(fix)}
                      className="press shrink-0 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 hover:bg-accent/20 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results by severity — count outstanding issues (matches the grade card,
              which also excludes fixes the user already applied). */}
          {(["critical", "warning", "suggestion"] as const).map((sev) => {
            const items = activeResults.filter((r) => r.severity === sev);
            if (!items.length) return null;
            return (
              <div key={sev}>
                <h3 className="flex items-center gap-2 eyebrow mb-3">
                  <span className={`w-2 h-2 rounded-full ${sev === "critical" ? "bg-red" : sev === "warning" ? "bg-amber" : "bg-blue"}`} />
                  {sev === "critical" ? "Critical issues" : sev === "warning" ? "Warnings" : "Suggestions"}
                  <span className="normal-case tracking-normal text-text-dim/70 nums">({items.length})</span>
                </h3>
                <div className="space-y-2">
                  {items.map((result, i) => (
                    <ResultCard key={i} result={result} onApplyFix={applyFix} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
