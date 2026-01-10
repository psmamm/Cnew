import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

// ============================================================================
// TRADE REPLAY 3.0 - Multi-Timeframe Synchronized Replay
// ============================================================================

type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
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

export const tradeReplayRouter = new Hono<{ Bindings: Env; Variables: { user: UserVariable } }>();

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

tradeReplayRouter.use('*', firebaseAuthMiddleware);

// ============================================================================
// TYPES
// ============================================================================

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Annotation {
  id: string;
  type: 'line' | 'horizontal' | 'vertical' | 'rectangle' | 'text' | 'arrow' | 'fibonacci';
  data: Record<string, unknown>;
  color: string;
  timestamp: number;
}

interface Note {
  id: string;
  timestamp: number;
  content: string;
  type: 'entry' | 'exit' | 'observation' | 'mistake' | 'lesson';
}

interface AIAnnotation {
  timestamp: number;
  type: 'entry_signal' | 'exit_signal' | 'pattern' | 'news' | 'divergence' | 'support' | 'resistance';
  description: string;
  confidence: number;
}

interface WhatIfScenario {
  exitTimestamp: number;
  exitPrice: number;
  wouldBePnl: number;
  wouldBePnlPercent: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateReplaySchema = z.object({
  trade_id: z.string(),
  tick_data: z.array(z.object({
    timestamp: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  })),
  timeframes_data: z.record(z.array(z.object({
    timestamp: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  }))).optional(),
});

const AddAnnotationSchema = z.object({
  type: z.enum(['line', 'horizontal', 'vertical', 'rectangle', 'text', 'arrow', 'fibonacci']),
  data: z.record(z.unknown()),
  color: z.string().optional(),
  timestamp: z.number(),
});

const AddNoteSchema = z.object({
  timestamp: z.number(),
  content: z.string().min(1),
  type: z.enum(['entry', 'exit', 'observation', 'mistake', 'lesson']).optional(),
});

const WhatIfSchema = z.object({
  exit_timestamp: z.number(),
  exit_price: z.number(),
});

// ============================================================================
// ROUTES
// ============================================================================

// Get replay for a trade
tradeReplayRouter.get('/:tradeId', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');

  try {
    // Verify trade ownership
    const trade = await c.env.DB.prepare(`
      SELECT id, symbol, entry_price, exit_price, entry_date, exit_date, direction, pnl
      FROM trades WHERE id = ? AND user_id = ?
    `).bind(tradeId, userId).first();

    if (!trade) {
      return c.json({ error: 'Trade not found' }, 404);
    }

    // Get replay data
    const replay = await c.env.DB.prepare(`
      SELECT * FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay) {
      return c.json({
        trade,
        replay: null,
        message: 'No replay data available for this trade'
      });
    }

    // Parse JSON fields
    const parsedReplay = {
      id: replay.id,
      trade_id: replay.trade_id,
      tick_data: replay.tick_data ? JSON.parse(replay.tick_data as string) : [],
      timeframes_data: replay.timeframes_data ? JSON.parse(replay.timeframes_data as string) : null,
      drawings: replay.drawings ? JSON.parse(replay.drawings as string) : [],
      notes: replay.notes ? JSON.parse(replay.notes as string) : [],
      screenshots: replay.screenshots ? JSON.parse(replay.screenshots as string) : [],
      ai_annotations: replay.ai_annotations ? JSON.parse(replay.ai_annotations as string) : [],
      what_if_scenarios: replay.what_if_scenarios ? JSON.parse(replay.what_if_scenarios as string) : [],
      created_at: replay.created_at,
    };

    return c.json({
      trade,
      replay: parsedReplay,
    });
  } catch (error) {
    console.error('Error fetching replay:', error);
    return c.json({ error: 'Failed to fetch replay data' }, 500);
  }
});

// Create or update replay data
tradeReplayRouter.post('/', zValidator('json', CreateReplaySchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const data = c.req.valid('json');

  try {
    // Verify trade ownership
    const trade = await c.env.DB.prepare(`
      SELECT id FROM trades WHERE id = ? AND user_id = ?
    `).bind(data.trade_id, userId).first();

    if (!trade) {
      return c.json({ error: 'Trade not found' }, 404);
    }

    // Check for existing replay
    const existing = await c.env.DB.prepare(`
      SELECT id FROM trade_replays WHERE trade_id = ?
    `).bind(data.trade_id).first();

    // Compress and store tick data
    const tickDataJson = JSON.stringify(data.tick_data);
    const timeframesJson = data.timeframes_data ? JSON.stringify(data.timeframes_data) : null;

    if (existing) {
      // Update existing
      await c.env.DB.prepare(`
        UPDATE trade_replays
        SET tick_data = ?, timeframes_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = ?
      `).bind(tickDataJson, timeframesJson, data.trade_id).run();
    } else {
      // Create new
      await c.env.DB.prepare(`
        INSERT INTO trade_replays (trade_id, tick_data, timeframes_data, drawings, notes, screenshots, ai_annotations, what_if_scenarios, created_at)
        VALUES (?, ?, ?, '[]', '[]', '[]', '[]', '[]', CURRENT_TIMESTAMP)
      `).bind(data.trade_id, tickDataJson, timeframesJson).run();
    }

    return c.json({
      success: true,
      message: existing ? 'Replay updated' : 'Replay created',
    });
  } catch (error) {
    console.error('Error saving replay:', error);
    return c.json({ error: 'Failed to save replay data' }, 500);
  }
});

// Add annotation to replay
tradeReplayRouter.post('/:tradeId/annotations', zValidator('json', AddAnnotationSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');
  const data = c.req.valid('json');

  try {
    // Get existing replay
    const replay = await c.env.DB.prepare(`
      SELECT drawings FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay) {
      return c.json({ error: 'Replay not found' }, 404);
    }

    const drawings: Annotation[] = replay.drawings ? JSON.parse(replay.drawings as string) : [];

    // Add new annotation
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      type: data.type,
      data: data.data,
      color: data.color || '#A855F7',
      timestamp: data.timestamp,
    };

    drawings.push(newAnnotation);

    // Update replay
    await c.env.DB.prepare(`
      UPDATE trade_replays SET drawings = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
    `).bind(JSON.stringify(drawings), tradeId).run();

    return c.json({
      success: true,
      annotation: newAnnotation,
    });
  } catch (error) {
    console.error('Error adding annotation:', error);
    return c.json({ error: 'Failed to add annotation' }, 500);
  }
});

