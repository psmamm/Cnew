import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";

// ============================================================================
// SUBSCRIPTIONS - Freemium Tier Management with Stripe
// ============================================================================

type Env = {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRO_PRICE_ID: string;
  STRIPE_ELITE_PRICE_ID: string;
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

export const subscriptionsRouter = new Hono<{ Bindings: Env; Variables: { user: UserVariable } }>();

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

// ============================================================================
// TYPES
// ============================================================================

type SubscriptionTier = 'free' | 'pro' | 'elite';

interface TierLimits {
  trades_limit: number;
  voice_minutes_limit: number;
  storage_limit_mb: number;
  api_calls_limit: number;
  exchange_limit: number;
  ai_clone_level: 'none' | 'observe' | 'suggest' | 'auto';
  features: string[];
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    trades_limit: 50,
    voice_minutes_limit: 10,
    storage_limit_mb: 100,
    api_calls_limit: 1000,
    exchange_limit: 1,
    ai_clone_level: 'none',
    features: ['basic_reports', 'csv_import', 'manual_journal'],
  },
  pro: {
    trades_limit: -1, // Unlimited
    voice_minutes_limit: -1,
    storage_limit_mb: 10240, // 10GB
    api_calls_limit: -1,
    exchange_limit: -1,
    ai_clone_level: 'suggest',
    features: [
      'basic_reports',
      'advanced_reports',
      'csv_import',
      'api_sync',
      'manual_journal',
      'voice_journal',
      'trade_replay',
      'ai_clone_suggest',
      'multi_exchange',
    ],
  },
  elite: {
    trades_limit: -1,
    voice_minutes_limit: -1,
    storage_limit_mb: -1,
    api_calls_limit: -1,
    exchange_limit: -1,
    ai_clone_level: 'auto',
    features: [
      'basic_reports',
      'advanced_reports',
      'ai_reports',
      'csv_import',
      'api_sync',
      'webhook_import',
      'manual_journal',
      'voice_journal',
      'trade_replay',
      'ai_clone_suggest',
      'ai_clone_auto',
      'multi_exchange',
      'priority_support',
      'early_access',
    ],
  },
};

