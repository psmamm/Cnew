-- AI Clone Pattern Learning System
-- Stores learned trading patterns and AI clone configuration

-- ============================================================================
-- TRADE PATTERNS - Learned from user's trading history
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_patterns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,

  -- Pattern Identification
  pattern_name TEXT,
  pattern_type TEXT NOT NULL, -- 'entry', 'exit', 'position_sizing', 'time_based'

  -- Context
  symbol TEXT,
  asset_class TEXT,
  timeframe TEXT,
  setup_type TEXT,
  market_condition TEXT, -- 'trending', 'ranging', 'volatile', 'quiet'

  -- Pattern Features (ML Input - JSON)
  features_json TEXT NOT NULL,
  feature_importance TEXT, -- JSON showing which features matter most

  -- Outcome Statistics
  outcome TEXT NOT NULL, -- 'win', 'loss', 'breakeven'
  avg_pnl REAL,
  avg_pnl_percent REAL,
  win_rate REAL,
  sample_size INTEGER DEFAULT 1,

  -- Confidence & Quality
  confidence REAL DEFAULT 0.5,
  quality_score REAL DEFAULT 0.5,
  is_validated INTEGER DEFAULT 0,

  -- Timestamps
  first_seen TEXT,
  last_seen TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE
);

-- ============================================================================
-- AI CLONE CONFIG - Per-user configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_clone_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL UNIQUE,

  -- Permission Level
  permission_level TEXT DEFAULT 'observe', -- 'observe', 'suggest', 'semi_auto', 'full_auto'

  -- Risk Limits
  max_position_size REAL,
  max_position_percent REAL DEFAULT 5,
  max_daily_trades INTEGER DEFAULT 10,
  max_daily_loss REAL,
  max_daily_loss_percent REAL DEFAULT 5,
  min_confidence REAL DEFAULT 0.7,
  min_pattern_samples INTEGER DEFAULT 10,

  -- Asset Restrictions
  allowed_asset_classes TEXT, -- JSON array
  allowed_symbols TEXT, -- JSON array
  blocked_symbols TEXT, -- JSON array

  -- Time Restrictions
  allowed_hours TEXT, -- JSON: {start: "09:00", end: "16:00", timezone: "America/New_York"}
  allowed_days TEXT, -- JSON array: ["monday", "tuesday", ...]
  avoid_news_events INTEGER DEFAULT 1,

  -- Strategy Preferences
  preferred_strategies TEXT, -- JSON array of strategy IDs
  preferred_setups TEXT, -- JSON array of setup types

  -- Learning Settings
  learning_enabled INTEGER DEFAULT 1,
  retrain_interval_days INTEGER DEFAULT 7,
  min_trades_for_pattern INTEGER DEFAULT 5,

  -- Status
  is_active INTEGER DEFAULT 0,
  last_trade_at TEXT,
  last_retrain_at TEXT,
  total_suggestions INTEGER DEFAULT 0,
  accepted_suggestions INTEGER DEFAULT 0,
  executed_trades INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE
);

-- ============================================================================
-- AI CLONE DECISIONS - Suggestion and execution history
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_clone_decisions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  pattern_id TEXT,

  -- Decision Info
  decision_type TEXT NOT NULL, -- 'suggest', 'execute', 'skip'
  symbol TEXT NOT NULL,
  asset_class TEXT,
  side TEXT NOT NULL, -- 'long', 'short'

  -- Trade Parameters
  entry_price REAL,
  stop_loss REAL,
  take_profit REAL,
  position_size REAL,
  leverage REAL DEFAULT 1,

  -- Confidence & Reasoning
  confidence REAL NOT NULL,
  reasoning TEXT, -- JSON: explanation of why this trade
  pattern_matches TEXT, -- JSON: array of matched pattern IDs
  risk_score REAL,

  -- User Response
  was_approved INTEGER,
  user_response_at TEXT,
  rejection_reason TEXT,

  -- Execution
  was_executed INTEGER DEFAULT 0,
  execution_trade_id TEXT,
  execution_price REAL,
  execution_slippage REAL,
  execution_error TEXT,

  -- Outcome
  outcome TEXT, -- 'win', 'loss', 'breakeven', 'pending', 'cancelled'
  actual_pnl REAL,
  actual_pnl_percent REAL,

  -- Timestamps
  suggested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  executed_at TEXT,
  closed_at TEXT,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE,
  FOREIGN KEY (pattern_id) REFERENCES trade_patterns(id) ON DELETE SET NULL,
  FOREIGN KEY (execution_trade_id) REFERENCES trades(id) ON DELETE SET NULL
);

-- ============================================================================
-- AI CLONE LEARNING SESSIONS - Training history
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_clone_training (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,

  -- Training Info
  training_type TEXT NOT NULL, -- 'initial', 'incremental', 'full_retrain'
  trades_analyzed INTEGER,
  patterns_found INTEGER,
  patterns_updated INTEGER,

  -- Performance Before/After
  accuracy_before REAL,
  accuracy_after REAL,
  confidence_improvement REAL,

  -- Training Details
  features_used TEXT, -- JSON array
  model_version TEXT,
  training_duration_ms INTEGER,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trade_patterns_user_id ON trade_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_patterns_symbol ON trade_patterns(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_patterns_confidence ON trade_patterns(confidence);
CREATE INDEX IF NOT EXISTS idx_trade_patterns_outcome ON trade_patterns(outcome);

CREATE INDEX IF NOT EXISTS idx_ai_clone_decisions_user_id ON ai_clone_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_clone_decisions_symbol ON ai_clone_decisions(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_clone_decisions_suggested_at ON ai_clone_decisions(suggested_at);
CREATE INDEX IF NOT EXISTS idx_ai_clone_decisions_was_executed ON ai_clone_decisions(was_executed);

CREATE INDEX IF NOT EXISTS idx_ai_clone_training_user_id ON ai_clone_training(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_clone_training_status ON ai_clone_training(status);
