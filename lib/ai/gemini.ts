import { GoogleGenAI } from "@google/genai";

/**
 * Model preference order. IDs are pinned to GA, *date-suffix-free* names so the
 * API resolves to the latest stable snapshot; the list provides an automatic
 * fallback if Google retires one (as happened to `gemini-2.0-flash`, shut down
 * 1 June 2026 — which the old code still referenced).
 *
 * Override with the GEMINI_MODELS env var (comma-separated) without a redeploy.
 */
const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let _client: GoogleGenAI | null | undefined;

/**
 * Returns a configured Gemini client, or `null` when no credentials are set
 * (callers then fall back to rule-based suggestions, which keeps the public
 * marketing demo working without any key).
 *
 * Auth precedence:
 *  1. **Vertex AI** — used when GOOGLE_VERTEX_PROJECT (or GOOGLE_CLOUD_PROJECT)
 *     and GOOGLE_SERVICE_ACCOUNT_JSON are set. This routes spend through Google
 *     Cloud so it can draw on the $300 credit, and carries the paid no-training
 *     data guarantee for unreleased artist metadata.
 *  2. **Gemini Developer API** — `GEMINI_API_KEY`. NOTE: the *free* Developer
 *     tier trains on your content; enable billing before sending real data.
 */
function getClient(): GoogleGenAI | null {
  if (_client !== undefined) return _client;
  try {
    const project = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (project && saJson) {
      const credentials = JSON.parse(saJson);
      _client = new GoogleGenAI({
        vertexai: true,
        project,
        location: process.env.GOOGLE_VERTEX_LOCATION || "us-central1",
        googleAuthOptions: { credentials },
      });
      return _client;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      _client = new GoogleGenAI({ apiKey });
      return _client;
    }
  } catch (err) {
    console.error("Gemini client init failed:", err);
  }
  _client = null;
  return _client;
}

/** Whether AI generation is available (a key/credentials are configured). */
export function isAiConfigured(): boolean {
  return getClient() !== null;
}

/**
 * Generate text from a prompt, trying each model in preference order until one
 * succeeds. Throws if no client is configured or every model fails — callers
 * are expected to catch and fall back to rule-based output.
 */
export async function generateText(prompt: string): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("No Gemini credentials configured");

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await client.models.generateContent({ model, contents: prompt });
      const text = res.text;
      if (text) return text;
    } catch (err) {
      lastErr = err;
      console.warn(
        `Gemini model "${model}" failed, trying next:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  throw lastErr ?? new Error("All Gemini models failed");
}
