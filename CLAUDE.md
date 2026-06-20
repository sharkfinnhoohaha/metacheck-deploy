# CLAUDE.md — MetaCheck: Build the Functional Tool

## Status (updated 20 June 2026)

**All 9 build phases complete + a major modernization/feature/hardening pass,
a final landing redesign, an e2e suite, and an audit-follow-ups bug pass.
`npm run build` ✓, Playwright e2e ✓ (10/10). LIVE in production on Vercel
(`metacheck-ten.vercel.app`).**

The core metadata-checking feature was audited and substantially expanded on
18 June 2026 — see **Metadata-checking audit & feature pass** below. On 19 June
2026 the UI was modernized and a large set of features + backend hardening shipped
— see **19 June 2026 pass**. On 20 June 2026 the landing page got its final
"Robinhood-style" redesign + a Playwright e2e suite, and an audit-follow-ups bug
pass shipped — see **20 June 2026 pass** immediately below.

---

## 20 June 2026 — Final landing redesign, e2e, audit follow-ups

All shipped to `main` (Vercel production).

### Landing redesign + e2e
- **Final landing polish** (`app/page.tsx`) — clean geometric/heavy hero:
  "Release music that gets paid." pain/money hook, tighter copy.
- **Display font changed**: `Instrument Serif` → **`Outfit`** (heavy, tight
  tracking) for a modern "Robinhood" feel. `--font-display` in `app/globals.css`
  is now Outfit; a `.font-display` base rule sets weight 700 / `-0.035em`.
  **The design-system font note below is updated to match — do not reintroduce
  Instrument Serif.**
- **Playwright e2e** (`playwright.config.ts` + `tests/e2e/public.spec.ts`) — covers
  the public surface (landing hero/pricing/CTAs, `/features`, `/release-planner`,
  live demo) on desktop + mobile. Config runs against a dev server on **:3210**
  (no `webServer` block — start `PORT=3210 npm run dev` first, then
  `npx playwright test`). `@playwright/test` is a devDependency.

### Public routes (added before this pass, now covered by e2e + sitemap)
- `/features`, `/release-planner` (free client-side timeline tool), `/privacy`,
  `/terms` — all in the sitemap. New public routes still need the `middleware.ts`
  allowlist.

### SEO canonical origin (`lib/site.ts`)
- `SITE_URL` is resolved by `firstValidOrigin(...)`: explicit `NEXT_PUBLIC_APP_URL`
  → Vercel production domain → localhost. It rejects unfilled placeholder hosts
  (compared against the **parsed hostname**, exact/subdomain — not a raw-string
  substring) so a stray env value can't poison canonical/OG/JSON-LD URLs.
  **In prod, set `NEXT_PUBLIC_APP_URL` to the real origin** or tags fall back to
  the Vercel auto-domain.

### Audit follow-ups (High/Medium/Low) + ultrareview fixes
- **Release credit unlocks AI** — when the monthly free AI taste/limit is spent,
  `/api/ai/fix` + `/api/ai/brief` fall back to `consumeCredit` before 403-ing
  (honoring the "unlock save, AI fixes and export" credit promise). The credit is
  only spent on a real AI call and **refunded (`addCredits`) on rules-fallback**,
  and excluded from the legacy usage-charge so it isn't double-billed.
- **Validate page**: per-severity section counts now use the outstanding
  (`activeResults`) set, matching the grade card. `applyFix` / `applyAllFixes`
  re-validate (like `applyAiFix`) and derive `updated` from the **live `tracks`**,
  not the frozen `fixedTracks` snapshot — so Sync-Ready edits (bpm/key/mood/
  contact/toggles via `updateTrackKeepResults`) made after validation aren't wiped.
- **`getGrade`**: warning volume folds into the lower tiers (`c + ⌊w/3⌋`, ~3
  warnings ≈ 1 critical). An F reached by warnings alone (`c === 0`) is labelled
  **"Too many issues"**, not "Critical failures" (which contradicted the breakdown).
