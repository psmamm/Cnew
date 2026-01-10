import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

// ============================================================================
// VOICE JOURNAL - Audio Recording with Hume AI Emotion Detection
// ============================================================================

type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  HUME_API_KEY: string;
  HUME_SECRET_KEY: string;
  AI: unknown; // Workers AI
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

export const voiceJournalRouter = new Hono<{ Bindings: Env; Variables: { user: UserVariable } }>();

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

voiceJournalRouter.use('*', firebaseAuthMiddleware);

// ============================================================================
// TYPES
// ============================================================================

interface EmotionScore {
  joy: number;
  fear: number;
  anger: number;
  sadness: number;
  surprise: number;
  disgust: number;
  contempt: number;
  // Hume's extended emotions
  determination: number;
  excitement: number;
  anxiety: number;
  doubt: number;
  satisfaction: number;
  frustration: number;
  confidence: number;
  nervousness: number;
}

interface EmotionAnalysis {
  primary_emotion: string;
  emotion_scores: EmotionScore;
  sentiment: number; // -1 to 1
  confidence_level: number; // 0 to 1
  stress_indicators: boolean;
  trading_state: 'focused' | 'anxious' | 'overconfident' | 'fearful' | 'neutral' | 'tilt';
}

interface ExtractedInsights {
  mentioned_setup?: string;
  mentioned_mistake?: string;
  mentioned_lesson?: string;
  action_items?: string[];
  key_phrases?: string[];
}

// VoiceEntry interface for type documentation (used in API responses)
type VoiceEntry = {
  id: string;
  user_id: string;
  trade_id: string | null;
  audio_url: string;
  transcript: string | null;
  duration_seconds: number;
  emotion_analysis: EmotionAnalysis | null;
  extracted_insights: ExtractedInsights | null;
  created_at: string;
};

// Export for external use
export type { VoiceEntry };

// ============================================================================
// SCHEMAS
// ============================================================================

const UpdateTranscriptSchema = z.object({
  transcript: z.string().min(1),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Determine trading state based on emotion scores
function determineTradingState(emotions: EmotionScore): EmotionAnalysis['trading_state'] {
  const { anxiety, fear, confidence, frustration, anger, excitement } = emotions;

  // Tilt detection: high frustration/anger + low confidence
  if ((frustration > 0.6 || anger > 0.5) && confidence < 0.3) {
    return 'tilt';
  }

  // Fearful: high fear/anxiety, low confidence
  if ((fear > 0.5 || anxiety > 0.6) && confidence < 0.4) {
    return 'fearful';
  }

  // Overconfident: very high confidence + excitement without caution
  if (confidence > 0.8 && excitement > 0.6 && fear < 0.2) {
    return 'overconfident';
  }

  // Anxious: moderate-high anxiety
  if (anxiety > 0.5) {
    return 'anxious';
  }

  // Focused: balanced emotions, moderate confidence
  if (confidence > 0.5 && anxiety < 0.4 && fear < 0.3 && frustration < 0.3) {
    return 'focused';
  }

  return 'neutral';
}

// Extract insights from transcript using pattern matching
function extractInsights(transcript: string): ExtractedInsights {
  const insights: ExtractedInsights = {};
  const lowerTranscript = transcript.toLowerCase();

  // Setup detection patterns
  const setupPatterns = [
    /(?:used|applied|followed|took)\s+(?:my\s+)?(\w+(?:\s+\w+)?)\s+(?:setup|strategy|pattern)/i,
    /(?:the|this)\s+(\w+(?:\s+\w+)?)\s+(?:setup|strategy|pattern)/i,
    /(?:breakout|pullback|reversal|momentum|scalp|swing)/i,
  ];

  for (const pattern of setupPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      insights.mentioned_setup = match[1] || match[0];
      break;
    }
  }

  // Mistake detection patterns
  const mistakePatterns = [
    /(?:mistake|error|wrong|shouldn't have|regret|messed up|screwed up)/i,
    /(?:too early|too late|didn't wait|jumped in|overtraded)/i,
    /(?:ignored|broke|violated)\s+(?:my\s+)?(?:rules?|plan|stop)/i,
  ];

  for (const pattern of mistakePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      // Extract sentence containing the mistake
      const sentences = transcript.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (pattern.test(sentence)) {
          insights.mentioned_mistake = sentence.trim();
          break;
        }
      }
      break;
    }
  }

  // Lesson detection patterns
  const lessonPatterns = [
    /(?:learned|lesson|realized|understand now|need to|will|should)\s+(.+)/i,
    /(?:next time|in the future|going forward)/i,
  ];

  for (const pattern of lessonPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      const sentences = transcript.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (pattern.test(sentence)) {
          insights.mentioned_lesson = sentence.trim();
          break;
        }
      }
      break;
    }
  }

  // Action items (TODO-like phrases)
  const actionPatterns = [
    /(?:need to|should|must|will|going to|have to)\s+([^.!?]+)/gi,
    /(?:action|todo|reminder):\s*([^.!?]+)/gi,
  ];

  insights.action_items = [];
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      if (match[1] && match[1].length > 10 && match[1].length < 100) {
        insights.action_items.push(match[1].trim());
      }
    }
  }

  if (insights.action_items.length === 0) {
    delete insights.action_items;
  }

  // Key phrases extraction
  const keyPhrases: string[] = [];
  const phrases = [
    'support', 'resistance', 'breakout', 'breakdown', 'trend',
    'volume', 'momentum', 'reversal', 'consolidation', 'pullback',
    'stop loss', 'take profit', 'risk reward', 'position size',
    'overtraded', 'FOMO', 'revenge trade', 'patience', 'discipline'
  ];

  for (const phrase of phrases) {
    if (lowerTranscript.includes(phrase)) {
      keyPhrases.push(phrase);
    }
  }

  if (keyPhrases.length > 0) {
    insights.key_phrases = keyPhrases;
  }

  return insights;
}

