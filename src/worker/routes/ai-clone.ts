import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";

// ============================================================================
// AI CLONE - Pattern Learning & Trade Suggestions
// ============================================================================

type Env = {
  DB: D1Database;
  AI: unknown; // Cloudflare Workers AI
};

interface UserVariable {
  google_user_data?: {
    sub: string;
    email?: string;
    name?: string;
  };
  firebase_user_id?: string;
  email?: string;
}

export const aiCloneRouter = new Hono<{ Bindings: Env; Variables: { user: UserVariable } }>();

// Firebase auth middleware
const firebaseAuthMiddleware = async (c: unknown, next: () => Promise<void>) => {
  const context = c as {
    get: (key: string) => UserVariable | undefined;
    set: (key: string, value: UserVariable) => void;
    json: (data: { error: string }, status: number) => Response;
  };

  const firebaseSession = getCookie(context as Parameters<typeof getCookie>[0], 'firebase_session');
  if (firebaseSession) {
    try {
      const userData = JSON.parse(firebaseSession) as { google_user_id?: string; sub?: string; email?: string; name?: string };
      context.set('user', {
        google_user_data: {
          sub: userData.google_user_id || userData.sub || '',
          email: userData.email,
          name: userData.name,
        },
        email: userData.email,
      });
      return next();
    } catch (error) {
      console.error('Error parsing Firebase session:', error);
    }
  }

  return context.json({ error: 'Unauthorized' }, 401);
};

aiCloneRouter.use('*', firebaseAuthMiddleware);

// ============================================================================
// TYPES
// ============================================================================

interface TradeFeatures {
  // Price action
  price_vs_ma20: number;
  price_vs_ma50: number;
  price_change_1h: number;
  price_change_4h: number;
  price_change_24h: number;

  // Volatility
  volatility_ratio: number;
  atr_percent: number;

  // Volume
  volume_ratio: number;
  volume_trend: number;

  // Time
  hour_of_day: number;
  day_of_week: number;
  is_market_open: boolean;

  // Position
  position_size_percent: number;
  leverage: number;
  risk_reward_ratio: number;

  // Context
  consecutive_wins: number;
  consecutive_losses: number;
  daily_pnl_before: number;
  emotion_state?: string;
}

interface Pattern {
  id: string;
  pattern_type: string;
  symbol: string;
  setup_type: string;
  features: TradeFeatures;
  win_rate: number;
  avg_pnl_percent: number;
  confidence: number;
  sample_size: number;
}

