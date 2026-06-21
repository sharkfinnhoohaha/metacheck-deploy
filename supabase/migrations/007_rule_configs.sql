-- 007_rule_configs.sql — Label-tier "Custom rules": per-account validation config.
--
-- Additive + idempotent. Service-role-only (RLS on, no policy). One row per
-- Label account (clerk_id PK, doubling as the FK). The app degrades to default
-- engine behavior if this is unapplied (GET returns null -> identity post-processor).
--
-- NOTE (operator): run alongside 005/006. The /api/rule-config PUT path catches
-- "relation does not exist" and 503s until applied.

CREATE TABLE IF NOT EXISTS rule_configs (
  clerk_id           TEXT PRIMARY KEY REFERENCES users(clerk_id) ON DELETE CASCADE,
  severity_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { rule_id: 'critical'|'warning'|'suggestion'|'off' }
  custom_checks      JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{ id, field, type, pattern?, severity, message }]
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rule_configs ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: service-role-only (mirrors webhook_events in 004).
