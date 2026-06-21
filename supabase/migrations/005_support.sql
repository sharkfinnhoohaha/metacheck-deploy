-- 005_support.sql — Priority support (Pro + Label tier): in-app ticket capture.
--
-- Additive + idempotent, matching the 003/004 migration contract. The table is
-- service-role-only (RLS enabled, NO policy) like webhook_events in 004 — the app
-- reads/writes exclusively through supabaseAdmin scoped by the Clerk user id.
--
-- NOTE (operator): unlike 004, the support write path needs this table to exist.
-- The API route catches "relation does not exist" and returns 503 until applied,
-- so deploying code before running this migration degrades gracefully rather than
-- 500-ing — but Support stays unavailable until you run it.

CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id      TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  email         TEXT,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  -- Snapshot of the submitter's tier + derived priority AT SUBMIT TIME, so a
  -- later up/downgrade never silently re-ranks an existing ticket.
  tier          TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'standard',   -- 'priority' | 'standard'
  priority_rank SMALLINT NOT NULL DEFAULT 1,        -- 0 = priority, 1 = standard (sortable)
  status        TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'closed'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: service-role-only (mirrors webhook_events in 004).

-- Admin triage: open tickets, highest priority first (rank 0), then oldest first.
CREATE INDEX IF NOT EXISTS idx_support_triage
  ON support_tickets (priority_rank ASC, created_at ASC)
  WHERE status = 'open';

-- Per-user lookups + the hourly spam-cap COUNT in the API route.
CREATE INDEX IF NOT EXISTS idx_support_by_user
  ON support_tickets (clerk_id, created_at DESC);