- **PayPal webhook**: an activate/update with no `custom_id` whose subscription id
  matches no row now unmarks the idempotency record + returns **503** so PayPal
  retries once the row exists (was a silent no-op marked processed).
- **Low**: `runValidation` yields a frame so the loading state renders; demo
  `applyFix` removes the queued fix by identity, not by field.

### New env vars / operator steps (20 June)
- **Set `NEXT_PUBLIC_APP_URL` in Vercel prod** to the real origin (SEO canonical).
- `ADMIN_USER_IDS` / `ADMIN_EMAILS` now documented in `.env.example`.
- **No DB migrations, no secret changes** in this pass.

---

## 19 June 2026 — Modernization, new features, admin & hardening

Shipped to `main` (Vercel production). All adversarially reviewed (multi-agent
review workflows) and the engine changes verified with behavioral test harnesses.

### UI / UX
- Apple-minimal **landing page** rework (clear value prop, outcomes strip, scroll
  reveals, route transitions, hover/press micro-interactions) — motion lives in
  `app/globals.css` + `app/_components/Reveal.tsx`; **reduced-motion + no-JS safe**.
- **Inline SVG icon set** (`app/_components/icons.tsx`) replaces all emoji/unicode
  glyphs. App route transition via `app/(app)/template.tsx`.

### Validation engine (still 100% client-side, `lib/validation/rules.ts`)
- **~20 Reddit-sourced rules** added: broadened feat-in-title (feat./ft./featuring
  only — NOT bare "with"), banned/promo/store words + URLs in title, keyword-
  stuffing, decorative-unicode (NFC-normalized, excludes ℗/™ + accents),
  bracket balance, ISRC↔UPC swap detection, UPC GS1 check-digit, placeholder
  credits (TBD/N/A, Apple-critical), generic-genre, sub-30s/royalty-farming/
  functional-length duration, explicit↔profanity mismatch, language/charset,
  artist casing-only profile-split, generic SEO artist name, SoundExchange
  reminder, missing/same-day release-date + `reviewLeadDays`-aware pitch window.
  Version descriptors split into a strong (standalone) set + a weak set that needs
  a qualifier prefix ("Radio Edit"), to avoid mangling titles like "Club Mix".
- **Sync-Ready score** (`lib/validation/sync.ts`) — 0–100 music-supervision
  readiness across clearable / usable / discoverable. Opt-in panel on `/validate`.
- **AI-disclosure** — `aiDisclosure` on `TrackMeta`; `aiPolicy` per
  `DistributorProfile` (CD Baby `ban`, TuneCore `restricted`, others `disclose`).

### Onboarding + AI value (free→paid conversion)
- One-click **sample release** + **paste-a-row** on `/validate`; **demo→signup
  handoff** via localStorage; dashboard `?sample=1` deep-link.
- **Free AI taste**: free tier now gets **1 AI fix/month** (`FREE_AI_TASTE` in
  `lib/auth/index.ts`); exhaustion → in-context `UpgradeCard`.
- AI fixes return a **"what this costs you" impact** line; new **AI Submission
  Readiness Brief** (`app/api/ai/brief/route.ts`) — verdict + money-at-risk + fix
  order. Both reuse the same Vertex client / gating / rule-fallback as `/api/ai/fix`.

### Admin dashboard
- `app/(app)/admin/page.tsx` — **deny-by-default**, gated by `ADMIN_USER_IDS` /
  `ADMIN_EMAILS` (`lib/auth/admin.ts`); sidebar link shown only to admins. KPIs
  (users, est. MRR, validations + AI calls/mo = credit-burn proxy), tier
  breakdown, recent signups/releases, ops "what to watch" panel.

