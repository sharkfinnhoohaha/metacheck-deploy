"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import type { TrackMeta, ValidationResult } from "@/lib/validation/types";
import { validateRelease, getGrade } from "@/lib/validation/rules";
import { exportCsv } from "@/lib/export/csv";

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
    songwriters: "", producers: "", composers: "", copyright: "",
    explicit: "", language: "", duration: "",
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
  { key: "producers", label: "Producers", placeholder: "Producer Name" },
  { key: "composers", label: "Composers", placeholder: "Composer Name" },
  { key: "copyright", label: "Copyright (℗)", placeholder: `℗ ${new Date().getFullYear()} Artist Name` },
  { key: "explicit", label: "Explicit", placeholder: "true / false / clean" },
  { key: "language", label: "Language", placeholder: "en" },
  { key: "duration", label: "Duration", placeholder: "3:45" },
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
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm text-text-muted">Track {idx + 1}</h3>
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
          <div key={f.key} className={f.key === "songwriters" || f.key === "producers" ? "sm:col-span-2" : ""}>
            <label className="block text-xs font-mono text-text-dim mb-1">
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
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20 hover:bg-accent/20 transition-colors font-mono"
          >
            Apply fix
          </button>
        )}
        {result._fixed && (
          <span className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-green/10 text-green border border-green/20 font-mono">
            Fixed ✓
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Mode = "single" | "multi" | "csv";

export default function ValidatePage() {
  const [mode, setMode] = useState<Mode>("single");
  const [tracks, setTracks] = useState<TrackMeta[]>([emptyTrack(1)]);
  const [results, setResults] = useState<(ValidationResult & { _fixed?: boolean })[] | null>(null);
  const [fixedTracks, setFixedTracks] = useState<TrackMeta[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFixes, setAiFixes] = useState<import("@/lib/validation/types").AiFix[] | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track mutations
  const updateTrack = useCallback((idx: number, key: keyof TrackMeta, val: string) => {
    setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
    setResults(null);
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
        setTracks(mapped.map((t, i) => ({ ...t, trackNumber: t.trackNumber || String(i + 1) })));
        setResults(null);
      },
      error: (err) => setCsvError(err.message),
    });
  };

  // Run validation
  const runValidation = () => {
    setIsRunning(true);
    const raw = validateRelease(tracks);
    setResults(raw.map((r) => ({ ...r, _fixed: false })));
    setFixedTracks([...tracks]);
    setAiFixes(null);
    setSavedId(null);
    setIsRunning(false);
  };

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
    fixable.forEach((r) => {
      const idx = r.trackIndex ?? 0;
      const fieldKey = resolveFieldKey(r.field);
      if (fieldKey) {
        updated = updated.map((t, i) => i === idx ? { ...t, [fieldKey]: r.suggestion! } : t);
        appliedRules.add(`${r.rule}:${r.trackIndex ?? -1}`);
      }
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
    try {
      // We pass the current tracks and the validation results so the AI knows what to fix
      const res = await fetch("/api/ai/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks, results }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI request failed");
      
      // The AI returns an array of fixes: { trackIndex, field, original, fixed, reason }
      setAiFixes(json.data?.fixes ?? []);
    } catch (err) {
      console.error("AI Fix Error:", err);
      alert(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
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
      <div className="flex gap-2 mb-8">
        {(["single", "multi", "csv"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setTracks(m === "csv" ? [] : [emptyTrack(1)]); setResults(null); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              mode === m
                ? "border-accent bg-accent/10 text-accent-bright"
                : "border-border text-text-muted hover:border-border-bright hover:text-text"
            }`}
          >
            {m === "single" ? "Single Track" : m === "multi" ? "Multi-Track" : "Upload CSV"}
          </button>
        ))}
      </div>

      {/* CSV Upload */}
      {mode === "csv" && (
        <div className="mb-6">
          <div
            className="rounded-xl border-2 border-dashed border-border hover:border-accent/50 transition-colors p-10 text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-2xl mb-3">📂</p>
            <p className="text-text-muted text-sm mb-1">Click to upload or drag & drop your CSV</p>
            <p className="text-xs font-mono text-text-dim">DistroKid, TuneCore, CD Baby export formats supported</p>
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
          {tracks.length > 0 && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-green/10 border border-green/20">
              <p className="text-sm text-green font-mono">{tracks.length} tracks loaded from CSV</p>
            </div>
          )}
        </div>
      )}

      {/* Track forms */}
      {(mode !== "csv" || tracks.length > 0) && (
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
          className="w-full py-4 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-bright transition-colors glow-teal disabled:opacity-50"
        >
          {isRunning ? "Scanning…" : "Run Validation →"}
        </button>
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
                  className="px-4 py-2 rounded-lg bg-green/10 border border-green/20 text-sm text-green font-mono hover:bg-green/20 transition-colors"
                >
                  Saved ✓ View →
                </a>
              )}
            </div>
          </div>

          {/* AI suggestions (Pro) */}
          <div className="rounded-xl border border-border bg-bg-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm text-text">AI Suggestions</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent-bright border border-accent/20 font-mono">Pro</span>
              </div>
              <button
                onClick={runAiFixes}
                disabled={aiLoading}
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-mono hover:bg-accent-bright transition-colors disabled:opacity-50"
              >
                {aiLoading ? "Analysing…" : "Get AI Fixes →"}
              </button>
            </div>
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
                <h3 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-3">
                  {sev === "critical" ? "🔴" : sev === "warning" ? "🟡" : "🔵"}{" "}
                  {sev === "critical" ? "Critical Issues" : sev === "warning" ? "Warnings" : "Suggestions"}{" "}
                  <span className="normal-case">({items.length})</span>
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
