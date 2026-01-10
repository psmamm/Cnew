/**
 * Reports Engine API
 *
 * Generates 75+ analytics reports for trading performance analysis.
 * Categories: Performance, Trade Analysis, Strategy, Psychology, AI-Generated
 */

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { D1Database } from "@cloudflare/workers-types";

interface UserVariable {
  google_user_data?: {
    sub: string;
    email?: string;
    name?: string;
  };
  firebase_user_id?: string;
  email?: string;
}

type Env = {
  DB: D1Database;
};

export const reportsRouter = new Hono<{ Bindings: Env; Variables: { user: UserVariable } }>();

// Firebase session auth middleware
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

reportsRouter.use('*', firebaseAuthMiddleware);

// ============================================================================
// Helper Functions
// ============================================================================

interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  commission: number;
  entry_date: string;
  exit_date: string | null;
  is_closed: number;
  strategy_id: string | null;
  asset_type: string;
  notes: string | null;
  emotion_tag: string | null;
}

function calculateWinRate(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.is_closed && t.pnl !== null);
  if (closedTrades.length === 0) return 0;
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
  return (wins / closedTrades.length) * 100;
}

function calculateProfitFactor(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.is_closed && t.pnl !== null);
  const grossProfit = closedTrades.reduce((sum, t) => sum + Math.max(0, t.pnl || 0), 0);
  const grossLoss = Math.abs(closedTrades.reduce((sum, t) => sum + Math.min(0, t.pnl || 0), 0));
  return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
}

function calculateExpectancy(trades: Trade[]): number {
  const closedTrades = trades.filter(t => t.is_closed && t.pnl !== null);
  if (closedTrades.length === 0) return 0;

  const winRate = calculateWinRate(trades) / 100;
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl || 0) < 0);

  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length) : 0;

  return (winRate * avgWin) - ((1 - winRate) * avgLoss);
}

function calculateMaxDrawdown(trades: Trade[]): { maxDrawdown: number; maxDrawdownPercent: number } {
  const closedTrades = trades.filter(t => t.is_closed && t.pnl !== null)
    .sort((a, b) => new Date(a.exit_date || a.entry_date).getTime() - new Date(b.exit_date || b.entry_date).getTime());

  let peak = 0;
  let runningPnl = 0;
  let maxDrawdown = 0;

  for (const trade of closedTrades) {
    runningPnl += trade.pnl || 0;
    if (runningPnl > peak) {
      peak = runningPnl;
    }
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  return { maxDrawdown, maxDrawdownPercent };
}

function calculateSharpeRatio(trades: Trade[], riskFreeRate: number = 0.02): number {
  const closedTrades = trades.filter(t => t.is_closed && t.pnl !== null);
  if (closedTrades.length < 2) return 0;

  const returns = closedTrades.map(t => t.pnl || 0);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);

  if (stdDev === 0) return 0;
  return (avgReturn - riskFreeRate) / stdDev;
}

function calculateSortinoRatio(trades: Trade[], riskFreeRate: number = 0.02): number {
  const closedTrades = trades.filter(t => t.is_closed && t.pnl !== null);
  if (closedTrades.length < 2) return 0;

  const returns = closedTrades.map(t => t.pnl || 0);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const negativeReturns = returns.filter(r => r < 0);

  if (negativeReturns.length === 0) return Infinity;

  const downside = Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length);
  if (downside === 0) return 0;

  return (avgReturn - riskFreeRate) / downside;
}

// ============================================================================
// Get Available Reports
// ============================================================================

