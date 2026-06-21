"use client";

import { useEffect, useMemo, useState } from "react";
import { RULE_META } from "@/lib/validation/ruleCatalogue";
import type { CustomCheck, Severity, SeverityOverride } from "@/lib/validation/custom";

const TRACK_META_KEYS = [
  "trackNumber", "title", "artist", "featuredArtists", "album", "isrc", "upc",
  "genre", "releaseDate", "label", "songwriters", "producers", "composers",
  "copyright", "explicit", "language", "duration", "iswc", "splits", "bpm",
  "musicalKey", "moodTags", "instrumentalAvailable", "cleanVersionAvailable",
  "stemsAvailable", "oneStopClearance", "licensingContact", "aiDisclosure",
];

const SEVERITIES: Severity[] = ["critical", "warning", "suggestion"];

const inputClass =
  "px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all";

export function RulesEditor() {
  const [overrides, setOverrides] = useState<Record<string, SeverityOverride>>({});
  const [checks, setChecks] = useState<CustomCheck[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rule-config")
      .then((r) => r.json())
      .then((j) => {
        const c = j?.data?.config;
        if (c) { setOverrides(c.severityOverrides ?? {}); setChecks(c.customChecks ?? []); }
      })
      .catch(() => {});
  }, []);

  // Group the built-in rules by field for a scannable list.
  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const [id, meta] of Object.entries(RULE_META)) (g[meta.field] ??= []).push(id);
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const setOverride = (id: string, val: string) =>
    setOverrides((prev) => {
      const next = { ...prev };
      if (!val) delete next[id];
      else next[id] = val as SeverityOverride;
      return next;
    });

  const addCheck = () =>
    setChecks((prev) => [...prev, { id: Math.random().toString(36).slice(2, 10), field: "title", type: "required", severity: "warning", message: "" }]);
  const updateCheck = (i: number, patch: Partial<CustomCheck>) =>
    setChecks((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCheck = (i: number) => setChecks((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/rule-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severityOverrides: overrides, customChecks: checks.filter((c) => c.message.trim()) }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Couldn't save."); setStatus("idle"); return; }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setError("Network error.");
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-8">
      {/* Severity overrides */}
      <section>
        <h3 className="font-semibold text-text mb-1">Adjust built-in rules</h3>
        <p className="text-sm text-text-muted mb-4">Re-tune any of the {Object.keys(RULE_META).length}+ rules to your label&apos;s policy — raise, lower, or turn off.</p>
        <div className="space-y-5">
          {grouped.map(([field, ids]) => (
            <div key={field}>
              <p className="eyebrow mb-2">{field}</p>
              <div className="space-y-1.5">
                {ids.map((id) => (
                  <div key={id} className="flex items-center gap-3">
                    <code className="text-xs text-text-muted flex-1 truncate">{id}</code>
                    <select
                      value={overrides[id] ?? ""}
                      onChange={(e) => setOverride(id, e.target.value)}
                      className={`${inputClass} w-36`}
                    >
                      <option value="">Default</option>
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                      <option value="suggestion">Suggestion</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom checks */}
      <section>
        <h3 className="font-semibold text-text mb-1">Custom checks</h3>
        <p className="text-sm text-text-muted mb-4">Require a field, or require it to match a pattern. Runs on every track.</p>
        <div className="space-y-3">
          {checks.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-border bg-surface/40 p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <select value={c.field} onChange={(e) => updateCheck(i, { field: e.target.value })} className={inputClass}>
                  {TRACK_META_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select value={c.type} onChange={(e) => updateCheck(i, { type: e.target.value as CustomCheck["type"] })} className={inputClass}>
                  <option value="required">is required</option>
                  <option value="regex">must match regex</option>
                </select>
                <select value={c.severity} onChange={(e) => updateCheck(i, { severity: e.target.value as Severity })} className={inputClass}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => removeCheck(i)} className="text-xs text-text-muted hover:text-red transition-colors ml-auto">Remove</button>
              </div>
              {c.type === "regex" && (
                <input value={c.pattern ?? ""} onChange={(e) => updateCheck(i, { pattern: e.target.value })} placeholder="Regex pattern, e.g. ^[A-Z]" className={`${inputClass} w-full`} />
              )}
              <input value={c.message} onChange={(e) => updateCheck(i, { message: e.target.value })} placeholder="Message shown when it fails" maxLength={200} className={`${inputClass} w-full`} />
            </div>
          ))}
          <button onClick={addCheck} className="press text-sm text-accent-bright hover:underline">+ Add a custom check</button>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="press px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save rules"}
        </button>
        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </div>
  );
}
