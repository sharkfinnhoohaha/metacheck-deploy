/**
 * Client-side audio analysis types. The whole audio module runs in the browser
 * (Web Audio API) — the master file never leaves the device, mirroring the
 * artwork-QC pattern. Nothing here touches the network or the server.
 */

/** Decoded PCM, ready for DSP. Channels are Float32 in [-1, 1]. */
export type DecodedAudio = {
  channels: Float32Array[];
  sampleRate: number;
  /** Seconds. */
  duration: number;
};

/** Loudness + peak measurements for a master, all client-side. */
export type LoudnessMeasurement = {
  /** Integrated (program) loudness, LUFS (ITU-R BS.1770-4). */
  integratedLufs: number;
  /** Loudness range, LU (EBU TECH 3342). */
  loudnessRangeLu: number;
  /** Maximum true peak, dBTP (4× oversampled). */
  truePeakDbtp: number;
  /** Maximum sample peak, dBFS. */
  samplePeakDbfs: number;
  /** Count of consecutive-full-scale clipping runs detected. */
  clippingEvents: number;
};

/** Estimated tempo/key — advisory, surfaced with a confidence so we never assert a wrong value. */
export type TempoKeyEstimate = {
  bpm: number | null;
  /** 0–1; below ~0.5 we treat the estimate as untrustworthy and stay quiet. */
  bpmConfidence: number;
  key: string | null;
  keyConfidence: number;
};

export type AudioAnalysis = {
  sampleRate: number;
  duration: number;
  channelCount: number;
  loudness: LoudnessMeasurement;
  tempoKey: TempoKeyEstimate;
};

/** One line in the audio report. Mirrors ArtworkCheckResult so the UI can share a row component. */
export type AudioCheckResult = {
  severity: "critical" | "warning" | "suggestion" | "success";
  rule: string;
  message: string;
};

/** Per-DSP loudness target used to predict normalization turn-down. */
export type DspLoudnessTarget = {
  name: string;
  /** Reference loudness the platform normalizes toward, LUFS. */
  targetLufs: number;
  /** Recommended true-peak ceiling for masters delivered to this platform, dBTP. */
  ceilingDbtp: number;
  /** Whether the platform turns quiet tracks UP by default (most only turn loud tracks down). */
  turnsUp: boolean;
};