reportsRouter.get('/available', async (c) => {
  const reports = [
    // Performance Reports (1-15)
    { id: 'daily_pnl', name: 'Daily P&L Curve', category: 'performance' },
    { id: 'weekly_summary', name: 'Weekly P&L Summary', category: 'performance' },
    { id: 'monthly_performance', name: 'Monthly Performance', category: 'performance' },
    { id: 'yearly_overview', name: 'Yearly Overview', category: 'performance' },
    { id: 'cumulative_returns', name: 'Cumulative Returns', category: 'performance' },
    { id: 'drawdown_analysis', name: 'Drawdown Analysis', category: 'performance' },
    { id: 'win_rate_by_day', name: 'Win Rate by Day of Week', category: 'performance' },
    { id: 'win_rate_by_hour', name: 'Win Rate by Time of Day', category: 'performance' },
    { id: 'win_rate_by_session', name: 'Win Rate by Session', category: 'performance' },
    { id: 'consecutive_analysis', name: 'Consecutive Wins/Losses', category: 'performance' },
    { id: 'avg_win_loss', name: 'Average Win vs Loss', category: 'performance' },
    { id: 'profit_factor_trend', name: 'Profit Factor Trend', category: 'performance' },
    { id: 'expectancy', name: 'Expectancy Calculator', category: 'performance' },
    { id: 'r_multiple', name: 'R-Multiple Distribution', category: 'performance' },
    { id: 'equity_curve', name: 'Equity Curve Comparison', category: 'performance' },

    // Trade Analysis Reports (16-35)
    { id: 'duration_analysis', name: 'Trade Duration Analysis', category: 'trade_analysis' },
    { id: 'entry_timing', name: 'Entry Timing Quality', category: 'trade_analysis' },
    { id: 'exit_timing', name: 'Exit Timing Quality', category: 'trade_analysis' },
    { id: 'partial_profits', name: 'Partial Profit Analysis', category: 'trade_analysis' },
    { id: 'stop_loss_analysis', name: 'Stop Loss Hit Rate', category: 'trade_analysis' },
    { id: 'take_profit_analysis', name: 'Take Profit Hit Rate', category: 'trade_analysis' },
    { id: 'slippage', name: 'Slippage Analysis', category: 'trade_analysis' },
    { id: 'commission_impact', name: 'Commission Impact', category: 'trade_analysis' },
    { id: 'overnight_analysis', name: 'Overnight Hold Analysis', category: 'trade_analysis' },
    { id: 'weekend_gaps', name: 'Weekend Gap Analysis', category: 'trade_analysis' },
    { id: 'position_sizing', name: 'Position Size Optimization', category: 'trade_analysis' },
    { id: 'scaling_analysis', name: 'Scaling In/Out Analysis', category: 'trade_analysis' },
    { id: 'breakeven_analysis', name: 'Break-Even Analysis', category: 'trade_analysis' },
    { id: 'mae_analysis', name: 'Maximum Adverse Excursion', category: 'trade_analysis' },
    { id: 'mfe_analysis', name: 'Maximum Favorable Excursion', category: 'trade_analysis' },
    { id: 'efficiency_score', name: 'Trade Efficiency Score', category: 'trade_analysis' },

    // Strategy Reports (36-50)
    { id: 'strategy_comparison', name: 'Strategy Performance Comparison', category: 'strategy' },
    { id: 'setup_success', name: 'Setup Success Rate', category: 'strategy' },
    { id: 'pattern_accuracy', name: 'Pattern Recognition Accuracy', category: 'strategy' },
    { id: 'timeframe_effectiveness', name: 'Timeframe Effectiveness', category: 'strategy' },
    { id: 'asset_class_performance', name: 'Asset Class Performance', category: 'strategy' },
    { id: 'symbol_ranking', name: 'Symbol Performance Ranking', category: 'strategy' },
    { id: 'sector_breakdown', name: 'Sector/Category Breakdown', category: 'strategy' },
    { id: 'correlation_matrix', name: 'Correlation Matrix', category: 'strategy' },
    { id: 'sharpe_ratio', name: 'Risk-Adjusted Returns (Sharpe)', category: 'strategy' },
    { id: 'sortino_ratio', name: 'Sortino Ratio', category: 'strategy' },
    { id: 'calmar_ratio', name: 'Calmar Ratio', category: 'strategy' },
    { id: 'consistency_score', name: 'Strategy Consistency Score', category: 'strategy' },
    { id: 'edge_quantification', name: 'Edge Quantification', category: 'strategy' },

    // Psychology Reports (51-65)
    { id: 'emotion_correlation', name: 'Emotion-Performance Correlation', category: 'psychology' },
    { id: 'revenge_trades', name: 'Revenge Trade Detection', category: 'psychology' },
    { id: 'fomo_analysis', name: 'FOMO Trade Analysis', category: 'psychology' },
    { id: 'overtrading', name: 'Overtrading Patterns', category: 'psychology' },
    { id: 'tilt_detection', name: 'Tilt Detection Timeline', category: 'psychology' },
    { id: 'confidence_accuracy', name: 'Confidence vs Accuracy', category: 'psychology' },
    { id: 'decision_quality', name: 'Decision Quality Score', category: 'psychology' },
    { id: 'impulse_tracking', name: 'Impulse Trade Tracking', category: 'psychology' },
    { id: 'plan_adherence', name: 'Plan Adherence Rate', category: 'psychology' },
    { id: 'rule_violations', name: 'Rule Violation Log', category: 'psychology' },
    { id: 'emotion_heatmap', name: 'Emotional State Heatmap', category: 'psychology' },
    { id: 'recovery_analysis', name: 'Recovery Time Analysis', category: 'psychology' },
    { id: 'peak_performance', name: 'Peak Performance Periods', category: 'psychology' },
    { id: 'stress_patterns', name: 'Stress Response Patterns', category: 'psychology' },
    { id: 'mental_optimization', name: 'Mental State Optimization', category: 'psychology' },

    // AI-Generated Reports (66-75)
    { id: 'ai_weekly_summary', name: 'Weekly AI Summary', category: 'ai_generated' },
    { id: 'ai_pattern_report', name: 'Pattern Recognition Report', category: 'ai_generated' },
    { id: 'ai_improvements', name: 'Improvement Suggestions', category: 'ai_generated' },
    { id: 'ai_risk_alert', name: 'Risk Alert Report', category: 'ai_generated' },
    { id: 'ai_tips', name: 'Personalized Trading Tips', category: 'ai_generated' },
    { id: 'ai_market_analysis', name: 'Market Condition Analysis', category: 'ai_generated' },
    { id: 'ai_optimal_windows', name: 'Optimal Trading Windows', category: 'ai_generated' },
    { id: 'ai_strategy_health', name: 'Strategy Health Check', category: 'ai_generated' },
    { id: 'ai_monthly_coaching', name: 'Monthly AI Coaching Report', category: 'ai_generated' },
  ];

  return c.json({ reports });
});

