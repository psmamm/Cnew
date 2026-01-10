-- Kill Switch for Emergency Trading Stop
-- Provides safety mechanism to halt all AI trading

CREATE TABLE IF NOT EXISTS kill_switch (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL UNIQUE,

  -- Status
  is_active INTEGER DEFAULT 0,
  reason TEXT,

  -- Timing
  triggered_at TEXT,
  recovery_at TEXT,

  -- Metadata
  triggered_by TEXT DEFAULT 'user', -- 'user', 'system', 'risk_management'
  total_activations INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_kill_switch_user_id ON kill_switch(user_id);
CREATE INDEX IF NOT EXISTS idx_kill_switch_is_active ON kill_switch(is_active);
