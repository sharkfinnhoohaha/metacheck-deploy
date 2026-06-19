"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Papa from "papaparse";
import type { TrackMeta, ValidationResult, ArtworkCheckResult } from "@/lib/validation/types";
import { validateRelease, getGrade } from "@/lib/validation/rules";
import { PROFILES, getProfile } from "@/lib/validation/profiles";
import { checkArtworkFile, scanArtworkText } from "@/lib/validation/artwork";
import { checkSyncReadiness, CATEGORY_LABEL, type SyncCategory } from "@/lib/validation/sync";
import { exportCsv } from "@/lib/export/csv";
import { IconCheck, IconClapper, IconArrowRight, IconUpload, IconChevronDown, IconBolt, IconSparkles } from "@/app/_components/icons";

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

// Maps a ValidationResult.field (human label from the engine, e.g. "Copyright")
// to its TrackMeta key. The form labels differ ("Copyright (℗)", "UPC / Barcode",
// etc.), so matching on form labels silently fails — this map is the source of truth.
const RESULT_FIELD_TO_KEY: Record<string, keyof TrackMeta> = {
  "isrc": "isrc",
  "title": "title",
  "artist": "artist",
  "featured artists": "featuredArtists",
  "album": "album",
  "upc": "upc",
  "genre": "genre",
  "release date": "releaseDate",
  "songwriters": "songwriters",
  "producers": "producers",
  "composers": "composers",
  "copyright": "copyright",
  "explicit": "explicit",
  "language": "language",
  "label": "label",
  "duration": "duration",
  "track number": "trackNumber",
  "splits": "splits",
  "iswc": "iswc",
  "ai disclosure": "aiDisclosure",
};

function resolveFieldKey(field: string): keyof TrackMeta | undefined {
  return (
    RESULT_FIELD_TO_KEY[field.toLowerCase().trim()] ??
    FIELDS.find((f) => f.label.toLowerCase() === field.toLowerCase())?.key
  );
}