const TIER_PRICES = {
  pro: {
    monthly: { price_id: 'price_pro_monthly', amount: 2900 }, // $29
    yearly: { price_id: 'price_pro_yearly', amount: 29000 }, // $290 (2 months free)
  },
  elite: {
    monthly: { price_id: 'price_elite_monthly', amount: 9900 }, // $99
    yearly: { price_id: 'price_elite_yearly', amount: 99000 }, // $990 (2 months free)
  },
};

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateCheckoutSchema = z.object({
  tier: z.enum(['pro', 'elite']),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

const CreatePortalSchema = z.object({
  return_url: z.string().url(),
});

// ============================================================================
// ROUTES
// ============================================================================

// Get current subscription
subscriptionsRouter.get('/', firebaseAuthMiddleware, async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    let subscription = await c.env.DB.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ?
    `).bind(userId).first();

    // Create free subscription if none exists
    if (!subscription) {
      const subId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO subscriptions (
          id, user_id, tier, trades_limit, voice_minutes_limit,
          storage_limit_mb, api_calls_limit
        ) VALUES (?, ?, 'free', 50, 10, 100, 1000)
      `).bind(subId, userId).run();

      subscription = await c.env.DB.prepare(`
        SELECT * FROM subscriptions WHERE id = ?
      `).bind(subId).first();
    }

    // Get tier limits
    const tier = subscription?.tier as SubscriptionTier || 'free';
    const limits = TIER_LIMITS[tier];

    return c.json({
      subscription: {
        id: subscription?.id,
        tier,
        status: subscription?.status || 'active',
        billing_interval: subscription?.billing_interval,
        current_period_end: subscription?.current_period_end,
        trial_ends_at: subscription?.trial_ends_at,
      },
      usage: {
        trades_used: subscription?.trades_this_month || 0,
        trades_limit: limits.trades_limit,
        voice_minutes_used: subscription?.voice_minutes_used || 0,
        voice_minutes_limit: limits.voice_minutes_limit,
        storage_used_mb: subscription?.storage_used_mb || 0,
        storage_limit_mb: limits.storage_limit_mb,
        api_calls_used: subscription?.api_calls_this_month || 0,
        api_calls_limit: limits.api_calls_limit,
      },
      features: limits.features,
      ai_clone_level: limits.ai_clone_level,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

// Get available plans
subscriptionsRouter.get('/plans', async (c) => {
  return c.json({
    plans: [
      {
        tier: 'free',
        name: 'Free',
        description: 'Get started with basic trading journal',
        price: { monthly: 0, yearly: 0 },
        limits: TIER_LIMITS.free,
        features: [
          '50 trades/month',
          '10 voice minutes',
          '100MB storage',
          '1 exchange connection',
          'Basic reports',
          'CSV import',
        ],
      },
      {
        tier: 'pro',
        name: 'Pro',
        description: 'Unlock advanced features for serious traders',
        price: { monthly: 29, yearly: 290 },
        limits: TIER_LIMITS.pro,
        features: [
          'Unlimited trades',
          'Unlimited voice journal',
          '10GB storage',
          'All exchanges',
          'Advanced reports',
          'Trade replay',
          'AI Clone suggestions',
          'API sync',
        ],
        popular: true,
      },
      {
        tier: 'elite',
        name: 'Elite',
        description: 'Full automation for professional traders',
        price: { monthly: 99, yearly: 990 },
        limits: TIER_LIMITS.elite,
        features: [
          'Everything in Pro',
          'AI Clone auto-trading',
          'Unlimited storage',
          'AI-generated reports',
          'Priority support',
          'Early access to features',
          'Webhook imports',
        ],
      },
    ],
  });
});

// Create Stripe checkout session
subscriptionsRouter.post('/checkout', firebaseAuthMiddleware, zValidator('json', CreateCheckoutSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  const userEmail = user.email || user.google_user_data?.email;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { tier, interval, success_url, cancel_url } = c.req.valid('json');

  try {
    const stripeKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      // Mock response for development
      return c.json({
        checkout_url: `${success_url}?session_id=mock_session_${Date.now()}`,
        session_id: `mock_session_${Date.now()}`,
        mock: true,
      });
    }

    // Get or create Stripe customer
    const subscription = await c.env.DB.prepare(`
      SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?
    `).bind(userId).first();

    let customerId = subscription?.stripe_customer_id as string;

    if (!customerId) {
      // Create Stripe customer
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: userEmail || '',
          metadata: JSON.stringify({ user_id: userId }),
        }),
      });

      if (!customerResponse.ok) {
        throw new Error('Failed to create Stripe customer');
      }

      const customer = await customerResponse.json() as { id: string };
      customerId = customer.id;

      // Save customer ID
      await c.env.DB.prepare(`
        UPDATE subscriptions SET stripe_customer_id = ? WHERE user_id = ?
      `).bind(customerId, userId).run();
    }

    // Get price ID
    const priceConfig = TIER_PRICES[tier][interval];
    const priceId = tier === 'pro'
      ? c.env.STRIPE_PRO_PRICE_ID || priceConfig.price_id
      : c.env.STRIPE_ELITE_PRICE_ID || priceConfig.price_id;

    // Create checkout session
    const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'success_url': success_url,
        'cancel_url': cancel_url,
        'metadata[user_id]': userId,
        'metadata[tier]': tier,
        'subscription_data[metadata][user_id]': userId,
        'subscription_data[metadata][tier]': tier,
      }),
    });

    if (!checkoutResponse.ok) {
      const error = await checkoutResponse.text();
      console.error('Stripe checkout error:', error);
      throw new Error('Failed to create checkout session');
    }

    const session = await checkoutResponse.json() as { id: string; url: string };

    return c.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Create Stripe customer portal session
