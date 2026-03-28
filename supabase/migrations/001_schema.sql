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
  clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  validations INTEGER DEFAULT 0,
  ai_calls INTEGER DEFAULT 0,
  UNIQUE(clerk_id, month)
);

CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
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

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own data
CREATE POLICY "users_own" ON users
  FOR ALL USING (clerk_id = current_user);

CREATE POLICY "usage_own" ON usage
  FOR ALL USING (clerk_id = current_user);

CREATE POLICY "releases_own" ON releases
  FOR ALL USING (clerk_id = current_user);
