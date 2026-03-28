export type TrackMeta = {
  trackNumber?: string;
  title: string;
  artist: string;
  featuredArtists?: string;
  album?: string;
  isrc?: string;
  upc?: string;
  genre?: string;
  releaseDate?: string;
  label?: string;
  songwriters?: string;
  producers?: string;
  composers?: string;
  copyright?: string;
  explicit?: string;
  language?: string;
  duration?: string;
};

export type ValidationResult = {
  rule: string;
  field: string;
  trackIndex?: number;
  severity: "critical" | "warning" | "suggestion";
  message: string;
  suggestion?: string;
  fixable: boolean;
};

export type Grade = "A" | "B" | "C" | "D" | "F";

export type AiFix = {
  trackIndex: number;
  field: string;
  original: string;
  fixed: string;
  reason: string;
};