// Delete annotation
tradeReplayRouter.delete('/:tradeId/annotations/:annotationId', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');
  const annotationId = c.req.param('annotationId');

  try {
    const replay = await c.env.DB.prepare(`
      SELECT drawings FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay) {
      return c.json({ error: 'Replay not found' }, 404);
    }

    let drawings: Annotation[] = replay.drawings ? JSON.parse(replay.drawings as string) : [];
    drawings = drawings.filter(d => d.id !== annotationId);

    await c.env.DB.prepare(`
      UPDATE trade_replays SET drawings = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
    `).bind(JSON.stringify(drawings), tradeId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return c.json({ error: 'Failed to delete annotation' }, 500);
  }
});

// Add note to replay
tradeReplayRouter.post('/:tradeId/notes', zValidator('json', AddNoteSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');
  const data = c.req.valid('json');

  try {
    const replay = await c.env.DB.prepare(`
      SELECT notes FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay) {
      return c.json({ error: 'Replay not found' }, 404);
    }

    const notes: Note[] = replay.notes ? JSON.parse(replay.notes as string) : [];

    const newNote: Note = {
      id: crypto.randomUUID(),
      timestamp: data.timestamp,
      content: data.content,
      type: data.type || 'observation',
    };

    notes.push(newNote);
    notes.sort((a, b) => a.timestamp - b.timestamp);

    await c.env.DB.prepare(`
      UPDATE trade_replays SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
    `).bind(JSON.stringify(notes), tradeId).run();

    return c.json({
      success: true,
      note: newNote,
    });
  } catch (error) {
    console.error('Error adding note:', error);
    return c.json({ error: 'Failed to add note' }, 500);
  }
});

