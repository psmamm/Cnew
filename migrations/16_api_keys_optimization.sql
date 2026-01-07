-- Migration 16: API Keys Table Optimization
-- Removes redundant IV column (Web Crypto API embeds IV in ciphertext)
-- Optimizes indexes for faster lookups

-- Remove IV column (redundant - Web Crypto API embeds IV in encrypted data)
-- Note: This migration assumes the api_keys table exists from migration 15
-- If IV column doesn't exist, this will fail gracefully

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- This is safe because we're only removing a redundant column

-- Step 1: Create new table without IV column
CREATE TABLE IF NOT EXISTS api_keys_new (
  user_id TEXT NOT NULL,
  exchange TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, exchange),
  FOREIGN KEY (user_id) REFERENCES users(google_user_id)
);

-- Step 2: Copy data from old table (without IV column)
INSERT INTO api_keys_new (user_id, exchange, encrypted_key, encrypted_secret, created_at, updated_at)
SELECT user_id, exchange, encrypted_key, encrypted_secret, created_at, updated_at
FROM api_keys;

-- Step 3: Drop old table
DROP TABLE IF EXISTS api_keys;

-- Step 4: Rename new table
ALTER TABLE api_keys_new RENAME TO api_keys;

-- Step 5: Recreate indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_exchange ON api_keys(exchange);

-- Composite index for common query pattern (user + exchange lookup)
CREATE INDEX IF NOT EXISTS idx_api_keys_user_exchange ON api_keys(user_id, exchange);
