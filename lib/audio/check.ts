/**
 * Audio pre-flight: decode a master in the browser, measure loudness/true-peak,
 * estimate tempo/key, and turn it into plain-English verdicts + a per-DSP
 * normalization matrix. This is the unique capability — a chatbot and a
 * distributor both lack the actual waveform.
 */
"use client";

import { decodeAudioFile } from "./decode";
import { measureLoudness } from "./loudness";
import { estimateTempoKey } from "./tempoKey";
import type { AudioAnalysis, AudioCheckResult, DspLoudnessTarget } from "./types";
import type { TrackMeta } from "../validation/types";

/** Reference loudness + true-peak ceilings the major DSPs normalize toward. */
export const DSP_TARGETS: DspLoudnessTarget[] = [
  { name: "Spotify", targetLufs: -14, ceilingDbtp: -1, turnsUp: true },
  { name: "Apple Music", targetLufs: -16, ceilingDbtp: -1, turnsUp: true },
  { name: "YouTube", targetLufs: -14, ceilingDbtp: -1, turnsUp: false },
  { name: "Amazon Music", targetLufs: -14, ceilingDbtp: -2, turnsUp: true },
  { name: "Tidal", targetLufs: -14, ceilingDbtp: -1, turnsUp: true },
];

export type LoudnessMatrixRow = {
  dsp: string;
  /** Gain the platform applies, dB. Negative = turned down (loudness lost). */
  gainDb: number;
  note: string;
};

export type AudioReport = {
  analysis: AudioAnalysis;
  results: AudioCheckResult[];
  matrix: LoudnessMatrixRow[];
  /** True if any critical/warning surfaced — drives the STOP vs OK headline. */
  hasIssues: boolean;
};