// Delete note
tradeReplayRouter.delete('/:tradeId/notes/:noteId', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');
  const noteId = c.req.param('noteId');

  try {
    const replay = await c.env.DB.prepare(`
      SELECT notes FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay) {
      return c.json({ error: 'Replay not found' }, 404);
    }

    let notes: Note[] = replay.notes ? JSON.parse(replay.notes as string) : [];
    notes = notes.filter(n => n.id !== noteId);

    await c.env.DB.prepare(`
      UPDATE trade_replays SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
    `).bind(JSON.stringify(notes), tradeId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return c.json({ error: 'Failed to delete note' }, 500);
  }
});

// Upload screenshot for replay
tradeReplayRouter.post('/:tradeId/screenshots', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const timestamp = formData.get('timestamp') as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `replays/${userId}/${tradeId}/${Date.now()}.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Update replay with screenshot URL
    const replay = await c.env.DB.prepare(`
      SELECT screenshots FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay) {
      return c.json({ error: 'Replay not found' }, 404);
    }

    const screenshots: Array<{ id: string; url: string; timestamp: number }> = replay.screenshots
      ? JSON.parse(replay.screenshots as string)
      : [];

    const newScreenshot = {
      id: crypto.randomUUID(),
      url: filename,
      timestamp: timestamp ? parseInt(timestamp) : Date.now(),
    };

    screenshots.push(newScreenshot);

    await c.env.DB.prepare(`
      UPDATE trade_replays SET screenshots = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
    `).bind(JSON.stringify(screenshots), tradeId).run();

    return c.json({
      success: true,
      screenshot: newScreenshot,
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    return c.json({ error: 'Failed to upload screenshot' }, 500);
  }
});

// Calculate What-If scenario
tradeReplayRouter.post('/:tradeId/what-if', zValidator('json', WhatIfSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');
  const data = c.req.valid('json');

  try {
    // Get trade details
    const trade = await c.env.DB.prepare(`
      SELECT entry_price, quantity, direction, commission FROM trades WHERE id = ? AND user_id = ?
    `).bind(tradeId, userId).first();

    if (!trade) {
      return c.json({ error: 'Trade not found' }, 404);
    }

    const entryPrice = trade.entry_price as number;
    const quantity = trade.quantity as number;
    const direction = trade.direction as string;
    const commission = (trade.commission as number) || 0;

    // Calculate hypothetical P&L
    let pnl: number;
    if (direction === 'long') {
      pnl = (data.exit_price - entryPrice) * quantity - commission;
    } else {
      pnl = (entryPrice - data.exit_price) * quantity - commission;
    }

    const pnlPercent = ((pnl / (entryPrice * quantity)) * 100);

    const scenario: WhatIfScenario = {
      exitTimestamp: data.exit_timestamp,
      exitPrice: data.exit_price,
      wouldBePnl: pnl,
      wouldBePnlPercent: pnlPercent,
    };

    // Store scenario in replay
    const replay = await c.env.DB.prepare(`
      SELECT what_if_scenarios FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (replay) {
      const scenarios: WhatIfScenario[] = replay.what_if_scenarios
        ? JSON.parse(replay.what_if_scenarios as string)
        : [];

      scenarios.push(scenario);

      // Keep only last 10 scenarios
      if (scenarios.length > 10) {
        scenarios.shift();
      }

      await c.env.DB.prepare(`
        UPDATE trade_replays SET what_if_scenarios = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
      `).bind(JSON.stringify(scenarios), tradeId).run();
    }

    return c.json({
      success: true,
      scenario,
    });
  } catch (error) {
    console.error('Error calculating what-if:', error);
    return c.json({ error: 'Failed to calculate scenario' }, 500);
  }
});

// Generate AI annotations for replay (uses Workers AI)
tradeReplayRouter.post('/:tradeId/ai-analyze', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId = c.req.param('tradeId');

  try {
    // Get replay data
    const replay = await c.env.DB.prepare(`
      SELECT tick_data FROM trade_replays WHERE trade_id = ?
    `).bind(tradeId).first();

    if (!replay || !replay.tick_data) {
      return c.json({ error: 'No replay data available' }, 404);
    }

    const tickData: OHLCV[] = JSON.parse(replay.tick_data as string);

    if (tickData.length < 10) {
      return c.json({ error: 'Not enough data for analysis' }, 400);
    }

    // Simple pattern detection (can be enhanced with Workers AI)
    const aiAnnotations: AIAnnotation[] = [];

    // Detect support/resistance levels
    const highs = tickData.map(d => d.high);
    const lows = tickData.map(d => d.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);

    // Find local maxima and minima for S/R
    for (let i = 2; i < tickData.length - 2; i++) {
      const prevHigh = tickData[i - 1].high;
      const currHigh = tickData[i].high;
      const nextHigh = tickData[i + 1].high;

      if (currHigh > prevHigh && currHigh > nextHigh && currHigh > maxHigh * 0.98) {
        aiAnnotations.push({
          timestamp: tickData[i].timestamp,
          type: 'resistance',
          description: `Resistance level at ${currHigh.toFixed(2)}`,
          confidence: 0.75,
        });
      }

      const prevLow = tickData[i - 1].low;
      const currLow = tickData[i].low;
      const nextLow = tickData[i + 1].low;

      if (currLow < prevLow && currLow < nextLow && currLow < minLow * 1.02) {
        aiAnnotations.push({
          timestamp: tickData[i].timestamp,
          type: 'support',
          description: `Support level at ${currLow.toFixed(2)}`,
          confidence: 0.75,
        });
      }
    }

    // Detect large volume spikes
    const avgVolume = tickData.reduce((sum, d) => sum + d.volume, 0) / tickData.length;
    for (const candle of tickData) {
      if (candle.volume > avgVolume * 2.5) {
        aiAnnotations.push({
          timestamp: candle.timestamp,
          type: 'pattern',
          description: `High volume spike (${(candle.volume / avgVolume).toFixed(1)}x average)`,
          confidence: 0.8,
        });
      }
    }

    // Detect momentum divergences (simplified)
    for (let i = 10; i < tickData.length; i++) {
      const priceChange = tickData[i].close - tickData[i - 10].close;
      const volumeChange = tickData[i].volume - tickData[i - 10].volume;

      // Bearish divergence: price up but volume down
      if (priceChange > 0 && volumeChange < 0) {
        const priceChangePercent = Math.abs(priceChange / tickData[i - 10].close);
        const volumeChangePercent = Math.abs(volumeChange / tickData[i - 10].volume);

        if (priceChangePercent > 0.02 && volumeChangePercent > 0.3) {
          aiAnnotations.push({
            timestamp: tickData[i].timestamp,
            type: 'divergence',
            description: 'Bearish divergence: price rising on declining volume',
            confidence: 0.65,
          });
        }
      }

      // Bullish divergence: price down but volume up
      if (priceChange < 0 && volumeChange > 0) {
        const priceChangePercent = Math.abs(priceChange / tickData[i - 10].close);
        const volumeChangePercent = Math.abs(volumeChange / tickData[i - 10].volume);

        if (priceChangePercent > 0.02 && volumeChangePercent > 0.3) {
          aiAnnotations.push({
            timestamp: tickData[i].timestamp,
            type: 'divergence',
            description: 'Bullish divergence: price falling on rising volume',
            confidence: 0.65,
          });
        }
      }
    }

    // Limit annotations
    const limitedAnnotations = aiAnnotations.slice(0, 20);

    // Store AI annotations
    await c.env.DB.prepare(`
      UPDATE trade_replays SET ai_annotations = ?, updated_at = CURRENT_TIMESTAMP WHERE trade_id = ?
    `).bind(JSON.stringify(limitedAnnotations), tradeId).run();

    return c.json({
      success: true,
      annotations: limitedAnnotations,
      count: limitedAnnotations.length,
    });
  } catch (error) {
    console.error('Error generating AI annotations:', error);
    return c.json({ error: 'Failed to generate AI analysis' }, 500);
  }
});

