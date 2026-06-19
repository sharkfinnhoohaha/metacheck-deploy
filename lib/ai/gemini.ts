import { GoogleGenAI } from "@google/genai";
import { IdentityPoolClient } from "google-auth-library";

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
 *  1. **Vertex AI via Workload Identity Federation (keyless)** — used when
 *     GCP_WORKLOAD_IDENTITY_AUDIENCE + GCP_SERVICE_ACCOUNT_EMAIL are set. On
 *     Vercel, the per-request `VERCEL_OIDC_TOKEN` is exchanged (STS) to
 *     impersonate the service account — no long-lived key, so it satisfies the
 *     org policy that blocks service-account keys, and draws on the GCP credit.
 *  2. **Vertex AI via service-account key** — GOOGLE_VERTEX_PROJECT +
 *     GOOGLE_SERVICE_ACCOUNT_JSON (used where SA keys are permitted).
 *  3. **Gemini Developer API** — `GEMINI_API_KEY`. NOTE: the *free* Developer
 *     tier trains on your content; enable billing before sending real data.
 */
function getClient(): GoogleGenAI | null {
  if (_client !== undefined) return _client;
  try {
    const project = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_VERTEX_LOCATION || "us-central1";

    // 1. Keyless Vertex (Workload Identity Federation) — preferred on Vercel.
    const wifAudience = process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE;
    const wifSaEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
    if (project && wifAudience && wifSaEmail) {
      const authClient = new IdentityPoolClient({
        audience: wifAudience,
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        token_url: "https://sts.googleapis.com/v1/token",
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${wifSaEmail}:generateAccessToken`,
        subject_token_supplier: {
          // Vercel issues a fresh, per-request OIDC token. At runtime it is NOT in
          // process.env — it must be read via @vercel/functions/oidc within the
          // request scope. Fall back to the env var (present at build) just in case.
          getSubjectToken: async () => {
            try {
              const { getVercelOidcToken } = await import("@vercel/functions/oidc");
              const token = await getVercelOidcToken();
              if (token) return token;
            } catch (e) {
              console.warn("getVercelOidcToken failed:", e instanceof Error ? e.message : e);
            }
            const env = process.env.VERCEL_OIDC_TOKEN;
            if (env) return env;
            throw new Error("VERCEL_OIDC_TOKEN unavailable — check OIDC federation on the Vercel project");
          },
        },
      });
      _client = new GoogleGenAI({
        vertexai: true,
        project,
        location,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        googleAuthOptions: { authClient: authClient as any },
      });
      return _client;
    }

    // 2. Vertex via service-account key (where key creation is allowed).
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (project && saJson) {
      const credentials = JSON.parse(saJson);
      _client = new GoogleGenAI({
        vertexai: true,
        project,
        location,
        googleAuthOptions: { credentials },
      });
      return _client;
    }

    // 3. Gemini Developer API key.
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
