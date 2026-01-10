import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { ExchangeFactory, type ExchangeId } from "../utils/exchanges";
import { decrypt } from "../utils/encryption";

// ============================================================================
// AUTO-TRADING - AI Clone Execution Engine
// ============================================================================

type Env = {
  DB: D1Database;
  ENCRYPTION_MASTER_KEY: string;
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

export const autoTradingRouter = new Hono<{ Bindings: Env; Variables: { user: UserVariable } }>();

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

autoTradingRouter.use('*', firebaseAuthMiddleware);

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionResult {
  success: boolean;
  order_id?: string;
  filled_price?: number;
  filled_quantity?: number;
  slippage?: number;
  error?: string;
}

interface KillSwitchStatus {
  triggered: boolean;
  reason?: string;
  triggered_at?: string;
  recovery_at?: string;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const ExecuteTradeSchema = z.object({
  decision_id: z.string(),
  exchange_connection_id: z.string().optional(),
  entry_price: z.number().optional(),
  stop_loss: z.number().optional(),
  take_profit: z.number().optional(),
  position_size: z.number().optional(),
});

const KillSwitchSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'reset']),
  reason: z.string().optional(),
  recovery_hours: z.number().min(1).max(168).optional(),
});

// ============================================================================
// SAFETY CHECKS
// ============================================================================

async function checkKillSwitch(db: D1Database, userId: string): Promise<KillSwitchStatus> {
  // Check user lockout
  const user = await db.prepare(`
    SELECT lockout_until FROM users WHERE google_user_id = ?
  `).bind(userId).first();

  if (user?.lockout_until) {
    const lockoutUntil = new Date(user.lockout_until as string);
    if (lockoutUntil > new Date()) {
      return {
        triggered: true,
        reason: 'Account is locked due to risk management limits',
        triggered_at: user.lockout_until as string,
        recovery_at: user.lockout_until as string,
      };
    }
  }

  // Check for kill switch record
  const killSwitch = await db.prepare(`
    SELECT * FROM kill_switch WHERE user_id = ? AND is_active = 1
  `).bind(userId).first();

  if (killSwitch) {
    return {
      triggered: true,
      reason: killSwitch.reason as string,
      triggered_at: killSwitch.triggered_at as string,
      recovery_at: killSwitch.recovery_at as string,
    };
  }

  return { triggered: false };
}

async function checkDailyLimits(db: D1Database, userId: string): Promise<{
  can_trade: boolean;
  reason?: string;
  trades_today: number;
  pnl_today: number;
  max_trades: number;
  max_loss: number;
}> {
  // Get AI Clone config
  const config = await db.prepare(`
    SELECT max_daily_trades, max_daily_loss, max_daily_loss_percent
    FROM ai_clone_config WHERE user_id = ?
  `).bind(userId).first();

  const maxTrades = (config?.max_daily_trades as number) || 10;
  const maxLossPercent = (config?.max_daily_loss_percent as number) || 5;

  // Get today's AI executed trades
  const today = new Date().toISOString().split('T')[0];
  const todayStats = await db.prepare(`
    SELECT
      COUNT(*) as trade_count,
      COALESCE(SUM(actual_pnl), 0) as total_pnl
    FROM ai_clone_decisions
    WHERE user_id = ? AND was_executed = 1
      AND date(executed_at) = ?
  `).bind(userId, today).first();

  const tradesToday = (todayStats?.trade_count as number) || 0;
  const pnlToday = (todayStats?.total_pnl as number) || 0;

  // Get starting capital for max loss calculation
  const userCapital = await db.prepare(`
    SELECT starting_capital FROM users WHERE google_user_id = ?
  `).bind(userId).first();

  const startingCapital = (userCapital?.starting_capital as number) || 10000;
  const maxLoss = (startingCapital * maxLossPercent) / 100;

  // Check limits
  if (tradesToday >= maxTrades) {
    return {
      can_trade: false,
      reason: `Daily trade limit reached (${tradesToday}/${maxTrades})`,
      trades_today: tradesToday,
      pnl_today: pnlToday,
      max_trades: maxTrades,
      max_loss: maxLoss,
    };
  }

  if (pnlToday <= -maxLoss) {
    return {
      can_trade: false,
      reason: `Daily loss limit reached ($${Math.abs(pnlToday).toFixed(2)}/$${maxLoss.toFixed(2)})`,
      trades_today: tradesToday,
      pnl_today: pnlToday,
      max_trades: maxTrades,
      max_loss: maxLoss,
    };
  }

  return {
    can_trade: true,
    trades_today: tradesToday,
    pnl_today: pnlToday,
    max_trades: maxTrades,
    max_loss: maxLoss,
  };
}

