// Canonical site origin for SEO (robots, sitemap, canonical, OG, JSON-LD) and
// metadataBase. Resolution order: explicit app URL → Vercel production domain →
// localhost. Each candidate is normalized (a scheme-less value like
// "example.com" becomes "https://example.com") and validated, so a misconfigured
// env var can never throw `new URL(...)` and break the build.
function firstValidOrigin(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = candidate.trim();
    // Reject obvious unfilled placeholders so a stray "replace_me_https" /
    // "your-domain.com" left in an env var can't poison canonical/OG/JSON-LD
    // URLs — fall through to the next candidate (e.g. the real Vercel domain).
    if (!cleaned || /replace_me|your-domain|changeme|example\.(com|org)/i.test(cleaned)) continue;
    const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    try {
      const url = new URL(withScheme);
      // A usable origin needs a dotted host (a TLD) or localhost. Bare tokens like
      // "replace_me_https" parse as a valid URL but aren't a real origin, so skip them.
      if (url.hostname === "localhost" || url.hostname.includes(".")) return url.origin;
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
