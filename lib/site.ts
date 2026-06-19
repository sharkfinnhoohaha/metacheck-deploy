// Canonical site origin for SEO (robots, sitemap, canonical, OG, JSON-LD) and
// metadataBase. Resolution order: explicit app URL → Vercel production domain →
// localhost. Each candidate is normalized (a scheme-less value like
// "example.com" becomes "https://example.com") and validated, so a misconfigured
// env var can never throw `new URL(...)` and break the build.
function firstValidOrigin(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const withScheme = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
      return new URL(withScheme).origin;
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
