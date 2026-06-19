import type { TrackMeta } from "@/lib/validation/types";

const COLUMNS: { key: keyof TrackMeta; header: string }[] = [
  { key: "trackNumber", header: "Track #" },
  { key: "title", header: "Title" },
  { key: "artist", header: "Artist" },
  { key: "featuredArtists", header: "Featured Artists" },
  { key: "isrc", header: "ISRC" },
  { key: "upc", header: "UPC" },
  { key: "genre", header: "Genre" },
  { key: "releaseDate", header: "Release Date" },
  { key: "songwriters", header: "Songwriters" },
  { key: "splits", header: "Splits" },
  { key: "iswc", header: "ISWC" },
  { key: "producers", header: "Producers" },
  { key: "composers", header: "Composers" },
  { key: "copyright", header: "Copyright" },
  { key: "explicit", header: "Explicit" },
  { key: "language", header: "Language" },
  { key: "label", header: "Label" },
  { key: "duration", header: "Duration" },
  { key: "album", header: "Album" },
  // AI-disclosure + Sync-Ready metadata — exported so the round-trip
  // (export → re-import) preserves everything the newer panels capture.
  { key: "aiDisclosure", header: "AI Disclosure" },
  { key: "bpm", header: "BPM" },
  { key: "musicalKey", header: "Key" },
  { key: "moodTags", header: "Mood Tags" },
  { key: "instrumentalAvailable", header: "Instrumental Available" },
  { key: "cleanVersionAvailable", header: "Clean Version Available" },
  { key: "stemsAvailable", header: "Stems Available" },
  { key: "oneStopClearance", header: "One-Stop Clearance" },
  { key: "licensingContact", header: "Licensing Contact" },
];

function escapeCell(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportCsv(tracks: TrackMeta[], filename = "metacheck-export.csv"): void {
  const header = COLUMNS.map((c) => c.header).join(",");
  const rows = tracks.map((track) =>
    COLUMNS.map((c) => escapeCell((track[c.key] as string) ?? "")).join(",")
  );
  const csv = [header, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
