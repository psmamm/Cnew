/**
 * AI Clone Page
 *
 * Dashboard for managing the AI Clone that learns from user's trading patterns
 * and can provide suggestions or execute trades autonomously.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  Brain,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  Shield,
  Play,
  Pause,
  Settings,
  Check,
  X,
  Clock,
  Zap,
  Eye,
  MessageSquare,
  Bot,
} from 'lucide-react';

// Types
interface AICloneConfig {
  permission_level: 'observe' | 'suggest' | 'semi_auto' | 'full_auto';
  is_active: boolean;
  min_confidence: number;
  max_position_size: number;
  max_daily_trades: number;
  max_daily_loss: number;
  allowed_symbols: string[];
}

interface Pattern {
  id: string;
  pattern_type: string;
  symbol: string;
  setup_type: string;
  win_rate: number;
  avg_pnl: number;
  sample_size: number;
  confidence: number;
}

interface Suggestion {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  confidence: number;
  reasoning: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

interface Stats {
  totalPatterns: number;
  avgConfidence: number;
  totalSuggestions: number;
  approvedSuggestions: number;
  successRate: number;
}

const PERMISSION_LEVELS = [
  {
    id: 'observe',
    label: 'Observe',
    description: 'AI watches and learns from your trades silently',
    icon: Eye,
    color: 'text-zinc-400',
  },
  {
    id: 'suggest',
    label: 'Suggest',
    description: 'AI provides trade suggestions for your approval',
    icon: MessageSquare,
    color: 'text-blue-400',
  },
  {
    id: 'semi_auto',
    label: 'Semi-Auto',
    description: 'AI executes trades after your confirmation',
    icon: Zap,
    color: 'text-yellow-400',
  },
  {
    id: 'full_auto',
    label: 'Full Auto',
    description: 'AI trades autonomously within your limits',
    icon: Bot,
    color: 'text-emerald-400',
  },
];

export default function AIClonePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AICloneConfig | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Helper to get auth token
  const getToken = useCallback(async () => {
    if (!user) return null;
    return await user.getIdToken();
  }, [user]);

  // Fetch AI Clone data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      try {
        const token = await getToken();
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        // Fetch config
        const configRes = await fetch('/api/ai-clone/config', { headers });
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        }

        // Fetch patterns
        const patternsRes = await fetch('/api/ai-clone/patterns?limit=10', { headers });
        if (patternsRes.ok) {
          const patternsData = await patternsRes.json();
          setPatterns(patternsData.patterns || []);
        }

        // Fetch suggestions
        const suggestionsRes = await fetch('/api/ai-clone/suggestions?limit=5', { headers });
        if (suggestionsRes.ok) {
          const suggestionsData = await suggestionsRes.json();
          setSuggestions(suggestionsData.suggestions || []);
        }

        // Fetch stats
        const statsRes = await fetch('/api/ai-clone/stats', { headers });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Error fetching AI Clone data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, getToken]);

  // Start training
  const handleStartTraining = async () => {
    if (!user) return;
    setIsTraining(true);

    try {
      const token = await getToken();
      const res = await fetch('/api/ai-clone/train', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Training complete! Found ${data.patterns_found} new patterns, updated ${data.patterns_updated} existing patterns.`);
        // Refresh patterns
        window.location.reload();
      }
    } catch (error) {
      console.error('Training failed:', error);
    } finally {
      setIsTraining(false);
    }
  };

  // Update permission level
  const handlePermissionChange = async (level: string) => {
    if (!user || !config) return;

    try {
      const token = await getToken();
      const res = await fetch('/api/ai-clone/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permission_level: level }),
      });

      if (res.ok) {
        setConfig({ ...config, permission_level: level as AICloneConfig['permission_level'] });
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  // Handle suggestion action
  const handleSuggestionAction = async (suggestionId: string, action: 'approve' | 'reject') => {
    if (!user) return;

    try {
      const token = await getToken();
      const res = await fetch(`/api/ai-clone/suggestions/${suggestionId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        setSuggestions(suggestions.map(s =>
          s.id === suggestionId
            ? { ...s, status: action === 'approve' ? 'approved' : 'rejected' }
            : s
        ));
      }
    } catch (error) {
      console.error(`Failed to ${action} suggestion:`, error);
    }
  };

  // Toggle active state
  const handleToggleActive = async () => {
    if (!user || !config) return;

    try {
      const token = await getToken();
      const res = await fetch('/api/ai-clone/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !config.is_active }),
      });

      if (res.ok) {
        setConfig({ ...config, is_active: !config.is_active });
      }
    } catch (error) {
      console.error('Failed to toggle active state:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-premium">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Clone</h1>
              <p className="text-zinc-400">Your personal trading AI that learns from you</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={config?.is_active ? 'destructive' : 'default'}
              onClick={handleToggleActive}
            >
              {config?.is_active ? (
                <>
                  <Pause className="h-4 w-4 mr-2" /> Pause Clone
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" /> Activate Clone
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Patterns Learned</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalPatterns || 0}</p>
                </div>
                <Target className="h-8 w-8 text-primary-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Avg Confidence</p>
                  <p className="text-2xl font-bold text-white">
                    {((stats?.avgConfidence || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <Sparkles className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Suggestions Made</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalSuggestions || 0}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Success Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {((stats?.successRate || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permission Level Selector */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary-500" />
              Permission Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {PERMISSION_LEVELS.map((level) => {
                const Icon = level.icon;
                const isActive = config?.permission_level === level.id;
                return (
                  <button
                    key={level.id}
                    onClick={() => handlePermissionChange(level.id)}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-[#2A2A2E] bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mb-3 ${isActive ? 'text-primary-500' : level.color}`} />
                    <h3 className={`font-semibold mb-1 ${isActive ? 'text-primary-500' : 'text-white'}`}>
                      {level.label}
                    </h3>
                    <p className="text-xs text-zinc-400">{level.description}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Learned Patterns */}
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary-500" />
                Learned Patterns
              </CardTitle>
              <Button
                size="sm"
                onClick={handleStartTraining}
                disabled={isTraining}
                loading={isTraining}
              >
                {isTraining ? 'Training...' : 'Train Now'}
              </Button>
            </CardHeader>
            <CardContent>
              {patterns.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No patterns learned yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Start training to let the AI learn from your trades
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{pattern.symbol}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary-500/20 text-primary-400">
                            {pattern.setup_type}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          {pattern.sample_size} trades analyzed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${pattern.win_rate >= 0.5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(pattern.win_rate * 100).toFixed(1)}% WR
                        </p>
                        <p className="text-xs text-zinc-400">
                          {(pattern.confidence * 100).toFixed(0)}% conf
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Suggestions */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Trade Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestions.filter(s => s.status === 'pending').length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No pending suggestions</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    AI will suggest trades when it detects matching patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions
                    .filter(s => s.status === 'pending')
                    .map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="p-4 rounded-lg bg-white/5 border border-[#2A2A2E]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{suggestion.symbol}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              suggestion.side === 'long'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {suggestion.side.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(suggestion.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        <p className="text-sm text-zinc-300 mb-3">{suggestion.reasoning}</p>

                        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                          <div>
                            <p className="text-zinc-500">Entry</p>
                            <p className="text-white">${suggestion.entry_price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Stop Loss</p>
                            <p className="text-rose-400">${suggestion.stop_loss.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Take Profit</p>
                            <p className="text-emerald-400">${suggestion.take_profit.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-400">
                              {(suggestion.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSuggestionAction(suggestion.id, 'reject')}
                            >
                              <X className="h-4 w-4 text-rose-400" />
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleSuggestionAction(suggestion.id, 'approve')}
                            >
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Warning Banner */}
        {config?.permission_level === 'full_auto' && (
          <Card variant="glass" className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-400">Full Auto Mode Active</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    The AI Clone will execute trades automatically within your configured limits.
                    Make sure your risk settings are properly configured before enabling this mode.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}











