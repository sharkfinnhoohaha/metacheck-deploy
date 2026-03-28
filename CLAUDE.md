# CLAUDE.md — MetaCheck: Build the Functional Tool

## Context
MetaCheck is a music metadata validation SaaS. The landing page is live on Vercel.
Now we need to build the actual working tool behind it: auth, the validation UI,
CSV upload, AI fix suggestions, export, usage tracking, and billing.

This is a Next.js 15 (App Router) project. The landing page currently lives at
`app/page.tsx` with a client-side demo component at `app/demo.tsx`. We need to
add authenticated app routes alongside the marketing page.

## Tech Stack
- **Framework**: Next.js 15, App Router, Server Components by default
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: Supabase (Postgres + RLS). Use `@supabase/ssr` for server/client.
- **Payments**: Stripe subscriptions (`stripe` SDK)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) — model: `claude-sonnet-4-20250514`
- **Styling**: Tailwind CSS v4 (already configured). Dark theme with teal accent (`#0d9488`).
- **File parsing**: `papaparse` for CSV parsing
- **PDF export**: `@react-pdf/renderer` or `jspdf` for generating clean PDF reports
- **Deployment**: Vercel

## Current File Structure
```
app/
  layout.tsx          # Root layout (keep as-is)
  globals.css         # Dark theme CSS (keep as-is)
  page.tsx            # Landing page (keep as-is — this is the marketing page)
  demo.tsx            # Live demo component (keep as-is)
```

## What to Build

### Phase 1: Auth + App Shell

1. **Install Clerk**: `npm install @clerk/nextjs`
2. **Add Clerk provider** to `app/layout.tsx` wrapping `{children}` in `<ClerkProvider>`
3. **Create middleware** at `middleware.ts`:
   - Public routes: `/`, `/pricing`, `/api/webhooks/(.*)`, `/sign-in(.*)`, `/sign-up(.*)`
   - All other routes require auth
4. **Create app layout** at `app/(app)/layout.tsx`:
   - Left sidebar (240px) with nav links: Dashboard, Validate Release, History, Settings
   - Use the existing dark theme colors from globals.css
   - Show `<UserButton />` at bottom of sidebar
   - Main content area scrolls independently
   - If no userId from `auth()`, redirect to `/sign-in`
5. **Move the landing page**: The current `app/page.tsx` is the marketing page.
   Create `app/(marketing)/layout.tsx` and `app/(marketing)/page.tsx` to house it.
   The marketing layout should NOT have the sidebar — just the existing nav + footer.
   Move `app/demo.tsx` into `app/(marketing)/demo.tsx`.

### Phase 2: Database

1. **Install Supabase**: `npm install @supabase/supabase-js @supabase/ssr`
2. **Create Supabase clients**:
   - `lib/supabase/client.ts` — browser client using `createBrowserClient`
   - `lib/supabase/server.ts` — server client using `createServerClient` with cookies
   - `lib/supabase/admin.ts` — admin client using `createClient` with `SUPABASE_SERVICE_KEY`
3. **Create migration** at `supabase/migrations/001_schema.sql`:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL REFERENCES users(clerk_id),
  month TEXT NOT NULL,
  validations INTEGER DEFAULT 0,
  ai_calls INTEGER DEFAULT 0,
  UNIQUE(clerk_id, month)
);

CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL REFERENCES users(clerk_id),
  title TEXT NOT NULL,
  artist TEXT,
  track_count INTEGER DEFAULT 0,
  grade TEXT,
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  suggestion_count INTEGER DEFAULT 0,
  tracks JSONB NOT NULL DEFAULT '[]',
  results JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_releases_clerk ON releases(clerk_id);
CREATE INDEX idx_releases_created ON releases(created_at DESC);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
```

### Phase 3: Validation Engine (the core feature)

The validation logic already exists in `app/demo.tsx` as inline functions.
**Extract and expand it into a proper module.**

1. **Create `lib/validation/rules.ts`** with the full validation engine:
   - Extract the `validate()` function from demo.tsx
   - Add these additional rules beyond what the demo has:
     - `isrc_duplicate`: Check for duplicate ISRCs within the same release
     - `title_special_chars`: Flag unusual characters (emojis in titles, etc.)
     - `artist_consistency`: Warn if primary artist name differs between tracks
     - `track_number_gaps`: Check for gaps or duplicates in track numbering
     - `duration_missing`: Warn if no duration is specified
     - `date_too_soon`: Warn if release date is < 7 days from now (Spotify pitch deadline)
     - `upc_missing`: Warn if UPC is missing for the release (not per-track)
     - `genre_consistency`: Suggest if all tracks should share the same genre
   - Every rule returns: `{ rule, field, severity, message, suggestion?, fixable }`
   - Severity levels: `critical` | `warning` | `suggestion`
   - Export `validateTrack(track)`, `validateRelease(tracks[])`, `getGrade(results)`

2. **Create `lib/validation/types.ts`**:
```typescript
export type TrackMeta = {
  trackNumber?: string;
  title: string;
  artist: string;
  featuredArtists?: string;
  album?: string;
  isrc?: string;
  upc?: string;
  genre?: string;
  releaseDate?: string;
  label?: string;
  songwriters?: string;
  producers?: string;
  composers?: string;
  copyright?: string;
  explicit?: string;
  language?: string;
  duration?: string;
};