// ============================================================================
// Performance Overview
// ============================================================================

reportsRouter.get('/performance/overview', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const period = c.req.query('period') || '30d';

  let dateFilter = '';
  switch (period) {
    case '7d': dateFilter = "AND entry_date >= datetime('now', '-7 days')"; break;
    case '30d': dateFilter = "AND entry_date >= datetime('now', '-30 days')"; break;
    case '90d': dateFilter = "AND entry_date >= datetime('now', '-90 days')"; break;
    case '1y': dateFilter = "AND entry_date >= datetime('now', '-1 year')"; break;
    default: dateFilter = '';
  }

  const tradesResult = await c.env.DB.prepare(`
    SELECT * FROM trades
    WHERE user_id = ? AND is_closed = 1 ${dateFilter}
    ORDER BY exit_date DESC
  `).bind(userId).all();

  const trades = tradesResult.results as unknown as Trade[];

  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => (t.pnl || 0) > 0).length;
  const losingTrades = trades.filter(t => (t.pnl || 0) < 0).length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossProfit = trades.reduce((sum, t) => sum + Math.max(0, t.pnl || 0), 0);
  const grossLoss = Math.abs(trades.reduce((sum, t) => sum + Math.min(0, t.pnl || 0), 0));
  const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(trades);

  return c.json({
    period,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: calculateWinRate(trades),
    totalPnl: Math.round(totalPnl * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(calculateProfitFactor(trades) * 100) / 100,
    expectancy: Math.round(calculateExpectancy(trades) * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    sharpeRatio: Math.round(calculateSharpeRatio(trades) * 100) / 100,
    sortinoRatio: Math.round(calculateSortinoRatio(trades) * 100) / 100,
  });
});

