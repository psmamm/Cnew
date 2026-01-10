-- Voice Journal Storage
-- Stores audio recordings with emotion analysis from Hume AI

CREATE TABLE IF NOT EXISTS voice_journal (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  trade_id TEXT,

  -- Audio Storage
  audio_url TEXT NOT NULL,
  transcript TEXT,
  duration_seconds INTEGER DEFAULT 0,

  -- Emotion Analysis (Hume AI)
  emotion_data TEXT,
  primary_emotion TEXT,
  sentiment REAL,
  stress_level INTEGER DEFAULT 0,

  -- AI Extracted Insights
  extracted_insights TEXT,

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE,
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_journal_user_id ON voice_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_journal_trade_id ON voice_journal(trade_id);
CREATE INDEX IF NOT EXISTS idx_voice_journal_created_at ON voice_journal(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_journal_primary_emotion ON voice_journal(primary_emotion);