interface Suggestion {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  position_size: number;
  confidence: number;
  reasoning: string[];
  matched_patterns: Pattern[];
  risk_score: number;
  expires_at: string;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const UpdateConfigSchema = z.object({
  permission_level: z.enum(['observe', 'suggest', 'semi_auto', 'full_auto']).optional(),
  max_position_percent: z.number().min(0.1).max(100).optional(),
  max_daily_trades: z.number().min(1).max(100).optional(),
  max_daily_loss_percent: z.number().min(0.1).max(50).optional(),
  min_confidence: z.number().min(0.5).max(0.99).optional(),
  allowed_asset_classes: z.array(z.string()).optional(),
  allowed_symbols: z.array(z.string()).optional(),
  blocked_symbols: z.array(z.string()).optional(),
  allowed_hours: z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
  }).optional(),
  allowed_days: z.array(z.string()).optional(),
  learning_enabled: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const ApproveSuggestionSchema = z.object({
  approved: z.boolean(),
  rejection_reason: z.string().optional(),
  modified_params: z.object({
    entry_price: z.number().optional(),
    stop_loss: z.number().optional(),
    take_profit: z.number().optional(),
    position_size: z.number().optional(),
  }).optional(),
});

// ============================================================================
// CONFIG ROUTES
// ============================================================================

// Get AI Clone config
aiCloneRouter.get('/config', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    let config = await c.env.DB.prepare(`
      SELECT * FROM ai_clone_config WHERE user_id = ?
    `).bind(userId).first();

    if (!config) {
      // Create default config
      const configId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO ai_clone_config (id, user_id) VALUES (?, ?)
      `).bind(configId, userId).run();

      config = await c.env.DB.prepare(`
        SELECT * FROM ai_clone_config WHERE id = ?
      `).bind(configId).first();
    }

    // Parse JSON fields
    const parsedConfig = {
      ...config,
      allowed_asset_classes: config?.allowed_asset_classes
        ? JSON.parse(config.allowed_asset_classes as string)
        : ['crypto'],
      allowed_symbols: config?.allowed_symbols
        ? JSON.parse(config.allowed_symbols as string)
        : [],
      blocked_symbols: config?.blocked_symbols
        ? JSON.parse(config.blocked_symbols as string)
        : [],
      allowed_hours: config?.allowed_hours
        ? JSON.parse(config.allowed_hours as string)
        : null,
      allowed_days: config?.allowed_days
        ? JSON.parse(config.allowed_days as string)
        : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      preferred_strategies: config?.preferred_strategies
        ? JSON.parse(config.preferred_strategies as string)
        : [],
      preferred_setups: config?.preferred_setups
        ? JSON.parse(config.preferred_setups as string)
        : [],
    };

    return c.json({ config: parsedConfig });
  } catch (error) {
    console.error('Error fetching AI clone config:', error);
    return c.json({ error: 'Failed to fetch config' }, 500);
  }
});

// Update AI Clone config
aiCloneRouter.put('/config', zValidator('json', UpdateConfigSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const updates = c.req.valid('json');

  try {
    // Build update query
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.permission_level !== undefined) {
      fields.push('permission_level = ?');
      values.push(updates.permission_level);
    }
    if (updates.max_position_percent !== undefined) {
      fields.push('max_position_percent = ?');
      values.push(updates.max_position_percent);
    }
    if (updates.max_daily_trades !== undefined) {
      fields.push('max_daily_trades = ?');
      values.push(updates.max_daily_trades);
    }
    if (updates.max_daily_loss_percent !== undefined) {
      fields.push('max_daily_loss_percent = ?');
      values.push(updates.max_daily_loss_percent);
    }
    if (updates.min_confidence !== undefined) {
      fields.push('min_confidence = ?');
      values.push(updates.min_confidence);
    }
    if (updates.allowed_asset_classes !== undefined) {
      fields.push('allowed_asset_classes = ?');
      values.push(JSON.stringify(updates.allowed_asset_classes));
    }
    if (updates.allowed_symbols !== undefined) {
      fields.push('allowed_symbols = ?');
      values.push(JSON.stringify(updates.allowed_symbols));
    }
    if (updates.blocked_symbols !== undefined) {
      fields.push('blocked_symbols = ?');
      values.push(JSON.stringify(updates.blocked_symbols));
    }
    if (updates.allowed_hours !== undefined) {
      fields.push('allowed_hours = ?');
      values.push(JSON.stringify(updates.allowed_hours));
    }
    if (updates.allowed_days !== undefined) {
      fields.push('allowed_days = ?');
      values.push(JSON.stringify(updates.allowed_days));
    }
    if (updates.learning_enabled !== undefined) {
      fields.push('learning_enabled = ?');
      values.push(updates.learning_enabled ? 1 : 0);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await c.env.DB.prepare(`
      UPDATE ai_clone_config SET ${fields.join(', ')} WHERE user_id = ?
    `).bind(...values).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating AI clone config:', error);
    return c.json({ error: 'Failed to update config' }, 500);
  }
});

// ============================================================================
// PATTERN LEARNING ROUTES
// ============================================================================

// Get learned patterns
aiCloneRouter.get('/patterns', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const minConfidence = parseFloat(c.req.query('min_confidence') || '0.5');
  const limit = parseInt(c.req.query('limit') || '50');

  try {
    const patterns = await c.env.DB.prepare(`
      SELECT * FROM trade_patterns
      WHERE user_id = ? AND confidence >= ?
      ORDER BY confidence DESC, sample_size DESC
      LIMIT ?
    `).bind(userId, minConfidence, limit).all();

    // Parse JSON fields
    const parsedPatterns = patterns.results.map((p: Record<string, unknown>) => ({
      ...p,
      features_json: p.features_json ? JSON.parse(p.features_json as string) : null,
      feature_importance: p.feature_importance ? JSON.parse(p.feature_importance as string) : null,
    }));

    return c.json({ patterns: parsedPatterns });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return c.json({ error: 'Failed to fetch patterns' }, 500);
  }
});

// Train/retrain AI Clone
aiCloneRouter.post('/train', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Create training session
    const trainingId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO ai_clone_training (id, user_id, training_type, status)
      VALUES (?, ?, 'incremental', 'running')
    `).bind(trainingId, userId).run();

    const startTime = Date.now();

    // Get user's closed trades
    const trades = await c.env.DB.prepare(`
      SELECT
        t.*,
        s.name as strategy_name,
        s.category as strategy_category
      FROM trades t
      LEFT JOIN strategies s ON t.strategy_id = s.id
      WHERE t.user_id = ? AND t.is_closed = 1
      ORDER BY t.exit_date DESC
      LIMIT 1000
    `).bind(userId).all();

    if (trades.results.length < 10) {
      await c.env.DB.prepare(`
        UPDATE ai_clone_training
        SET status = 'failed', error_message = 'Not enough trades for training (minimum 10)'
        WHERE id = ?
      `).bind(trainingId).run();

      return c.json({
        error: 'Not enough trades for training',
        minimum_required: 10,
        current_count: trades.results.length,
      }, 400);
    }

    // Extract features and find patterns
    const patterns = extractPatterns(trades.results as unknown as TradeData[]);
    let patternsFound = 0;
    let patternsUpdated = 0;

    for (const pattern of patterns) {
      // Check if pattern already exists
      const existing = await c.env.DB.prepare(`
        SELECT id, sample_size, avg_pnl, win_rate
        FROM trade_patterns
        WHERE user_id = ? AND pattern_type = ? AND symbol = ? AND setup_type = ?
      `).bind(userId, pattern.pattern_type, pattern.symbol, pattern.setup_type).first();

      if (existing) {
        // Update existing pattern with new data
        const newSampleSize = (existing.sample_size as number) + pattern.sample_size;
        const newWinRate = ((existing.win_rate as number) * (existing.sample_size as number) +
          pattern.win_rate * pattern.sample_size) / newSampleSize;
        const newAvgPnl = ((existing.avg_pnl as number) * (existing.sample_size as number) +
          pattern.avg_pnl * pattern.sample_size) / newSampleSize;
        const newConfidence = calculateConfidence(newWinRate, newSampleSize);

        await c.env.DB.prepare(`
          UPDATE trade_patterns
          SET sample_size = ?, win_rate = ?, avg_pnl = ?, confidence = ?,
              features_json = ?, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          newSampleSize,
          newWinRate,
          newAvgPnl,
          newConfidence,
          JSON.stringify(pattern.features),
          existing.id
        ).run();

        patternsUpdated++;
      } else {
        // Create new pattern
        const patternId = crypto.randomUUID();
        const confidence = calculateConfidence(pattern.win_rate, pattern.sample_size);

        await c.env.DB.prepare(`
          INSERT INTO trade_patterns (
            id, user_id, pattern_type, symbol, setup_type, asset_class,
            features_json, outcome, avg_pnl, avg_pnl_percent, win_rate,
            sample_size, confidence, first_seen, last_seen
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          patternId,
          userId,
          pattern.pattern_type,
          pattern.symbol,
          pattern.setup_type,
          pattern.asset_class,
          JSON.stringify(pattern.features),
          pattern.win_rate >= 0.5 ? 'win' : 'loss',
          pattern.avg_pnl,
          pattern.avg_pnl_percent,
          pattern.win_rate,
          pattern.sample_size,
          confidence
        ).run();

        patternsFound++;
      }
    }

    // Update training session
    const endTime = Date.now();
    await c.env.DB.prepare(`
      UPDATE ai_clone_training
      SET status = 'completed',
          trades_analyzed = ?,
          patterns_found = ?,
          patterns_updated = ?,
          training_duration_ms = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      trades.results.length,
      patternsFound,
      patternsUpdated,
      endTime - startTime,
      trainingId
    ).run();

    // Update last retrain time in config
    await c.env.DB.prepare(`
      UPDATE ai_clone_config SET last_retrain_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `).bind(userId).run();

    return c.json({
      success: true,
      training_id: trainingId,
      trades_analyzed: trades.results.length,
      patterns_found: patternsFound,
      patterns_updated: patternsUpdated,
      duration_ms: endTime - startTime,
    });
  } catch (error) {
    console.error('Error training AI clone:', error);
    return c.json({ error: 'Failed to train AI clone' }, 500);
  }
});

// ============================================================================
// SUGGESTION ROUTES
// ============================================================================

// Get active suggestions
aiCloneRouter.get('/suggestions', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const suggestions = await c.env.DB.prepare(`
      SELECT * FROM ai_clone_decisions
      WHERE user_id = ? AND decision_type = 'suggest' AND was_approved IS NULL
      ORDER BY suggested_at DESC
      LIMIT 10
    `).bind(userId).all();

    // Parse JSON fields
    const parsedSuggestions = suggestions.results.map((s: Record<string, unknown>) => ({
      ...s,
      reasoning: s.reasoning ? JSON.parse(s.reasoning as string) : [],
      pattern_matches: s.pattern_matches ? JSON.parse(s.pattern_matches as string) : [],
    }));

    return c.json({ suggestions: parsedSuggestions });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return c.json({ error: 'Failed to fetch suggestions' }, 500);
  }
});

// Generate new suggestions
aiCloneRouter.post('/suggestions/generate', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Get config
    const config = await c.env.DB.prepare(`
      SELECT * FROM ai_clone_config WHERE user_id = ?
    `).bind(userId).first();

    if (!config || config.is_active !== 1) {
      return c.json({ error: 'AI Clone is not active' }, 400);
    }

    const permissionLevel = config.permission_level as string;
    if (permissionLevel === 'observe') {
      return c.json({
        error: 'AI Clone is in observe mode. Enable suggestions in settings.',
      }, 400);
    }

    // Get high-confidence patterns
    const minConfidence = (config.min_confidence as number) || 0.7;
    const patterns = await c.env.DB.prepare(`
      SELECT * FROM trade_patterns
      WHERE user_id = ? AND confidence >= ? AND sample_size >= ?
      ORDER BY confidence DESC
      LIMIT 20
    `).bind(userId, minConfidence, (config.min_pattern_samples as number) || 10).all();

    if (patterns.results.length === 0) {
      return c.json({
        suggestions: [],
        message: 'No high-confidence patterns found. Continue trading to train the AI.',
      });
    }

    // Generate suggestions based on patterns
    // In a real implementation, this would analyze current market conditions
    // For now, we return the top patterns as potential suggestions
    const suggestions: Partial<Suggestion>[] = [];

    for (const pattern of patterns.results.slice(0, 5)) {
      const features = pattern.features_json
        ? JSON.parse(pattern.features_json as string)
        : {};

      // Create suggestion
      const suggestionId = crypto.randomUUID();
      const side = features.price_change_24h > 0 ? 'long' : 'short';

      await c.env.DB.prepare(`
        INSERT INTO ai_clone_decisions (
          id, user_id, pattern_id, decision_type, symbol, side,
          confidence, reasoning, pattern_matches, risk_score
        ) VALUES (?, ?, ?, 'suggest', ?, ?, ?, ?, ?, ?)
      `).bind(
        suggestionId,
        userId,
        pattern.id,
        pattern.symbol,
        side,
        pattern.confidence,
        JSON.stringify([
          `Based on ${pattern.sample_size} similar trades`,
          `Historical win rate: ${((pattern.win_rate as number) * 100).toFixed(1)}%`,
          `Average P&L: ${((pattern.avg_pnl_percent as number) || 0).toFixed(2)}%`,
        ]),
        JSON.stringify([pattern.id]),
        1 - (pattern.confidence as number)
      ).run();

      suggestions.push({
        id: suggestionId,
        symbol: pattern.symbol as string,
        side: side as 'long' | 'short',
        confidence: pattern.confidence as number,
        reasoning: [
          `Based on ${pattern.sample_size} similar trades`,
          `Historical win rate: ${((pattern.win_rate as number) * 100).toFixed(1)}%`,
        ],
      });
    }

    // Update suggestion count
    await c.env.DB.prepare(`
      UPDATE ai_clone_config
      SET total_suggestions = total_suggestions + ?
      WHERE user_id = ?
    `).bind(suggestions.length, userId).run();

    return c.json({
      suggestions,
      total: suggestions.length,
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return c.json({ error: 'Failed to generate suggestions' }, 500);
  }
});

// Approve or reject suggestion
aiCloneRouter.post('/suggestions/:id/respond', zValidator('json', ApproveSuggestionSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const suggestionId = c.req.param('id');
  const { approved, rejection_reason, modified_params } = c.req.valid('json');

  try {
    // Verify ownership
    const suggestion = await c.env.DB.prepare(`
      SELECT * FROM ai_clone_decisions WHERE id = ? AND user_id = ?
    `).bind(suggestionId, userId).first();

    if (!suggestion) {
      return c.json({ error: 'Suggestion not found' }, 404);
    }

    // Update suggestion
    await c.env.DB.prepare(`
      UPDATE ai_clone_decisions
      SET was_approved = ?, user_response_at = CURRENT_TIMESTAMP,
          rejection_reason = ?,
          entry_price = COALESCE(?, entry_price),
          stop_loss = COALESCE(?, stop_loss),
          take_profit = COALESCE(?, take_profit),
          position_size = COALESCE(?, position_size)
      WHERE id = ?
    `).bind(
      approved ? 1 : 0,
      rejection_reason || null,
      modified_params?.entry_price || null,
      modified_params?.stop_loss || null,
      modified_params?.take_profit || null,
      modified_params?.position_size || null,
      suggestionId
    ).run();

    // Update accepted count if approved
    if (approved) {
      await c.env.DB.prepare(`
        UPDATE ai_clone_config
        SET accepted_suggestions = accepted_suggestions + 1
        WHERE user_id = ?
      `).bind(userId).run();
    }

    return c.json({
      success: true,
      approved,
      message: approved ? 'Suggestion approved' : 'Suggestion rejected',
    });
  } catch (error) {
    console.error('Error responding to suggestion:', error);
    return c.json({ error: 'Failed to respond to suggestion' }, 500);
  }
});

// ============================================================================
// STATS & HISTORY
// ============================================================================

// Get AI Clone statistics
aiCloneRouter.get('/stats', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Get config stats
    const config = await c.env.DB.prepare(`
      SELECT total_suggestions, accepted_suggestions, executed_trades, last_trade_at, last_retrain_at
      FROM ai_clone_config WHERE user_id = ?
    `).bind(userId).first();

    // Get pattern stats
    const patternStats = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_patterns,
        AVG(confidence) as avg_confidence,
        AVG(win_rate) as avg_win_rate,
        SUM(sample_size) as total_samples
      FROM trade_patterns WHERE user_id = ?
    `).bind(userId).first();

    // Get decision stats
    const decisionStats = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_decisions,
        SUM(CASE WHEN was_approved = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN was_executed = 1 THEN 1 ELSE 0 END) as executed,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(actual_pnl) as total_pnl
      FROM ai_clone_decisions WHERE user_id = ?
    `).bind(userId).first();

    // Get training history
    const recentTraining = await c.env.DB.prepare(`
      SELECT *
      FROM ai_clone_training
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(userId).all();

    return c.json({
      config: {
        total_suggestions: config?.total_suggestions || 0,
        accepted_suggestions: config?.accepted_suggestions || 0,
        executed_trades: config?.executed_trades || 0,
        last_trade_at: config?.last_trade_at,
        last_retrain_at: config?.last_retrain_at,
        acceptance_rate: config?.total_suggestions
          ? ((config.accepted_suggestions as number) / (config.total_suggestions as number) * 100)
          : 0,
      },
      patterns: {
        total: patternStats?.total_patterns || 0,
        avg_confidence: patternStats?.avg_confidence || 0,
        avg_win_rate: patternStats?.avg_win_rate || 0,
        total_samples: patternStats?.total_samples || 0,
      },
      decisions: {
        total: decisionStats?.total_decisions || 0,
        approved: decisionStats?.approved || 0,
        executed: decisionStats?.executed || 0,
        wins: decisionStats?.wins || 0,
        losses: decisionStats?.losses || 0,
        total_pnl: decisionStats?.total_pnl || 0,
        win_rate: (decisionStats?.wins as number) + (decisionStats?.losses as number) > 0
          ? ((decisionStats?.wins as number) / ((decisionStats?.wins as number) + (decisionStats?.losses as number)) * 100)
          : 0,
      },
      recent_training: recentTraining.results,
    });
  } catch (error) {
    console.error('Error fetching AI clone stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Get decision history
aiCloneRouter.get('/history', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const decisions = await c.env.DB.prepare(`
      SELECT d.*, p.pattern_type, p.setup_type
      FROM ai_clone_decisions d
      LEFT JOIN trade_patterns p ON d.pattern_id = p.id
      WHERE d.user_id = ?
      ORDER BY d.suggested_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const total = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_clone_decisions WHERE user_id = ?
    `).bind(userId).first();

    return c.json({
      decisions: decisions.results.map((d: Record<string, unknown>) => ({
        ...d,
        reasoning: d.reasoning ? JSON.parse(d.reasoning as string) : [],
        pattern_matches: d.pattern_matches ? JSON.parse(d.pattern_matches as string) : [],
      })),
      total: total?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching decision history:', error);
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface TradeData {
  id: string;
  symbol: string;
  asset_type: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  quantity: number;
  entry_date: string;
  exit_date: string;
  strategy_name?: string;
  strategy_category?: string;
  setup_type?: string;
  emotion_before?: string;
}

interface ExtractedPattern {
  pattern_type: string;
  symbol: string;
  asset_class: string;
  setup_type: string;
  features: Partial<TradeFeatures>;
  win_rate: number;
  avg_pnl: number;
  avg_pnl_percent: number;
  sample_size: number;
}

function extractPatterns(trades: TradeData[]): ExtractedPattern[] {
  const patternMap = new Map<string, ExtractedPattern>();

  for (const trade of trades) {
    const isWin = (trade.pnl || 0) > 0;
    const pnlPercent = trade.entry_price
      ? ((trade.pnl || 0) / (trade.entry_price * (trade.quantity || 1))) * 100
      : 0;

    // Extract time-based features
    const entryDate = new Date(trade.entry_date);

    const features: Partial<TradeFeatures> = {
      hour_of_day: entryDate.getHours(),
      day_of_week: entryDate.getDay(),
      risk_reward_ratio: trade.exit_price && trade.entry_price
        ? Math.abs((trade.exit_price - trade.entry_price) / trade.entry_price)
        : 0,
    };

    // Create pattern key
    const patternKey = `${trade.symbol}:${trade.setup_type || 'default'}:${trade.direction}`;

    if (patternMap.has(patternKey)) {
      const existing = patternMap.get(patternKey)!;
      existing.sample_size++;
      existing.win_rate = (existing.win_rate * (existing.sample_size - 1) + (isWin ? 1 : 0)) / existing.sample_size;
      existing.avg_pnl = (existing.avg_pnl * (existing.sample_size - 1) + (trade.pnl || 0)) / existing.sample_size;
      existing.avg_pnl_percent = (existing.avg_pnl_percent * (existing.sample_size - 1) + pnlPercent) / existing.sample_size;
    } else {
      patternMap.set(patternKey, {
        pattern_type: trade.direction === 'long' ? 'entry' : 'entry',
        symbol: trade.symbol,
        asset_class: trade.asset_type || 'crypto',
        setup_type: trade.setup_type || 'default',
        features,
        win_rate: isWin ? 1 : 0,
        avg_pnl: trade.pnl || 0,
        avg_pnl_percent: pnlPercent,
        sample_size: 1,
      });
    }
  }

  return Array.from(patternMap.values());
}

function calculateConfidence(winRate: number, sampleSize: number): number {
  // Bayesian confidence based on win rate and sample size
  // More samples = higher confidence
  const baseConfidence = winRate;
  const sampleFactor = Math.min(sampleSize / 50, 1); // Max confidence boost at 50 samples
  const uncertainty = 0.5 * (1 - sampleFactor); // Uncertainty decreases with more samples

  return Math.min(0.95, baseConfidence * (1 - uncertainty) + uncertainty * 0.5);
}
