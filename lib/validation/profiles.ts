import type { DistributorProfile } from "./types";

/**
 * Per-distributor validation profiles. The differences below are drawn from each
 * distributor's published behaviour:
 *  - DistroKid and CD Baby auto-assign ISRCs and a release UPC for free, so a
 *    blank code is fine — flagging it critical produces false alarms.
 *  - Apple Music's Style Guide mandates at least one performer credit and one
 *    producer credit, and is the strictest on title casing.
 *  - TuneCore assigns ISRC/UPC but still surfaces them, so we keep them as
 *    warnings rather than criticals.
 * The "generic" profile is the conservative default used when no distributor is
 * chosen — it assumes nothing is auto-assigned.
 */
export const PROFILES: Record<string, DistributorProfile> = {
  generic: {
    id: "generic",
    name: "Generic / Unsure",
    autoAssignsIsrc: false,
    autoAssignsUpc: false,
    requireProducerCredit: false,
    requirePerformerCredit: true,
    enforceTitleCase: true,
    aiPolicy: "disclose",
  },
  distrokid: {
    id: "distrokid",
    name: "DistroKid",
    autoAssignsIsrc: true,
    autoAssignsUpc: true,
    requireProducerCredit: false,
    requirePerformerCredit: true,
    enforceTitleCase: true,
    // DistroKid permits AI music but requires a 4-category disclosure.
    aiPolicy: "disclose",
  },
  cdbaby: {
    id: "cdbaby",
    name: "CD Baby",
    autoAssignsIsrc: true,
    autoAssignsUpc: true,
    requireProducerCredit: false,
    requirePerformerCredit: true,
    enforceTitleCase: true,
    // CD Baby prohibits fully AI-generated music.
    aiPolicy: "ban",
  },
  tunecore: {
    id: "tunecore",
    name: "TuneCore",
    autoAssignsIsrc: true,
    autoAssignsUpc: true,
    requireProducerCredit: false,
    requirePerformerCredit: true,
    enforceTitleCase: true,
    // TuneCore / Believe block tracks made with unlicensed AI tools (Suno, Udio).
    aiPolicy: "restricted",
  },
  apple: {
    id: "apple",
    name: "Apple Music (strict)",
    autoAssignsIsrc: false,
    autoAssignsUpc: false,
    requireProducerCredit: true,
    requirePerformerCredit: true,
    enforceTitleCase: true,
    aiPolicy: "disclose",
  },
};

export const DEFAULT_PROFILE = PROFILES.generic;

export function getProfile(id?: string): DistributorProfile {
  return (id && PROFILES[id]) || DEFAULT_PROFILE;
}
