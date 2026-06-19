import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { trackUsage, canUseAI } from "@/lib/auth/index";
import { AI_FIX_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { generateText, isAiConfigured } from "@/lib/ai/gemini";
import { rateLimit, clientIp, isRateLimitConfigured } from "@/lib/ratelimit";

const RequestSchema = z.object({
  // Bounded to a realistic release size so an anonymous caller can't post a
  // giant payload to run up token cost against the Gemini key.
  tracks: z.array(z.record(z.string(), z.any())).max(50),
  results: z
    .array(
      z.object({
        rule: z.string().max(200),
        field: z.string().max(100),
        trackIndex: z.number().optional(),
        severity: z.enum(["critical", "warning", "suggestion"]),
        message: z.string().max(2000),
        suggestion: z.string().max(2000).optional(),
        fixable: z.boolean(),
      })
    )
    .max(300),
});

type ResultInput = z.infer<typeof RequestSchema>["results"][number];
type TrackInput = Record<string, unknown>;

// `field` must be a real TrackMeta key so the client can apply the fix — the
// engine's display labels ("Release Date", "Featured Artists") don't lowercase
// to a valid key, so map them explicitly and skip anything we can't resolve.
const FIELD_LABEL_TO_KEY: Record<string, string> = {
  isrc: "isrc", title: "title", artist: "artist",
  "featured artists": "featuredArtists", album: "album", upc: "upc",
  genre: "genre", "release date": "releaseDate", songwriters: "songwriters",
  producers: "producers", composers: "composers", copyright: "copyright",
  explicit: "explicit", language: "language", label: "label",
  duration: "duration", "track number": "trackNumber", iswc: "iswc", splits: "splits",
};

/** Deterministic rule-based fixes — used for the public demo and as a fallback
 *  when no AI key is configured or the model call fails. */
function buildRuleFallback(tracks: TrackInput[], results: ResultInput[]) {
  return results
    .filter((r) => r.fixable)
    .map((r) => {
      const key = FIELD_LABEL_TO_KEY[r.field.toLowerCase().trim()];
      if (!key) return null;
      const idx = r.trackIndex ?? 0;
      return {
        trackIndex: idx,
        field: key,
        original: (tracks[idx]?.[key] as string) || "",
        fixed: r.suggestion || "Fixed value",
        reason: "Auto-corrected based on validation rules.",
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  // TEMP diagnostic: ?diag=mc1 surfaces the underlying model error (no secrets).
  const diag = new URL(req.url).searchParams.get("diag") === "mc1";

  // Rate limit by user (if signed in) or IP. Public demo callers are anonymous,
  // so the IP bucket is the primary guard against Gemini-key abuse.
  const rlKey = userId ?? `ip:${clientIp(req)}`;
  const { success } = await rateLimit("ai-fix", rlKey, { requests: 15, windowSec: 60 });
  if (!success) {
    return Response.json(
      { data: null, error: "Too many requests — slow down and try again in a minute." },
      { status: 429 }
    );
  }

  // Authenticated users must be on a paid tier with AI quota remaining.
  // Anonymous requests are intentionally allowed so the public marketing demo
  // keeps working (it falls back to rule-based fixes when no key is configured).
  if (userId) {
    let allowed = false;
    try {
      allowed = await canUseAI(userId);
    } catch (err) {
      console.error("AI gating check failed:", err);
      return Response.json(
        { data: null, error: "Couldn't verify your subscription right now. Please try again." },
        { status: 503 }
      );
    }
    if (!allowed) {
      return Response.json(
        { data: null, error: "AI fixes are a Pro feature. Upgrade to Pro for AI-powered suggestions." },
        { status: 403 }
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: "Invalid request payload." }, { status: 400 });
  }

  const { tracks, results } = parsed.data;

  // Decide whether we may call the paid model. Serve deterministic rule-based
  // fixes (which power the public demo) when:
  //  - no AI is configured, OR
  //  - the caller is anonymous AND no rate limiter is configured — otherwise
  //    that's an unauthenticated, unthrottled path that could drain the key, so
  //    we fail CLOSED to rules rather than relying on the no-op rate limiter.
  const canCallModel = isAiConfigured() && (Boolean(userId) || isRateLimitConfigured());
  if (!canCallModel) {
    return Response.json({
      data: { fixes: buildRuleFallback(tracks, results), source: "rules" },
      error: null,
    });
  }

  try {
    const prompt = `System Instructions: ${AI_FIX_SYSTEM_PROMPT}\n\nHere are the tracks and their validation issues. Suggest fixes:\n\nTRACKS:\n${JSON.stringify(tracks, null, 2)}\n\nVALIDATION ISSUES:\n${JSON.stringify(results, null, 2)}`;

    const text = await generateText(prompt);

    // Gemini may wrap JSON in markdown fences — extract the first object.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;

    let fixes: unknown[];
    try {
      const json = JSON.parse(cleanText);
      fixes = Array.isArray(json.fixes) ? json.fixes : [];
    } catch {
      console.error("Malformed AI response:", text.slice(0, 500));
      // Don't bill a failed call — fall back to rules instead of erroring.
      return Response.json({
        data: { fixes: buildRuleFallback(tracks, results), source: "rules" },
        error: null,
      });
    }

    // Charge usage only after a successful AI generation (never on fallback).
    if (userId) {
      try {
        await trackUsage(userId, "ai_call");
      } catch (err) {
        console.warn("Usage tracking failed, proceeding anyway:", err);
      }
    }

    return Response.json({ data: { fixes, source: "ai" }, error: null });
  } catch (err) {
    console.error("Gemini API error:", err instanceof Error ? err.message : err);
    // Model/credentials failure → deterministic fallback so the user still gets value.
    return Response.json({
      data: {
        fixes: buildRuleFallback(tracks, results),
        source: "rules",
        ...(diag ? { _diag: String(err instanceof Error ? err.message : err).slice(0, 800) } : {}),
      },
      error: null,
    });
  }
}