// ── Severity badge styles ─────────────────────────────────────────────────────
const SEV: Record<string, { badge: string; dotClass: string; border: string }> = {
  critical: { badge: "text-[#fda4af] bg-red-950/40", dotClass: "bg-rose-500", border: "border-red-500/20" },
  warning: { badge: "text-[#fcd34d] bg-amber-950/40", dotClass: "bg-amber-500", border: "border-amber-500/20" },
  suggestion: { badge: "text-[#93c5fd] bg-blue-950/40", dotClass: "bg-blue-500", border: "border-blue-500/20" },
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
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-accent transition-colors font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({
  result, onApplyFix,
}: {
  result: ValidationResult & { _fixed?: boolean };
  onApplyFix?: (result: ValidationResult) => void;
}) {
  const s = SEV[result.severity];
  return (
    <div className={`rounded-lg border p-4 ${s.border} bg-bg-elevated`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${s.badge}`}>
                {result.severity}
              </span>
              <span className="text-xs font-mono text-text-dim">{result.field}</span>
              {result.trackIndex !== undefined && (
                <span className="text-xs font-mono text-text-dim">track {result.trackIndex + 1}</span>
              )}
            </div>
            <p className="text-sm text-text leading-relaxed">{result.message}</p>
            {result.suggestion && (
              <p className="text-xs text-text-muted mt-1 font-mono">
                <span className="text-accent-bright">→</span> {result.suggestion}
              </p>
            )}
          </div>
        </div>
        {result.fixable && !result._fixed && (
          <button
            onClick={() => onApplyFix?.(result)}
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
          <p className="text-xs text-text-dim uppercase tracking-wider">To raise the score</p>
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
  // Sync-Ready (music-supervision) panel — opt-in to keep the page uncluttered.
  const [showSync, setShowSync] = useState(false);
  // Onboarding: paste-a-row box + "picked up where you left off" handoff banner.
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [handoff, setHandoff] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

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
          const profile = getProfile(profileId);
          const groups = groupReleases(mapped);
          const releases: BatchRelease[] = Object.entries(groups).map(([title, grp]) => {
            const grpTracks = grp.map((t, i) => ({ ...t, trackNumber: t.trackNumber || String(i + 1) }));
            const res = validateRelease(grpTracks, profile);
            return { title, tracks: grpTracks, results: res, grade: getGrade(res) };
          });
          setBatch(releases);
          setExpandedBatch(new Set());
        } else {
          setTracks(mapped.map((t, i) => ({ ...t, trackNumber: t.trackNumber || String(i + 1) })));
          setResults(null);
        }
      },
      error: (err) => setCsvError(err.message),
    });
  };

  // Run validation
  const runValidation = () => {
    setIsRunning(true);
    const raw = validateRelease(tracks, getProfile(profileId));
    setResults(raw.map((r) => ({ ...r, _fixed: false })));
    setFixedTracks([...tracks]);
    setAiFixes(null);
    setAiImpact(null);
    setAiUpgrade(false);
    setBrief(null);
    setBriefUpgrade(false);
    setSavedId(null);
    setIsRunning(false);
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

  const toggleBatch = (i: number) =>
    setExpandedBatch((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  // Apply a single fix
  const applyFix = (result: ValidationResult) => {
    if (!result.suggestion) return;
    const idx = result.trackIndex ?? 0;
    const fieldKey = resolveFieldKey(result.field);
    if (!fieldKey) return; // unknown field — don't mark fixed if we can't apply it
    setFixedTracks((prev) => prev.map((t, i) => i === idx ? { ...t, [fieldKey]: result.suggestion! } : t));
    setTracks((prev) => prev.map((t, i) => i === idx ? { ...t, [fieldKey]: result.suggestion! } : t));
    setResults((prev) =>
      prev?.map((r) => r.rule === result.rule && r.trackIndex === result.trackIndex ? { ...r, _fixed: true } : r) ?? null
    );
  };

  // Auto-fix all fixable
  const applyAllFixes = () => {
    const fixable = results?.filter((r) => r.fixable && !r._fixed && r.suggestion) ?? [];
    let updated = [...fixedTracks];
    const appliedRules = new Set<string>();
    // Two fixable rules can target the same cell (e.g. several Title rules). Apply
    // the FIRST per cell and leave the rest genuinely outstanding — otherwise the
    // later ones get marked "fixed" without their suggestion actually being written.
    const writtenCells = new Set<string>();
    fixable.forEach((r) => {
      const idx = r.trackIndex ?? 0;
      const fieldKey = resolveFieldKey(r.field);
      if (!fieldKey) return;
      const cell = `${idx}:${fieldKey}`;
      if (writtenCells.has(cell)) return;
      updated = updated.map((t, i) => i === idx ? { ...t, [fieldKey]: r.suggestion! } : t);
      writtenCells.add(cell);
      appliedRules.add(`${r.rule}:${r.trackIndex ?? -1}`);
    });
    setFixedTracks(updated);
    setTracks(updated);
    setResults((prev) => prev?.map((r) => (
      appliedRules.has(`${r.rule}:${r.trackIndex ?? -1}`) ? { ...r, _fixed: true } : r
    )) ?? null);
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
        tracks,
        results,
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
  const criticals = activeResults.filter((r) => r.severity === "critical");
  const warnings = activeResults.filter((r) => r.severity === "warning");
  const suggestions = activeResults.filter((r) => r.severity === "suggestion");
  const fixableCount = results?.filter((r) => r.fixable && !r._fixed).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text mb-2">Validate Release</h1>
        <p className="text-text-muted text-sm">Scan your metadata for errors before submitting to your distributor.</p>
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
        <label htmlFor="profile" className="text-xs font-mono text-text-dim">Distributor ruleset:</label>
        <select
          id="profile"
          value={profileId}
          onChange={(e) => { setProfileId(e.target.value); setResults(null); setBatch(null); }}
          className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text font-mono focus:outline-none focus:border-accent transition-colors"
        >
          {Object.values(PROFILES).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="text-xs text-text-dim">tunes which checks are critical (e.g. DistroKid auto-assigns ISRC/UPC; Apple requires a producer credit).</span>
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
          {csvError && <p className="mt-2 text-sm text-red font-mono">{csvError}</p>}
          {mode === "csv" && tracks.length > 0 && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-green/10 border border-green/20">
              <p className="text-sm text-green font-mono">{tracks.length} tracks loaded from CSV</p>
            </div>
          )}
          {mode === "batch" && batch && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-green/10 border border-green/20">
              <p className="text-sm text-green font-mono">
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
              className="w-full py-3 rounded-xl border border-dashed border-border-bright text-sm text-text-muted hover:text-text hover:border-accent/50 transition-all font-mono"
            >
              + Add Track
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

      {/* Artwork QC */}
      {mode !== "batch" && (
        <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-mono text-sm text-text">Artwork QC</h3>
              <p className="text-xs text-text-dim mt-0.5">Cover art is rejected as often as metadata — check specs + scan for URLs/handles.</p>
            </div>
            <button
              type="button"
              onClick={() => artworkInputRef.current?.click()}
              className="shrink-0 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted font-mono hover:text-text transition-colors"
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
          {artworkChecking && <p className="text-sm text-text-muted font-mono">Checking specs…</p>}
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
                className="px-4 py-2 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-xs font-mono hover:bg-accent/20 transition-colors disabled:opacity-50"
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

      {/* Batch / catalog results */}
      {mode === "batch" && batch && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-text">Catalog QC</h2>
            <button
              onClick={() => exportCsv(batch.flatMap((b) => b.tracks))}
              className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted font-mono hover:text-text transition-colors"
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
                    <p className="text-xs font-mono text-text-dim">
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
                      <p className="text-sm text-text-muted font-mono">No issues found.</p>
                    ) : (
                      rel.results.map((result, j) => <ResultCard key={j} result={result} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Results */}
      {results && grade && (
        <div className="mt-10 space-y-6">
          {/* Grade card */}
          <div className="rounded-xl border border-border bg-bg-card p-6 flex items-center gap-6">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center text-5xl font-bold font-display shrink-0 ${GRADE_DISPLAY[grade.letter]?.bg ?? "bg-surface"} ${GRADE_DISPLAY[grade.letter]?.text ?? "text-text-muted"}`}
            >
              {grade.letter}
            </div>
            <div>
              <h2 className="font-display text-2xl text-text mb-1">{grade.label}</h2>
              <p className="text-sm font-mono text-text-muted">
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
                  className="px-4 py-2 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 text-sm font-mono hover:bg-accent/20 transition-colors"
                >
                  Auto-fix All ({fixableCount})
                </button>
              )}
              <button
                onClick={() => exportCsv(fixedTracks)}
                className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted font-mono hover:text-text transition-colors"
              >
                Export CSV
              </button>
              {!savedId ? (
                <button
                  onClick={saveToHistory}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-muted font-mono hover:text-text transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save to History"}
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
                    <p className="text-xs text-text-dim uppercase tracking-wider mb-2">What it costs you</p>
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
                    <p className="text-xs text-text-dim uppercase tracking-wider mb-2">Fix in this order</p>
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
                <p className="text-xs text-amber font-medium uppercase tracking-wider mb-1">What this costs you</p>
                <p className="text-sm text-text-muted leading-relaxed">{aiImpact}</p>
              </div>
            )}
            {aiFixes && aiFixes.length === 0 && (
              <p className="text-sm text-text-muted font-mono">No additional AI suggestions — metadata looks good!</p>
            )}
            {aiFixes && aiFixes.length > 0 && (
              <div className="space-y-3">
                {aiFixes.map((fix, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-text-dim mb-1">
                        Track {fix.trackIndex + 1} · {fix.field}
                      </p>
                      <p className="text-sm text-text-muted line-through mb-0.5 font-mono">{fix.original}</p>
                      <p className="text-sm text-accent-bright font-mono">{fix.fixed}</p>
                      <p className="text-xs text-text-dim mt-1">{fix.reason}</p>
                    </div>
                    <button
                      onClick={() => applyAiFix(fix)}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 hover:bg-accent/20 transition-colors font-mono"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results by severity */}
          {(["critical", "warning", "suggestion"] as const).map((sev) => {
            const items = results.filter((r) => r.severity === sev);
            if (!items.length) return null;
            return (
              <div key={sev}>
                <h3 className="flex items-center gap-2 text-xs text-text-dim uppercase tracking-widest mb-3">
                  <span className={`w-2 h-2 rounded-full ${sev === "critical" ? "bg-rose-500" : sev === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                  {sev === "critical" ? "Critical Issues" : sev === "warning" ? "Warnings" : "Suggestions"}
                  <span className="normal-case text-text-dim/70">({items.length})</span>
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
