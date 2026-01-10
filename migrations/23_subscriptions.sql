-- Subscriptions for Freemium Model
-- Tracks user subscription status and usage

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL UNIQUE,

  -- Tier
  tier TEXT DEFAULT 'free', -- 'free', 'pro', 'elite'

  -- Stripe Integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,

  -- Billing
  billing_interval TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',

  -- Usage Tracking
  trades_this_month INTEGER DEFAULT 0,
  trades_limit INTEGER DEFAULT 50,
  voice_minutes_used INTEGER DEFAULT 0,
  voice_minutes_limit INTEGER DEFAULT 10,
  storage_used_mb INTEGER DEFAULT 0,
  storage_limit_mb INTEGER DEFAULT 100,
  api_calls_this_month INTEGER DEFAULT 0,
  api_calls_limit INTEGER DEFAULT 1000,

  -- Feature Flags
  ai_clone_enabled INTEGER DEFAULT 0,
  auto_trading_enabled INTEGER DEFAULT 0,
  advanced_reports_enabled INTEGER DEFAULT 0,
  multi_exchange_enabled INTEGER DEFAULT 0,
  priority_support INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'past_due', 'cancelled', 'trialing'
  trial_ends_at TEXT,

  -- Billing Dates
  current_period_start TEXT,
  current_period_end TEXT,
  cancelled_at TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE
);

-- Usage Events for tracking
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  subscription_id TEXT,

  -- Event Info
  event_type TEXT NOT NULL, -- 'trade', 'voice_minute', 'storage', 'api_call'
  event_value INTEGER DEFAULT 1,

  -- Metadata
  metadata TEXT, -- JSON

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);

-- Tier Configurations (reference)
-- FREE: 50 trades/month, 10 voice min, 100MB, 1 exchange, basic reports
-- PRO ($29/month): Unlimited trades, unlimited voice, 10GB, all exchanges, advanced reports, AI Clone observe+suggest
-- ELITE ($99/month): All PRO features + Auto-trading, priority support, 1:1 coaching
