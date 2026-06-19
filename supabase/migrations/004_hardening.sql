-- 004 — Pre-market hardening: atomic AI-quota reservation + webhook idempotency.
-- Apply in the Supabase SQL editor after 001–003. Additive and idempotent — safe
-- to run on the live database; the app code degrades gracefully until it's applied.

-- ── Atomic AI-call reservation (closes the TOCTOU race on the free AI taste) ──
-- Reserves one AI call for the month IFF the user is under p_limit, atomically.
-- Returns the new count when granted, or NULL when at/over the limit — mirroring
-- consume_credit's NULL-on-empty contract so callers gate without a race window.
CREATE OR REPLACE FUNCTION consume_ai_call(p_clerk_id TEXT, p_month TEXT, p_limit INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE new_count INTEGER;
BEGIN
  INSERT INTO usage (clerk_id, month, validations, ai_calls)
  VALUES (p_clerk_id, p_month, 0, 0)
  ON CONFLICT (clerk_id, month) DO NOTHING;

  UPDATE usage SET ai_calls = ai_calls + 1
    WHERE clerk_id = p_clerk_id AND month = p_month AND ai_calls < p_limit
    RETURNING ai_calls INTO new_count;

  RETURN new_count; -- NULL when the monthly limit was already reached
END;
$$;

-- Refund a reserved AI call when the model didn't actually run (fell back to rules).
CREATE OR REPLACE FUNCTION refund_ai_call(p_clerk_id TEXT, p_month TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE usage SET ai_calls = GREATEST(ai_calls - 1, 0)
    WHERE clerk_id = p_clerk_id AND month = p_month;
END;
$$;

-- ── Webhook idempotency (Stripe + PayPal deliver at-least-once) ──────────────
-- The handler inserts each event id ON CONFLICT DO NOTHING and skips any event
-- already present, so a replayed event can't double-grant paid credits.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY; -- service-role only; no policy = no anon access

-- ── PayPal subscription uniqueness (prevents duplicate sub-id rows) ──────────
CREATE UNIQUE INDEX IF NOT EXISTS users_paypal_sub_unique
  ON users (paypal_subscription_id) WHERE paypal_subscription_id IS NOT NULL;
