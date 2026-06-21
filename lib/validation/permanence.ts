/**
 * Permanence taxonomy — the framing the pivot is built on.
 *
 * The validation engine already finds the issues; this layer reframes each one
 * around irreversibility: what it costs you to fix AFTER you hit distribute. That
 * "it's forever" cost line is the moat for the free front door — the same checks a
 * distributor does silently, but presented as "stop, this is permanent."
 *
 * Pure, deterministic, client-side. No new rules — just classification.
 */

import type { ValidationResult } from "./types";

export type PermanenceLevel = "permanent" | "recoverable" | "advisory";

export type Permanence = {
  level: PermanenceLevel;
  /** One-line "cost to undo after release" explanation. */
  costToUndo: string;
};

// Fields that identify the RECORDING/COMPOSITION or route money — effectively
// locked once the release is live; fixing means a takedown + re-release.
const RIGHTS_FIELDS = new Set([
  "isrc", "upc", "splits", "songwriters", "composers", "producers", "iswc", "copyright",
]);

// Fields shown to listeners everywhere and cached by DSPs — changing them after
// release usually requires pulling the release and re-delivering.
const IDENTITY_FIELDS = new Set([
  "title", "artist", "featured artists", "featured artist", "album", "explicit", "version",
]);

// Fields most distributors let you edit after release (slow to propagate).
const RECOVERABLE_FIELDS = new Set([
  "genre", "language", "label", "mood", "mood tags", "bpm", "key", "musical key",
  "instrumental", "clean version", "stems", "one-stop clearance", "licensing contact",
  "ai disclosure", "track number",
]);

const COST = {
  rights:
    "Locked to the recording. Fixing this after release means a takedown + re-upload — a new release date, lost streams and playlist spots. Once royalties have flowed, split fixes can mean clawbacks.",
  identity:
    "Shown everywhere and cached by the stores. Changing it after release usually needs a takedown + re-release — you lose your release date, pre-saves and any playlist placements.",
  date:
    "You can't un-miss a release date. Editorial pitching and the new-music window close the moment you go live.",
  recoverable:
    "Editable after release through your distributor, but it can take days to propagate — and you may already have lost discovery in the meantime.",
  advisory:
    "Not permanent — an opportunity to capture more streams or sync placements before you release.",
};

function normField(field: string): string {
  return field.toLowerCase().replace(/\(.*?\)/g, "").replace(/[℗©]/g, "").replace(/\s+/g, " ").trim();
}

export function classifyPermanence(result: ValidationResult): Permanence {
  const field = normField(result.field);
  const rule = result.rule.toLowerCase();

  // Release-date issues are their own kind of irreversible.
  if (field.includes("release date") || rule.startsWith("date_") || rule.includes("release_date") || rule.includes("pitch")) {
    // Pure "pitch sooner" optimisation is advisory; a missed/invalid/past date is permanent.
    if (result.severity === "suggestion" && !rule.includes("invalid") && !rule.includes("past") && !rule.includes("today")) {
      return { level: "advisory", costToUndo: COST.advisory };
    }
    return { level: "permanent", costToUndo: COST.date };
  }

  if (RIGHTS_FIELDS.has(field) || /isrc|upc|split|songwriter|composer|producer|iswc|copyright/.test(rule)) {
    return { level: "permanent", costToUndo: COST.rights };
  }

  if (IDENTITY_FIELDS.has(field) || /title|artist|explicit|feat|album|version/.test(rule)) {
    // Cosmetic style suggestions on identity fields are recoverable nudges, not stop-the-press.
    if (result.severity === "suggestion") {
      return { level: "recoverable", costToUndo: COST.recoverable };
    }
    return { level: "permanent", costToUndo: COST.identity };
  }

  if (RECOVERABLE_FIELDS.has(field) || /genre|language|label|mood|bpm|key|sync|disclosure|track_number/.test(rule)) {
    if (result.severity === "suggestion") return { level: "advisory", costToUndo: COST.advisory };
    return { level: "recoverable", costToUndo: COST.recoverable };
  }

  // Release-level reminders (MLC/SoundExchange) and anything else → advisory.
  return { level: "advisory", costToUndo: COST.advisory };
}

export type PreflightVerdict = {
  safe: boolean;
  /** Count of permanent-level issues that are critical or warning. */
  permanentCount: number;
  recoverableCount: number;
  advisoryCount: number;
  headline: string;
  subline: string;
};

/**
 * Roll active (outstanding) results into a single "safe to release / STOP" verdict,
 * weighted by permanence rather than raw severity.
 */
export function preflightVerdict(activeResults: ValidationResult[]): PreflightVerdict {
  let permanent = 0, recoverable = 0, advisory = 0;
  for (const r of activeResults) {
    const p = classifyPermanence(r);
    const blocking = r.severity === "critical" || r.severity === "warning";
    if (p.level === "permanent" && blocking) permanent++;
    else if (p.level === "recoverable" && blocking) recoverable++;
    else advisory++;
  }

  if (permanent > 0) {
    return {
      safe: false,
      permanentCount: permanent,
      recoverableCount: recoverable,
      advisoryCount: advisory,
      headline: `STOP — ${permanent} permanent ${permanent === 1 ? "mistake" : "mistakes"} before you release`,
      subline:
        "These get baked into your release the moment you hit distribute. Fixing them later means a takedown, a new release date and lost streams. Fix them now — it's free.",
    };
  }

  if (recoverable > 0) {
    return {
      safe: false,
      permanentCount: 0,
      recoverableCount: recoverable,
      advisoryCount: advisory,
      headline: `Almost safe — ${recoverable} thing${recoverable === 1 ? "" : "s"} to tidy`,
      subline:
        "Nothing here is permanent — these are editable after release — but they're cheaper to fix now than to chase your distributor later.",
    };
  }

  return {
    safe: true,
    permanentCount: 0,
    recoverableCount: 0,
    advisoryCount: advisory,
    headline: "Safe to release",
    subline:
      advisory > 0
        ? "No permanent mistakes. The remaining notes are optional ways to capture more streams or sync placements."
        : "No permanent mistakes, nothing left to fix. Ship it.",
  };
}
