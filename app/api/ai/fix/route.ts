import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { trackUsage, reserveAiCall, refundAiCall } from "@/lib/auth/index";
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

/** Plain-English "what this costs you" line for the rule fallback (no AI). */
function buildImpact(results: ResultInput[]): string {
  const c = results.filter((r) => r.severity === "critical").length;
  const w = results.filter((r) => r.severity === "warning").length;
  if (c === 0 && w === 0) {
    return "Your metadata looks clean — nothing here is costing you royalties or risking a rejection.";
  }
  const parts: string[] = [];
  if (c > 0) parts.push(`${c} critical issue${c > 1 ? "s" : ""} that can get this release rejected or break royalty tracking`);
  if (w > 0) parts.push(`${w} warning${w > 1 ? "s" : ""} that quietly cost you discoverability or publishing royalties`);
  return `This release has ${parts.join(" and ")}. Left unfixed, that means delayed or rejected submissions and money slipping into the MLC's unmatched-royalties black box — fix them before you hit submit.`;
}

export async function POST(req: Request) {
  const { userId } = await auth();

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

  const rulesResponse = () =>
    Response.json({
      data: { fixes: buildRuleFallback(tracks, results), impact: buildImpact(results), source: "rules" },
      error: null,
    });

  // Reserve quota for authenticated users ATOMICALLY (closes the read-then-act
  // race on the free taste); for anonymous demo callers, enforce a global daily
  // ceiling so rotated IPs can't drain the Vertex credit past a fixed budget.
  let reservation: { granted: boolean; counted: boolean } | null = null;
  if (userId) {
    try {
      reservation = await reserveAiCall(userId);
    } catch (err) {
      console.error("AI gating check failed:", err);
      return Response.json(
        { data: null, error: "Couldn't verify your subscription right now. Please try again." },
        { status: 503 }
      );
    }
    if (!reservation.granted) {
      return Response.json(
        {
          data: null,
          error: "You've used your free AI fix this month. Upgrade to Pro for unlimited AI-powered fixes.",
          upgrade: true,
        },
        { status: 403 }
      );
    }
  } else {
    // Global daily ceiling for the public demo (IP-rotation-proof) — keeps a
    // burst of anonymous traffic from draining the Vertex credit. Past the
    // budget, anonymous callers still get deterministic rule-based fixes.
    const ANON_DAILY_AI_BUDGET = 200;
    const globalOk = (await rateLimit("ai-anon-global", "all", { requests: ANON_DAILY_AI_BUDGET, windowSec: 86_400 })).success;
    if (!globalOk) return rulesResponse(); // anonymous daily AI budget spent → serve rules
  }

  // If we reserved a (counted) call but end up serving rules, refund it.
  const refundIfReserved = async () => {
    if (userId && reservation?.counted) await refundAiCall(userId);
  };

  // Serve deterministic rules when no AI is configured, or for an anonymous caller
  // with no rate limiter (fail CLOSED rather than rely on the no-op limiter).
  const canCallModel = isAiConfigured() && (Boolean(userId) || isRateLimitConfigured());
  if (!canCallModel) {
    await refundIfReserved();
    return rulesResponse();
  }

  try {
    const prompt = `System Instructions: ${AI_FIX_SYSTEM_PROMPT}\n\nHere are the tracks and their validation issues. Suggest fixes:\n\nTRACKS:\n${JSON.stringify(tracks, null, 2)}\n\nVALIDATION ISSUES:\n${JSON.stringify(results, null, 2)}`;

    const text = await generateText(prompt);

    // Gemini may wrap JSON in markdown fences — extract the first object.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;

    let fixes: unknown[];
    let impact: string;
    try {
      const json = JSON.parse(cleanText);
      fixes = Array.isArray(json.fixes) ? json.fixes : [];
      impact = typeof json.impact === "string" && json.impact.trim() ? json.impact.trim() : buildImpact(results);
    } catch {
      console.error("Malformed AI response:", text.slice(0, 500));
      // Served rules, not AI → refund the reserved call so it isn't billed.
      await refundIfReserved();
      return rulesResponse();
    }

    // Legacy path only (RPC absent → reservation didn't count): charge now.
    if (userId && reservation && !reservation.counted) {
      try {
        await trackUsage(userId, "ai_call");
      } catch (err) {
        console.warn("Usage tracking failed, proceeding anyway:", err);
      }
    }

    return Response.json({ data: { fixes, impact, source: "ai" }, error: null });
  } catch (err) {
    console.error("Gemini API error:", err instanceof Error ? err.message : err);
    // Model/credentials failure → deterministic fallback so the user still gets value.
    await refundIfReserved();
    return rulesResponse();
  }
}