### Backend hardening (activated by migration 004)
- **Atomic AI-quota reservation** (`consume_ai_call` RPC + `reserveAiCall`/
  `refundAiCall`) closes a TOCTOU race on the free taste; refunds on rules-fallback.
- **Webhook idempotency** (`webhook_events` table + `lib/webhooks.ts`) — Stripe/
  PayPal replays no longer double-grant credits. `addCredits` now THROWS on
  error/no-row so a failed paid grant retries (was silently dropped).
- **Global anonymous-AI daily budget** (IP-rotation-proof) in `/api/ai/fix`.
- **Security headers** in `next.config.ts` (HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy). CSP deferred (needs allowlist).
- All hardening **degrades gracefully** until `004_hardening.sql` is applied
  (RPC/table absent → prior behavior), so the code was safe to deploy first.

### CI
- `.github/workflows/ci.yml` (lint + tsc + build on PR/push).
- `.github/workflows/claude-review.yml` (auto Claude PR review — needs the Claude
  GitHub App + `ANTHROPIC_API_KEY` secret; **only for PR review, not the app**).

### AI / Vertex note
- Prod AI = **keyless Vertex via Workload Identity Federation** (no SA key;
  `GEMINI_API_KEY` removed from prod, only on preview). Model order in
  `lib/ai/gemini.ts` leads with **`gemini-2.5-flash`** — the 3.x names were failing
  on every call in this Vertex project (logs showed it). Override via `GEMINI_MODELS`.

### New env vars / operator steps (19 June)
- **Run `supabase/migrations/004_hardening.sql`** to activate the AI-quota race fix
  + webhook idempotency.
- Set `ADMIN_USER_IDS` (Clerk id) and/or `ADMIN_EMAILS` to unlock `/admin`.
- _(optional)_ `ANTHROPIC_API_KEY` + Claude GitHub App for auto PR review.
- `migrations/003_usage_and_credits.sql` and `004_hardening.sql` must be applied.

### Phase completion

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Auth + App Shell | ✅ Done | Clerk, middleware, sidebar, redirect |
| 2 — Database | ✅ Done | Schema + RLS policies fixed (see below) |
| 3 — Validation Engine | ✅ Done | 40+ rules, fully client-side, distributor-profile aware |
| 4 — Validate Page | ✅ Done | Single / multi-track / CSV / batch modes + artwork QC |
| 5 — AI Fix Suggestions | ✅ Done | Claude API route, Pro gating, usage tracking |
| 6 — Export | ✅ Done | CSV download + PDF report (jsPDF) |
| 7 — Dashboard + History | ✅ Done | Server components, Supabase reads |
| 8 — Settings + Billing | ✅ Done | Stripe checkout, portal, webhooks |
| 9 — Tier Gating | ✅ Done | `canValidate()` / `canUseAI()` wired throughout |

### Bugs fixed

- **`/api/ai/fix`**: Replaced non-existent `supabaseAdmin.rpc("increment_ai_calls")` call
  with `trackUsage(userId, "ai_call")` from `lib/auth/index.ts`.
- **RLS policies** (`supabase/migrations/001_schema.sql`): Changed all three policies from
  `clerk_id = current_user` (Postgres DB role — always wrong) to
  `clerk_id = (auth.jwt() ->> 'sub')` (Clerk user ID from JWT).
- **Inline styles**: Replaced hex colour maps in dashboard, history, validate, and demo pages
  with Tailwind class maps (`GRADE_CLASSES`, `GRADE_DISPLAY`, `dotClass`). Removed all
  dynamic `style={}` props except genuinely-dynamic values (progress bar width, marketing
  page SVG/radial-gradient which need eslint-disable comments).
- **CSS**: Added `mask:` fallback alongside `-webkit-mask:` in `globals.css` for Firefox.
  Added `.scrollbar-thin` utility with `-webkit-scrollbar` fallback for Safari.
