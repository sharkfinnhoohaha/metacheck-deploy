-- PayPal billing (additive alongside Stripe).
-- Stores the active PayPal subscription ID so the webhook + cancel flow can
-- map a subscription back to a user. RLS already covers this column via the
-- existing FOR ALL policy on the users table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
