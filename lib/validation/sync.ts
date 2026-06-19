import type { TrackMeta } from "./types";

/**
 * Sync-Ready scoring — assesses how licensable a track is for film / TV / ads /
 * games. Music supervisors filter dozens of submissions a day and reject on the
 * "paperwork around the music", not the music: can I clear it fast from one
 * party (clearable), do I have the versions I need (usable), and can I find it
 * by mood/BPM/key (discoverable). This mirrors the Guild of Music Supervisors
 * and SyncSummit readiness checklists.
 *
 * Pure, client-side, deterministic — scores out of 100 across three weighted
 * dimensions so the result is stable and explainable.
 */

export type SyncCategory = "clearable" | "usable" | "discoverable";

export type SyncCheck = {
  severity: "critical" | "warning" | "suggestion" | "success";
  category: SyncCategory;
  /** Points this check is worth toward the 100-point score. */
  weight: number;
  /** Whether the track earned the points. */
  earned: boolean;
  message: string;
};

export type SyncReadiness = {
  /** 0–100. */
  score: number;
  tier: "Sync-ready" | "Nearly there" | "Not sync-ready";
  /** Sub-scores per dimension (earned / possible). */
  breakdown: Record<SyncCategory, { earned: number; possible: number }>;
  checks: SyncCheck[];
};

const CATEGORY_LABEL: Record<SyncCategory, string> = {
  clearable: "Clearable",
  usable: "Usable",
  discoverable: "Discoverable",
};

export { CATEGORY_LABEL };

/** Truthy interpretation of a free-text yes/no field. */
function isYes(v?: string): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "available";
}

/** Sum of split percentages in a free-text splits field, or null if none present. */
function splitsTotal(splits?: string): number | null {
  if (!splits) return null;
  const matches = [...splits.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (!matches.length) return null;
  return matches.reduce((sum, m) => sum + parseFloat(m[1]), 0);
}

function looksLikeEmail(v?: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v || "").trim());
}

export function checkSyncReadiness(track: TrackMeta): SyncReadiness {
  const checks: SyncCheck[] = [];
  const add = (
    category: SyncCategory,
    weight: number,
    earned: boolean,
    earnedMsg: string,
    missingMsg: string,
    missingSeverity: SyncCheck["severity"] = "warning"
  ) => {
    checks.push({
      category,
      weight,
      earned,
      severity: earned ? "success" : missingSeverity,
      message: earned ? earnedMsg : missingMsg,
    });
  };

  // ── Clearable (40 pts) — the #1 supervisor filter ──────────────────
  add(
    "clearable", 15, isYes(track.oneStopClearance),
    "One-stop clearance — a supervisor can license master + publishing from one party.",
    "No one-stop clearance flagged. Supervisors strongly prefer one party who controls both master and publishing — declare it if you do.",
    "critical"
  );
  const total = splitsTotal(track.splits);
  add(
    "clearable", 10, total !== null && Math.abs(total - 100) <= 0.5,
    "Writer splits documented and total 100% — clearance won't stall on a missing split sheet.",
    total === null
      ? "No writer splits on file. A missing split sheet is the most common reason a sync deal dies — add each writer's share totalling 100%."
      : `Writer splits total ${total}%, not 100% — fix before pitching for sync.`,
    "critical"
  );
  add(
    "clearable", 10, looksLikeEmail(track.licensingContact),
    "Reachable licensing contact on file.",
    "No licensing contact email. Supervisors work on deadline — give them a direct address for clearance requests.",
    "warning"
  );
  add(
    "clearable", 5, !!track.songwriters?.trim(),
    "Songwriters credited — ownership is traceable.",
    "No songwriters listed — ownership is unclear, which blocks clearance.",
    "warning"
  );

  // ── Usable (35 pts) — do I have the versions I need? ───────────────
  add(
    "usable", 15, isYes(track.instrumentalAvailable),
    "Instrumental version available — works under dialogue.",
    "No instrumental version. This is the single biggest deliverable gap — most placements need a vocal-free version to sit under dialogue.",
    "critical"
  );
  add(
    "usable", 8, isYes(track.cleanVersionAvailable),
    "Clean version available — safe for broadcast and brand spots.",
    "No clean version. Ads and broadcast usually require a no-profanity edit.",
    "warning"
  );
  add(
    "usable", 7, isYes(track.stemsAvailable),
    "Stems available — editors can re-cut to picture.",
    "No stems. Offering stems lets editors tailor the cue to a scene and meaningfully raises licensability.",
    "suggestion"
  );
  add(
    "usable", 5, !!track.duration?.trim(),
    "Duration specified.",
    "No duration on file — supervisors filter by runtime; add it.",
    "suggestion"
  );

  // ── Discoverable (25 pts) — can I find it in a search? ─────────────
  const bpmNum = parseInt((track.bpm || "").replace(/[^\d]/g, ""), 10);
  add(
    "discoverable", 8, !isNaN(bpmNum) && bpmNum >= 40 && bpmNum <= 300,
    `BPM tagged (${bpmNum}) — turns up in tempo-filtered searches.`,
    "No BPM. Tempo is a hard search filter in every sync library — a track without it is effectively invisible.",
    "warning"
  );
  add(
    "discoverable", 6, !!track.musicalKey?.trim(),
    "Musical key tagged.",
    "No musical key. Helps supervisors match a cue to existing score.",
    "suggestion"
  );
  const moodCount = (track.moodTags || "").split(",").map((s) => s.trim()).filter(Boolean).length;
  add(
    "discoverable", 8, moodCount >= 2,
    `Mood tags present (${moodCount}) — searchable by vibe and scene.`,
    "Fewer than two mood tags. Supervisors search by feeling ('hopeful', 'tense', 'cinematic') — add a handful of specific, non-generic tags.",
    "warning"
  );
  add(
    "discoverable", 3, !!track.genre?.trim(),
    "Genre tagged.",
    "No genre tag — add one for basic discoverability.",
    "suggestion"
  );

  // ── Tally ──────────────────────────────────────────────────────────
  const breakdown: SyncReadiness["breakdown"] = {
    clearable: { earned: 0, possible: 0 },
    usable: { earned: 0, possible: 0 },
    discoverable: { earned: 0, possible: 0 },
  };
  for (const c of checks) {
    breakdown[c.category].possible += c.weight;
    if (c.earned) breakdown[c.category].earned += c.weight;
  }
  const score = Math.round(
    Object.values(breakdown).reduce((s, b) => s + b.earned, 0)
  );
  const tier: SyncReadiness["tier"] =
    score >= 80 ? "Sync-ready" : score >= 50 ? "Nearly there" : "Not sync-ready";

  return { score, tier, breakdown, checks };
}