export type ValidationResult = {
  rule: string;
  field: string;
  trackIndex?: number;
  severity: "critical" | "warning" | "suggestion";
  message: string;
  suggestion?: string;
  fixable: boolean;
};

export type Grade = "A" | "B" | "C" | "D" | "F";
```

### Phase 4: The Validate Page (main UI)

Create `app/(app)/validate/page.tsx` — this is the CORE of the product.

**It should support three input modes:**
1. **Manual entry**: A form for single-track metadata (like the demo, but fuller)
2. **Multi-track entry**: Add multiple tracks for an EP/album release
3. **CSV upload**: Upload a CSV file (DistroKid, TuneCore, CD Baby export format)

**The UI flow:**
1. User lands on `/validate`
2. They choose: "Single Track", "Multi-Track", or "Upload CSV"
3. For CSV: use `papaparse` to parse the file client-side. Map columns to our TrackMeta fields.
   Common CSV column names to auto-map:
   - "Track Title" / "Song Name" / "Title" → title
   - "Artist" / "Primary Artist" / "Artist Name" → artist
   - "ISRC" / "ISRC Code" → isrc
   - "UPC" / "UPC/EAN" / "Barcode" → upc
   - "Genre" / "Primary Genre" → genre
   - "Release Date" / "Street Date" → releaseDate
   - "Songwriter(s)" / "Writers" / "Songwriters" → songwriters
   - "Producer(s)" / "Producers" → producers
   - "Copyright" / "℗ Line" → copyright
   - "Explicit" / "Explicit Content" → explicit
   - "Language" / "Audio Language" → language
   - "Label" / "Label Name" / "Record Label" → label
4. After input, user clicks "Run Validation"
5. Show results page with:
   - Overall grade (A-F) in a large card at top
   - Summary: X critical, Y warnings, Z suggestions, N auto-fixable
   - Results grouped by severity, each showing field, message, suggestion
   - "Auto-fix All" button that applies all fixable suggestions
   - "Export Clean CSV" button that exports the corrected metadata
   - "Save to History" button that saves the release to Supabase
6. **Track tier limits**: Check usage before validating.
   - Free: 3 validations/month
   - Pro: unlimited
   - If at limit, show upgrade prompt

**Important UX details:**
- Keep the dark theme consistent with the landing page
- Use font-mono (IBM Plex Mono) for field names, ISRC codes, technical data
- Use Instrument Serif for headings
- Teal accent for primary actions, red for critical issues, amber for warnings, blue for suggestions
- Results should feel like a "scan report" — technical but readable
- The validation should run client-side (no API call needed for basic rules) for instant feedback

### Phase 5: AI Fix Suggestions (Pro feature)

1. **Create `app/api/ai/fix/route.ts`**:
   - POST endpoint accepting `{ tracks: TrackMeta[], results: ValidationResult[] }`
   - Uses Claude API to analyze the metadata and suggest intelligent fixes:
     - Correct likely misspellings in artist/songwriter names
     - Suggest proper genre based on artist + track title
     - Generate a copyright line from available data
     - Fix featured artist formatting
     - Suggest missing credits if detectable from context
   - System prompt should include music industry knowledge about DSP formatting requirements
   - Gate behind Pro tier (check user tier before calling Claude)
   - Track AI usage in the `usage` table

2. **Claude system prompt for the AI fixer** (put in `lib/ai/prompts.ts`):
```
You are a music metadata specialist. You understand DSP submission requirements
for Spotify, Apple Music, Amazon, Tidal, and YouTube Music.

Given a set of tracks with validation issues, suggest specific fixes.

Rules you enforce:
- Featured artists must use "(feat. Name)" format in track titles
- Title casing is preferred (not ALL CAPS, not all lowercase)
- ISRC format: CC-XXX-YY-NNNNN (12 alphanumeric characters)
- Every track needs songwriters listed for publishing royalty collection
- Copyright line format: ℗ YYYY Label/Artist Name
- Genre must match DSP-recognized genre lists
- Explicit flag must be set for all tracks