- **Layout**: Converted `style={{ width: 240 }}` / `style={{ marginLeft: 240 }}` to
  Tailwind `w-60` / `ml-60` in `Sidebar.tsx` and `app/(app)/layout.tsx`.
- **Accessibility**: Added `aria-label="Upload CSV file"` to hidden file input in
  `app/(app)/validate/page.tsx`.

### Files added

- `.env.example` — documents all required environment variables with setup notes.

---

## Audit & fixes pass (18 June 2026)

A full functional audit was run. The codebase builds cleanly and the public surface
(landing page, live demo, iTunes search, validation engine) works end-to-end. The
following **functional bugs were found and fixed** in this pass:

- **Authenticated reads returned no data (RLS mismatch).** Dashboard / History /
  Settings / release-detail are Server Components that read Supabase via the anon
  cookie client — but auth is **Clerk**, not Supabase Auth, so no JWT ever reached
  Postgres and the RLS policy (`clerk_id = auth.jwt()->>'sub'`) matched nothing.
  Every read came back empty even though writes succeeded. **Fix:** these pages now
  read through the service-role client (`supabaseAdmin`) scoped by the authenticated
  Clerk `userId`, mirroring the existing `/api/releases` route. RLS remains as
  defense-in-depth for any direct anon access.
- **"Apply fix" silently no-op'd for some fields (e.g. Copyright).** `applyFix`
  matched the engine's field label (`"Copyright"`) against the form label
  (`"Copyright (℗)"`), which never matched — it marked the issue "Fixed ✓" without
  changing the value. **Fix:** added an explicit `RESULT_FIELD_TO_KEY` map in
  `validate/page.tsx`.
- **No sign-in / sign-up pages existed.** `redirect("/sign-in")` 404'd. **Fix:**
  added Clerk catch-all routes `app/sign-in/[[...sign-in]]` and `app/sign-up/[[...sign-up]]`.
- **No way into the app from the landing page.** **Fix:** added `Sign in` and
  `Open App →` links to the marketing nav.
- **AI tier gating was never enforced.** `canUseAI()` existed but was never called.
  **Fix:** `/api/ai/fix` now enforces `canUseAI()` for authenticated users (free tier
  → 403 upgrade prompt); anonymous requests (the public demo) stay open and fall back
  to rule-based fixes when no AI key is configured.
- **Doc/env drift.** Removed the stale `.env.local.example` (referenced a non-existent
  `ANTHROPIC_API_KEY`); `.env.example` (Gemini) is the single source of truth.

**Still requires the operator (you) — cannot be done from code:** create the Supabase,
Clerk, Stripe and Google Gemini accounts, fill `.env.local`, run the SQL migration, wire
the webhooks, and deploy. See **Next Steps** at the bottom. Production also requires real
Clerk keys — `next start` 500s without them (dev uses Clerk keyless mode automatically).

---

## PayPal billing (additive — June 2026)

PayPal was added **alongside** Stripe (not as a replacement) so customers can choose
how to pay. Both providers write the same `users.tier` column; the webhook is the
source of truth, mirroring the Stripe design.

- `lib/paypal/index.ts` — OAuth token caching + REST helpers (`createSubscription`,
  `cancelSubscription`, `verifyWebhookSignature`). The official PayPal Node SDK does
  **not** cover Subscriptions, so these call the REST API directly.
- `app/api/paypal/checkout/route.ts` — `GET ?tier=pro|team` → creates a subscription,
  redirects to PayPal's approval URL (`custom_id` carries the Clerk user ID).
- `app/api/webhooks/paypal/route.ts` — verifies the signature, then maps
  `BILLING.SUBSCRIPTION.ACTIVATED/UPDATED` → tier and `…CANCELLED/EXPIRED/SUSPENDED`
  → free. `/api/webhooks/(.*)` is already public in `middleware.ts`.
- `app/api/paypal/cancel/route.ts` — PayPal has **no hosted billing portal**, so this
  is the cancel action (the Settings page shows it for PayPal subscribers).