async function validateDecision(db: D1Database, decisionId: string, userId: string): Promise<{
  valid: boolean;
  decision?: Record<string, unknown>;
  error?: string;
}> {
  // Get decision
  const decision = await db.prepare(`
    SELECT d.*, c.permission_level, c.min_confidence
    FROM ai_clone_decisions d
    JOIN ai_clone_config c ON d.user_id = c.user_id
    WHERE d.id = ? AND d.user_id = ?
  `).bind(decisionId, userId).first();

  if (!decision) {
    return { valid: false, error: 'Decision not found' };
  }

  // Check if already executed
  if (decision.was_executed === 1) {
    return { valid: false, error: 'Decision already executed' };
  }

  // Check if approved (required for semi_auto)
  const permissionLevel = decision.permission_level as string;
  if (permissionLevel === 'semi_auto' && decision.was_approved !== 1) {
    return { valid: false, error: 'Decision requires approval for semi-auto mode' };
  }

  // Check permission level
  if (permissionLevel === 'observe' || permissionLevel === 'suggest') {
    return { valid: false, error: 'AI Clone is in suggest-only mode' };
  }

  // Check confidence threshold
  const confidence = decision.confidence as number;
  const minConfidence = decision.min_confidence as number;
  if (confidence < minConfidence) {
    return { valid: false, error: `Confidence ${confidence} below minimum ${minConfidence}` };
  }

  return { valid: true, decision };
}

// ============================================================================
// ROUTES
// ============================================================================

