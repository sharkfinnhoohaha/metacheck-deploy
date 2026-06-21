/**
 * ITU-R BS.1770-4 loudness + true-peak measurement, hand-rolled so it runs
 * 100% client-side with zero dependencies. This is the part neither a chatbot
 * nor a distributor can do — it reads the actual waveform.
 *
 * Implements:
 *  - K-weighting pre-filter (two biquads), coefficients derived for the file's
 *    own sample rate (not just the 48 kHz reference) via the standard bilinear
 *    forms used by pyloudnorm / libebur128.
 *  - Gated integrated loudness (absolute −70 LUFS, then relative −10 LU).
 *  - Loudness range (EBU TECH 3342): 3 s short-term windows, −20 LU relative
 *    gate, 10th–95th percentile spread.
 *  - True peak via 4× polyphase oversampling (catches inter-sample peaks that a
 *    plain sample-peak meter misses and that distort after lossy transcode).
 *  - Consecutive-full-scale clipping detection.
 *
 * Verified against synthetic signals in lib/audio/__tests__ (a −20 dBFS 1 kHz
 * sine reads ≈ −23.0 LUFS; a full-scale sine reads ≈ 0 dBFS sample peak).
 */

import type { LoudnessMeasurement } from "./types";

type Biquad = { b: [number, number, number]; a: [number, number, number] };

/** Apply a biquad (Direct Form I, a0 normalised to 1) in place-safe fashion. */
function applyBiquad(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  const [b0, b1, b2] = f.b;
  const [, a1, a2] = f.a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const xn = x[n];
    const yn = b0 * xn + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xn; y2 = y1; y1 = yn;
    y[n] = yn;
  }
  return y;
}

/**
 * The two BS.1770 K-weighting stages, computed for an arbitrary sample rate.
 * Stage 1: a +4 dB high-shelf (head/torso acoustic model).
 * Stage 2: an RLB high-pass at ~38 Hz.
 * At fs = 48 kHz these reproduce the reference coefficients in the standard.
 */
function kWeightingFilters(fs: number): [Biquad, Biquad] {
  // ── Stage 1: high shelf ──
  const f0 = 1681.9744509555319;
  const G = 3.999843853973347;
  const Q1 = 0.7071752369554196;
  const K1 = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0_1 = 1 + K1 / Q1 + K1 * K1;
  const stage1: Biquad = {
    b: [
      (Vh + (Vb * K1) / Q1 + K1 * K1) / a0_1,
      (2 * (K1 * K1 - Vh)) / a0_1,
      (Vh - (Vb * K1) / Q1 + K1 * K1) / a0_1,
    ],
    a: [1, (2 * (K1 * K1 - 1)) / a0_1, (1 - K1 / Q1 + K1 * K1) / a0_1],
  };

  // ── Stage 2: RLB high pass ──
  const fc = 38.13547087602444;
  const Q2 = 0.5003270373238773;
  const K2 = Math.tan((Math.PI * fc) / fs);
  const a0_2 = 1 + K2 / Q2 + K2 * K2;
  const stage2: Biquad = {
    b: [1, -2, 1],
    a: [1, (2 * (K2 * K2 - 1)) / a0_2, (1 - K2 / Q2 + K2 * K2) / a0_2],
  };

  return [stage1, stage2];
}

/** Channel weights G_i from BS.1770 (L,R,C = 1.0; surrounds = 1.41 ≈ +1.5 dB). */
function channelWeight(index: number, count: number): number {
  if (count <= 2) return 1.0; // mono or stereo
  // For 5.1-ish layouts, surrounds (indices 3,4) get +1.5 dB. Rare for masters.
  return index >= 3 ? 1.41 : 1.0;
}

/** Mean square of each gating block. blockSize/step in samples; shared grid across channels. */
function blockMeanSquares(filtered: Float32Array, blockSize: number, step: number): Float32Array {
  if (filtered.length < blockSize) return new Float32Array(0);
  const count = 1 + Math.floor((filtered.length - blockSize) / step);
  const out = new Float32Array(count);
  for (let bi = 0; bi < count; bi++) {
    const start = bi * step;
    let sum = 0;
    for (let n = start; n < start + blockSize; n++) sum += filtered[n] * filtered[n];
    out[bi] = sum / blockSize;
  }
  return out;
}

const ABS_GATE_LUFS = -70;

/** Gated loudness over a set of per-block channel-summed mean squares (z). */
function gatedLoudness(z: Float32Array, relativeGateLu: number): number {
  // Absolute gate.
  let sumAbs = 0, nAbs = 0;
  for (let i = 0; i < z.length; i++) {
    const l = -0.691 + 10 * Math.log10(z[i] || Number.MIN_VALUE);
    if (l > ABS_GATE_LUFS) { sumAbs += z[i]; nAbs++; }
  }
  if (nAbs === 0) return -Infinity;
  const meanAbs = sumAbs / nAbs;
  const relThreshold = -0.691 + 10 * Math.log10(meanAbs) + relativeGateLu;
  // Relative gate.
  let sumRel = 0, nRel = 0;
  for (let i = 0; i < z.length; i++) {
    const l = -0.691 + 10 * Math.log10(z[i] || Number.MIN_VALUE);
    if (l > ABS_GATE_LUFS && l > relThreshold) { sumRel += z[i]; nRel++; }
  }
  if (nRel === 0) return -Infinity;
  return -0.691 + 10 * Math.log10(sumRel / nRel);
}