- `supabase/migrations/002_paypal.sql` — adds `users.paypal_subscription_id`
  (already applied to the live project).

**Operator setup (PayPal):** at developer.paypal.com create an app (Client ID/Secret),
create two subscription **Plans** ($9/mo Pro, $29/mo Label) and copy the plan IDs, then
add a webhook → `{APP_URL}/api/webhooks/paypal` (all `BILLING.SUBSCRIPTION.*` events) and
copy its Webhook ID. Fill `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`
(`sandbox`/`live`), `PAYPAL_PRO_PLAN_ID`, `PAYPAL_TEAM_PLAN_ID`, `PAYPAL_WEBHOOK_ID`.

---

## Metadata-checking audit & feature pass (18 June 2026)

The core validation feature was audited and expanded. **Bugs fixed:**

- **Grade/counts went stale after applying fixes.** `getGrade(results)` counted the full
  results array, ignoring the `_fixed` flag, so the grade card and the saved-history record
  stayed on the original grade after "Auto-fix All". Now computed over outstanding (`!_fixed`)
  issues in `validate/page.tsx`.
- **AI fallback fixes silently no-op'd on multi-word fields.** The `/api/ai/fix` fallback emitted
  `field: r.field.toLowerCase()` (e.g. `"release date"`), which isn't a valid `TrackMeta` key, so
  `applyAiFix` wrote a junk property. The fallback now maps display labels → real keys; the page's
  `applyAiFix` also resolves both forms via `resolveFieldKey`.
- **Malformed release dates passed silently.** `new Date("banana")` is `Invalid Date` and every
  comparison was `false` → no feedback. Added a `date_invalid` critical.
- **Inverted `producer_no_writer` rule.** Fired when producers were *absent* but its message claimed
  "Producers listed but no songwriters". Removed.

**Five improvements added** (all rooted in documented DSP rejection causes / market demand):

1. **DSP style-guide linter** — all-lowercase + title-case enforcement, and unbracketed version
   descriptors (`"Song Live"` → suggests `"Song (Live)"`). Trailing-word match only, so
   `"Live Your Life"` doesn't false-trigger.
2. **Publishing validation** — writer **splits must total 100%** (critical otherwise), **ISWC**
   format/presence, and a release-level **MLC registration reminder** (ASCAP/BMI ≠ MLC).
3. **Artwork QC** (`lib/validation/artwork.ts`) — client-side spec checks (square, ≥3000×3000,
   JPG/PNG, **CMYK detection by reading the JPEG SOF marker**) + opt-in **OCR** scan for forbidden
   URLs/handles/emails/dates via lazy-loaded `tesseract.js`.
4. **Editorial-pitch timeline** — day-accurate release-date guidance (missed Spotify 7-day window
   vs. the 14-day sweet spot).
5. **Per-distributor profiles + batch mode** — `lib/validation/profiles.ts` (DistroKid / CD Baby /
   TuneCore / Apple / generic) retunes severities; a "Batch / Catalog" mode groups a CSV into
   releases by album and grades each.

**No new operator setup or env vars.** `tesseract.js` installs via `npm install` on deploy and
runs entirely in the browser (model downloads from CDN on first artwork text scan).

---

## Context
MetaCheck is a music metadata validation SaaS. The landing page is live on Vercel.
All authenticated app routes have been built alongside the marketing page.

This is a Next.js 15 (App Router) project.

## Tech Stack
- **Framework**: Next.js 15, App Router, Server Components by default
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: Supabase (Postgres + RLS). Use `@supabase/ssr` for server/client.
- **Payments**: Stripe subscriptions (`stripe` SDK)
- **AI**: Google **Vertex AI / Gemini** via `@google/genai` (`lib/ai/gemini.ts`).
  Production uses **keyless Vertex (Workload Identity Federation)** drawing the GCP
  credit — no SA key, and `GEMINI_API_KEY` is NOT set in prod (only preview).
  Model order leads with `gemini-2.5-flash` (override via `GEMINI_MODELS`); the old
  `gemini-2.0-flash` was retired. `ANTHROPIC_API_KEY` is unrelated to the app — it
  only powers the optional Claude PR-review GitHub Action.
