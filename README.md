# MetaCheck

AI-powered metadata checking tool for music releases. Audit your track metadata before distribution to catch permanent, money-losing mistakes — missing songwriter credits, bad ISRCs, genre mismatches, and more — that you can't undo after you hit "distribute."

**Live:** [metacheck-ten.vercel.app](https://metacheck-ten.vercel.app)

## Tech Stack

- **Next.js 15** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS 4** for styling
- **Supabase** (PostgreSQL) for database
- **Clerk** for authentication
- **Stripe** + **PayPal** for billing (Pro $9/mo, Label $29/mo tiers)
- **Google Gemini / Vertex AI** for AI-powered metadata fixes and artwork QC
- **Upstash Redis** for rate limiting
- **Tesseract.js** for client-side artwork OCR
- **jsPDF** for PDF report export
- **Playwright** for end-to-end tests

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project
- A Clerk application
- (For AI features) Google Gemini API key or Vertex AI service account
- (For billing) Stripe + PayPal developer accounts

### Installation

```bash
git clone https://github.com/sharkfinnhoohaha/metacheck-deploy.git
cd metacheck-deploy
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

Key variables (see `.env.example` for full list with comments):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key |
| `STRIPE_SECRET_KEY` | Stripe API secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `GEMINI_API_KEY` | Google Gemini API key (or Vertex AI config) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. `http://localhost:3000`) |

### Database Migrations

Apply migrations in order using the Supabase SQL Editor (Dashboard → SQL Editor) or `psql`:

```bash
# Using psql (replace with your connection string)
psql "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
  -f supabase/migrations/001_schema.sql
psql "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
  -f supabase/migrations/002_paypal.sql
# ... continue through 004_hardening.sql
```

Migrations 005–007 (Label tier features — additive and idempotent, safe to run together):

| Migration | Tables | Purpose |
|---|---|---|
| `005_support.sql` | `support_tickets` | Priority support ticket capture (Pro + Label tiers) |
| `006_api_keys.sql` | `api_keys` | Label-tier hashed API keys for programmatic access |
| `007_rule_configs.sql` | `rule_configs` | Label-tier custom validation rules (per-account config) |

All three are service-role-only (RLS enabled, no public policy) and degrade gracefully — API routes return 503 until applied.

### Development

```bash
npm run dev    # Start dev server at http://localhost:3000
```

### Build

```bash
npm run build  # Production build
npm run start  # Start production server
```

### Lint & Tests

```bash
npm run lint   # ESLint via next lint
npx playwright test  # End-to-end tests
```

## Project Structure

```
metacheck/
├── app/                      # Next.js App Router
│   ├── (app)/                # Authenticated app routes
│   │   ├── dashboard/        # User dashboard
│   │   ├── validate/         # Main metadata validation tool
│   │   ├── history/          # Past validation reports
│   │   ├── settings/         # Account settings, API keys, custom rules
│   │   ├── support/          # Priority support (Pro+)
│   │   └── admin/            # Admin dashboard + support triage
│   ├── (marketing)/          # Marketing layout group
│   ├── api/                  # API routes
│   │   ├── v1/               # Label-tier public API (validate)
│   │   ├── ai/               # AI fix + brief endpoints
│   │   ├── webhooks/         # Clerk, Stripe, PayPal webhooks
│   │   └── ...               # Checkout, billing, keys, support, etc.
│   ├── sign-in/              # Clerk sign-in
│   ├── sign-up/              # Clerk sign-up
│   ├── demo.tsx              # Public demo (no auth)
│   ├── features/             # Features landing page
│   ├── release-planner/      # Release planner tool
│   ├── privacy/              # Privacy policy
│   └── terms/                # Terms of service
├── lib/                      # Shared library code
│   ├── validation/           # Metadata validation engine
│   │   ├── rules.ts          # Core validation rules
│   │   ├── custom.ts         # Label-tier custom rule post-processor
│   │   ├── permanence.ts     # Permanent vs recoverable issue classification
│   │   └── artwork.ts        # Artwork QC (client-side OCR)
│   ├── audio/                # Audio pre-flight (client-side waveform analysis)
│   ├── ai/                   # Gemini/Vertex AI integration
│   ├── supabase/             # Supabase client/server/admin
│   ├── auth/                 # Clerk auth helpers + admin gate
│   ├── stripe/               # Stripe billing
│   ├── paypal/               # PayPal billing
│   ├── api/                  # API guard (Label-tier auth)
│   ├── export/               # PDF, CSV, split-sheet exporters
│   └── ratelimit.ts          # Upstash rate limiting
├── supabase/
│   └── migrations/           # SQL migrations (001–007)
├── tests/                    # Playwright e2e tests
├── middleware.ts             # Clerk + API route middleware
└── next.config.ts            # Next.js config
```

## Tiers

- **Free** — 3 metadata scans/month, public demo
- **Pro ($9/mo)** — 300 AI-assisted scans/month, PDF export, priority support
- **Label ($29/mo)** — Everything in Pro + 5 seats, API access, custom validation rules

## License

Proprietary. All rights reserved.