// ============================================================================
// ROUTES
// ============================================================================

// Get all voice entries for user
voiceJournalRouter.get('/', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const tradeId = c.req.query('trade_id');

  try {
    let query = `
      SELECT v.*, t.symbol, t.pnl, t.direction
      FROM voice_journal v
      LEFT JOIN trades t ON v.trade_id = t.id
      WHERE v.user_id = ?
    `;
    const params: (string | number)[] = [userId];

    if (tradeId) {
      query += ' AND v.trade_id = ?';
      params.push(tradeId);
    }

    query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const entries = await c.env.DB.prepare(query).bind(...params).all();

    // Parse JSON fields
    const parsedEntries = entries.results.map((entry: Record<string, unknown>) => ({
      ...entry,
      emotion_analysis: entry.emotion_data ? JSON.parse(entry.emotion_data as string) : null,
      extracted_insights: entry.extracted_insights ? JSON.parse(entry.extracted_insights as string) : null,
    }));

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM voice_journal WHERE user_id = ?';
    const countParams: string[] = [userId];
    if (tradeId) {
      countQuery += ' AND trade_id = ?';
      countParams.push(tradeId);
    }
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

    return c.json({
      entries: parsedEntries,
      total: countResult?.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching voice entries:', error);
    return c.json({ error: 'Failed to fetch voice entries' }, 500);
  }
});

// Get single voice entry
voiceJournalRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entryId = c.req.param('id');

  try {
    const entry = await c.env.DB.prepare(`
      SELECT v.*, t.symbol, t.pnl, t.direction, t.entry_date, t.exit_date
      FROM voice_journal v
      LEFT JOIN trades t ON v.trade_id = t.id
      WHERE v.id = ? AND v.user_id = ?
    `).bind(entryId, userId).first();

    if (!entry) {
      return c.json({ error: 'Voice entry not found' }, 404);
    }

    return c.json({
      entry: {
        ...entry,
        emotion_analysis: entry.emotion_data ? JSON.parse(entry.emotion_data as string) : null,
        extracted_insights: entry.extracted_insights ? JSON.parse(entry.extracted_insights as string) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching voice entry:', error);
    return c.json({ error: 'Failed to fetch voice entry' }, 500);
  }
});

// Upload voice recording
voiceJournalRouter.post('/upload', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('audio') as File | null;
    const tradeId = formData.get('trade_id') as string | null;
    const durationStr = formData.get('duration_seconds') as string;

    if (!file) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const duration = parseInt(durationStr) || 0;

    // Validate file type
    const validTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.includes(file.type)) {
      return c.json({ error: 'Invalid audio format. Supported: webm, mp3, wav, ogg, m4a' }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'webm';
    const entryId = crypto.randomUUID();
    const filename = `voice-journal/${userId}/${entryId}.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Create database entry
    await c.env.DB.prepare(`
      INSERT INTO voice_journal (
        id, user_id, trade_id, audio_url, duration_seconds, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(entryId, userId, tradeId, filename, duration).run();

    return c.json({
      success: true,
      entry: {
        id: entryId,
        audio_url: filename,
        trade_id: tradeId,
        duration_seconds: duration,
      },
    });
  } catch (error) {
    console.error('Error uploading voice recording:', error);
    return c.json({ error: 'Failed to upload voice recording' }, 500);
  }
});

// Get audio file (presigned URL or stream)
voiceJournalRouter.get('/:id/audio', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entryId = c.req.param('id');

  try {
    // Verify ownership
    const entry = await c.env.DB.prepare(`
      SELECT audio_url FROM voice_journal WHERE id = ? AND user_id = ?
    `).bind(entryId, userId).first();

    if (!entry) {
      return c.json({ error: 'Voice entry not found' }, 404);
    }

    // Get file from R2
    const object = await c.env.R2_BUCKET.get(entry.audio_url as string);

    if (!object) {
      return c.json({ error: 'Audio file not found' }, 404);
    }

    // Return audio stream
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'audio/webm');
    headers.set('Content-Length', object.size.toString());
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(object.body as unknown as BodyInit, { headers });
  } catch (error) {
    console.error('Error fetching audio:', error);
    return c.json({ error: 'Failed to fetch audio' }, 500);
  }
});