- **Styling**: Tailwind CSS v4 (already configured). Dark theme with teal accent (`#0d9488`).
- **File parsing**: `papaparse` for CSV parsing
- **PDF export**: `@react-pdf/renderer` or `jspdf` for generating clean PDF reports
- **Artwork OCR**: `tesseract.js` — **lazy-loaded** in the browser only when the user
  runs the artwork text scan (keeps it out of the page bundle; `/validate` stays ~15 kB).
  The engine + English model download from a CDN on first scan. No server-side OCR.
- **Deployment**: Vercel

## Current File Structure

```
app/
  layout.tsx                    # Root layout with ClerkProvider
  globals.css                   # Dark theme CSS — do not break
  page.tsx                      # Landing / marketing page
  demo.tsx                      # Live demo component (standalone, no auth)
  (marketing)/
    layout.tsx                  # Passthrough layout (no sidebar)
  (app)/
    layout.tsx                  # Auth guard + sidebar shell
    _components/Sidebar.tsx     # Fixed 240px sidebar with nav + UserButton
    dashboard/page.tsx          # Usage stats + recent releases
    validate/page.tsx           # Core validation UI (client component)
    history/page.tsx            # Past validations list (Pro only)
    history/[id]/page.tsx       # Release detail + export
    history/[id]/_components/ReleaseActions.tsx
    settings/page.tsx           # Plan + billing + account
  api/
    ai/fix/route.ts             # POST — Claude AI fix suggestions (Pro)
    checkout/route.ts           # GET ?tier=pro|team — Stripe checkout
    billing-portal/route.ts     # POST — Stripe customer portal
    releases/route.ts           # GET (list) + POST (save) releases
    webhooks/clerk/route.ts     # Clerk user sync → Supabase
    webhooks/stripe/route.ts    # Stripe subscription events → tier updates
lib/
  ai/prompts.ts                 # AI_FIX_SYSTEM_PROMPT for Claude
  auth/index.ts                 # getUserTier, canValidate, canUseAI, trackUsage, reserve/refundAiCall, consumeCredit/addCredits
  export/csv.ts                 # exportCsv() — browser download
  export/pdf.ts                 # exportPdf() — jsPDF report
  site.ts                       # SITE_URL canonical-origin resolver (firstValidOrigin, placeholder-host guard)
  stripe/index.ts               # createCheckoutSession, createPortalSession
  supabase/client.ts            # Browser client (createBrowserClient)
  supabase/server.ts            # Server client (createServerClient + cookies)
  supabase/admin.ts             # Admin client (service key, bypasses RLS)
  validation/rules.ts           # validateTrack, validateRelease, getGrade (profile-aware)
  validation/types.ts           # TrackMeta, ValidationResult, Grade, AiFix, DistributorProfile, ArtworkCheckResult
  validation/profiles.ts        # Per-distributor rule profiles (DistroKid/CD Baby/TuneCore/Apple/generic)
  validation/artwork.ts         # checkArtworkFile (specs + JPEG-CMYK), scanArtworkText (lazy OCR)
  validation/sync.ts            # checkSyncReadiness — 0–100 sync-licensing readiness score
supabase/
  migrations/001_schema.sql     # users, usage, releases tables + RLS
  migrations/00{2,3,4}_*.sql    # 002 paypal, 003 usage_and_credits, 004 hardening (RPC + webhook_events)
tests/e2e/public.spec.ts        # Playwright e2e (public surface, desktop + mobile)
playwright.config.ts            # e2e config — runs against a dev server on :3210
middleware.ts                   # Clerk route protection
.env.example                    # All required env vars documented
```

