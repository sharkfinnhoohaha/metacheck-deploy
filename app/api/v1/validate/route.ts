import { z } from "zod";
import { requireLabelApiKey } from "@/lib/api/guard";
import { validateRelease, getGrade } from "@/lib/validation/rules";
import { getProfile } from "@/lib/validation/profiles";
import type { TrackMeta } from "@/lib/validation/types";
import { rateLimit, isRateLimitConfigured } from "@/lib/ratelimit";

// Tracks are a flat record of string fields (mirrors the save route's shape).
const BodySchema = z.object({
  tracks: z.array(z.record(z.string(), z.string())).min(1).max(500),
  distributor: z.string().max(40).optional(),
});

/**
 * POST /api/v1/validate — Label-tier programmatic metadata validation.
 *   Authorization: Bearer mc_live_…
 *   { "tracks": [ { "title": "...", "artist": "...", ... } ], "distributor": "distrokid" }
 * Pure compute (no AI, no quota — team validations are unlimited), so the
 * per-key rate limit is the only abuse guard and FAILS CLOSED when unconfigured.
 */
export async function POST(req: Request) {
  const guard = await requireLabelApiKey(req);
  if (!guard.ok) return guard.response;

  // Fail closed: without a real limiter, an unauthenticated-cost-free compute
  // endpoint would be unbounded. (rateLimit() no-ops when Upstash is absent.)
  if (!isRateLimitConfigured()) {
    return Response.json({ data: null, error: "API rate limiting is not configured. Contact support." }, { status: 503 });
  }
  const { success } = await rateLimit("api-v1-validate", guard.clerkId, { requests: 120, windowSec: 60 });
  if (!success) {
    return Response.json({ data: null, error: "Rate limit exceeded (120 req/min). Slow down and retry." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: "Body must be { tracks: [...] } with 1–500 tracks of string fields." }, { status: 400 });
  }

  const tracks = parsed.data.tracks as TrackMeta[];
  const results = validateRelease(tracks, getProfile(parsed.data.distributor));
  const grade = getGrade(results);

  return Response.json({
    data: {
      grade: { letter: grade.letter, label: grade.label },
      trackCount: tracks.length,
      issueCount: results.length,
      // Rule ids are documented but UNSTABLE during beta — may change before GA.
      results: results.map((r) => ({
        rule: r.rule,
        field: r.field,
        severity: r.severity,
        message: r.message,
        suggestion: r.suggestion ?? null,
        trackIndex: r.trackIndex ?? null,
      })),
    },
    error: null,
  });
}
