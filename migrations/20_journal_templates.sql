-- Journal Templates
-- Pre-built and user-created templates for trade journaling

CREATE TABLE IF NOT EXISTS journal_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT,

  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,

  -- Template Content (JSON)
  template_data TEXT NOT NULL,
  fields TEXT,

  -- Sharing
  is_public INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(google_user_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_templates_user_id ON journal_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_templates_category ON journal_templates(category);
CREATE INDEX IF NOT EXISTS idx_journal_templates_is_public ON journal_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_journal_templates_use_count ON journal_templates(use_count);

-- Default System Templates
INSERT OR IGNORE INTO journal_templates (id, user_id, name, description, category, template_data, is_public) VALUES
  ('tmpl_pre_trade', NULL, 'Pre-Trade Checklist', 'Complete before entering any trade', 'pre_trade',
   '{"sections":[{"title":"Market Analysis","fields":[{"name":"trend","type":"select","options":["Bullish","Bearish","Ranging"],"required":true},{"name":"key_levels","type":"text"},{"name":"volume_analysis","type":"text"}]},{"title":"Trade Plan","fields":[{"name":"entry_reason","type":"textarea","required":true},{"name":"entry_price","type":"number"},{"name":"stop_loss","type":"number","required":true},{"name":"take_profit","type":"number"},{"name":"position_size","type":"number"}]},{"title":"Risk Check","fields":[{"name":"risk_percent","type":"number","max":5},{"name":"rr_ratio","type":"number"},{"name":"emotional_state","type":"select","options":["Calm","Anxious","Excited","FOMO","Revenge"]}]}]}',
   1),

  ('tmpl_post_trade', NULL, 'Post-Trade Review', 'Analyze completed trades', 'post_trade',
   '{"sections":[{"title":"Trade Execution","fields":[{"name":"followed_plan","type":"boolean"},{"name":"entry_quality","type":"rating","max":5},{"name":"exit_quality","type":"rating","max":5}]},{"title":"Psychology","fields":[{"name":"emotional_state_entry","type":"select","options":["Calm","Anxious","Excited","FOMO","Revenge"]},{"name":"emotional_state_during","type":"select","options":["Calm","Anxious","Greedy","Fearful"]},{"name":"emotional_state_exit","type":"select","options":["Satisfied","Relieved","Frustrated","Regretful"]}]},{"title":"Lessons","fields":[{"name":"what_went_well","type":"textarea"},{"name":"what_could_improve","type":"textarea"},{"name":"key_lesson","type":"textarea","required":true}]}]}',
   1),

  ('tmpl_daily_review', NULL, 'Daily Trading Review', 'End of day trading summary', 'daily',
   '{"sections":[{"title":"Session Summary","fields":[{"name":"total_trades","type":"number"},{"name":"winners","type":"number"},{"name":"losers","type":"number"},{"name":"pnl","type":"number"}]},{"title":"Best Trade","fields":[{"name":"best_trade_symbol","type":"text"},{"name":"best_trade_reason","type":"textarea"}]},{"title":"Worst Trade","fields":[{"name":"worst_trade_symbol","type":"text"},{"name":"worst_trade_lesson","type":"textarea"}]},{"title":"Tomorrow","fields":[{"name":"watchlist","type":"text"},{"name":"focus_areas","type":"textarea"}]}]}',
   1),

  ('tmpl_weekly_review', NULL, 'Weekly Performance Review', 'Weekly trading performance analysis', 'weekly',
   '{"sections":[{"title":"Performance Metrics","fields":[{"name":"total_pnl","type":"number"},{"name":"win_rate","type":"number"},{"name":"average_rr","type":"number"},{"name":"biggest_win","type":"number"},{"name":"biggest_loss","type":"number"}]},{"title":"Strategy Analysis","fields":[{"name":"best_strategy","type":"text"},{"name":"worst_strategy","type":"text"},{"name":"strategy_adjustments","type":"textarea"}]},{"title":"Psychology","fields":[{"name":"overall_discipline","type":"rating","max":10},{"name":"tilt_moments","type":"number"},{"name":"psychological_wins","type":"textarea"}]},{"title":"Goals for Next Week","fields":[{"name":"focus_areas","type":"textarea"},{"name":"rules_to_enforce","type":"textarea"},{"name":"pnl_target","type":"number"}]}]}',
   1),

  ('tmpl_loss_analysis', NULL, 'Loss Trade Analysis', 'Deep dive into losing trades', 'analysis',
   '{"sections":[{"title":"Trade Details","fields":[{"name":"symbol","type":"text"},{"name":"entry_price","type":"number"},{"name":"exit_price","type":"number"},{"name":"loss_amount","type":"number"}]},{"title":"Root Cause Analysis","fields":[{"name":"was_planned","type":"boolean"},{"name":"followed_rules","type":"boolean"},{"name":"primary_reason","type":"select","options":["Poor Entry","Poor Exit","Position Too Large","No Stop Loss","Chased Entry","FOMO","Revenge Trade","Market Conditions","Other"]},{"name":"detailed_explanation","type":"textarea","required":true}]},{"title":"Prevention","fields":[{"name":"what_would_prevent","type":"textarea"},{"name":"new_rule_needed","type":"boolean"},{"name":"new_rule","type":"text"}]}]}',
   1),

  ('tmpl_scalping', NULL, 'Scalping Trade Journal', 'Quick trade documentation for scalpers', 'strategy',
   '{"sections":[{"title":"Quick Entry","fields":[{"name":"symbol","type":"text"},{"name":"direction","type":"select","options":["Long","Short"]},{"name":"setup","type":"select","options":["Breakout","Pullback","Reversal","Momentum","S/R Bounce"]},{"name":"timeframe","type":"select","options":["1m","5m","15m"]}]},{"title":"Execution","fields":[{"name":"entry_price","type":"number"},{"name":"exit_price","type":"number"},{"name":"duration_minutes","type":"number"},{"name":"slippage","type":"number"}]},{"title":"Quick Notes","fields":[{"name":"execution_quality","type":"rating","max":5},{"name":"quick_note","type":"text"}]}]}',
   1),

  ('tmpl_swing', NULL, 'Swing Trade Journal', 'Multi-day trade tracking', 'strategy',
   '{"sections":[{"title":"Trade Thesis","fields":[{"name":"symbol","type":"text"},{"name":"timeframe","type":"text"},{"name":"thesis","type":"textarea","required":true},{"name":"catalyst","type":"text"}]},{"title":"Technical Setup","fields":[{"name":"trend","type":"select","options":["Strong Uptrend","Uptrend","Ranging","Downtrend","Strong Downtrend"]},{"name":"key_support","type":"number"},{"name":"key_resistance","type":"number"},{"name":"indicators","type":"text"}]},{"title":"Management Plan","fields":[{"name":"initial_stop","type":"number"},{"name":"trailing_stop_method","type":"text"},{"name":"scale_out_levels","type":"text"},{"name":"max_hold_days","type":"number"}]}]}',
   1),

  ('tmpl_mindset', NULL, 'Trading Mindset Check', 'Pre-session mental preparation', 'psychology',
   '{"sections":[{"title":"Current State","fields":[{"name":"sleep_quality","type":"rating","max":5},{"name":"energy_level","type":"rating","max":5},{"name":"stress_level","type":"rating","max":5},{"name":"focus_level","type":"rating","max":5}]},{"title":"Mental Preparation","fields":[{"name":"ready_to_trade","type":"boolean"},{"name":"potential_distractions","type":"text"},{"name":"todays_affirmation","type":"text"}]},{"title":"Rules Reminder","fields":[{"name":"max_loss_today","type":"number"},{"name":"max_trades_today","type":"number"},{"name":"rule_focus","type":"text"}]}]}',
   1),

  ('tmpl_fomo_check', NULL, 'FOMO Prevention Checklist', 'Use before chasing trades', 'psychology',
   '{"sections":[{"title":"FOMO Check","fields":[{"name":"seeing_others_profit","type":"boolean"},{"name":"missed_move","type":"boolean"},{"name":"chasing_entry","type":"boolean"},{"name":"breaking_rules","type":"boolean"}]},{"title":"Reality Check","fields":[{"name":"is_valid_setup","type":"boolean"},{"name":"is_good_rr","type":"boolean"},{"name":"is_within_risk","type":"boolean"},{"name":"can_wait_for_better","type":"boolean"}]},{"title":"Decision","fields":[{"name":"take_trade","type":"boolean"},{"name":"reason","type":"textarea"}]}]}',
   1),

  ('tmpl_monthly', NULL, 'Monthly Trading Report', 'Comprehensive monthly analysis', 'monthly',
   '{"sections":[{"title":"Performance Summary","fields":[{"name":"total_pnl","type":"number"},{"name":"pnl_percent","type":"number"},{"name":"total_trades","type":"number"},{"name":"win_rate","type":"number"},{"name":"profit_factor","type":"number"},{"name":"max_drawdown","type":"number"}]},{"title":"Best & Worst","fields":[{"name":"best_day","type":"text"},{"name":"worst_day","type":"text"},{"name":"best_trade","type":"text"},{"name":"worst_trade","type":"text"}]},{"title":"Strategy Review","fields":[{"name":"strategy_performance","type":"textarea"},{"name":"strategy_adjustments","type":"textarea"}]},{"title":"Goals","fields":[{"name":"goals_achieved","type":"textarea"},{"name":"goals_missed","type":"textarea"},{"name":"next_month_goals","type":"textarea"}]}]}',
   1);