// ============================================================================
// Daily P&L Curve
// ============================================================================

reportsRouter.get('/performance/daily-pnl', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const days = parseInt(c.req.query('days') || '30');

  const result = await c.env.DB.prepare(`
    SELECT
      DATE(COALESCE(exit_date, entry_date)) as date,
      SUM(pnl) as daily_pnl,
      COUNT(*) as trade_count,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
    FROM trades
    WHERE user_id = ? AND is_closed = 1
      AND entry_date >= datetime('now', '-' || ? || ' days')
    GROUP BY DATE(COALESCE(exit_date, entry_date))
    ORDER BY date ASC
  `).bind(userId, days).all();

  // Calculate cumulative PnL
  let cumulative = 0;
  const data = result.results.map((row: Record<string, unknown>) => {
    cumulative += (row.daily_pnl as number) || 0;
    return {
      date: row.date,
      dailyPnl: Math.round((row.daily_pnl as number) * 100) / 100,
      cumulativePnl: Math.round(cumulative * 100) / 100,
      tradeCount: row.trade_count,
      wins: row.wins,
      losses: row.losses,
      winRate: (row.trade_count as number) > 0
        ? Math.round(((row.wins as number) / (row.trade_count as number)) * 100)
        : 0,
    };
  });

  return c.json({ data });
});

// ============================================================================
// Win Rate by Day of Week
// ============================================================================

reportsRouter.get('/performance/win-rate-by-day', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT
      CASE strftime('%w', COALESCE(exit_date, entry_date))
        WHEN '0' THEN 'Sunday'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday'
        WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday'
        WHEN '6' THEN 'Saturday'
      END as day_name,
      strftime('%w', COALESCE(exit_date, entry_date)) as day_num,
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl
    FROM trades
    WHERE user_id = ? AND is_closed = 1
    GROUP BY strftime('%w', COALESCE(exit_date, entry_date))
    ORDER BY day_num
  `).bind(userId).all();

  const data = result.results.map((row: Record<string, unknown>) => ({
    day: row.day_name,
    totalTrades: row.total_trades,
    wins: row.wins,
    winRate: (row.total_trades as number) > 0
      ? Math.round(((row.wins as number) / (row.total_trades as number)) * 100)
      : 0,
    totalPnl: Math.round((row.total_pnl as number) * 100) / 100,
    avgPnl: Math.round((row.avg_pnl as number) * 100) / 100,
  }));

  return c.json({ data });
});

// ============================================================================
// Win Rate by Hour
// ============================================================================

reportsRouter.get('/performance/win-rate-by-hour', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT
      strftime('%H', entry_date) as hour,
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl
    FROM trades
    WHERE user_id = ? AND is_closed = 1
    GROUP BY strftime('%H', entry_date)
    ORDER BY hour
  `).bind(userId).all();

  const data = result.results.map((row: Record<string, unknown>) => ({
    hour: parseInt(row.hour as string),
    hourLabel: `${row.hour}:00`,
    totalTrades: row.total_trades,
    wins: row.wins,
    winRate: (row.total_trades as number) > 0
      ? Math.round(((row.wins as number) / (row.total_trades as number)) * 100)
      : 0,
    totalPnl: Math.round((row.total_pnl as number) * 100) / 100,
    avgPnl: Math.round((row.avg_pnl as number) * 100) / 100,
  }));

  return c.json({ data });
});

// ============================================================================
// Symbol Performance Ranking
// ============================================================================