subscriptionsRouter.post('/portal', firebaseAuthMiddleware, zValidator('json', CreatePortalSchema), async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { return_url } = c.req.valid('json');

  try {
    const subscription = await c.env.DB.prepare(`
      SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?
    `).bind(userId).first();

    if (!subscription?.stripe_customer_id) {
      return c.json({ error: 'No subscription found' }, 404);
    }

    const stripeKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return c.json({
        portal_url: return_url,
        mock: true,
      });
    }

    const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: subscription.stripe_customer_id as string,
        return_url,
      }),
    });

    if (!portalResponse.ok) {
      throw new Error('Failed to create portal session');
    }

    const session = await portalResponse.json() as { url: string };

    return c.json({
      portal_url: session.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

// Stripe webhook handler
subscriptionsRouter.post('/webhook', async (c) => {
  try {
    const signature = c.req.header('stripe-signature');
    const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return c.json({ error: 'Missing signature' }, 400);
    }

    const body = await c.req.text();

    // Verify webhook signature (simplified - use Stripe SDK in production)
    // For now, we'll process the event directly

    const event = JSON.parse(body) as {
      type: string;
      data: {
        object: {
          id: string;
          customer: string;
          status: string;
          metadata?: { user_id?: string; tier?: string };
          current_period_start?: number;
          current_period_end?: number;
          cancel_at?: number;
        };
      };
    };

    const { type, data } = event;
    const subscription = data.object;

    switch (type) {
      case 'checkout.session.completed': {
        // Payment successful, activate subscription
        const userId = subscription.metadata?.user_id;
        const tier = subscription.metadata?.tier as SubscriptionTier;

        if (userId && tier) {
          const limits = TIER_LIMITS[tier];
          await c.env.DB.prepare(`
            UPDATE subscriptions
            SET tier = ?,
                stripe_subscription_id = ?,
                status = 'active',
                trades_limit = ?,
                voice_minutes_limit = ?,
                storage_limit_mb = ?,
                api_calls_limit = ?,
                ai_clone_enabled = ?,
                auto_trading_enabled = ?,
                advanced_reports_enabled = ?,
                multi_exchange_enabled = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).bind(
            tier,
            subscription.id,
            limits.trades_limit,
            limits.voice_minutes_limit,
            limits.storage_limit_mb,
            limits.api_calls_limit,
            limits.ai_clone_level !== 'none' ? 1 : 0,
            limits.ai_clone_level === 'auto' ? 1 : 0,
            limits.features.includes('advanced_reports') ? 1 : 0,
            limits.exchange_limit === -1 ? 1 : 0,
            userId
          ).run();
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Subscription updated (upgrade/downgrade)
        const stripeSubId = subscription.id;
        const status = subscription.status;

        await c.env.DB.prepare(`
          UPDATE subscriptions
          SET status = ?,
              current_period_start = ?,
              current_period_end = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = ?
        `).bind(
          status,
          subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          stripeSubId
        ).run();
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled - downgrade to free
        const stripeSubId = subscription.id;
        const freeLimits = TIER_LIMITS.free;

        await c.env.DB.prepare(`
          UPDATE subscriptions
          SET tier = 'free',
              status = 'cancelled',
              stripe_subscription_id = NULL,
              trades_limit = ?,
              voice_minutes_limit = ?,
              storage_limit_mb = ?,
              api_calls_limit = ?,
              ai_clone_enabled = 0,
              auto_trading_enabled = 0,
              advanced_reports_enabled = 0,
              multi_exchange_enabled = 0,
              cancelled_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = ?
        `).bind(
          freeLimits.trades_limit,
          freeLimits.voice_minutes_limit,
          freeLimits.storage_limit_mb,
          freeLimits.api_calls_limit,
          stripeSubId
        ).run();
        break;
      }

      case 'invoice.payment_failed': {
        // Payment failed - mark as past due
        const customerId = subscription.customer;

        await c.env.DB.prepare(`
          UPDATE subscriptions
          SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
          WHERE stripe_customer_id = ?
        `).bind(customerId).run();
        break;
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Track usage event
subscriptionsRouter.post('/usage/:type', firebaseAuthMiddleware, async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const eventType = c.req.param('type');
  const validTypes = ['trade', 'voice_minute', 'storage', 'api_call'];

  if (!validTypes.includes(eventType)) {
    return c.json({ error: 'Invalid event type' }, 400);
  }

  try {
    // Get current subscription
    const subscription = await c.env.DB.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ?
    `).bind(userId).first();

    if (!subscription) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    // Check limits
    const tier = subscription.tier as SubscriptionTier;
    const limits = TIER_LIMITS[tier];

    let currentUsage: number;
    let limit: number;
    let updateField: string;

    switch (eventType) {
      case 'trade':
        currentUsage = (subscription.trades_this_month as number) || 0;
        limit = limits.trades_limit;
        updateField = 'trades_this_month';
        break;
      case 'voice_minute':
        currentUsage = (subscription.voice_minutes_used as number) || 0;
        limit = limits.voice_minutes_limit;
        updateField = 'voice_minutes_used';
        break;
      case 'storage':
        currentUsage = (subscription.storage_used_mb as number) || 0;
        limit = limits.storage_limit_mb;
        updateField = 'storage_used_mb';
        break;
      case 'api_call':
        currentUsage = (subscription.api_calls_this_month as number) || 0;
        limit = limits.api_calls_limit;
        updateField = 'api_calls_this_month';
        break;
      default:
        return c.json({ error: 'Invalid event type' }, 400);
    }

    // Check if over limit (-1 means unlimited)
    if (limit !== -1 && currentUsage >= limit) {
      return c.json({
        success: false,
        error: 'Usage limit reached',
        current: currentUsage,
        limit,
        upgrade_required: true,
      }, 403);
    }

    // Increment usage
    await c.env.DB.prepare(`
      UPDATE subscriptions SET ${updateField} = ${updateField} + 1 WHERE user_id = ?
    `).bind(userId).run();

    // Log usage event
    await c.env.DB.prepare(`
      INSERT INTO usage_events (id, user_id, subscription_id, event_type)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), userId, subscription.id, eventType).run();

    return c.json({
      success: true,
      current: currentUsage + 1,
      limit,
      remaining: limit === -1 ? -1 : limit - currentUsage - 1,
    });
  } catch (error) {
    console.error('Error tracking usage:', error);
    return c.json({ error: 'Failed to track usage' }, 500);
  }
});

// Check feature access
subscriptionsRouter.get('/feature/:feature', firebaseAuthMiddleware, async (c) => {
  const user = c.get('user');
  const userId = user.google_user_data?.sub || user.firebase_user_id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const feature = c.req.param('feature');

  try {
    const subscription = await c.env.DB.prepare(`
      SELECT tier FROM subscriptions WHERE user_id = ?
    `).bind(userId).first();

    const tier = (subscription?.tier as SubscriptionTier) || 'free';
    const limits = TIER_LIMITS[tier];
    const hasAccess = limits.features.includes(feature);

    return c.json({
      feature,
      has_access: hasAccess,
      current_tier: tier,
      required_tier: hasAccess
        ? tier
        : Object.entries(TIER_LIMITS).find(([, l]) => l.features.includes(feature))?.[0] || 'elite',
    });
  } catch (error) {
    console.error('Error checking feature:', error);
    return c.json({ error: 'Failed to check feature' }, 500);
  }
});

// Reset monthly usage (called by cron)
subscriptionsRouter.post('/reset-usage', async (c) => {
  // Verify internal call (add proper authentication in production)
  const authHeader = c.req.header('Authorization');
  if (authHeader !== 'Bearer internal-cron-key') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    await c.env.DB.prepare(`
      UPDATE subscriptions
      SET trades_this_month = 0,
          voice_minutes_used = 0,
          api_calls_this_month = 0,
          updated_at = CURRENT_TIMESTAMP
    `).run();

    return c.json({ success: true, message: 'Monthly usage reset complete' });
  } catch (error) {
    console.error('Error resetting usage:', error);
    return c.json({ error: 'Failed to reset usage' }, 500);
  }
});
