/**
 * Decode an audio file to raw PCM entirely in the browser via the Web Audio API.
 * The file is read with File.arrayBuffer() and handed to decodeAudioData — it is
 * never uploaded. Browsers natively decode whatever they support (WAV, MP3, M4A/
 * AAC, FLAC, OGG depending on platform), which covers every common master format.
 *
 * Pattern adapted from cue-track's client-decode.ts (transcodeToWav).
 */
"use client";

import type { DecodedAudio } from "./types";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Hard cap so a pathological upload can't lock the tab — analyse the first N minutes. */
const MAX_ANALYSIS_SECONDS = 12 * 60;

export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    throw new Error("Your browser can't decode audio. Try Chrome, Edge, Safari or Firefox.");
  }
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new Ctor();
  let buffer: AudioBuffer;
  try {
    // decodeAudioData detaches the buffer in some engines — pass a copy.
    buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    await ctx.close().catch(() => {});
    throw new Error(
      err instanceof Error && err.message
        ? `Couldn't decode that audio in the browser: ${err.message}`
        : "Couldn't decode that audio. Try a WAV or MP3 master.",
    );
  }
  await ctx.close().catch(() => {});

  const sampleRate = buffer.sampleRate;
  const frames = Math.min(buffer.length, Math.floor(MAX_ANALYSIS_SECONDS * sampleRate));
  const channelCount = Math.max(1, buffer.numberOfChannels);
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    const full = buffer.getChannelData(c);
    channels.push(frames < full.length ? full.slice(0, frames) : full);
  }

  return {
    channels,
    sampleRate,
    // Report the true file duration even if we only analysed a prefix.
    duration: buffer.duration,
  };
}
