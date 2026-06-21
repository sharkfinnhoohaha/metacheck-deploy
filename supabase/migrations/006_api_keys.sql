-- 006_api_keys.sql — Label-tier programmatic API access (hashed API keys).
--
-- Additive + idempotent, matching the 003/004 contract. Service-role-only
-- (RLS on, no policy) like webhook_events. Only the SHA-256 hash of a key is
-- stored — the plaintext is shown to the user exactly once at creation.
--
-- NOTE (operator): the /api/keys + /api/v1 routes catch "relation does not
-- exist" and return 503 until this is applied, so deploying before migrating
-- degrades gracefully. (Runs cleanly alongside 005_support.sql.)

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id     TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  key_hash     TEXT UNIQUE NOT NULL,   -- SHA-256 hex of the plaintext; plaintext NEVER stored
  name         TEXT,                    -- user label, e.g. "CI" or "prod"
  prefix       TEXT NOT NULL,           -- 'mc_live_…last4', safe to display
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: service-role-only (mirrors webhook_events in 004).

-- List a user's active keys (the management UI); key_hash UNIQUE already indexes auth lookups.
CREATE INDEX IF NOT EXISTS idx_api_keys_owner
  ON api_keys (clerk_id, created_at DESC)
  WHERE revoked_at IS NULL;