## What Was Built

All phases from the original spec are implemented. Key notes for ongoing work:

- Validation runs **100% client-side** — `lib/validation/rules.ts` is the source of truth. No server route needed for basic rules.
- `validateTrack(track, trackIndex?, profile?)` and `validateRelease(tracks, profile?)` take an
  optional **`DistributorProfile`** (from `lib/validation/profiles.ts`). The profile retunes which
  checks are critical vs. informational (e.g. DistroKid auto-assigns ISRC/UPC, Apple requires a
  producer credit). Defaults to the conservative `generic` profile, so existing 1/2-arg calls
  (e.g. the public demo) still work.
- `TrackMeta` now includes **`iswc`** and **`splits`** (writer splits as free text, e.g.
  `"Jane 50%, John 50%"` — the engine parses the percentages and requires them to total 100%).
- The validate page has four modes: single / multi / CSV / **batch**. Batch groups a flat CSV
  into releases by album and grades each separately. Artwork QC is a separate client-side panel.
- AI suggestions hit `POST /api/ai/fix` which calls Claude Sonnet 4. Gated to Pro/Team tier.
- All DB writes go through the admin Supabase client (service key, server-side only). Client-side Supabase reads use cookies-based server client.
- Stripe tier mapping lives in `app/api/webhooks/stripe/route.ts` — if you add new price IDs, update the price→tier map there.
- Grade colours/severity dots use **Tailwind class maps** (`GRADE_CLASSES`, `GRADE_DISPLAY`, `dotClass`) — do not reintroduce inline `style={}` hex values.



## Design System (MUST follow)
- **Background**: `#0a0a0c` (bg), `#111114` (elevated), `#16161a` (card), `#1e1e23` (surface)
- **Text**: `#e8e6e3` (primary), `#8a8a95` (muted), `#5a5a65` (dim)
- **Accent**: `#0d9488` (teal), `#14b8a6` (bright teal)
- **Severity colors**: red `#f43f5e` (critical), amber `#f59e0b` (warning), blue `#3b82f6` (suggestion), green `#22c55e` (success/grade-A)
- **Fonts**: `Outfit` (display/headings — heavy + tight, set via `--font-display`
  and the `.font-display` base rule), `Outfit` (body), `IBM Plex Mono` (code/data).
  _(As of the 20 June redesign — was `Instrument Serif` for display; do not revert.)_
- **Border**: `#2a2a30` (default), `#3a3a42` (bright)
- **Border radius**: `rounded-xl` for cards, `rounded-lg` for buttons/inputs
- Use `gradient-border` class (already in globals.css) for featured cards
- Use `glow-teal` class for primary CTAs

## Conventions
- TypeScript strict mode
- Server Components by default, `'use client'` only when interactivity is needed
- All API routes return `{ data, error }` shape
- Use Zod for request body validation in API routes
- Prices stored as integers (cents)
- Dates as ISO strings
- Validation runs CLIENT-SIDE for instant feedback (no API call for basic rules)
- AI suggestions are the only thing that hits the server

## Build Order (all complete ✅)
1. ✅ Auth + app shell (Clerk + sidebar layout)
2. ✅ Database (Supabase schema + clients)
3. ✅ Validation engine (30+ rules, fully client-side)
4. ✅ Validate page (manual + CSV input, results display)
5. ✅ AI fix suggestions (Claude API route, Pro gating)
6. ✅ Export (CSV + PDF)
7. ✅ Dashboard + history (Supabase reads, saved releases)
8. ✅ Settings + billing (Stripe checkout, portal, webhooks)
9. ✅ Tier gating (wired throughout)

