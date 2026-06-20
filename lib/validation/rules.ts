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
  // "Strong" descriptors are rarely ordinary trailing title words, so they match
  // standalone. "Weak" descriptors (mix/edit/version/live/demo…) are common words,
  // so they only count when preceded by a known qualifier (Radio Edit, Club Mix) —
  // this avoids mangling legit titles like "Going Live", "New Version", "The Mix".
  const strong = title.match(/[\s-]+(remix|acoustic|instrumental|unplugged|remaster(?:ed)?|karaoke|sped[\s-]?up|slowed)\s*$/i);
  const weak = title.match(/[\s-]+((?:radio|extended|club|original|album|single|studio|piano|dance|deluxe|clean|dirty|main|dub|tv)\s+(?:edit|version|mix|mono|stereo|vip|rework|reprise|live|demo|dub))\s*$/i);
  const m = strong || weak;
  if (!m || m.index === undefined) return null;
  const keyword = m[1].trim();
  const base = title.slice(0, m.index).replace(/[-\s]+$/, "").trim();
  if (!base) return null;
  // Title-case the descriptor words.
  const cap = keyword.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return { keyword, fixed: `${base} (${cap})` };
}

// ── Reddit-sourced rejection heuristics ─────────────────────────────────────
// Promotional / redundant words DSPs strip or reject in titles.
const BANNED_TITLE_WORDS = [
  "original mix", "out now", "free download", "promo", "teaser", "snippet",
  "exclusive", "preview", "full version",
];
// Store / DSP names don't belong in a title.
const STORE_NAMES = [
  "spotify", "apple music", "itunes", "beatport", "soundcloud", "youtube",
  "tidal", "deezer", "amazon music", "bandcamp", "audiomack",
];
// URLs, @handles, emails in a title → rejection.
const URL_HANDLE_RE = /(https?:\/\/|www\.|\.com\b|\.net\b|@[a-z0-9_]{2,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
// Decorative / non-standard unicode beyond emoji: math alphanumerics (𝓯𝓪𝓷𝓬𝔂),
// fullwidth ASCII variants, enclosed alphanumerics (①②), box-drawing. Deliberately
// EXCLUDES combining diacritics (legit accented Latin, esp. NFD-decomposed) and
// letterlike symbols (℗ ™ № are standard in music metadata).
const DECORATIVE_UNICODE_RE = /[\u{1D400}-\u{1D7FF}\u{FF01}-\u{FF5E}\u{2460}-\u{24FF}\u{2500}-\u{257F}]/u;
// SEO / playlist-bait filler terms; flagged only in combination + a long title.
const SEO_FILLER = new Set([
  "lofi", "lo-fi", "chill", "study", "relax", "relaxing", "sleep", "ambient",
  "beats", "music", "night", "drive", "focus", "calm", "instrumental",
  "background", "playlist", "vibes", "aesthetic", "mix", "deep", "meditation",
]);
// Artist names that are pure genre/function strings — caught by spam filters.
const GENERIC_ARTIST = new Set([
  "lofi", "lo-fi", "lofi beats", "sleep music", "study music", "relaxing music",
  "white noise", "rain sounds", "meditation music", "workout", "chill beats",
  "background music", "various artists",
]);
// Non-genres that hurt discoverability when used as the primary genre.
const GENERIC_GENRES = new Set(["music", "other", "misc", "miscellaneous", "n/a", "none", "unknown"]);
// Placeholder credits Apple (and others) reject.
const PLACEHOLDER_RE = /\b(tbd|tba|pending|n\/?a|unknown|coming soon|placeholder)\b/i;
// Small, word-boundaried explicit-content list (kept tight to avoid false hits).
const PROFANITY_RE = /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|n[i1]gga\w*|motherfuck\w*|asshole\w*)\b/i;

/** GS1 mod-10 check-digit validation for a 12-digit UPC-A or 13-digit EAN-13. */
function upcCheckDigitValid(digits: string): boolean {
  if (!/^\d{12,13}$/.test(digits)) return false;
  const d = digits.split("").map(Number);
  const check = d[d.length - 1];
  const body = d.slice(0, -1).reverse();
  // From the rightmost body digit, odd positions ×3.
  const sum = body.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Parse "mm:ss", "h:mm:ss" or a raw seconds string into seconds, or null. */
function parseDurationSeconds(v: string): number | null {
  const s = v.trim();
  // Integer-only for the bare-number branch — a bare decimal like "3.45" is
  // ambiguous (3.45s? 3m45s?), so let it fall through and raise no warning.
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + parseInt(p, 10), 0);
}

/** Normalised identity key for an artist name (casing/punctuation/diacritics-insensitive). */
function normalizeArtistKey(name: string): string {
  return name
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Detect a guest-credit syntax in the title (not just trailing "ft."). Limited to
 * feat./ft./featuring — bare "with" is far too common in normal titles ("Dancing
 * with Myself", "Come Away with Me") to treat as a featured credit.
 */
function detectGuestInTitle(title: string): string | null {
  const m = title.match(/[([]?\s*(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)/i);
  return m ? m[1].trim().replace(/[)\]]+$/, "").trim() : null;
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
      if (UPC_RE.test(normalized)) {
        a("isrc_is_upc", "ISRC", "critical", `"${track.isrc}" looks like a UPC (12–13 digits), not an ISRC. They differ: ISRC identifies the recording (CC-XXX-YY-NNNNN), UPC identifies the release/product. Move it to the UPC field.`);
      } else {
        a("isrc_format", "ISRC", "critical", `"${track.isrc}" is not a valid ISRC. Format: CC-XXX-YY-NNNNN (12 chars).`);
      }
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
    // Featured artist anywhere in the title (not just trailing "ft.").
    const guest = detectGuestInTitle(track.title);
    if (guest && !/\(feat\. [^)]+\)/.test(track.title)) {
      const stripped = track.title
        .replace(/\s*[([]?\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]]+[)\]]?\s*$/i, "")
        .trim();
      if (stripped && stripped !== track.title) {
        a("title_feat_in_title", "Title", "warning", `Featured artist in the title — DSPs want the lowercase "(feat. Name)" form, and the guest also belongs in the Featured Artists field. Bare / "ft." / "with" / bracketed forms get rejected or linked to the wrong profile.`, `${stripped} (feat. ${guest})`, true);
      } else {
        a("title_feat_in_title", "Title", "warning", `Move the featured artist "${guest}" out of the title into the Featured Artists field — and use the "(feat. ${guest})" form if it stays. Bare / "ft." / "with" forms get rejected or mislinked.`);
      }
    }
    // Promotional / store / URL noise in the title.
    const lowerTitle = track.title.toLowerCase();
    const banned = BANNED_TITLE_WORDS.find((w) => lowerTitle.includes(w));
    if (banned) {
      a("title_banned_word", "Title", "warning", `"${banned}" doesn't belong in a track title — DSPs strip or reject promotional words. Put version info in parentheses and drop promo text.`);
    }
    const store = STORE_NAMES.find((w) => lowerTitle.includes(w));
    if (store) {
      a("title_store_name", "Title", "warning", `Store/platform name "${store}" in the title is rejected by DSPs — remove it.`);
    }
    if (URL_HANDLE_RE.test(track.title)) {
      a("title_url", "Title", "critical", "URL, @handle or email in the title is an automatic rejection — remove it.");
    }
    // Keyword-stuffed / playlist-bait titles (2025 spam filter).
    const titleWords = track.title.split(/\s+/).filter(Boolean);
    const fillerHits = titleWords.filter((w) => SEO_FILLER.has(w.toLowerCase().replace(/[^a-z-]/g, ""))).length;
    if (titleWords.length > 7 && fillerHits >= 2) {
      a("title_keyword_stuffing", "Title", "warning", "Keyword-stuffed title — Spotify's spam filter de-ranks (and can penalise the whole account for) titles packed with playlist-bait terms. Trim it to the actual song name.");
    }
    if (track.title !== track.title.trim()) {
      a("title_ws", "Title", "warning", "Leading or trailing whitespace in title.", track.title.trim(), true);
    }
    if (/\s{2,}/.test(track.title.trim())) {
      a("title_double_space", "Title", "suggestion", "Double spaces in the title — collapse to single spaces.", track.title.replace(/\s+/g, " ").trim(), true);
    }
    if (EMOJI_RE.test(track.title)) {
      a("title_special_chars", "Title", "warning", "Emoji in the title may be stripped or rejected by some DSPs.");
    } else if (DECORATIVE_UNICODE_RE.test(track.title.normalize("NFC"))) {
      a("title_unicode_decorative", "Title", "warning", "Decorative/stylised unicode (fancy fonts, fullwidth or enclosed characters) gets normalised or rejected — use plain text.");
    }
    // Bracket balance (parentheses + square brackets).
    const open = (track.title.match(/\(/g) || []).length;
    const close = (track.title.match(/\)/g) || []).length;
    if (open !== close) {
      a("title_parens", "Title", "critical", "Unbalanced parentheses in title — will be rejected by most DSPs.");
    }
    const sqOpen = (track.title.match(/\[/g) || []).length;
    const sqClose = (track.title.match(/\]/g) || []).length;
    if (sqOpen !== sqClose) {
      a("title_brackets", "Title", "warning", "Unbalanced square brackets in title.");
    }
  }

  // ── Artist ────────────────────────────────────────────────────────
  if (!track.artist?.trim()) {
    const sev = profile.requirePerformerCredit ? "critical" : "warning";
    a("artist_empty", "Artist", sev, "Primary artist name is empty.");
  } else if (GENERIC_ARTIST.has(track.artist.trim().toLowerCase())) {
    a("artist_generic_seo", "Artist", "warning", `"${track.artist.trim()}" is a generic/SEO-style artist name — Spotify's spam crackdown de-ranks or rejects function-word artist names like this. Use a distinct project name.`);
  }

  // ── Album ─────────────────────────────────────────────────────────
  if (track.album && !track.album.trim()) {
    a("album_empty", "Album", "warning", "Album title is empty or just whitespace.");
  }

  // ── Songwriters ───────────────────────────────────────────────────
  if (!track.songwriters?.trim()) {
    a("no_writers", "Songwriters", "critical", "No songwriters listed — blocks publishing royalties via PROs and the MLC.");
  }

  // Placeholder credits (TBD / Pending / N/A) — rejected, Apple especially.
  const creditFields: [string, string | undefined][] = [
    ["Songwriters", track.songwriters], ["Producers", track.producers],
    ["Composers", track.composers], ["Featured Artists", track.featuredArtists],
  ];
  for (const [label, val] of creditFields) {
    const m = val?.match(PLACEHOLDER_RE);
    if (m) {
      a("placeholder_credit", label, profile.id === "apple" ? "critical" : "warning", `Placeholder text ("${m[0]}") in ${label} — DSPs (Apple especially) reject TBD/Pending/N/A credits. Use real names or leave it blank.`);
    }
  }
  // Writer credits should be full legal names, not a stage name/handle (Spotify/MLC).
  // Only flag unambiguous non-legal-name signals: handles, digits, or a single
  // token (missing a last name) — never "writer == artist", since a solo artist
  // legitimately using their real name for both is the common case.
  if (track.songwriters?.trim()) {
    const writers = track.songwriters.split(/[,;]/).map((w) => w.trim()).filter(Boolean);
    const suspect = writers.find((w) => /[@\d]/.test(w) || !/\s/.test(w));
    if (suspect) {
      a("writer_legal_name", "Songwriters", "suggestion", `"${suspect}" looks like a stage name or handle — PROs and the MLC require each writer's full legal name (first + last). It only appears in the credits panel, never as your public artist name.`);
    }
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
  } else if (GENERIC_GENRES.has(track.genre.trim().toLowerCase())) {
    a("genre_too_broad", "Genre", "suggestion", `"${track.genre.trim()}" is too generic — pick a specific sub-genre so Spotify and Apple match the right playlists and algorithmic stations.`);
  }

  // ── Explicit flag ─────────────────────────────────────────────────
  if (!track.explicit?.trim()) {
    a("no_explicit", "Explicit", "warning", "Explicit content flag not set — required by all major DSPs.", undefined, false);
  } else {
    const ex = track.explicit.trim().toLowerCase();
    const marksClean = ex === "false" || ex === "no" || ex === "clean" || ex === "0";
    if (marksClean && PROFANITY_RE.test(track.title || "")) {
      a("explicit_mismatch", "Explicit", "warning", "The title contains explicit language but the track is flagged clean/non-explicit — mismatched explicit flags get clean versions rejected and explicit tracks left unmarked.");
    }
  }

  // ── Language ──────────────────────────────────────────────────────
  if (!track.language?.trim()) {
    a("no_lang", "Language", "suggestion", "Language not specified — defaults to English but should be explicit.", "en", true);
  } else {
    const lang = track.language.trim().toLowerCase();
    const nonLatin = ["ja", "ko", "zh", "ar", "ru", "hi", "he", "th", "el", "fa", "ur", "bn"];
    const titleArtist = `${track.title || ""} ${track.artist || ""}`;
    if (nonLatin.includes(lang) && /^[\x00-\x7F]*$/.test(titleArtist)) {
      a("language_charset_mismatch", "Language", "suggestion", `Metadata language is "${lang}" but the title/artist are plain ASCII — this field describes the script of the typed metadata, not the sung language. Double-check it matches.`);
    }
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
      const lead = profile.reviewLeadDays;
      const effective = days - lead; // days of pitch lead-time after the distributor delivers
      if (days < 0) {
        a("date_past", "Release Date", "warning", "Release date is in the past — fine for back-catalogue, but you can't pitch to editors or land on Release Radar.");
      } else if (days === 0) {
        a("date_today", "Release Date", "warning", "Releasing today — too late to pitch editorially or qualify for Release Radar. Schedule future releases 2–4 weeks out.");
      } else if (effective < 7) {
        a("date_too_soon", "Release Date", "warning", `Only ${days} day(s) out, and ${profile.name} typically takes ~${lead} day(s) to deliver — so it reaches Spotify inside the 7-day editorial cutoff and forfeits the Release Radar guarantee. Push the date back.`);
      } else if (effective < 14) {
        a("date_pitch_suboptimal", "Release Date", "suggestion", `~${effective} day(s) of lead time after ${profile.name}'s delivery — enough to pitch, but 14+ days ahead sees roughly double the editorial consideration. Consider pushing the date back.`);
      }
    }
  } else {
    a("date_missing", "Release Date", "warning", "No release date set — most distributors push an undated release live immediately, which forfeits editorial pitching and Release Radar. Set a future date 2–4 weeks out.");
  }

  // ── Duration ──────────────────────────────────────────────────────
  if (!track.duration?.trim()) {
    a("duration_missing", "Duration", "suggestion", "No track duration specified — some distributors require this field.");
  } else {
    const secs = parseDurationSeconds(track.duration);
    const isFunctional = /noise|white\s*noise|sleep|rain|ambient|nature|asmr|binaural|lo-?fi/i.test(track.genre || "");
    // A duration of 0 means "unknown/unset", not a literal 0-second track.
    if (secs !== null && secs > 0) {
      if (secs < 30) {
        a("duration_too_short", "Duration", "warning", `Only ${Math.round(secs)}s long — under Spotify's 30-second royalty threshold, so it earns nothing and can be flagged.`);
      } else if (secs <= 35 && !isFunctional) {
        a("duration_farming", "Duration", "suggestion", "Just over 30 seconds — Spotify scrutinises tracks chopped to ~31s to farm the royalty threshold. Make sure the length is genuine.");
      }
      if (isFunctional && secs >= 30 && secs < 120) {
        a("functional_min_length", "Duration", "suggestion", "Functional audio (sleep/ambient/noise) under ~2 minutes is increasingly demonetised — these tracks are expected to run longer.");
      }
    }
  }

  // ── Featured Artist Consistency ───────────────────────────────────
  if (track.title && /\(feat\.\s([^)]+)\)/i.test(track.title)) {
    const match = track.title.match(/\(feat\.\s([^)]+)\)/i);
    const nameInTitle = match ? match[1].trim() : "";
    if (nameInTitle && track.featuredArtists && !track.featuredArtists.includes(nameInTitle)) {
      a("feat_consistency", "Featured Artists", "suggestion", `"${nameInTitle}" is in the title but not in the featured artists field.`, nameInTitle, false);
    }
  }

  // ── AI disclosure (per-distributor policy) ─────────────────────────
  // Distributors diverged hard on AI music in 2025–26: CD Baby bans fully-AI
  // tracks, TuneCore/Believe block unlicensed AI tools, DistroKid permits with a
  // disclosure. The same track can be shippable on one and bannable on another.
  const ai = (track.aiDisclosure || "").trim().toLowerCase();
  const usesAi = ai === "ai-assisted" || ai === "ai-vocals" || ai === "fully-ai";
  if (!ai) {
    a("ai_disclosure_missing", "AI Disclosure", "suggestion", "AI use isn't declared — Spotify and Apple now surface AI credits and most distributors ask at upload. Set this to none / ai-assisted / ai-vocals / fully-ai.");
  } else if (usesAi) {
    const heavy = ai === "fully-ai" || ai === "ai-vocals";
    if (profile.aiPolicy === "ban") {
      a("ai_policy_ban", "AI Disclosure", heavy ? "critical" : "warning", `${profile.name} prohibits AI-generated music — a "${ai}" track will be taken down. Move it to a distributor that allows disclosed AI (e.g. DistroKid).`);
    } else if (profile.aiPolicy === "restricted") {
      a("ai_policy_restricted", "AI Disclosure", heavy ? "critical" : "warning", `${profile.name} blocks tracks made with unlicensed AI tools (e.g. Suno, Udio). Confirm your AI tool grants commercial rights or this "${ai}" release will be rejected.`);
    } else if (profile.aiPolicy === "disclose") {
      a("ai_policy_disclose", "AI Disclosure", "warning", `Declare "${ai}" in ${profile.name}'s AI-disclosure form at upload — undisclosed AI is a takedown risk now that Spotify/Apple show AI credits.`);
    } else {
      a("ai_policy_open", "AI Disclosure", "suggestion", `${profile.name} has no stated AI policy, but disclose "${ai}" anyway — DSP-level AI labelling still applies downstream.`);
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
  const artists = [...new Set(tracks.map((t) => t.artist?.trim()).filter(Boolean))] as string[];
  if (artists.length > 1) {
    releaseAdd(
      "artist_consistency",
      "Artist",
      "warning",
      `Primary artist name differs between tracks: ${artists.map((a) => `"${a}"`).join(", ")}. Ensure consistency.`
    );
  }
  // Casing/punctuation-only variants spawn a DUPLICATE artist profile on Spotify.
  const artistKeys = new Map<string, Set<string>>();
  for (const name of artists) {
    const k = normalizeArtistKey(name);
    if (!artistKeys.has(k)) artistKeys.set(k, new Set());
    artistKeys.get(k)!.add(name);
  }
  for (const variants of artistKeys.values()) {
    if (variants.size > 1) {
      releaseAdd(
        "artist_casing_split",
        "Artist",
        "critical",
        `Primary artist credited as ${[...variants].map((v) => `"${v}"`).join(" and ")} — these differ only in capitalisation/punctuation. Spotify treats them as different artists and splits the release across two profiles. Make the spelling identical.`
      );
    }
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
      const norm = badUpc.upc!.replace(/-/g, "").toUpperCase();
      if (ISRC_RE.test(norm)) {
        releaseAdd("upc_is_isrc", "UPC", "critical", `"${badUpc.upc}" looks like an ISRC (a per-recording code), not a UPC (the release barcode). Move it to the ISRC field.`);
      } else {
        releaseAdd("upc_format", "UPC", "critical", `UPC "${badUpc.upc}" is invalid — must be 12 or 13 digits.`);
      }
    } else {
      // Right length but wrong GS1 check digit → almost always a typo.
      const badCheck = tracks.find((t) => t.upc && !upcCheckDigitValid(t.upc.replace(/-/g, "")));
      if (badCheck) {
        releaseAdd("upc_checkdigit", "UPC", "critical", `UPC "${badCheck.upc}" has the right length but an invalid check digit — it was likely mis-typed. Re-copy it from your distributor.`);
      }
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

  // SoundExchange registration — for the master/recording side (distinct from MLC).
  if (tracks.some((t) => t.isrc?.trim() || t.producers?.trim())) {
    releaseAdd(
      "soundexchange_register",
      "Publishing",
      "suggestion",
      'Register your recordings with SoundExchange (soundexchange.com) too — an ISRC existing does not register it, and unregistered masters leave digital-performance / neighbouring-rights royalties unclaimed under "Unknown Artist".'
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
  // Fold warning volume into the lower tiers so two releases with the same critical
  // count are still differentiated by their warnings (~3 warnings ≈ 1 critical).
  // Previously the ladder keyed off criticals alone, so 1 crit + 40 warnings graded
  // the same C as 1 crit + 0 warnings.
  const score = c + Math.floor(w / 3);
  if (score <= 1) return { letter: "C", color: "#eab308", bg: "#2e2505", label: "Needs work" };
  if (score <= 3) return { letter: "D", color: "#f97316", bg: "#2e1a05", label: "Major issues" };
  return { letter: "F", color: "#f43f5e", bg: "#2e050d", label: "Critical failures" };
}