/** Per-block z = Σ_ch G_ch · meanSquare_ch, on a shared block grid. */
function blockZ(filteredChannels: Float32Array[], blockSize: number, step: number): Float32Array {
  const perCh = filteredChannels.map((f) => blockMeanSquares(f, blockSize, step));
  const count = perCh.length ? Math.min(...perCh.map((p) => p.length)) : 0;
  const z = new Float32Array(count);
  for (let bi = 0; bi < count; bi++) {
    let sum = 0;
    for (let c = 0; c < perCh.length; c++) sum += channelWeight(c, perCh.length) * perCh[c][bi];
    z[bi] = sum;
  }
  return z;
}

function integratedLufs(filteredChannels: Float32Array[], fs: number): number {
  const blockSize = Math.round(0.4 * fs); // 400 ms
  const step = Math.round(0.1 * fs); // 75% overlap → 100 ms hop
  const z = blockZ(filteredChannels, blockSize, step);
  if (z.length === 0) return -Infinity;
  return gatedLoudness(z, -10);
}

function loudnessRange(filteredChannels: Float32Array[], fs: number): number {
  const blockSize = Math.round(3.0 * fs); // 3 s short-term window
  const step = Math.round(0.1 * fs); // 100 ms hop
  const z = blockZ(filteredChannels, blockSize, step);
  if (z.length === 0) return 0;

  // Per-window short-term loudness, absolute-gated.
  const stl: number[] = [];
  let sumAbs = 0, nAbs = 0;
  for (let i = 0; i < z.length; i++) {
    const l = -0.691 + 10 * Math.log10(z[i] || Number.MIN_VALUE);
    if (l > ABS_GATE_LUFS) { stl.push(l); sumAbs += z[i]; nAbs++; }
  }
  if (nAbs === 0 || stl.length < 2) return 0;
  const relGate = -0.691 + 10 * Math.log10(sumAbs / nAbs) - 20;
  const gated = stl.filter((l) => l > relGate).sort((p, q) => p - q);
  if (gated.length < 2) return 0;
  const pct = (p: number) => gated[Math.min(gated.length - 1, Math.max(0, Math.round(p * (gated.length - 1))))];
  return pct(0.95) - pct(0.1);
}

// ── True peak via 4× polyphase oversampling ──────────────────────────────────
const OVERSAMPLE = 4;
const TAPS_PER_PHASE = 12;

/** Build a windowed-sinc low-pass, split into OVERSAMPLE polyphase branches. */
function buildPolyphase(): Float32Array[] {
  const protoLen = OVERSAMPLE * TAPS_PER_PHASE;
  const proto = new Float32Array(protoLen);
  const center = (protoLen - 1) / 2;
  const fc = 1 / OVERSAMPLE; // cutoff at original Nyquist, normalised to upsampled fs
  for (let i = 0; i < protoLen; i++) {
    const t = i - center;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * fc * t) / (Math.PI * fc * t);
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (protoLen - 1));
    proto[i] = fc * sinc * hann;
  }
  // Decompose into phases; normalise each so a constant signal is preserved.
  const phases: Float32Array[] = [];
  for (let p = 0; p < OVERSAMPLE; p++) {
    const taps = new Float32Array(TAPS_PER_PHASE);
    let sum = 0;
    for (let m = 0; m < TAPS_PER_PHASE; m++) {
      taps[m] = proto[p + OVERSAMPLE * m];
      sum += taps[m];
    }
    if (sum !== 0) for (let m = 0; m < TAPS_PER_PHASE; m++) taps[m] /= sum;
    phases.push(taps);
  }
  return phases;
}

const POLYPHASE = buildPolyphase();

/** Max true peak (linear) across channels using polyphase interpolation. */
function truePeakLinear(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    const n = ch.length;
    for (let i = 0; i < n; i++) {
      // Sample peak (phase aligned to 0).
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
      // Inter-sample peaks from the fractional phases.
      for (let p = 1; p < OVERSAMPLE; p++) {
        const taps = POLYPHASE[p];
        let acc = 0;
        for (let m = 0; m < TAPS_PER_PHASE; m++) {
          const idx = i - m;
          if (idx >= 0) acc += taps[m] * ch[idx];
        }
        const v = Math.abs(acc);
        if (v > peak) peak = v;
      }
    }
  }
  return peak;
}

function samplePeakLinear(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

/** Count runs of ≥3 consecutive at-or-above full-scale samples (clipping signature). */
function clippingEvents(channels: Float32Array[]): number {
  const THRESH = 0.99988; // ≈ −0.001 dBFS
  let events = 0;
  for (const ch of channels) {
    let run = 0;
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) >= THRESH) {
        run++;
        if (run === 3) events++;
      } else {
        run = 0;
      }
    }
  }
  return events;
}

const dbFromLinear = (x: number) => (x <= 0 ? -Infinity : 20 * Math.log10(x));

export function measureLoudness(channels: Float32Array[], sampleRate: number): LoudnessMeasurement {
  const [s1, s2] = kWeightingFilters(sampleRate);
  const filtered = channels.map((ch) => applyBiquad(applyBiquad(ch, s1), s2));

  const integrated = integratedLufs(filtered, sampleRate);
  const lra = loudnessRange(filtered, sampleRate);
  const truePeak = dbFromLinear(truePeakLinear(channels));
  const samplePeak = dbFromLinear(samplePeakLinear(channels));

  return {
    integratedLufs: Number.isFinite(integrated) ? round1(integrated) : -70,
    loudnessRangeLu: round1(lra),
    truePeakDbtp: Number.isFinite(truePeak) ? round1(truePeak) : -120,
    samplePeakDbfs: Number.isFinite(samplePeak) ? round1(samplePeak) : -120,
    clippingEvents: clippingEvents(channels),
  };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