## Do NOT
- Break the existing landing page or demo
- Use a UI component library other than raw Tailwind (no shadcn needed for this project — keep it lean)
- Add authentication to the marketing routes (/, /pricing)
- Use client-side data fetching where a Server Component would work
- Forget to handle loading and error states
- Skip the CSV column auto-mapping — this is critical UX for the target user
- Make the validation depend on a network call — basic rules MUST run client-side instantly
- Re-introduce inline `style={}` hex colour values — use Tailwind class maps instead

---

## Next Steps — Deployment Checklist

The codebase is complete. To go live, complete these steps in order:

### 1. Supabase
- [ ] Create a new Supabase project at [supabase.com](https://supabase.com)
- [ ] Run `supabase/migrations/001_schema.sql` in the **SQL editor**
  - If previously applied with the old `current_user` RLS policies, drop them first:
    ```sql
    DROP POLICY IF EXISTS "users_own" ON users;
    DROP POLICY IF EXISTS "usage_own" ON usage;
    DROP POLICY IF EXISTS "releases_own" ON releases;
    ```
  - Then re-run the migration
- [ ] Copy **Project URL** and **anon key** → `.env.local`
- [ ] Copy **service_role key** (Settings → API) → `.env.local` as `SUPABASE_SERVICE_KEY`
- [ ] _(Optional, defense-in-depth)_ The app reads through the service-role key scoped by
  Clerk user ID, so RLS is no longer required for the app to function. Only add your Clerk
  JWT public key in Supabase Auth settings if you also want anon-key reads to satisfy RLS.

### 2. Clerk
- [ ] Create a Clerk application at [clerk.com](https://clerk.com)
- [ ] Copy **Publishable Key** and **Secret Key** → `.env.local`
- [ ] Add webhook endpoint: `{APP_URL}/api/webhooks/clerk`
  - Events: `user.created`, `user.updated`, `user.deleted`
- [ ] Copy **Webhook Signing Secret** → `.env.local` as `CLERK_WEBHOOK_SECRET`
- [ ] Set `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
  (the app ships catch-all `app/sign-in` / `app/sign-up` routes)
- [ ] _(Optional)_ Only needed if you enabled the RLS/anon-key path above: in Clerk JWT
  Templates, add a template named `supabase` that includes `{ "sub": user.id }`

### 3. Stripe
- [ ] Create a Stripe account at [stripe.com](https://stripe.com)
- [ ] Create two products in the Stripe dashboard:
  - **MetaCheck Pro** — $9/month recurring → copy **Price ID** → `STRIPE_PRO_PRICE_ID`
  - **MetaCheck Label** — $29/month recurring → copy **Price ID** → `STRIPE_TEAM_PRICE_ID`
- [ ] Copy **Publishable Key** and **Secret Key** → `.env.local`
- [ ] Add webhook endpoint: `{APP_URL}/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Copy **Webhook Signing Secret** → `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 4. Google Gemini (AI)
- [ ] Get an API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- [ ] Copy → `.env.local` as `GEMINI_API_KEY`
- Note: without this key the AI route still responds, but falls back to rule-based
  suggestions (used by the public demo). A real key enables true AI fixes.

### 5. Local environment
- [ ] Copy `.env.example` → `.env.local`
- [ ] Fill in all values from the steps above
- [ ] Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local dev

### 6. Deploy to Vercel
- [ ] Push to GitHub
- [ ] Import to Vercel — it will detect Next.js automatically
- [ ] Add all environment variables in Vercel project settings (copy from `.env.local`)
- [ ] Change `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Update Clerk and Stripe webhook URLs to the production domain
- [ ] Deploy → `npm run build` should be clean ✓

### 7. Post-deploy verification
- [ ] Sign up as a new user — check Supabase `users` table is populated via Clerk webhook
- [ ] Run a validation — check `usage` table increments
- [ ] Upgrade to Pro via Stripe test mode — check `users.tier` updates via Stripe webhook
- [ ] Run an AI fix on a Pro account — check Gemini responds and `usage.ai_calls` increments
- [ ] Export a CSV and a PDF — verify downloads work