Respond ONLY with valid JSON. No markdown. No backticks. Format:
{
  "fixes": [
    {
      "trackIndex": 0,
      "field": "title",
      "original": "MIDNIGHT DRIVE ft. Luna",
      "fixed": "Midnight Drive (feat. Luna)",
      "reason": "Converted to title case and standardized featured artist format"
    }
  ]
}
```

3. **Wire into the validate page**: After basic validation runs, show an
   "AI Suggestions" button (Pro badge). When clicked, send tracks + results
   to the API, then display AI fixes as a separate section with "Apply" buttons.

### Phase 6: Export

1. **CSV Export** (`lib/export/csv.ts`):
   - Take the (potentially fixed) track metadata
   - Export as a clean CSV matching common distributor import formats
   - Columns: Track #, Title, Artist, Featured Artists, ISRC, UPC, Genre, Release Date, Songwriters, Producers, Composers, Copyright, Explicit, Language, Label
   - Trigger browser download

2. **PDF Report** (`lib/export/pdf.ts`):
   - Generate a PDF validation report showing:
     - Release title, artist, date
     - Overall grade
     - Issue summary
     - Per-track results
   - Use MetaCheck branding (teal accent, dark bg not necessary for PDF — white bg is fine for print)

### Phase 7: Dashboard + History

1. **Dashboard** at `app/(app)/dashboard/page.tsx`:
   - Welcome message with user's name
   - Usage stats: validations this month / limit, AI calls used
   - Quick action: "Validate New Release" button
   - Recent releases (last 5) from Supabase with grade, date, track count

2. **History** at `app/(app)/history/page.tsx`:
   - Full list of past validations from Supabase
   - Each row: release title, artist, grade, track count, date, "View" link
   - Click to view full results for that release (read-only)

3. **Release detail** at `app/(app)/history/[id]/page.tsx`:
   - Full validation results for a saved release
   - "Re-validate" button (re-runs with current rules)
   - "Export CSV" and "Export PDF" buttons

### Phase 8: Settings + Billing

1. **Settings** at `app/(app)/settings/page.tsx`:
   - Current plan display
   - Upgrade button → Stripe checkout
   - Manage billing → Stripe customer portal
   - Account section → link to Clerk user profile

2. **Stripe integration**:
   - `lib/stripe/index.ts` — Stripe client, `createCheckoutSession`, `createPortalSession`
   - `app/api/webhooks/stripe/route.ts` — handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `app/api/checkout/route.ts` — GET with `?tier=pro|team`, redirects to Stripe checkout
   - `app/api/billing-portal/route.ts` — POST, redirects to Stripe portal
   - Stripe products to create: MetaCheck Pro ($9/mo), MetaCheck Label ($29/mo)

3. **Clerk webhook** at `app/api/webhooks/clerk/route.ts`:
   - On `user.created` / `user.updated`: upsert into `users` table
   - On `user.deleted`: delete from `users` table

### Phase 9: Tier Gating

Create `lib/auth/index.ts`:
```typescript
// getUserTier(clerkId) → "free" | "pro" | "team"
// trackUsage(clerkId, type: "validation" | "ai_call") → currentCount
// canValidate(clerkId) → boolean (checks monthly limit)
// canUseAI(clerkId) → boolean (checks tier is pro+)
```

Tier limits:
- **Free**: 3 validations/month, 0 AI calls, basic rules (15), CSV export only
- **Pro**: Unlimited validations, 300 AI calls/month, all 30+ rules, AI suggestions, PDF export, history
- **Label**: Unlimited everything, 1500 AI calls, team members, API access, custom rules

Gate these at the page/API level:
- `/validate`: check `canValidate()` before running
- `/api/ai/fix`: check `canUseAI()` before calling Claude
- History page: show "Upgrade to Pro" if on free tier
- PDF export: Pro+ only

## Environment Variables Needed
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Design System (MUST follow)
- **Background**: `#0a0a0c` (bg), `#111114` (elevated), `#16161a` (card), `#1e1e23` (surface)
- **Text**: `#e8e6e3` (primary), `#8a8a95` (muted), `#5a5a65` (dim)
- **Accent**: `#0d9488` (teal), `#14b8a6` (bright teal)
- **Severity colors**: red `#f43f5e` (critical), amber `#f59e0b` (warning), blue `#3b82f6` (suggestion), green `#22c55e` (success/grade-A)
- **Fonts**: `Instrument Serif` (display/headings), `Outfit` (body), `IBM Plex Mono` (code/data)
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

## Build Order
Do these in order. Each phase should be deployable independently:
1. Auth + app shell (Clerk + sidebar layout)
2. Database (Supabase schema + clients)
3. Validation engine (extract from demo, expand rules)
4. Validate page (manual + CSV input, results display, client-side validation)
5. AI fix suggestions (Claude API route, Pro gating)
6. Export (CSV + PDF)
7. Dashboard + history (Supabase reads, saved releases)
8. Settings + billing (Stripe checkout, portal, webhooks)
9. Tier gating (wire limits throughout)

## Do NOT
- Break the existing landing page or demo
- Use a UI component library other than raw Tailwind (no shadcn needed for this project — keep it lean)
- Add authentication to the marketing routes (/, /pricing)
- Use client-side data fetching where a Server Component would work
- Forget to handle loading and error states
- Skip the CSV column auto-mapping — this is critical UX for the target user
- Make the validation depend on a network call — basic rules MUST run client-side instantly