// Update transcript
voiceJournalRouter.put('/:id/transcript', zValidator('json', UpdateTranscriptSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entryId = c.req.param('id');
  const { transcript } = c.req.valid('json');

  try {
    // Verify ownership
    const entry = await c.env.DB.prepare(`
      SELECT id FROM voice_journal WHERE id = ? AND user_id = ?
    `).bind(entryId, userId).first();

    if (!entry) {
      return c.json({ error: 'Voice entry not found' }, 404);
    }

    // Extract insights from transcript
    const insights = extractInsights(transcript);

    // Update entry
    await c.env.DB.prepare(`
      UPDATE voice_journal
      SET transcript = ?, extracted_insights = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(transcript, JSON.stringify(insights), entryId).run();

    return c.json({
      success: true,
      transcript,
      extracted_insights: insights,
    });
  } catch (error) {
    console.error('Error updating transcript:', error);
    return c.json({ error: 'Failed to update transcript' }, 500);
  }
});

// Analyze emotions using Hume AI
voiceJournalRouter.post('/:id/analyze-emotions', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entryId = c.req.param('id');

  try {
    // Verify ownership and get audio
    const entry = await c.env.DB.prepare(`
      SELECT audio_url, transcript FROM voice_journal WHERE id = ? AND user_id = ?
    `).bind(entryId, userId).first();

    if (!entry) {
      return c.json({ error: 'Voice entry not found' }, 404);
    }

    // Get audio file from R2
    const audioObject = await c.env.R2_BUCKET.get(entry.audio_url as string);
    if (!audioObject) {
      return c.json({ error: 'Audio file not found' }, 404);
    }

    const audioBuffer = await audioObject.arrayBuffer();

    // Prepare Hume AI request
    const humeApiKey = c.env.HUME_API_KEY;
    if (!humeApiKey) {
      // If Hume AI not configured, use mock analysis based on transcript
      const mockAnalysis = generateMockEmotionAnalysis(entry.transcript as string || '');

      await c.env.DB.prepare(`
        UPDATE voice_journal
        SET emotion_data = ?, primary_emotion = ?, sentiment = ?, stress_level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        JSON.stringify(mockAnalysis),
        mockAnalysis.primary_emotion,
        mockAnalysis.sentiment,
        mockAnalysis.stress_indicators ? 1 : 0,
        entryId
      ).run();

      return c.json({
        success: true,
        emotion_analysis: mockAnalysis,
        source: 'mock',
      });
    }

    // Call Hume AI API for prosody analysis
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.webm');
    formData.append('models', JSON.stringify({ prosody: {} }));

    const humeResponse = await fetch('https://api.hume.ai/v0/batch/jobs', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': humeApiKey,
      },
      body: formData,
    });

    if (!humeResponse.ok) {
      const errorText = await humeResponse.text();
      console.error('Hume API error:', errorText);

      // Fallback to mock analysis
      const mockAnalysis = generateMockEmotionAnalysis(entry.transcript as string || '');

      await c.env.DB.prepare(`
        UPDATE voice_journal
        SET emotion_data = ?, primary_emotion = ?, sentiment = ?, stress_level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        JSON.stringify(mockAnalysis),
        mockAnalysis.primary_emotion,
        mockAnalysis.sentiment,
        mockAnalysis.stress_indicators ? 1 : 0,
        entryId
      ).run();

      return c.json({
        success: true,
        emotion_analysis: mockAnalysis,
        source: 'fallback',
      });
    }

    const humeData = await humeResponse.json() as { job_id: string };

    // Return job ID - client should poll for results
    return c.json({
      success: true,
      job_id: humeData.job_id,
      status: 'processing',
      message: 'Emotion analysis started. Poll /analyze-emotions/status/:jobId for results.',
    });
  } catch (error) {
    console.error('Error analyzing emotions:', error);
    return c.json({ error: 'Failed to analyze emotions' }, 500);
  }
});

// Check Hume AI job status
voiceJournalRouter.get('/:id/analyze-emotions/status/:jobId', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entryId = c.req.param('id');
  const jobId = c.req.param('jobId');

  try {
    const humeApiKey = c.env.HUME_API_KEY;
    if (!humeApiKey) {
      return c.json({ error: 'Hume AI not configured' }, 500);
    }

    // Check job status
    const statusResponse = await fetch(`https://api.hume.ai/v0/batch/jobs/${jobId}`, {
      headers: {
        'X-Hume-Api-Key': humeApiKey,
      },
    });

    if (!statusResponse.ok) {
      return c.json({ error: 'Failed to check job status' }, 500);
    }

    const statusData = await statusResponse.json() as {
      state: { status: string };
      results?: {
        predictions: Array<{
          models: {
            prosody?: {
              grouped_predictions: Array<{
                predictions: Array<{
                  emotions: Array<{ name: string; score: number }>;
                }>;
              }>;
            };
          };
        }>;
      };
    };

    if (statusData.state.status === 'COMPLETED') {
      // Parse results and update database
      const analysis = parseHumeResults(statusData.results);

      await c.env.DB.prepare(`
        UPDATE voice_journal
        SET emotion_data = ?, primary_emotion = ?, sentiment = ?, stress_level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).bind(
        JSON.stringify(analysis),
        analysis.primary_emotion,
        analysis.sentiment,
        analysis.stress_indicators ? 1 : 0,
        entryId,
        userId
      ).run();

      return c.json({
        success: true,
        status: 'completed',
        emotion_analysis: analysis,
      });
    }

    return c.json({
      status: statusData.state.status.toLowerCase(),
      message: `Job is ${statusData.state.status.toLowerCase()}`,
    });
  } catch (error) {
    console.error('Error checking job status:', error);
    return c.json({ error: 'Failed to check job status' }, 500);
  }
});

// Delete voice entry
voiceJournalRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const entryId = c.req.param('id');

  try {
    // Get audio URL for R2 cleanup
    const entry = await c.env.DB.prepare(`
      SELECT audio_url FROM voice_journal WHERE id = ? AND user_id = ?
    `).bind(entryId, userId).first();

    if (!entry) {
      return c.json({ error: 'Voice entry not found' }, 404);
    }

    // Delete from R2
    if (entry.audio_url) {
      await c.env.R2_BUCKET.delete(entry.audio_url as string);
    }

    // Delete from database
    await c.env.DB.prepare(`
      DELETE FROM voice_journal WHERE id = ? AND user_id = ?
    `).bind(entryId, userId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting voice entry:', error);
    return c.json({ error: 'Failed to delete voice entry' }, 500);
  }
});

// Get emotion statistics for user
voiceJournalRouter.get('/stats/emotions', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const days = parseInt(c.req.query('days') || '30');

  try {
    const entries = await c.env.DB.prepare(`
      SELECT emotion_data, primary_emotion, sentiment, stress_level, created_at
      FROM voice_journal
      WHERE user_id = ? AND emotion_data IS NOT NULL
        AND created_at >= datetime('now', '-${days} days')
      ORDER BY created_at DESC
    `).bind(userId).all();

    if (entries.results.length === 0) {
      return c.json({
        total_entries: 0,
        message: 'No voice entries with emotion data found',
      });
    }

    // Aggregate emotions
    const emotionCounts: Record<string, number> = {};
    let totalSentiment = 0;
    let stressCount = 0;
    const tradingStates: Record<string, number> = {};

    for (const entry of entries.results) {
      const emotion = entry.primary_emotion as string;
      if (emotion) {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      }

      totalSentiment += (entry.sentiment as number) || 0;

      if (entry.stress_level === 1) {
        stressCount++;
      }

      if (entry.emotion_data) {
        const data = JSON.parse(entry.emotion_data as string) as EmotionAnalysis;
        if (data.trading_state) {
          tradingStates[data.trading_state] = (tradingStates[data.trading_state] || 0) + 1;
        }
      }
    }

    // Find dominant emotion
    let dominantEmotion = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    }

    return c.json({
      total_entries: entries.results.length,
      period_days: days,
      dominant_emotion: dominantEmotion,
      average_sentiment: totalSentiment / entries.results.length,
      stress_rate: stressCount / entries.results.length,
      emotion_distribution: emotionCounts,
      trading_state_distribution: tradingStates,
    });
  } catch (error) {
    console.error('Error fetching emotion stats:', error);
    return c.json({ error: 'Failed to fetch emotion statistics' }, 500);
  }
});

// Get emotion timeline
voiceJournalRouter.get('/stats/timeline', async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const days = parseInt(c.req.query('days') || '14');

  try {
    const entries = await c.env.DB.prepare(`
      SELECT
        date(created_at) as date,
        AVG(sentiment) as avg_sentiment,
        SUM(CASE WHEN stress_level = 1 THEN 1 ELSE 0 END) as stress_entries,
        COUNT(*) as total_entries,
        GROUP_CONCAT(primary_emotion) as emotions
      FROM voice_journal
      WHERE user_id = ? AND emotion_data IS NOT NULL
        AND created_at >= datetime('now', '-${days} days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).bind(userId).all();

    return c.json({
      timeline: entries.results.map((entry: Record<string, unknown>) => ({
        date: entry.date,
        avg_sentiment: entry.avg_sentiment,
        stress_rate: (entry.stress_entries as number) / (entry.total_entries as number),
        entry_count: entry.total_entries,
        emotions: (entry.emotions as string)?.split(',') || [],
      })),
    });
  } catch (error) {
    console.error('Error fetching emotion timeline:', error);
    return c.json({ error: 'Failed to fetch emotion timeline' }, 500);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateMockEmotionAnalysis(transcript: string): EmotionAnalysis {
  // Simple sentiment analysis based on keywords
  const positiveWords = ['good', 'great', 'profit', 'win', 'success', 'happy', 'confident', 'perfect', 'excellent'];
  const negativeWords = ['bad', 'loss', 'mistake', 'wrong', 'fear', 'anxious', 'worried', 'frustrated', 'angry'];
  const stressWords = ['stress', 'pressure', 'nervous', 'panic', 'scared', 'overwhelmed'];

  const lowerTranscript = transcript.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  let stressCount = 0;

  for (const word of positiveWords) {
    if (lowerTranscript.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (lowerTranscript.includes(word)) negativeCount++;
  }
  for (const word of stressWords) {
    if (lowerTranscript.includes(word)) stressCount++;
  }

  const sentiment = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
  const confidence = positiveCount > negativeCount ? 0.6 : 0.4;
  const anxiety = stressCount > 0 ? 0.5 : 0.2;

  const emotions: EmotionScore = {
    joy: positiveCount > 0 ? 0.5 : 0.2,
    fear: negativeCount > 0 ? 0.4 : 0.1,
    anger: lowerTranscript.includes('angry') || lowerTranscript.includes('frustrated') ? 0.5 : 0.1,
    sadness: lowerTranscript.includes('sad') || lowerTranscript.includes('disappointed') ? 0.4 : 0.1,
    surprise: 0.1,
    disgust: 0.05,
    contempt: 0.05,
    determination: positiveCount > 0 ? 0.5 : 0.3,
    excitement: lowerTranscript.includes('excited') ? 0.6 : 0.2,
    anxiety: anxiety,
    doubt: negativeCount > 0 ? 0.4 : 0.2,
    satisfaction: positiveCount > negativeCount ? 0.5 : 0.2,
    frustration: lowerTranscript.includes('frustrat') ? 0.6 : 0.2,
    confidence: confidence,
    nervousness: anxiety,
  };

  // Find primary emotion
  let primaryEmotion = 'neutral';
  let maxScore = 0;
  for (const [emotion, score] of Object.entries(emotions)) {
    if (score > maxScore) {
      maxScore = score;
      primaryEmotion = emotion;
    }
  }

  const tradingState = determineTradingState(emotions);

  return {
    primary_emotion: primaryEmotion,
    emotion_scores: emotions,
    sentiment: sentiment,
    confidence_level: confidence,
    stress_indicators: stressCount > 0,
    trading_state: tradingState,
  };
}

function parseHumeResults(results: unknown): EmotionAnalysis {
  const data = results as {
    predictions?: Array<{
      models?: {
        prosody?: {
          grouped_predictions?: Array<{
            predictions?: Array<{
              emotions?: Array<{ name: string; score: number }>;
            }>;
          }>;
        };
      };
    }>;
  };

  const emotions: EmotionScore = {
    joy: 0,
    fear: 0,
    anger: 0,
    sadness: 0,
    surprise: 0,
    disgust: 0,
    contempt: 0,
    determination: 0,
    excitement: 0,
    anxiety: 0,
    doubt: 0,
    satisfaction: 0,
    frustration: 0,
    confidence: 0,
    nervousness: 0,
  };

  try {
    const predictions = data?.predictions?.[0]?.models?.prosody?.grouped_predictions || [];

    for (const group of predictions) {
      for (const pred of group.predictions || []) {
        for (const emotion of pred.emotions || []) {
          const name = emotion.name.toLowerCase().replace(/ /g, '_') as keyof EmotionScore;
          if (name in emotions) {
            emotions[name] = Math.max(emotions[name], emotion.score);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Hume results:', e);
  }

  // Find primary emotion
  let primaryEmotion = 'neutral';
  let maxScore = 0;
  for (const [emotion, score] of Object.entries(emotions)) {
    if (score > maxScore) {
      maxScore = score;
      primaryEmotion = emotion;
    }
  }

  // Calculate sentiment (-1 to 1)
  const positiveEmotions = emotions.joy + emotions.satisfaction + emotions.excitement + emotions.confidence;
  const negativeEmotions = emotions.fear + emotions.anger + emotions.sadness + emotions.anxiety + emotions.frustration;
  const sentiment = (positiveEmotions - negativeEmotions) / (positiveEmotions + negativeEmotions + 0.001);

  const tradingState = determineTradingState(emotions);

  return {
    primary_emotion: primaryEmotion,
    emotion_scores: emotions,
    sentiment: sentiment,
    confidence_level: emotions.confidence,
    stress_indicators: emotions.anxiety > 0.5 || emotions.fear > 0.5,
    trading_state: tradingState,
  };
}
