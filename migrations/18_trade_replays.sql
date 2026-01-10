-- Trade Replay Storage
-- Stores tick data, annotations, and analysis for trade replays

CREATE TABLE IF NOT EXISTS trade_replays (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_id TEXT NOT NULL UNIQUE,

  -- Market Data (JSON compressed)
  tick_data TEXT NOT NULL,
  timeframes_data TEXT,

  -- Annotations
  drawings TEXT DEFAULT '[]',
  notes TEXT DEFAULT '[]',
  screenshots TEXT DEFAULT '[]',

  -- AI Analysis
  ai_annotations TEXT DEFAULT '[]',
  what_if_scenarios TEXT DEFAULT '[]',

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_replays_trade_id ON trade_replays(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_replays_created_at ON trade_replays(created_at);