// Compare two trades side by side
tradeReplayRouter.get('/compare/:tradeId1/:tradeId2', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tradeId1 = c.req.param('tradeId1');
  const tradeId2 = c.req.param('tradeId2');

  try {
    // Get both trades
    const trade1 = await c.env.DB.prepare(`
      SELECT t.*, r.tick_data, r.ai_annotations
      FROM trades t
      LEFT JOIN trade_replays r ON t.id = r.trade_id
      WHERE t.id = ? AND t.user_id = ?
    `).bind(tradeId1, userId).first();

    const trade2 = await c.env.DB.prepare(`
      SELECT t.*, r.tick_data, r.ai_annotations
      FROM trades t
      LEFT JOIN trade_replays r ON t.id = r.trade_id
      WHERE t.id = ? AND t.user_id = ?
    `).bind(tradeId2, userId).first();

    if (!trade1 || !trade2) {
      return c.json({ error: 'One or both trades not found' }, 404);
    }

    // Compare metrics
    const comparison = {
      trade1: {
        id: trade1.id,
        symbol: trade1.symbol,
        direction: trade1.direction,
        pnl: trade1.pnl,
        entry_price: trade1.entry_price,
        exit_price: trade1.exit_price,
        hasReplay: !!trade1.tick_data,
      },
      trade2: {
        id: trade2.id,
        symbol: trade2.symbol,
        direction: trade2.direction,
        pnl: trade2.pnl,
        entry_price: trade2.entry_price,
        exit_price: trade2.exit_price,
        hasReplay: !!trade2.tick_data,
      },
      similarities: [] as string[],
      differences: [] as string[],
    };

    // Analyze similarities and differences
    if (trade1.symbol === trade2.symbol) {
      comparison.similarities.push('Same trading symbol');
    } else {
      comparison.differences.push('Different trading symbols');
    }

    if (trade1.direction === trade2.direction) {
      comparison.similarities.push('Same trade direction');
    } else {
      comparison.differences.push('Opposite trade directions');
    }

    const pnl1 = trade1.pnl as number || 0;
    const pnl2 = trade2.pnl as number || 0;
    if ((pnl1 > 0) === (pnl2 > 0)) {
      comparison.similarities.push('Same outcome (both profit or both loss)');
    } else {
      comparison.differences.push('Different outcomes');
    }

    return c.json({
      success: true,
      comparison,
    });
  } catch (error) {
    console.error('Error comparing trades:', error);
    return c.json({ error: 'Failed to compare trades' }, 500);
  }
});

// Get list of trades with replays
tradeReplayRouter.get('/', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const trades = await c.env.DB.prepare(`
      SELECT t.id, t.symbol, t.direction, t.pnl, t.entry_date, t.exit_date,
             CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as has_replay,
             r.created_at as replay_created_at
      FROM trades t
      LEFT JOIN trade_replays r ON t.id = r.trade_id
      WHERE t.user_id = ?
      ORDER BY t.exit_date DESC
      LIMIT 100
    `).bind(userId).all();

    return c.json({
      trades: trades.results,
      total: trades.results.length,
    });
  } catch (error) {
    console.error('Error fetching trades with replays:', error);
    return c.json({ error: 'Failed to fetch trades' }, 500);
  }
});