reportsRouter.get('/strategy/symbol-ranking', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT
      symbol,
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl,
      MAX(pnl) as best_trade,
      MIN(pnl) as worst_trade
    FROM trades
    WHERE user_id = ? AND is_closed = 1
    GROUP BY symbol
    ORDER BY total_pnl DESC
    LIMIT 20
  `).bind(userId).all();

  const data = result.results.map((row: Record<string, unknown>) => ({
    symbol: row.symbol,
    totalTrades: row.total_trades,
    wins: row.wins,
    winRate: (row.total_trades as number) > 0
      ? Math.round(((row.wins as number) / (row.total_trades as number)) * 100)
      : 0,
    totalPnl: Math.round((row.total_pnl as number) * 100) / 100,
    avgPnl: Math.round((row.avg_pnl as number) * 100) / 100,
    bestTrade: Math.round((row.best_trade as number) * 100) / 100,
    worstTrade: Math.round((row.worst_trade as number) * 100) / 100,
  }));

  return c.json({ data });
});

// ============================================================================
// Strategy Comparison
// ============================================================================

reportsRouter.get('/strategy/comparison', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT
      COALESCE(s.name, 'No Strategy') as strategy_name,
      t.strategy_id,
      COUNT(*) as total_trades,
      SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(t.pnl) as total_pnl,
      AVG(t.pnl) as avg_pnl,
      SUM(CASE WHEN t.pnl > 0 THEN t.pnl ELSE 0 END) as gross_profit,
      SUM(CASE WHEN t.pnl < 0 THEN ABS(t.pnl) ELSE 0 END) as gross_loss
    FROM trades t
    LEFT JOIN strategies s ON t.strategy_id = s.id
    WHERE t.user_id = ? AND t.is_closed = 1
    GROUP BY t.strategy_id, s.name
    ORDER BY total_pnl DESC
  `).bind(userId).all();

  const data = result.results.map((row: Record<string, unknown>) => ({
    strategyName: row.strategy_name,
    strategyId: row.strategy_id,
    totalTrades: row.total_trades,
    wins: row.wins,
    winRate: (row.total_trades as number) > 0
      ? Math.round(((row.wins as number) / (row.total_trades as number)) * 100)
      : 0,
    totalPnl: Math.round((row.total_pnl as number) * 100) / 100,
    avgPnl: Math.round((row.avg_pnl as number) * 100) / 100,
    profitFactor: (row.gross_loss as number) > 0
      ? Math.round(((row.gross_profit as number) / (row.gross_loss as number)) * 100) / 100
      : 0,
  }));

  return c.json({ data });
});

// ============================================================================
// Emotion-Performance Correlation
// ============================================================================

reportsRouter.get('/psychology/emotion-correlation', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT
      COALESCE(emotion_tag, 'Not Tagged') as emotion,
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl
    FROM trades
    WHERE user_id = ? AND is_closed = 1
    GROUP BY emotion_tag
    ORDER BY total_trades DESC
  `).bind(userId).all();

  const data = result.results.map((row: Record<string, unknown>) => ({
    emotion: row.emotion,
    totalTrades: row.total_trades,
    wins: row.wins,
    winRate: (row.total_trades as number) > 0
      ? Math.round(((row.wins as number) / (row.total_trades as number)) * 100)
      : 0,
    totalPnl: Math.round((row.total_pnl as number) * 100) / 100,
    avgPnl: Math.round((row.avg_pnl as number) * 100) / 100,
  }));

  return c.json({ data });
});

// ============================================================================
// Trade Duration Analysis
// ============================================================================

reportsRouter.get('/trade-analysis/duration', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT
      CASE
        WHEN (julianday(exit_date) - julianday(entry_date)) * 24 * 60 < 5 THEN 'Under 5 min'
        WHEN (julianday(exit_date) - julianday(entry_date)) * 24 * 60 < 15 THEN '5-15 min'
        WHEN (julianday(exit_date) - julianday(entry_date)) * 24 * 60 < 60 THEN '15-60 min'
        WHEN (julianday(exit_date) - julianday(entry_date)) * 24 < 4 THEN '1-4 hours'
        WHEN (julianday(exit_date) - julianday(entry_date)) < 1 THEN '4-24 hours'
        ELSE 'Over 1 day'
      END as duration_bucket,
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl
    FROM trades
    WHERE user_id = ? AND is_closed = 1 AND exit_date IS NOT NULL
    GROUP BY duration_bucket
    ORDER BY
      CASE duration_bucket
        WHEN 'Under 5 min' THEN 1
        WHEN '5-15 min' THEN 2
        WHEN '15-60 min' THEN 3
        WHEN '1-4 hours' THEN 4
        WHEN '4-24 hours' THEN 5
        ELSE 6
      END
  `).bind(userId).all();

  const data = result.results.map((row: Record<string, unknown>) => ({
    duration: row.duration_bucket,
    totalTrades: row.total_trades,
    wins: row.wins,
    winRate: (row.total_trades as number) > 0
      ? Math.round(((row.wins as number) / (row.total_trades as number)) * 100)
      : 0,
    totalPnl: Math.round((row.total_pnl as number) * 100) / 100,
    avgPnl: Math.round((row.avg_pnl as number) * 100) / 100,
  }));

  return c.json({ data });
});

