-- 003 — Atomic usage counting + per-release credits
-- Apply in the Supabase SQL editor after 001 and 002.

-- ── Per-release credits ──────────────────────────────────────────────
-- A one-time "Per Release" purchase grants release credits that let a free-tier
-- user save / export / AI-fix one release beyond their monthly allowance.
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- ── Atomic monthly usage increment ───────────────────────────────────
-- Replaces the previous read-then-write in lib/auth, which let concurrent
-- requests double-count (or undercount) and could be raced past the free limit.
-- The UPDATE ... + 1 is atomic at the row level.
CREATE OR REPLACE FUNCTION increment_usage(p_clerk_id TEXT, p_month TEXT, p_column TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF p_column NOT IN ('validations', 'ai_calls') THEN
    RAISE EXCEPTION 'invalid usage column: %', p_column;
  END IF;

  INSERT INTO usage (clerk_id, month, validations, ai_calls)
  VALUES (p_clerk_id, p_month, 0, 0)
  ON CONFLICT (clerk_id, month) DO NOTHING;

  IF p_column = 'validations' THEN
    UPDATE usage SET validations = validations + 1
      WHERE clerk_id = p_clerk_id AND month = p_month
      RETURNING validations INTO new_count;
  ELSE
    UPDATE usage SET ai_calls = ai_calls + 1
      WHERE clerk_id = p_clerk_id AND month = p_month
      RETURNING ai_calls INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;

-- ── Atomic credit consume / grant ────────────────────────────────────
-- consume_credit returns the remaining balance after decrementing, or NULL when
-- the user had no credits (so callers can gate cleanly without a race).
CREATE OR REPLACE FUNCTION consume_credit(p_clerk_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  remaining INTEGER;
BEGIN
  UPDATE users SET credits = credits - 1
    WHERE clerk_id = p_clerk_id AND credits > 0
    RETURNING credits INTO remaining;
  RETURN remaining; -- NULL when no row updated (no credits available)
END;
$$;

CREATE OR REPLACE FUNCTION add_credits(p_clerk_id TEXT, p_qty INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total INTEGER;
BEGIN
  UPDATE users SET credits = credits + GREATEST(p_qty, 0)
    WHERE clerk_id = p_clerk_id
    RETURNING credits INTO total;
  RETURN total;
END;
$$;
