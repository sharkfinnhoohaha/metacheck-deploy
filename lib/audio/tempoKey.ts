/**
 * Advisory tempo + key estimation from raw PCM, client-side and dependency-free.
 *
 * These are estimates, NOT assertions — both come back with a confidence and the
 * UI stays silent below a threshold. A wrong BPM/key is worse than none (the whole
 * product thesis is "trust = being right"), so we only ever surface these as a
 * cross-check against what the user typed, or as a low-confidence "looks like…".
 *
 *  - BPM: onset-energy novelty → autocorrelation over a musical lag range, with
 *    half/double-time noted rather than silently folded.
 *  - Key: Krumhansl–Schmuckler — a 12-bin chroma vector correlated against the
 *    classic major/minor key profiles in all 12 rotations.
 */

import type { TempoKeyEstimate } from "./types";

// ── Compact iterative radix-2 FFT (in place) ─────────────────────────────────
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cwr - im[b] * cwi;
        const ti = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr; cwr = ncwr;
      }
    }
  }
}

function downmixMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < channels.length; c++) s += channels[c][i];
    out[i] = s / channels.length;
  }
  return out;
}

// ── BPM via onset novelty + autocorrelation ──────────────────────────────────
function estimateBpm(mono: Float32Array, fs: number): { bpm: number | null; confidence: number; halfDouble: boolean } {
  const hop = 512;
  const frames = Math.floor(mono.length / hop);
  if (frames < 64) return { bpm: null, confidence: 0, halfDouble: false };

  // Onset novelty: half-wave-rectified rise in short-time energy.
  const novelty = new Float32Array(frames);
  let prev = 0;
  let maxNov = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const start = f * hop;
    for (let n = start; n < start + hop && n < mono.length; n++) e += mono[n] * mono[n];
    const logE = Math.log(1e-9 + e);
    const nov = Math.max(0, logE - prev);
    novelty[f] = nov;
    if (nov > maxNov) maxNov = nov;
    prev = logE;
  }

  // Gate: a real beat needs several distinct onsets. A sustained tone (one attack
  // then silence/steady) has none, so we refuse to invent a tempo for it. This is
  // what stops a beatless pad from reporting a confident, spurious BPM.
  if (maxNov <= 0) return { bpm: null, confidence: 0, halfDouble: false };
  const onsetThresh = 0.25 * maxNov;
  let onsets = 0;
  for (let f = 1; f < frames - 1; f++) {
    if (novelty[f] > onsetThresh && novelty[f] >= novelty[f - 1] && novelty[f] >= novelty[f + 1]) onsets++;
  }
  if (onsets < 4) return { bpm: null, confidence: 0, halfDouble: false };

  // Remove DC, then autocorrelate over a musical lag band.
  let mean = 0;
  for (let f = 0; f < frames; f++) mean += novelty[f];
  mean /= frames;
  for (let f = 0; f < frames; f++) novelty[f] -= mean;

  const fps = fs / hop;
  const minBpm = 70, maxBpm = 180;
  const minLag = Math.floor((60 * fps) / maxBpm);
  const maxLag = Math.ceil((60 * fps) / minBpm);

  let bestLag = -1, bestVal = -Infinity;
  const acVals: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    for (let f = 0; f + lag < frames; f++) ac += novelty[f] * novelty[f + lag];
    acVals.push(ac);
    if (ac > bestVal) { bestVal = ac; bestLag = lag; }
  }
  if (bestLag < 0 || acVals.length === 0) return { bpm: null, confidence: 0, halfDouble: false };

  // Confidence = how many standard deviations the winning lag stands above the
  // rest of the band (z-score prominence) — robust whether the mean is +/-.
  let sum = 0, sum2 = 0;
  for (const v of acVals) { sum += v; sum2 += v * v; }
  const m = sum / acVals.length;
  const std = Math.sqrt(Math.max(0, sum2 / acVals.length - m * m));
  const z = std > 0 ? (bestVal - m) / std : 0;
  const confidence = Math.max(0, Math.min(1, z / 4));

  const bpm = Math.round((60 * fps) / bestLag);
  const halfDouble = bpm <= 90 || bpm >= 160; // ambiguous octave band
  return { bpm, confidence, halfDouble };
}

// ── Key via Krumhansl–Schmuckler ─────────────────────────────────────────────
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function chromaVector(mono: Float32Array, fs: number): Float64Array {
  const N = 4096;
  const hop = 4096;
  const chroma = new Float64Array(12);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  const minHz = 55, maxHz = 2000;
  for (let start = 0; start + N <= mono.length; start += hop) {
    for (let i = 0; i < N; i++) { re[i] = mono[start + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const hz = (k * fs) / N;
      if (hz < minHz || hz > maxHz) continue;
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const midi = 69 + 12 * Math.log2(hz / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mag;
    }
  }
  return chroma;
}

function pearson(a: number[] | Float64Array, b: number[] | Float64Array): number {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function estimateKey(mono: Float32Array, fs: number): { key: string | null; confidence: number } {
  const chroma = chromaVector(mono, fs);
  const total = chroma.reduce((s, v) => s + v, 0);
  if (total <= 0) return { key: null, confidence: 0 };

  let best = { corr: -Infinity, name: "" as string };
  let secondCorr = -Infinity;
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = new Float64Array(12);
    for (let i = 0; i < 12; i++) rotated[i] = chroma[(i + tonic) % 12];
    for (const [profile, mode] of [[MAJOR_PROFILE, "major"], [MINOR_PROFILE, "minor"]] as const) {
      const corr = pearson(rotated, profile);
      if (corr > best.corr) {
        secondCorr = best.corr;
        best = { corr, name: `${NOTE_NAMES[tonic]} ${mode}` };
      } else if (corr > secondCorr) {
        secondCorr = corr;
      }
    }
  }
  // Confidence blends absolute fit with the margin over the runner-up.
  const margin = Number.isFinite(secondCorr) ? best.corr - secondCorr : best.corr;
  const confidence = Math.max(0, Math.min(1, best.corr * 0.6 + margin * 2));
  return { key: best.name, confidence: Math.round(confidence * 100) / 100 };
}

export function estimateTempoKey(channels: Float32Array[], fs: number): TempoKeyEstimate {
  const mono = downmixMono(channels);
  const t = estimateBpm(mono, fs);
  const k = estimateKey(mono, fs);
  return {
    bpm: t.bpm,
    bpmConfidence: Math.round(t.confidence * 100) / 100,
    key: k.key,
    keyConfidence: k.confidence,
  };
}
