// Canonical site origin for SEO (robots, sitemap, canonical, OG, JSON-LD) and
// metadataBase. Resolution order: explicit app URL → Vercel production domain →
// localhost. Each candidate is normalized (a scheme-less value like
// "example.com" becomes "https://example.com") and validated, so a misconfigured
// env var can never throw `new URL(...)` and break the build.
// Unfilled placeholder hostnames from .env.example. Compared against the parsed
// hostname (exact match or as a parent of a subdomain) — NOT a substring of the
// raw URL, so legitimate hosts like "myexample.com" or "staging-example.com" are
// not falsely rejected.
const PLACEHOLDER_HOSTS = ["example.com", "example.org", "your-domain.com", "changeme.com"];

function firstValidOrigin(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = candidate.trim();
    if (!cleaned) continue;
    const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    try {
      const url = new URL(withScheme);
      // Reject obvious unfilled placeholders so a stray "your-domain.com" left in
      // an env var can't poison canonical/OG/JSON-LD URLs — fall through to the
      // next candidate (e.g. the real Vercel domain).
      const host = url.hostname.toLowerCase();
      if (PLACEHOLDER_HOSTS.some((p) => host === p || host.endsWith(`.${p}`))) continue;
      // A usable origin needs a dotted host (a TLD) or localhost. Bare tokens like
      // "replace_me_https" parse as a valid URL but aren't a real origin, so skip them.
      if (host === "localhost" || host.includes(".")) return url.origin;
    } catch {
      // try the next candidate
    }
  }
  return "http://localhost:3000";
}

export const SITE_URL = firstValidOrigin(
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  "http://localhost:3000"
);
