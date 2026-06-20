/**
 * Migration Pre-Flight — the single most irreversible action in a catalog's life.
 *
 * When you switch distributors (or re-upload a remaster), the new distributor
 * auto-assigns FRESH ISRC/UPC codes unless you explicitly reuse the old ones — and
 * the moment the identifiers (or even the exact title) differ, the stores treat it
 * as a brand-new release: streams reset to zero, playlist placements drop, and your
 * Spotify/Apple URLs break. This diffs the OLD live release against the NEW upload
 * and surfaces the invisible killers (transposed digits, smart quotes, trailing
 * spaces, accent normalisation) that a human eye — and a chatbot — slides right past.
 *
 * Pure + deterministic. The old display fields can be auto-filled from the iTunes
 * proxy; the old ISRC/UPC come from the user's old-distributor dashboard (the search
 * API doesn't expose them).
 */

export type MigrationInput = {
  isrc?: string;
  upc?: string;
  title?: string;
  artist?: string;
  duration?: string;
};

export type MigrationFieldStatus = "match" | "differ" | "invisible" | "missing-old" | "missing-new" | "empty";

export type MigrationField = {
  key: keyof MigrationInput;
  label: string;
  oldValue: string;
  newValue: string;
  status: MigrationFieldStatus;
  severity: "critical" | "warning" | "suggestion" | "success";
  note: string;
};

export type MigrationReport = {
  fields: MigrationField[];
  /** No critical/warning diffs across the identifiers + title. */
  safe: boolean;
  /** Number of critical+warning diffs. */
  blocking: number;
  headline: string;
  subline: string;
  /** The correct order of operations — getting this backwards is what kills streams. */
  takedownSteps: string[];
  /** True once the user has entered enough of the old release to compare. */
  hasOldData: boolean;
};

