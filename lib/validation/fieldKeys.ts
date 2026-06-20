import type { TrackMeta } from "./types";

/**
 * Maps a ValidationResult.field / AiFix.field (a human label from the engine,
 * e.g. "Copyright" or "Release Date") to its real TrackMeta key. Matching on
 * form labels ("Copyright (℗)", "UPC / Barcode") silently fails, so this map is
 * the single source of truth shared by the validate page and the public demo.
 */
export const RESULT_FIELD_TO_KEY: Record<string, keyof TrackMeta> = {
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

/** Resolve an engine/AI field label to a TrackMeta key via the shared map. */
export function resolveResultFieldKey(field: string): keyof TrackMeta | undefined {
  return RESULT_FIELD_TO_KEY[field.toLowerCase().trim()];
}
