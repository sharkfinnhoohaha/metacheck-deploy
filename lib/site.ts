// Canonical site origin for SEO (robots, sitemap, canonical, OG, JSON-LD).
// Prefer the explicit app URL; on Vercel fall back to the production domain so
// these never silently emit localhost if NEXT_PUBLIC_APP_URL is forgotten;
// only then fall back to localhost for local dev.
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