// ============================================================================
// Consecutive Wins/Losses Analysis
// ============================================================================

reportsRouter.get('/performance/consecutive', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const tradesResult = await c.env.DB.prepare(`
    SELECT pnl FROM trades
    WHERE user_id = ? AND is_closed = 1
    ORDER BY COALESCE(exit_date, entry_date) ASC
  `).bind(userId).all();

  const trades = tradesResult.results as { pnl: number }[];

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentWinStreak++;
      if (currentLossStreak > 0) {
        lossStreaks.push(currentLossStreak);
        currentLossStreak = 0;
      }
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if (trade.pnl < 0) {
      currentLossStreak++;
      if (currentWinStreak > 0) {
        winStreaks.push(currentWinStreak);
        currentWinStreak = 0;
      }
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  }

  // Push final streaks
  if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
  if (currentLossStreak > 0) lossStreaks.push(currentLossStreak);

  const avgWinStreak = winStreaks.length > 0
    ? Math.round((winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length) * 10) / 10
    : 0;
  const avgLossStreak = lossStreaks.length > 0
    ? Math.round((lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length) * 10) / 10
    : 0;

  return c.json({
    maxWinStreak,
    maxLossStreak,
    avgWinStreak,
    avgLossStreak,
    currentStreak: currentWinStreak > 0
      ? { type: 'win', count: currentWinStreak }
      : { type: 'loss', count: currentLossStreak },
  });
});

// ============================================================================
// Full Report Export
// ============================================================================

reportsRouter.get('/export', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const format = c.req.query('format') || 'json';
  const period = c.req.query('period') || 'all';

  // Get all trades
  let dateFilter = '';
  switch (period) {
    case '7d': dateFilter = "AND entry_date >= datetime('now', '-7 days')"; break;
    case '30d': dateFilter = "AND entry_date >= datetime('now', '-30 days')"; break;
    case '90d': dateFilter = "AND entry_date >= datetime('now', '-90 days')"; break;
    case '1y': dateFilter = "AND entry_date >= datetime('now', '-1 year')"; break;
  }

  const tradesResult = await c.env.DB.prepare(`
    SELECT * FROM trades
    WHERE user_id = ? ${dateFilter}
    ORDER BY entry_date DESC
  `).bind(userId).all();

  const trades = tradesResult.results as unknown as Trade[];
  const closedTrades = trades.filter(t => t.is_closed);

  const report = {
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      openTrades: trades.length - closedTrades.length,
      winRate: calculateWinRate(closedTrades),
      totalPnl: closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      profitFactor: calculateProfitFactor(closedTrades),
      expectancy: calculateExpectancy(closedTrades),
      sharpeRatio: calculateSharpeRatio(closedTrades),
      sortinoRatio: calculateSortinoRatio(closedTrades),
      ...calculateMaxDrawdown(closedTrades),
    },
    trades: format === 'full' ? trades : undefined,
  };

  if (format === 'csv') {
    const headers = ['Date', 'Symbol', 'Direction', 'Entry', 'Exit', 'Quantity', 'P&L', 'Strategy'];
    const rows = trades.map(t => [
      t.entry_date,
      t.symbol,
      t.direction,
      t.entry_price,
      t.exit_price || '',
      t.quantity,
      t.pnl || '',
      t.strategy_id || '',
    ].join(','));

    return new Response([headers.join(','), ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="trading-report-${period}.csv"`,
      },
    });
  }

  return c.json(report);
});