// ── helpers ──────────────────────────────────────────────────────────────────
function normCode(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function parseSeconds(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return null;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** If two strings look identical but aren't byte-identical, name the invisible cause. */
function invisibleCause(a: string, b: string): string | null {
  if (a === b) return null;
  const canon = (s: string) =>
    s.normalize("NFC")
      .replace(/[‘’′]/g, "'")
      .replace(/[“”″]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  if (canon(a) !== canon(b)) return null; // genuinely different text
  if (a.trim() !== a || b.trim() !== b) return "leading/trailing whitespace";
  if (/\s{2,}/.test(a) || /\s{2,}/.test(b)) return "a double space";
  const smart = /[‘’“”–—]/;
  if (smart.test(a) !== smart.test(b)) return "smart vs straight quotes/dashes";
  if (a.normalize("NFC") !== a || b.normalize("NFC") !== b) return "unicode accent normalisation";
  if (a.toLowerCase() === b.toLowerCase()) return "capitalisation";
  return "an invisible character difference";
}

function codeField(
  key: "isrc" | "upc",
  label: string,
  oldRaw: string,
  newRaw: string,
): MigrationField {
  const o = oldRaw.trim();
  const n = newRaw.trim();
  if (!o && !n) {
    return { key, label, oldValue: o, newValue: n, status: "empty", severity: "suggestion",
      note: `No ${label} on either side. If you have one on the old release, reuse the exact same code.` };
  }
  if (o && !n) {
    return { key, label, oldValue: o, newValue: n, status: "missing-new", severity: "critical",
      note: `The new upload has no ${label} — your distributor will auto-assign a fresh one and the stores will treat this as a NEW recording. Streams reset to zero. Reuse ${o}.` };
  }
  if (!o && n) {
    return { key, label, oldValue: o, newValue: n, status: "missing-old", severity: "suggestion",
      note: `Enter the old release's ${label} (from your previous distributor) so we can confirm it matches.` };
  }
  if (normCode(o) === normCode(n)) {
    return { key, label, oldValue: o, newValue: n, status: "match", severity: "success",
      note: `${label} matches — the stores will link the new upload to your existing release.` };
  }
  return { key, label, oldValue: o, newValue: n, status: "differ", severity: "critical",
    note: `${label} DIFFERS (often a transposed digit). The stores link on this code — a mismatch resets streams and playlist placement to zero. Make the new upload use ${o}.` };
}

function textField(
  key: "title" | "artist",
  label: string,
  oldRaw: string,
  newRaw: string,
): MigrationField {
  // Compare the RAW strings — trimming here would hide the exact invisible
  // differences (trailing spaces, etc.) this check exists to catch.
  if (!oldRaw.trim() || !newRaw.trim()) {
    return { key, label, oldValue: oldRaw.trim(), newValue: newRaw.trim(), status: oldRaw.trim() ? "missing-new" : "missing-old", severity: "suggestion",
      note: `Fill both sides to compare the ${label.toLowerCase()}.` };
  }
  if (oldRaw === newRaw) {
    return { key, label, oldValue: oldRaw, newValue: newRaw, status: "match", severity: "success", note: `${label} matches exactly.` };
  }
  const cause = invisibleCause(oldRaw, newRaw);
  if (cause) {
    return { key, label, oldValue: oldRaw, newValue: newRaw, status: "invisible", severity: "warning",
      note: `${label} looks identical but differs by ${cause}. DSPs match on the exact string — this can stop the new upload linking to the old release.` };
  }
  return { key, label, oldValue: oldRaw, newValue: newRaw, status: "differ", severity: "warning",
    note: `${label} differs from the live release. DSPs link on exact metadata, so a changed ${label.toLowerCase()} may create a separate page instead of updating the existing one.` };
}

export function diffMigration(oldRel: MigrationInput, newRel: MigrationInput): MigrationReport {
  const fields: MigrationField[] = [
    codeField("isrc", "ISRC", oldRel.isrc ?? "", newRel.isrc ?? ""),
    codeField("upc", "UPC", oldRel.upc ?? "", newRel.upc ?? ""),
    textField("title", "Title", oldRel.title ?? "", newRel.title ?? ""),
    textField("artist", "Artist", oldRel.artist ?? "", newRel.artist ?? ""),
  ];

  // Duration (fingerprint tolerance).
  const oDur = parseSeconds(oldRel.duration);
  const nDur = parseSeconds(newRel.duration);
  if (oDur != null && nDur != null) {
    const delta = Math.abs(oDur - nDur);
    fields.push(
      delta <= 2
        ? { key: "duration", label: "Duration", oldValue: oldRel.duration!, newValue: newRel.duration!, status: "match", severity: "success", note: "Duration matches within fingerprint tolerance." }
        : { key: "duration", label: "Duration", oldValue: oldRel.duration!, newValue: newRel.duration!, status: "differ", severity: "warning",
            note: `Duration differs by ${Math.round(delta)}s. If this is the same recording, audio-fingerprint matching may fail and the stores won't link the two. (A genuine remaster/edit is fine — just expect a fresh release.)` }
    );
  } else {
    fields.push({ key: "duration", label: "Duration", oldValue: oldRel.duration ?? "", newValue: newRel.duration ?? "", status: "empty", severity: "suggestion", note: "Add both runtimes to check fingerprint match." });
  }

  const hasOldData = !!(oldRel.isrc?.trim() || oldRel.upc?.trim() || oldRel.title?.trim());
  const blocking = fields.filter((f) => f.severity === "critical" || f.severity === "warning").length;
  const criticals = fields.filter((f) => f.severity === "critical").length;
  const safe = blocking === 0 && hasOldData;

  let headline: string;
  let subline: string;
  if (!hasOldData) {
    headline = "Enter your old release to check";
    subline = "Paste the old release's ISRC/UPC (from your previous distributor) or search to auto-fill its title — then we'll diff it against this upload.";
  } else if (criticals > 0) {
    headline = `STOP — ${criticals} identifier ${criticals === 1 ? "mismatch" : "mismatches"} will reset your streams`;
    subline = "The stores link a re-upload to your existing release by its codes and exact metadata. Fix the criticals below before you deliver, or you'll start from zero plays and lose your playlist spots.";
  } else if (blocking > 0) {
    headline = `Risky — ${blocking} difference${blocking === 1 ? "" : "s"} could break linking`;
    subline = "The identifiers line up, but the metadata below differs. DSP linking is best-effort and matches on the exact string — tighten these to be safe.";
  } else {
    headline = "Safe to migrate";
    subline = "Identifiers and metadata match the live release. Follow the order below so the switch is seamless and your streams carry over.";
  }

  const takedownSteps = [
    "Upload the NEW release with the SAME ISRC + UPC as the old one — never let the distributor auto-assign fresh codes.",
    "Wait until the new upload is LIVE on every store (Spotify, Apple, etc.) — confirm each one shows it.",
    "ONLY THEN take down the old release at your previous distributor.",
    "Keep the old distribution active until the new is confirmed live — pulling it first is what loses streams and breaks links.",
  ];

  return { fields, safe, blocking, headline, subline, takedownSteps, hasOldData };
}
