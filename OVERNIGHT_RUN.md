# MetaCheck — Overnight UI + Feature Run

Started: 2026-06-19 (overnight). Branch: `worktree-ui-modernize`.

## Goal (from Finn)
1. Audit + modernize the UI — minimize clutter, make it feel like Apple / modern sites.
2. Make the value proposition unmistakable on the landing page.
3. Add transitions on click/interaction.
4. Research-driven features, esp. music-supervision pain points.
5. Get as close to production-ready as possible; flag blockers.

## Decisions locked
- Keep the dark teal theme + 3-font system (it's already good). Modernize, don't replace.
- Replace emoji + unicode icons with clean inline SVG line icons.
- Reduce monospace-label noise; reserve mono for actual data.
- Add a real motion system: scroll-reveal, route transitions, hover micro-interactions, with `prefers-reduced-motion` guards.
- New flagship features (research-backed, both extend the existing client-side engine):
  - **Sync-Ready Score** — music-supervision readiness (the standout differentiator Finn called out).
  - **AI-disclosure validator** — per-distributor AI policy (was the deferred flagship).

## Research highlights (full report in run)
- Tracks fail on *paperwork*, not music: title formatting, feat-in-title, casing, artist-profile collisions, artwork content, splits != 100%, MLC non-registration.
- Music supervision is underserved: supervisors need one-stop clearance, instrumental/clean/stems, BPM/key, mood tags, reachable contact. No tool *validates* sync-readiness today.
- 2025-26: AI-disclosure went from nothing to de-facto required; distributor AI policy is a spectrum (CD Baby ban -> DistroKid permissive). Spotify now requires full legal names for writers.

## Progress log
- [x] Worktree created. NOTE: worktree had no node_modules — ran `npm install` (earlier "passing" builds were masked by `| tail`). Now building real.
- [x] Full UI + engine recon complete.
- [x] Motion/design-system foundation (globals.css) — easing tokens, scroll-reveal, route transitions, hover/press micro-interactions, reduced-motion guard, focus rings.
- [x] Reusable primitives: `Reveal` (IntersectionObserver), inline SVG icon set, `(app)/template.tsx` route transition.
- [x] Landing page rework — centered Apple-style hero, sharper value prop, outcomes strip, SVG icons, scroll reveals, Sync-Ready + AI-disclosure surfaced, de-cluttered CTAs.
- [x] Demo modernized (SVG icons, pop-in dropdown).
- [x] App shell — sidebar SVG icons + blur, route transitions.
- [x] Sync-Ready feature — `lib/validation/sync.ts` (0–100 score across clearable/usable/discoverable) + opt-in panel on /validate.
- [x] AI-disclosure feature — `aiPolicy` per distributor profile + engine rule + form field.
- [x] Dashboard + history polish (icons, motion).
- [x] Final build green (exit 0) + visual verify in browser (hero, outcomes, demo engine run, features, pricing all confirmed).

## What changed (files)
- `app/globals.css` — motion system (easing tokens, scroll-reveal, route transition, hover/press, shimmer, pop-in), refined tokens, focus rings, reduced-motion guard.
- `app/_components/Reveal.tsx` — IntersectionObserver scroll-reveal wrapper.
- `app/_components/icons.tsx` — inline SVG line-icon set (replaces all emoji/unicode glyphs).
- `app/(app)/template.tsx` — route transition for the authed app.
- `app/page.tsx` — full landing rework (centered hero, value-prop outcomes strip, SVG features incl. Sync-Ready + AI-disclosure, scroll reveals, de-cluttered CTAs).
- `app/demo.tsx` — modernized icons + pop-in dropdown; copy polish.
- `app/(app)/_components/Sidebar.tsx` — SVG icons, blur, motion.
- `app/(app)/dashboard|history/page.tsx` — icons + motion polish.
- `app/(app)/validate/page.tsx` — AI-disclosure field, Sync-Ready opt-in panel, emoji→icons, lighter labels.
- `lib/validation/types.ts` — sync + AI-disclosure fields; `aiPolicy` on profiles.
- `lib/validation/profiles.ts` — per-distributor `aiPolicy` (CD Baby ban, TuneCore restricted, DistroKid/Apple disclose).
- `lib/validation/rules.ts` — AI-disclosure rule (profile-aware).
- `lib/validation/sync.ts` — NEW Sync-Ready scoring engine (0–100, clearable/usable/discoverable).

## Reddit pain-point coverage pass (follow-up)
Ran a multi-agent audit: 6 research agents (Reddit + distributor forums) → 45 pain points → coverage audit vs. the engine → adversarial verification → **39 confirmed gaps**. Closed the ~20 highest-value ones that work on EXISTING fields (zero new UI), verified with a 29-assertion behavioral test harness (all pass):

- **Titles:** broadened feat-in-title detection (feat./ft./featuring/with/brackets, fixable), banned/promo words (Original Mix, Exclusive, Out Now…), store/DSP names, URLs/@handles (critical), keyword-stuffing/playlist-bait, double-space, decorative-unicode (fancy fonts), square-bracket balance, expanded version descriptors (edit/mix/radio edit/VIP/version/sped-up…).
- **Identifiers:** ISRC↔UPC swap detection (both directions), UPC GS1 check-digit validation.
- **Credits:** placeholder credits (TBD/Pending/N/A, critical on Apple), full-legal-name heuristic (handles/single-token).
- **Artist:** casing/punctuation-only duplicate-profile split (critical), generic/SEO artist-name flag.
- **Scheduling:** missing-date warning, same-day-release warning, distributor delivery lead-time math (`reviewLeadDays` per profile) feeding the editorial-pitch window.
- **Other:** generic-genre flag, sub-30s + ~31s royalty-farming + functional-track min-length, explicit/profanity mismatch, language/charset mismatch, SoundExchange registration reminder.

**Deferred (need NEW input fields — your call before I add UI):**
- Re-upload / distributor-switch ISRC continuity (reuse old ISRC or streams reset to 0) — needs `isReupload` + `existingIsrc`.
- Artist-profile collision via supplying Spotify URI / Apple Artist ID — needs `spotifyArtistId` / `appleArtistId`.
- Cover/remix mechanical-license + clearance — needs `isCover`/`isRemix`/`mechanicalLicenseSecured`.
- One-pitch-per-release picker (`pitchPick`), publishing-admin double-registration conflict (`publishingAdmin`), artwork-text↔metadata exact-match (extend OCR).

## Onboarding + AI value pass (judge-panel designed, ultracode)
Ran an 8-agent judge-panel design workflow on "smoothest onboarding + most value to convert free→paid (credits available)", then built the top, lowest-risk features:

**Onboarding (no AI, zero credit cost):**
- **One-click sample release** on /validate — `sampleTrack()` with planted issues grades instantly so a new user sees the tool catch real problems without typing. Button + dashboard "see a sample first →" deep-link (`?sample=1`).
- **Paste-a-row** box — paste a DistroKid/CD Baby/TuneCore row or "Title - Artist" free text → instant grade (header-aware via papaparse).
- **Demo→signup handoff** — the public demo stores the checked release in localStorage; /validate hydrates it on first load ("Picked up where you left off") so signup continues instead of restarting.

**AI value (spends Gemini credits, drives conversion):**
- **Free AI taste** — free tier now gets **1 AI fix/month** (was 0) via `canUseAI` (no migration; self-enforced by the usage counter). Exhaustion returns a structured `{upgrade:true}` payload → in-context **UpgradeCard** instead of a raw error.
- **"What this costs you"** — the AI fix response now returns an `impact` line (royalties lost / rejection risk) rendered as a callout; deterministic fallback when no AI.
- **AI Submission Readiness Brief** — new `/api/ai/brief` route + card: a manager-grade verdict (ready / close / not-ready), money-at-risk exposure, and a prioritized fix order. Reuses the same Vertex/Gemini client, rate-limiting, gating and rule-fallback as the fix route. No new env vars.

## Admin dashboard + market-readiness hardening pass
Built an internal admin dashboard and hardened the backend after a 17-agent security/QA review (11 confirmed findings) + a follow-up implementation review.

**Admin dashboard** — `/admin` (deny-by-default, gated by `ADMIN_USER_IDS` / `ADMIN_EMAILS`; shows in the sidebar only for admins). KPIs (users, est. MRR, validations/mo, AI calls/mo = credit-burn proxy), tier breakdown, recent signups + releases, and a "what to watch" panel with links.

**Backend hardening:**
- **Atomic AI-quota reservation** (`consume_ai_call` RPC + `reserveAiCall`/`refundAiCall`) — closes a TOCTOU race where parallel requests let a free user exceed the 1-free-AI-fix/month limit (~25x credit-drain per account). Refunds on any rules-fallback so non-AI results aren't billed.
- **Webhook idempotency** (`webhook_events` table + `markWebhookProcessed`) — a replayed Stripe credit-purchase event no longer double-grants paid credits; mark-then-fail is undone so retries still process.
- **Global anonymous-AI daily budget** — caps total anonymous demo Vertex spend (500/day) regardless of IP rotation; fails to rules when spent.
- **Stripe webhook** now logs when a customer update/delete matches zero users (silent-drift visibility).
- **PayPal** unique index on `paypal_subscription_id` + idempotency.
- **Security headers** in `next.config.ts` (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). CSP deferred (needs an allowlist for Clerk/Stripe).
- **History** query capped at 100 rows; **AI-fix apply** now re-grades the release.

All code DEGRADES GRACEFULLY before migration 004 is applied (RPC/table absent → prior behavior), so deploy order is safe.

## GitHub Actions
- `.github/workflows/ci.yml` — lint + `tsc --noEmit` + build on every PR and push-to-main.
- `.github/workflows/claude-review.yml` — auto Claude review on every PR (needs the Claude GitHub App + `ANTHROPIC_API_KEY` secret; harmless no-op until configured).

## What to monitor / respond to (operations)
- **GCP Vertex credit burn** — GCP Billing → Vertex AI, against the $300 credit. Free users each spend ~1 AI call/mo; watch the trend. Dial via `FREE_AI_TASTE` (lib/auth) or the anon daily budget.
- **Webhooks firing** — Clerk (user sync), Stripe + PayPal (tier/credits). A stuck webhook shows as signups not appearing or tiers not updating. Check provider dashboards + the new "no user matched" error logs.
- **Errors / abuse** — Vercel runtime logs for 5xx on /api/* and 429 rate-limits.
- **Upstash rate limiter** — must stay configured in prod (the anonymous AI demo fails closed to rules without it).
- **Conversions** — `/admin` shows paying vs total; the free AI taste is the lever.

## Go-to-market checklist (what YOU need to do next)
1. **Run `supabase/migrations/004_hardening.sql`** in the Supabase SQL editor to ACTIVATE the AI-quota race fix + webhook idempotency (code is safe before it; just not yet race-proof).
2. **Set `ADMIN_USER_IDS`** (your Clerk user id) or `ADMIN_EMAILS` in Vercel env to unlock `/admin`.
3. **Enable PR review:** install the Claude GitHub App (`claude /install-github-app`) + add the `ANTHROPIC_API_KEY` repo secret.
4. **Custom domain** — point one at the Vercel project; update `NEXT_PUBLIC_APP_URL` + Clerk/Stripe/PayPal webhook URLs.
5. **Confirm billing is in live mode** (Stripe + PayPal live keys/plans + webhooks).
6. **Legal** — Terms/Privacy pages exist; review the copy before charging.
7. **Pull `main`** locally (the worktree pushed straight to origin/main).

## Operator action items (chat reply has these too)
1. This work is on branch `worktree-ui-modernize` (NOT merged to main, NOT pushed). Review, then merge when happy.
2. Nothing new to configure — both new features run 100% client-side, no env vars.
3. Pre-existing deploy checklist (Supabase/Clerk/Stripe/Gemini keys, webhooks) still applies — unchanged by this run.
4. The two-lockfile build warning is pre-existing (a stray `package-lock.json` in your home dir); harmless, optional to silence via `turbopack.root`.
</content>