// Check trading status
autoTradingRouter.get('/status', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Check kill switch
    const killSwitchStatus = await checkKillSwitch(c.env.DB, userId);

    // Check daily limits
    const limitsStatus = await checkDailyLimits(c.env.DB, userId);

    // Get AI Clone config
    const config = await c.env.DB.prepare(`
      SELECT permission_level, is_active
      FROM ai_clone_config WHERE user_id = ?
    `).bind(userId).first();

    // Get active exchange connections
    const connections = await c.env.DB.prepare(`
      SELECT id, exchange_id FROM exchange_connections
      WHERE user_id = ? AND is_active = 1
    `).bind(userId).all();

    return c.json({
      can_trade: !killSwitchStatus.triggered && limitsStatus.can_trade && config?.is_active === 1,
      kill_switch: killSwitchStatus,
      limits: limitsStatus,
      config: {
        permission_level: config?.permission_level || 'observe',
        is_active: config?.is_active === 1,
      },
      exchange_connections: connections.results.length,
    });
  } catch (error) {
    console.error('Error checking trading status:', error);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

// Execute a trade decision
autoTradingRouter.post('/execute', zValidator('json', ExecuteTradeSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { decision_id, exchange_connection_id, entry_price, stop_loss, take_profit, position_size } = c.req.valid('json');

  try {
    // Step 1: Check kill switch
    const killSwitchStatus = await checkKillSwitch(c.env.DB, userId);
    if (killSwitchStatus.triggered) {
      return c.json({
        success: false,
        error: 'Trading is disabled',
        reason: killSwitchStatus.reason,
      }, 403);
    }

    // Step 2: Check daily limits
    const limitsStatus = await checkDailyLimits(c.env.DB, userId);
    if (!limitsStatus.can_trade) {
      return c.json({
        success: false,
        error: 'Daily limit reached',
        reason: limitsStatus.reason,
      }, 403);
    }

    // Step 3: Validate decision
    const validation = await validateDecision(c.env.DB, decision_id, userId);
    if (!validation.valid) {
      return c.json({
        success: false,
        error: validation.error,
      }, 400);
    }

    const decision = validation.decision!;

    // Step 4: Get exchange connection
    let connectionId = exchange_connection_id;
    if (!connectionId) {
      // Find first active connection for the decision's asset class
      const connection = await c.env.DB.prepare(`
        SELECT id FROM exchange_connections
        WHERE user_id = ? AND is_active = 1
        ORDER BY last_sync_at DESC
        LIMIT 1
      `).bind(userId).first();

      if (!connection) {
        return c.json({
          success: false,
          error: 'No active exchange connection found',
        }, 400);
      }

      connectionId = connection.id as string;
    }

    // Get connection details
    const connection = await c.env.DB.prepare(`
      SELECT * FROM exchange_connections WHERE id = ? AND user_id = ?
    `).bind(connectionId, userId).first();

    if (!connection) {
      return c.json({ success: false, error: 'Exchange connection not found' }, 404);
    }

    // Step 5: Decrypt credentials
    const masterKey = c.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      return c.json({ success: false, error: 'Encryption service unavailable' }, 500);
    }

    const apiKey = await decrypt(connection.api_key_encrypted as string, masterKey);
    const apiSecret = await decrypt(connection.api_secret_encrypted as string, masterKey);
    const passphrase = connection.passphrase_encrypted
      ? await decrypt(connection.passphrase_encrypted as string, masterKey)
      : undefined;

    // Step 6: Create exchange instance
    const exchangeId = connection.exchange_id as ExchangeId;
    const exchange = ExchangeFactory.create({
      exchangeId,
      credentials: { apiKey, apiSecret, passphrase },
      testnet: false,
    });

    // Step 7: Execute trade
    const symbol = decision.symbol as string;
    const side = decision.side as 'long' | 'short';
    const finalEntryPrice = entry_price || (decision.entry_price as number);
    const finalStopLoss = stop_loss || (decision.stop_loss as number);
    const finalTakeProfit = take_profit || (decision.take_profit as number);
    const finalPositionSize = position_size || (decision.position_size as number);

    let executionResult: ExecutionResult;

    try {
      // Get current market price from recent OHLCV data
      const recentCandles = await exchange.getOHLCV(symbol, '1', undefined, undefined, 1);
      const marketPrice = recentCandles.length > 0 ? recentCandles[0].close : finalEntryPrice;

      // Place market order
      const orderResult = await exchange.createOrder({
        symbol,
        side: side === 'long' ? 'buy' : 'sell',
        type: 'market',
        quantity: finalPositionSize,
        reduceOnly: false,
      });

      executionResult = {
        success: true,
        order_id: orderResult.id,
        filled_price: orderResult.averagePrice || marketPrice,
        filled_quantity: orderResult.filledQuantity,
        slippage: orderResult.averagePrice
          ? ((orderResult.averagePrice - marketPrice) / marketPrice) * 100
          : 0,
      };

      // Place stop loss order if specified
      if (finalStopLoss && finalStopLoss > 0) {
        try {
          await exchange.createOrder({
            symbol,
            side: side === 'long' ? 'sell' : 'buy',
            type: 'stop',
            quantity: finalPositionSize,
            stopPrice: finalStopLoss,
            reduceOnly: true,
          });
        } catch (slError) {
          console.error('Failed to place stop loss:', slError);
        }
      }

      // Place take profit order if specified
      if (finalTakeProfit && finalTakeProfit > 0) {
        try {
          await exchange.createOrder({
            symbol,
            side: side === 'long' ? 'sell' : 'buy',
            type: 'limit',
            quantity: finalPositionSize,
            price: finalTakeProfit,
            reduceOnly: true,
          });
        } catch (tpError) {
          console.error('Failed to place take profit:', tpError);
        }
      }
    } catch (orderError) {
      console.error('Order execution error:', orderError);
      executionResult = {
        success: false,
        error: orderError instanceof Error ? orderError.message : 'Order execution failed',
      };
    }

    // Step 8: Update decision record
    await c.env.DB.prepare(`
      UPDATE ai_clone_decisions
      SET was_executed = ?,
          executed_at = CURRENT_TIMESTAMP,
          execution_price = ?,
          execution_slippage = ?,
          execution_error = ?
      WHERE id = ?
    `).bind(
      executionResult.success ? 1 : 0,
      executionResult.filled_price || null,
      executionResult.slippage || null,
      executionResult.error || null,
      decision_id
    ).run();

    // Step 9: Update AI Clone stats if successful
    if (executionResult.success) {
      await c.env.DB.prepare(`
        UPDATE ai_clone_config
        SET executed_trades = executed_trades + 1, last_trade_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(userId).run();

      // Create trade record
      const tradeId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO trades (
          id, user_id, symbol, asset_type, direction, quantity,
          entry_price, entry_date, is_closed, created_at, updated_at
        ) VALUES (?, ?, ?, 'crypto', ?, ?, ?, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        tradeId,
        userId,
        symbol,
        side,
        finalPositionSize,
        executionResult.filled_price
      ).run();

      // Link trade to decision
      await c.env.DB.prepare(`
        UPDATE ai_clone_decisions SET execution_trade_id = ? WHERE id = ?
      `).bind(tradeId, decision_id).run();
    }

    return c.json({
      success: executionResult.success,
      order_id: executionResult.order_id,
      filled_price: executionResult.filled_price,
      filled_quantity: executionResult.filled_quantity,
      slippage: executionResult.slippage,
      error: executionResult.error,
    });
  } catch (error) {
    console.error('Error executing trade:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    }, 500);
  }
});

// Kill switch control
autoTradingRouter.post('/kill-switch', zValidator('json', KillSwitchSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { action, reason, recovery_hours } = c.req.valid('json');

  try {
    if (action === 'activate') {
      const recoveryAt = recovery_hours
        ? new Date(Date.now() + recovery_hours * 60 * 60 * 1000).toISOString()
        : null;

      // Create kill switch record
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO kill_switch (id, user_id, is_active, reason, triggered_at, recovery_at)
        VALUES (
          COALESCE((SELECT id FROM kill_switch WHERE user_id = ?), lower(hex(randomblob(16)))),
          ?, 1, ?, CURRENT_TIMESTAMP, ?
        )
      `).bind(userId, userId, reason || 'Manual activation', recoveryAt).run();

      // Deactivate AI Clone
      await c.env.DB.prepare(`
        UPDATE ai_clone_config SET is_active = 0 WHERE user_id = ?
      `).bind(userId).run();

      // Cancel all pending orders (if possible)
      // This would require iterating through exchange connections

      return c.json({
        success: true,
        action: 'activated',
        recovery_at: recoveryAt,
        message: 'Kill switch activated. All AI trading has been stopped.',
      });
    } else if (action === 'deactivate') {
      // Check if recovery time has passed
      const killSwitch = await c.env.DB.prepare(`
        SELECT recovery_at FROM kill_switch WHERE user_id = ? AND is_active = 1
      `).bind(userId).first();

      if (killSwitch?.recovery_at) {
        const recoveryAt = new Date(killSwitch.recovery_at as string);
        if (recoveryAt > new Date()) {
          return c.json({
            success: false,
            error: 'Kill switch cannot be deactivated before recovery time',
            recovery_at: killSwitch.recovery_at,
          }, 400);
        }
      }

      // Deactivate kill switch
      await c.env.DB.prepare(`
        UPDATE kill_switch SET is_active = 0 WHERE user_id = ?
      `).bind(userId).run();

      return c.json({
        success: true,
        action: 'deactivated',
        message: 'Kill switch deactivated. AI trading can be resumed.',
      });
    } else if (action === 'reset') {
      // Force reset (admin action)
      await c.env.DB.prepare(`
        DELETE FROM kill_switch WHERE user_id = ?
      `).bind(userId).run();

      await c.env.DB.prepare(`
        UPDATE users SET lockout_until = NULL WHERE google_user_id = ?
      `).bind(userId).run();

      return c.json({
        success: true,
        action: 'reset',
        message: 'Kill switch and lockouts have been reset.',
      });
    }

    return c.json({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Error controlling kill switch:', error);
    return c.json({ error: 'Failed to control kill switch' }, 500);
  }
});

// Get execution history
autoTradingRouter.get('/executions', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const executions = await c.env.DB.prepare(`
      SELECT d.*, t.exit_price, t.pnl, t.is_closed
      FROM ai_clone_decisions d
      LEFT JOIN trades t ON d.execution_trade_id = t.id
      WHERE d.user_id = ? AND d.was_executed = 1
      ORDER BY d.executed_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const total = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_clone_decisions
      WHERE user_id = ? AND was_executed = 1
    `).bind(userId).first();

    // Calculate stats
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;

    for (const exec of executions.results) {
      const pnl = (exec.pnl as number) || 0;
      totalPnl += pnl;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
    }

    return c.json({
      executions: executions.results,
      total: total?.count || 0,
      stats: {
        total_pnl: totalPnl,
        wins,
        losses,
        win_rate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      },
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching executions:', error);
    return c.json({ error: 'Failed to fetch executions' }, 500);
  }
});

// Close AI trade position
autoTradingRouter.post('/close/:tradeId', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');

  try {
    // Get trade details
    const trade = await c.env.DB.prepare(`
      SELECT t.*, d.id as decision_id
      FROM trades t
      JOIN ai_clone_decisions d ON d.execution_trade_id = t.id
      WHERE t.id = ? AND t.user_id = ?
    `).bind(tradeId, userId).first();

    if (!trade) {
      return c.json({ error: 'Trade not found' }, 404);
    }

    if (trade.is_closed === 1) {
      return c.json({ error: 'Trade already closed' }, 400);
    }

    // Get exchange connection
    const connection = await c.env.DB.prepare(`
      SELECT * FROM exchange_connections
      WHERE user_id = ? AND is_active = 1
      ORDER BY last_sync_at DESC
      LIMIT 1
    `).bind(userId).first();

    if (!connection) {
      return c.json({ error: 'No active exchange connection' }, 400);
    }

    // Decrypt credentials
    const masterKey = c.env.ENCRYPTION_MASTER_KEY;
    const apiKey = await decrypt(connection.api_key_encrypted as string, masterKey);
    const apiSecret = await decrypt(connection.api_secret_encrypted as string, masterKey);
    const passphrase = connection.passphrase_encrypted
      ? await decrypt(connection.passphrase_encrypted as string, masterKey)
      : undefined;

    // Create exchange instance
    const exchange = ExchangeFactory.create({
      exchangeId: connection.exchange_id as ExchangeId,
      credentials: { apiKey, apiSecret, passphrase },
      testnet: false,
    });

    // Close position
    const symbol = trade.symbol as string;
    const direction = trade.direction as string;
    const quantity = trade.quantity as number;

    const closeResult = await exchange.createOrder({
      symbol,
      side: direction === 'long' ? 'sell' : 'buy',
      type: 'market',
      quantity,
      reduceOnly: true,
    });

    // Update trade record
    const exitPrice = closeResult.averagePrice || 0;
    const entryPrice = trade.entry_price as number;
    const pnl = direction === 'long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;

    await c.env.DB.prepare(`
      UPDATE trades
      SET is_closed = 1, exit_price = ?, exit_date = CURRENT_TIMESTAMP, pnl = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(exitPrice, pnl, tradeId).run();

    // Update decision outcome
    await c.env.DB.prepare(`
      UPDATE ai_clone_decisions
      SET outcome = ?, actual_pnl = ?, closed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      pnl,
      trade.decision_id
    ).run();

    return c.json({
      success: true,
      exit_price: exitPrice,
      pnl,
      message: `Position closed at ${exitPrice}. P&L: $${pnl.toFixed(2)}`,
    });
  } catch (error) {
    console.error('Error closing position:', error);
    return c.json({ error: 'Failed to close position' }, 500);
  }
});
