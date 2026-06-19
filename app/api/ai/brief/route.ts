import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { trackUsage, reserveAiCall, refundAiCall } from "@/lib/auth/index";
import { AI_BRIEF_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { generateText, isAiConfigured } from "@/lib/ai/gemini";
import { rateLimit, clientIp, isRateLimitConfigured } from "@/lib/ratelimit";

const RequestSchema = z.object({
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
  distributor: z.string().max(80).optional(),
});

type ResultInput = z.infer<typeof RequestSchema>["results"][number];

/** Deterministic readiness brief — public demo + fallback when AI is unavailable. */
function buildBriefFallback(results: ResultInput[], distributor?: string) {
  const crit = results.filter((r) => r.severity === "critical");
  const warn = results.filter((r) => r.severity === "warning");
  const verdict = crit.length ? "not-ready" : warn.length > 2 ? "close" : "ready";
  const dest = distributor ? ` to ${distributor}` : "";
  const headline =
    verdict === "ready"
      ? `Ready to submit${dest} — no blocking issues found.`
      : verdict === "close"
        ? `Almost ready${dest} — clear a few warnings first.`
        : `Not ready${dest} — ${crit.length} critical issue${crit.length > 1 ? "s" : ""} will block or break this release.`;
  const exposure = [...crit, ...warn].slice(0, 4).map((r) => ({
    issue: `${r.field}: ${r.message.slice(0, 90)}`,
    cost:
      r.severity === "critical"
        ? "Blocks the release or breaks royalty tracking."
        : "Costs discoverability or publishing royalties.",
  }));
  const fixOrder = [...crit, ...warn]
    .slice(0, 5)
    .map((r) => (r.suggestion ? `${r.field}: ${r.suggestion}` : r.message.slice(0, 100)));
  return {
    verdict,
    headline,
    summary:
      verdict === "ready"
        ? "No critical issues remain. Double-check credits and artwork, then submit."
        : `Found ${crit.length} critical and ${warn.length} warning issue(s). Resolve the criticals before submitting; the warnings protect your royalties and reach.`,
    exposure,
    fixOrder,
  };
}

export async function POST(req: Request) {
  const { userId } = await auth();

  const rlKey = userId ?? `ip:${clientIp(req)}`;
  const { success } = await rateLimit("ai-brief", rlKey, { requests: 10, windowSec: 60 });
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

  const { tracks, results, distributor } = parsed.data;

  const rulesResponse = () =>
    Response.json({
      data: { brief: buildBriefFallback(results, distributor), source: "rules" },
      error: null,
    });

  // Atomically reserve the AI call for authenticated users (closes the free-taste race).
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
          error: "You've used your free AI run this month. Upgrade to Pro for unlimited AI briefs.",
          upgrade: true,
        },
        { status: 403 }
      );
    }
  }

  const refundIfReserved = async () => {
    if (userId && reservation?.counted) await refundAiCall(userId);
  };

  const canCallModel = isAiConfigured() && (Boolean(userId) || isRateLimitConfigured());
  if (!canCallModel) {
    await refundIfReserved();
    return rulesResponse();
  }

  try {
    const prompt = `System Instructions: ${AI_BRIEF_SYSTEM_PROMPT}\n\nTARGET DISTRIBUTOR: ${distributor || "a major distributor"}\n\nTRACKS:\n${JSON.stringify(tracks, null, 2)}\n\nOUTSTANDING ISSUES:\n${JSON.stringify(results, null, 2)}`;

    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      console.error("Malformed AI brief:", text.slice(0, 500));
      await refundIfReserved();
      return rulesResponse();
    }

    // An LLM can emit valid JSON of the WRONG shape (missing verdict, exposure as a
    // string). That would crash the client (.map on a non-array) or waste the free
    // taste, so validate + normalize before billing — fall back to rules otherwise.
    const b = parsed as Record<string, unknown>;
    if (!b || typeof b !== "object" || typeof b.verdict !== "string") {
      console.error("Malformed AI brief shape:", text.slice(0, 500));
      await refundIfReserved();
      return rulesResponse();
    }
    const brief = {
      verdict: b.verdict,
      headline: typeof b.headline === "string" ? b.headline : undefined,
      summary: typeof b.summary === "string" ? b.summary : undefined,
      exposure: Array.isArray(b.exposure)
        ? (b.exposure as unknown[])
            .filter((e) => !!e && typeof e === "object")
            .map((e) => {
              const o = e as Record<string, unknown>;
              return { issue: String(o.issue ?? ""), cost: String(o.cost ?? "") };
            })
        : [],
      fixOrder: Array.isArray(b.fixOrder) ? (b.fixOrder as unknown[]).map((x) => String(x)) : [],
    };

    // Legacy path only (RPC absent → reservation didn't count): charge now.
    if (userId && reservation && !reservation.counted) {
      try {
        await trackUsage(userId, "ai_call");
      } catch (err) {
        console.warn("Usage tracking failed, proceeding anyway:", err);
      }
    }

    return Response.json({ data: { brief, source: "ai" }, error: null });
  } catch (err) {
    console.error("Gemini brief error:", err instanceof Error ? err.message : err);
    await refundIfReserved();
    return rulesResponse();
  }
}
