import type { TrackMeta, ValidationResult, Grade } from "./types";

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/;
const UPC_RE = /^\d{12,13}$/;
// Emoji detection — broad unicode ranges
const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

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

/** Validate a single track. Pass trackIndex for multi-track context. */
export function validateTrack(track: TrackMeta, trackIndex?: number): ValidationResult[] {
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
    a("isrc_missing", "ISRC", "critical", "Missing ISRC — royalty tracking will fail across all platforms.", "Get one from usisrc.org or your distributor.");
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
    if (track.title === track.title.toUpperCase() && track.title.replace(/\s/g, "").length > 3) {
      const fixed = track.title
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      a("title_caps", "Title", "warning", "ALL CAPS title — most DSPs prefer title case.", fixed, true);
    }
    if (/\bft\.?\s/i.test(track.title) && !/\(feat\.\s/.test(track.title)) {
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
    a("artist_empty", "Artist", "critical", "Primary artist name is empty.");
  }

  // ── Album ─────────────────────────────────────────────────────────
  if (track.album && !track.album.trim()) {
    a("album_empty", "Album", "warning", "Album title is empty or just whitespace.");
  }

  // ── Songwriters ───────────────────────────────────────────────────
  if (!track.songwriters?.trim()) {
    a("no_writers", "Songwriters", "critical", "No songwriters listed — blocks publishing royalties via PROs and the MLC.");
  }

  // ── Producers ─────────────────────────────────────────────────────
  if (!track.producers?.trim()) {
    a("no_producer", "Producers", "warning", "No producer credited — affects master royalties and SoundExchange payments.");
    if (track.songwriters?.trim()) {
      a("producer_no_writer", "Songwriters", "warning", "Producers listed but no songwriters — usually producers should also be credited as songwriters for publishing.");
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

  // ── Release date ──────────────────────────────────────────────────
  if (track.releaseDate) {
    const releaseDate = new Date(track.releaseDate);
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (releaseDate < now) {
      a("date_past", "Release Date", "suggestion", "Release date is in the past — this may cause issues with retrospective distribution.");
    } else if (releaseDate < sevenDaysOut) {
      a("date_too_soon", "Release Date", "warning", "Release date is fewer than 7 days away — Spotify editorial pitch requires 7+ days lead time.");
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
export function validateRelease(tracks: TrackMeta[]): ValidationResult[] {
  const all: ValidationResult[] = [];

  // Per-track validation
  tracks.forEach((track, idx) => {
    validateTrack(track, idx).forEach((result) => all.push(result));
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
    releaseAdd(
      "upc_missing",
      "UPC",
      "warning",
      "No UPC/barcode set for this release — required for distribution on all major DSPs."
    );
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
