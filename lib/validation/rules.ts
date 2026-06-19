import type { TrackMeta, ValidationResult, Grade, DistributorProfile } from "./types";
import { DEFAULT_PROFILE } from "./profiles";

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/;
const UPC_RE = /^\d{12,13}$/;
// ISWC: T- followed by 9 digits and a check digit, e.g. T-123.456.789-0 (separators optional).
const ISWC_RE = /^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$/i;
// Emoji detection — broad unicode ranges
const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

// Words kept lowercase in DSP title case unless first/last word of the title.
const TITLE_SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor",
  "of", "on", "onto", "or", "over", "the", "to", "with", "via", "vs", "per",
]);

/** Apply DSP-style title case: capitalise the first/last word and all major words. */
function toTitleCase(title: string): string {
  const parts = title.split(" ");
  return parts
    .map((w, i) => {
      if (!w) return w;
      const isEdge = i === 0 || i === parts.length - 1;
      if (!isEdge && TITLE_SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** First or last word of the title isn't capitalised (and the title isn't all-caps/all-lowercase). */
function needsTitleCaseFix(title: string): boolean {
  const words = title.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const startsUpper = (w: string) => /^[^A-Za-z]*[A-Z]/.test(w) || !/[A-Za-z]/.test(w);
  return !startsUpper(words[0]) || !startsUpper(words[words.length - 1]);
}

/**
 * A version descriptor (Remix/Live/Acoustic…) trailing the title without brackets.
 * DSPs require these in parentheses, e.g. "Song (Live)". We only match a trailing
 * descriptor so legitimate words like "Live Your Life" don't trip the rule.
 */
function detectUnbracketedVersion(title: string): { keyword: string; fixed: string } | null {
  const m = title.match(/[\s-]+(remix|live|acoustic|instrumental|unplugged|remaster(?:ed)?|demo)\s*$/i);
  if (!m || m.index === undefined) return null;
  const keyword = m[1];
  const base = title.slice(0, m.index).replace(/[-\s]+$/, "").trim();
  if (!base) return null;
  const cap = keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
  return { keyword, fixed: `${base} (${cap})` };
}

/** Sum of split percentages in a free-text splits field, or null if none are present. */
function parseSplitsTotal(splits: string): number | null {
  const matches = [...splits.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (!matches.length) return null;
  return matches.reduce((sum, m) => sum + parseFloat(m[1]), 0);
}

function add(
  results: ValidationResult[],
  rule: string,
  field: string,
  severity: ValidationResult["severity"],
  message: string,
  suggestion?: string,
  fixable = false,
  trackIndex?: number
) {
  results.push({ rule, field, severity, message, suggestion, fixable, ...(trackIndex !== undefined ? { trackIndex } : {}) });
}

/** Validate a single track. Pass trackIndex for multi-track context, profile to tune per-distributor rules. */
export function validateTrack(
  track: TrackMeta,
  trackIndex?: number,
  profile: DistributorProfile = DEFAULT_PROFILE
): ValidationResult[] {
  const r: ValidationResult[] = [];
  const a = (
    rule: string,
    field: string,
    severity: ValidationResult["severity"],
    message: string,
    suggestion?: string,
    fixable = false
  ) => add(r, rule, field, severity, message, suggestion, fixable, trackIndex);

  // ── ISRC ──────────────────────────────────────────────────────────
  if (!track.isrc?.trim()) {
    // DistroKid / CD Baby / TuneCore assign an ISRC for free, so a blank one is
    // only informational on those profiles — flagging it critical is a false alarm.
    if (profile.autoAssignsIsrc) {
      a("isrc_missing", "ISRC", "suggestion", `No ISRC — ${profile.name} will auto-assign one, but supply your own if this recording already has it.`);
    } else {
      a("isrc_missing", "ISRC", "critical", "Missing ISRC — royalty tracking will fail across all platforms.", "Get one from usisrc.org or your distributor.");
    }
  } else {
    const normalized = track.isrc.replace(/-/g, "").toUpperCase();
    if (!ISRC_RE.test(normalized)) {
      a("isrc_format", "ISRC", "critical", `"${track.isrc}" is not a valid ISRC. Format: CC-XXX-YY-NNNNN (12 chars).`);
    }
  }

  // ── Title ─────────────────────────────────────────────────────────
  if (!track.title?.trim()) {
    a("title_empty", "Title", "critical", "Track title is empty.");
  } else {
    const letters = track.title.replace(/[^A-Za-z]/g, "");
    if (letters.length > 3 && track.title === track.title.toUpperCase()) {
      a("title_caps", "Title", "warning", "ALL CAPS title — DSPs like Apple Music reject or auto-reformat all-caps titles.", toTitleCase(track.title.toLowerCase()), true);
    } else if (letters.length > 3 && track.title === track.title.toLowerCase()) {
      // all-lowercase is just as non-compliant with the Apple Music Style Guide.
      a("title_lowercase", "Title", "warning", "all-lowercase title — DSPs expect title case (first and last word capitalised).", toTitleCase(track.title), true);
    } else if (profile.enforceTitleCase && needsTitleCaseFix(track.title)) {
      a("title_titlecase", "Title", "suggestion", "Title case expected — the first and last word of a title should be capitalised.", toTitleCase(track.title), true);
    }
    const version = detectUnbracketedVersion(track.title);
    if (version) {
      a("title_version_format", "Title", "warning", `Version info ("${version.keyword}") should be in parentheses, e.g. "Song (${version.keyword.charAt(0).toUpperCase() + version.keyword.slice(1).toLowerCase()})" — required by Apple Music & most DSPs.`, version.fixed, true);
    }
    if (/\bft\.?\s/i.test(track.title) && !/\(feat\.\s/i.test(track.title)) {
      a("title_feat", "Title", "warning", 'Featured artist should use "(feat. Name)" format — "ft." is often rejected by DSPs.');
    }
    if (track.title !== track.title.trim()) {
      a("title_ws", "Title", "warning", "Leading or trailing whitespace in title.", track.title.trim(), true);
    }
    if (EMOJI_RE.test(track.title)) {
      a("title_special_chars", "Title", "warning", "Emoji or special characters in title may be rejected by some DSPs.");
    }
    // Parentheses check
    const open = (track.title.match(/\(/g) || []).length;
    const close = (track.title.match(/\)/g) || []).length;
    if (open !== close) {
      a("title_parens", "Title", "critical", "Unbalanced parentheses in title — will be rejected by most DSPs.");
    }
  }

  // ── Artist ────────────────────────────────────────────────────────
  if (!track.artist?.trim()) {
    const sev = profile.requirePerformerCredit ? "critical" : "warning";
    a("artist_empty", "Artist", sev, "Primary artist name is empty.");
  }

  // ── Album ─────────────────────────────────────────────────────────
  if (track.album && !track.album.trim()) {
    a("album_empty", "Album", "warning", "Album title is empty or just whitespace.");
  }

  // ── Songwriters ───────────────────────────────────────────────────
  if (!track.songwriters?.trim()) {
    a("no_writers", "Songwriters", "critical", "No songwriters listed — blocks publishing royalties via PROs and the MLC.");
  }

  // ── Writer splits & ISWC ──────────────────────────────────────────
  if (track.splits?.trim()) {
    const total = parseSplitsTotal(track.splits);
    if (total === null) {
      a("splits_format", "Splits", "suggestion", "Couldn't read any percentages in the splits field — use e.g. \"Jane Doe 50%, John Roe 50%\".");
    } else if (Math.abs(total - 100) > 0.5) {
      a("splits_total", "Splits", "critical", `Writer splits total ${total}%, not 100% — publishing royalties won't match correctly and may land in the MLC black box.`);
    }
  } else if (track.songwriters?.trim()) {
    a("no_splits", "Splits", "suggestion", "No writer splits defined — specify each writer's share (totalling 100%) so the MLC and PROs can match publishing royalties.");
  }
  if (track.iswc?.trim() && !ISWC_RE.test(track.iswc.trim())) {
    a("iswc_format", "ISWC", "warning", `"${track.iswc}" is not a valid ISWC. Format: T-123.456.789-0.`);
  } else if (!track.iswc?.trim() && track.songwriters?.trim()) {
    a("no_iswc", "ISWC", "suggestion", "No ISWC for this composition — registering one helps the MLC match mechanical royalties to your song.");
  }

  // ── Producers ─────────────────────────────────────────────────────
  if (!track.producers?.trim()) {
    if (profile.requireProducerCredit) {
      a("no_producer", "Producers", "critical", `${profile.name} requires at least one producer credit per track.`);
    } else {
      a("no_producer", "Producers", "warning", "No producer credited — affects master royalties and SoundExchange payments.");
    }
  }

  // ── Copyright ─────────────────────────────────────────────────────
  if (!track.copyright?.trim()) {
    const fix = `℗ ${new Date().getFullYear()} ${track.artist?.trim() || "Your Name"}`;
    a("no_copyright", "Copyright", "warning", "Copyright line (℗) is missing — required for rights identification.", fix, true);
  } else {
    const yearMatch = track.copyright.match(/\d{4}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      const currentYear = new Date().getFullYear();
      if (year > currentYear + 1) {
        a("copyright_future", "Copyright", "critical", `Copyright year ${year} is too far in the future.`);
      } else if (year < currentYear - 50) {
        a("copyright_old", "Copyright", "warning", `Copyright year ${year} seems very old. Ensure this is correct.`);
      }
    }
  }

  // ── Genre ─────────────────────────────────────────────────────────
  if (!track.genre?.trim()) {
    a("no_genre", "Genre", "warning", "Genre missing — hurts playlist discoverability on Spotify and Apple Music.");
  }

  // ── Explicit flag ─────────────────────────────────────────────────
  if (!track.explicit?.trim()) {
    a("no_explicit", "Explicit", "warning", "Explicit content flag not set — required by all major DSPs.", undefined, false);
  }

  // ── Language ──────────────────────────────────────────────────────
  if (!track.language?.trim()) {
    a("no_lang", "Language", "suggestion", "Language not specified — defaults to English but should be explicit.", "en", true);
  }

  // ── Label ─────────────────────────────────────────────────────────
  if (!track.label?.trim()) {
    a("no_label", "Label", "suggestion", "Label name missing — self-released artists should use their artist name.", track.artist?.trim() || undefined, !!track.artist?.trim());
  }

  // ── Release date & editorial-pitch timeline ───────────────────────
  if (track.releaseDate?.trim()) {
    const releaseDate = new Date(track.releaseDate);
    if (isNaN(releaseDate.getTime())) {
      // An unparseable date silently passed every comparison below, so a typo
      // like "Marhc 2026" produced zero feedback. Flag it instead.
      a("date_invalid", "Release Date", "critical", `"${track.releaseDate}" is not a valid date — use YYYY-MM-DD.`);
    } else {
      const now = new Date();
      const days = Math.ceil((releaseDate.getTime() - now.getTime()) / 86_400_000);
      if (days < 0) {
        a("date_past", "Release Date", "suggestion", "Release date is in the past — fine for back-catalogue, but you can't pitch to editors or land on Release Radar.");
      } else if (days < 7) {
        a("date_too_soon", "Release Date", "warning", `Only ${days} day(s) until release — past Spotify's 7-day editorial cutoff, so you forfeit the Release Radar guarantee. Distributor review can add another 1–3 days.`);
      } else if (days < 14) {
        a("date_pitch_suboptimal", "Release Date", "suggestion", `${days} days out — enough to pitch, but tracks submitted 14+ days ahead see roughly double the editorial consideration. Consider pushing the date back.`);
      }
    }
  }

  // ── Duration ──────────────────────────────────────────────────────
  if (!track.duration?.trim()) {
    a("duration_missing", "Duration", "suggestion", "No track duration specified — some distributors require this field.");
  }

  // ── Featured Artist Consistency ───────────────────────────────────
  if (track.title && /\(feat\.\s([^)]+)\)/i.test(track.title)) {
    const match = track.title.match(/\(feat\.\s([^)]+)\)/i);
    const nameInTitle = match ? match[1].trim() : "";
    if (nameInTitle && track.featuredArtists && !track.featuredArtists.includes(nameInTitle)) {
      a("feat_consistency", "Featured Artists", "suggestion", `"${nameInTitle}" is in the title but not in the featured artists field.`, nameInTitle, false);
    }
  }

  return r;
}

/** Validate a full release (multi-track checks on top of per-track). */
export function validateRelease(
  tracks: TrackMeta[],
  profile: DistributorProfile = DEFAULT_PROFILE
): ValidationResult[] {
  const all: ValidationResult[] = [];

  // Per-track validation
  tracks.forEach((track, idx) => {
    validateTrack(track, idx, profile).forEach((result) => all.push(result));
  });

  // Release-level checks
  const releaseResults: ValidationResult[] = [];
  const releaseAdd = (
    rule: string, field: string, severity: ValidationResult["severity"],
    message: string, suggestion?: string, fixable = false
  ) => releaseResults.push({ rule, field, severity, message, suggestion, fixable });

  // Duplicate ISRCs
  const isrcs = tracks
    .map((t, i) => ({ isrc: t.isrc?.replace(/-/g, "").toUpperCase(), idx: i }))
    .filter((x) => x.isrc);
  const seen = new Map<string, number>();
  isrcs.forEach(({ isrc, idx }) => {
    if (isrc) {
      if (seen.has(isrc)) {
        releaseAdd(
          "isrc_duplicate",
          "ISRC",
          "critical",
          `Duplicate ISRC "${isrc}" on track ${idx + 1} — ISRCs must be unique per recording.`
        );
      } else {
        seen.set(isrc, idx);
      }
    }
  });

  // Artist consistency across tracks
  const artists = [...new Set(tracks.map((t) => t.artist?.trim()).filter(Boolean))];
  if (artists.length > 1) {
    releaseAdd(
      "artist_consistency",
      "Artist",
      "warning",
      `Primary artist name differs between tracks: ${artists.map((a) => `"${a}"`).join(", ")}. Ensure consistency.`
    );
  }

  // Track number gaps or duplicates
  const trackNums = tracks
    .map((t) => parseInt(t.trackNumber || "", 10))
    .filter((n) => !isNaN(n));
  if (trackNums.length === tracks.length && trackNums.length > 1) {
    const sorted = [...trackNums].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        releaseAdd(
          "track_number_gaps",
          "Track Number",
          "warning",
          `Track numbers are not sequential (found: ${sorted.join(", ")}). DSPs expect 1, 2, 3…`
        );
        break;
      }
    }
    const dupNums = trackNums.filter((n, i) => trackNums.indexOf(n) !== i);
    if (dupNums.length > 0) {
      releaseAdd(
        "track_number_gaps",
        "Track Number",
        "warning",
        `Duplicate track numbers: ${dupNums.join(", ")}.`
      );
    }
  }

  // UPC missing at release level (check on first track as proxy)
  const hasUpc = tracks.some((t) => t.upc?.trim());
  if (!hasUpc) {
    if (profile.autoAssignsUpc) {
      releaseAdd("upc_missing", "UPC", "suggestion", `No UPC/barcode — ${profile.name} will assign one automatically.`);
    } else {
      releaseAdd("upc_missing", "UPC", "warning", "No UPC/barcode set for this release — required for distribution on all major DSPs.");
    }
  } else {
    const badUpc = tracks.find((t) => t.upc && !UPC_RE.test(t.upc.replace(/-/g, "")));
    if (badUpc) {
      releaseAdd("upc_format", "UPC", "critical", `UPC "${badUpc.upc}" is invalid — must be 12 or 13 digits.`);
    }
  }

  // Genre consistency
  const genres = [...new Set(tracks.map((t) => t.genre?.trim()).filter(Boolean))];
  if (genres.length > 1) {
    releaseAdd(
      "genre_consistency",
      "Genre",
      "suggestion",
      `Multiple genres across tracks: ${genres.map((g) => `"${g}"`).join(", ")}. Consider using a single primary genre for better DSP categorisation.`
    );
  }

  // MLC / publishing registration reminder — ASCAP/BMI registration does NOT
  // register the work with the MLC, where ~$1B of mechanical royalties sits
  // unclaimed due to missing registrations.
  if (tracks.some((t) => t.songwriters?.trim())) {
    releaseAdd(
      "mlc_register",
      "Publishing",
      "suggestion",
      "Register these compositions with the MLC (themlc.com) and your PRO — ASCAP/BMI registration alone does not collect MLC mechanical royalties."
    );
  }

  return [...releaseResults, ...all];
}

/** Compute a letter grade from validation results. */
export function getGrade(results: ValidationResult[]): { letter: Grade; color: string; bg: string; label: string } {
  const c = results.filter((r) => r.severity === "critical").length;
  const w = results.filter((r) => r.severity === "warning").length;
  if (c === 0 && w === 0) return { letter: "A", color: "#22c55e", bg: "#052e16", label: "Release ready!" };
  if (c === 0 && w <= 2) return { letter: "B", color: "#84cc16", bg: "#1a2e05", label: "Almost there" };
  if (c <= 1) return { letter: "C", color: "#eab308", bg: "#2e2505", label: "Needs work" };
  if (c <= 3) return { letter: "D", color: "#f97316", bg: "#2e1a05", label: "Major issues" };
  return { letter: "F", color: "#f43f5e", bg: "#2e050d", label: "Critical failures" };
}
