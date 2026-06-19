import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

const _limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, requests: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${name}:${requests}:${windowSec}`;
  let limiter = _limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, `${windowSec} s`),
      prefix: `metacheck:${name}`,
      analytics: false,
    });
    _limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Sliding-window rate limit keyed by `id` (usually client IP). **No-ops (always
 * allows) when Upstash is not configured** so local dev and the public demo keep
 * working — but it MUST be configured in production: the AI and music-search
 * routes are public and would otherwise let anyone drain the Gemini key.
 */
export async function rateLimit(
  name: string,
  id: string,
  opts: { requests: number; windowSec: number } = { requests: 20, windowSec: 60 }
): Promise<{ success: boolean; remaining: number }> {
  const limiter = getLimiter(name, opts.requests, opts.windowSec);
  if (!limiter) return { success: true, remaining: opts.requests };
  try {
    const { success, remaining } = await limiter.limit(id);
    return { success, remaining };
  } catch (err) {
    // Never let a rate-limiter outage take down the route — fail open.
    console.error("Rate limit check failed (allowing request):", err);
    return { success: true, remaining: opts.requests };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] || req.headers.get("x-real-ip") || "anonymous").trim();
}