function parseDurationSeconds(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return null;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normaliseKey(k: string): string {
  return k.toLowerCase().replace(/\bmaj(or)?\b/g, "major").replace(/\bmin(or)?\b/g, "minor").replace(/[♯#]/g, "#").replace(/\s+/g, " ").trim();
}

function fmtDb(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}

export async function checkAudioFile(file: File, track?: TrackMeta): Promise<AudioReport> {
  const decoded = await decodeAudioFile(file);
  const loudness = measureLoudness(decoded.channels, decoded.sampleRate);
  const tempoKey = estimateTempoKey(decoded.channels, decoded.sampleRate);

  const analysis: AudioAnalysis = {
    sampleRate: decoded.sampleRate,
    duration: decoded.duration,
    channelCount: decoded.channels.length,
    loudness,
    tempoKey,
  };

  const results: AudioCheckResult[] = [];
  const { integratedLufs, truePeakDbtp, clippingEvents, loudnessRangeLu } = loudness;

  // ── True peak ──────────────────────────────────────────────────────────────
  if (truePeakDbtp > 0) {
    results.push({
      severity: "critical",
      rule: "audio_true_peak",
      message: `True peak is ${fmtDb(truePeakDbtp)} dBTP — over full scale. Lossy transcodes (AAC/MP3/Ogg) WILL add audible distortion on every streaming platform. Re-limit with a ceiling of −1 dBTP (−2 to be safe).`,
    });
  } else if (truePeakDbtp > -1) {
    results.push({
      severity: "warning",
      rule: "audio_true_peak",
      message: `True peak is ${fmtDb(truePeakDbtp)} dBTP. It looks fine on a sample meter, but inter-sample peaks can clip after lossy transcode. Lower your limiter ceiling to −1 dBTP.`,
    });
  }

  // ── Clipping ───────────────────────────────────────────────────────────────
  if (clippingEvents > 0) {
    results.push({
      severity: clippingEvents > 20 ? "critical" : "warning",
      rule: "audio_clipping",
      message: `Detected ${clippingEvents} clipped region${clippingEvents === 1 ? "" : "s"} (runs of full-scale samples) — distortion is baked into the master and is permanent once released.`,
    });
  }

  // ── Loudness vs DSP targets ─────────────────────────────────────────────────
  const matrix: LoudnessMatrixRow[] = DSP_TARGETS.map((t) => {
    let gain = t.targetLufs - integratedLufs; // +ve = turned up, -ve = turned down
    if (gain > 0 && !t.turnsUp) gain = 0; // platforms that only attenuate
    // A platform that turns you up still limits at its ceiling — never pushes past it.
    let note: string;
    if (gain <= -1) note = `Turned down ${fmtDb(gain)} dB`;
    else if (gain >= 1 && t.turnsUp) note = `Turned up ${fmtDb(gain)} dB (limited)`;
    else if (gain >= 1 && !t.turnsUp) note = "Left as-is (quieter than peers)";
    else note = "≈ matched";
    return { dsp: t.name, gainDb: Math.round(gain * 10) / 10, note };
  });

  const spotify = matrix.find((m) => m.dsp === "Spotify")!;
  if (integratedLufs > -13) {
    results.push({
      severity: "suggestion",
      rule: "audio_loud",
      message: `Integrated loudness is ${integratedLufs} LUFS — louder than the −14 LUFS streaming reference. Spotify turns this down ${fmtDb(spotify.gainDb)} dB, so your loudness-war gains are erased on playback. You can master quieter (more dynamic range) and sound identical there, with fewer distortion risks.`,
    });
  } else if (integratedLufs < -17) {
    results.push({
      severity: "suggestion",
      rule: "audio_quiet",
      message: `Integrated loudness is ${integratedLufs} LUFS — quieter than the −14 LUFS reference. On platforms that only turn loud tracks down (e.g. YouTube), you'll sound noticeably weaker than competing releases. Consider mastering closer to −14 LUFS.`,
    });
  }

  // ── Sample rate ─────────────────────────────────────────────────────────────
  if (decoded.sampleRate < 44100) {
    results.push({
      severity: "warning",
      rule: "audio_samplerate",
      message: `Sample rate is ${decoded.sampleRate} Hz — below the 44.1 kHz minimum most DSPs require. Export at 44.1 kHz or higher.`,
    });
  }

  // ── Cross-checks against typed metadata ─────────────────────────────────────
  if (track) {
    const typedDur = parseDurationSeconds(track.duration);
    if (typedDur != null && Math.abs(typedDur - analysis.duration) > 2) {
      results.push({
        severity: "warning",
        rule: "audio_duration_mismatch",
        message: `The audio file is ${formatClock(analysis.duration)} long, but your metadata duration says ${track.duration}. DSPs flag a mismatch between the file and the declared runtime.`,
      });
    }

    if (tempoKey.bpm != null && tempoKey.bpmConfidence >= 0.6) {
      const typedBpm = track.bpm ? parseInt(track.bpm, 10) : null;
      if (typedBpm && Number.isFinite(typedBpm)) {
        const ratio = typedBpm / tempoKey.bpm;
        const isHalfDouble = Math.abs(ratio - 0.5) < 0.06 || Math.abs(ratio - 2) < 0.12;
        const isMatch = Math.abs(typedBpm - tempoKey.bpm) <= 2;
        if (!isMatch && isHalfDouble) {
          results.push({
            severity: "warning",
            rule: "audio_bpm_halfdouble",
            message: `You typed ${typedBpm} BPM but the audio sounds like ~${tempoKey.bpm} BPM — a classic half-time / double-time mix-up. Supervisors filter by BPM, so the wrong value buries the track.`,
          });
        } else if (!isMatch && !isHalfDouble) {
          results.push({
            severity: "suggestion",
            rule: "audio_bpm_mismatch",
            message: `You typed ${typedBpm} BPM but the audio analyses closer to ~${tempoKey.bpm} BPM. Worth double-checking.`,
          });
        }
      }
    }

    if (tempoKey.key && tempoKey.keyConfidence >= 0.55 && track.musicalKey) {
      if (normaliseKey(track.musicalKey) !== normaliseKey(tempoKey.key)) {
        results.push({
          severity: "suggestion",
          rule: "audio_key_mismatch",
          message: `You logged the key as "${track.musicalKey}" but the audio analyses as ~${tempoKey.key} (estimate). Relative major/minor are easy to swap — worth confirming.`,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      severity: "success",
      rule: "audio_ok",
      message: `Master looks clean — ${integratedLufs} LUFS, true peak ${fmtDb(truePeakDbtp)} dBTP, ${loudnessRangeLu} LU range, no clipping. Safe loudness/peak headroom for every major DSP.`,
    });
  }

  const hasIssues = results.some((r) => r.severity === "critical" || r.severity === "warning");
  return { analysis, results, matrix, hasIssues };
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
