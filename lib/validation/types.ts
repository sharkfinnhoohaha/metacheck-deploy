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
  /** International Standard Musical Work Code — identifies the composition for publishing. */
  iswc?: string;
  /** Writer splits, e.g. "Jane Doe 50%, John Roe 50%" — must total 100%. */
  splits?: string;
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

/**
 * A distributor / DSP rule profile. Distributors differ on what they require vs.
 * auto-assign (DistroKid auto-assigns ISRC + UPC; Apple mandates a producer and
 * performer credit), so the same metadata can be "ready" for one and rejected by
 * another. A profile tunes the engine's thresholds without forking the rules.
 */
export type DistributorProfile = {
  id: string;
  name: string;
  /** Distributor auto-assigns an ISRC, so a missing one is informational, not critical. */
  autoAssignsIsrc: boolean;
  /** Distributor auto-assigns a UPC/barcode for the release. */
  autoAssignsUpc: boolean;
  /** Distributor (e.g. Apple) rejects releases without at least one producer credit. */
  requireProducerCredit: boolean;
  /** Distributor rejects releases without at least one performer/artist credit. */
  requirePerformerCredit: boolean;
  /** Enforce DSP title-case style (first/last word capitalised, no all-caps/all-lowercase). */
  enforceTitleCase: boolean;
};

/** Result of validating a release's cover artwork against DSP submission specs. */
export type ArtworkCheckResult = {
  severity: "critical" | "warning" | "suggestion" | "success";
  rule: string;
  message: string;
};
