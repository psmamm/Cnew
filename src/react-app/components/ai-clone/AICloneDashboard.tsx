import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import {
  Bot,
  Brain,
  Zap,
  Shield,
  TrendingUp,
  TrendingDown,
  Settings,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AICloneConfig {
  permission_level: 'observe' | 'suggest' | 'semi_auto' | 'full_auto';
  is_active: boolean;
  max_position_percent: number;
  max_daily_trades: number;
  max_daily_loss_percent: number;
  min_confidence: number;
  learning_enabled: boolean;
  allowed_asset_classes: string[];
  allowed_symbols: string[];
  last_retrain_at: string | null;
}

interface Pattern {
  id: string;
  symbol: string;
  pattern_type: string;
  setup_type: string;
  win_rate: number;
  confidence: number;
  sample_size: number;
  avg_pnl_percent: number;
}

interface Suggestion {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  confidence: number;
  reasoning: string[];
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  suggested_at: string;
}

interface AICloneStats {
  config: {
    total_suggestions: number;
    accepted_suggestions: number;
    executed_trades: number;
    acceptance_rate: number;
    last_trade_at: string | null;
    last_retrain_at: string | null;
  };
  patterns: {
    total: number;
    avg_confidence: number;
    avg_win_rate: number;
    total_samples: number;
  };
  decisions: {
    total: number;
    approved: number;
    executed: number;
    wins: number;
    losses: number;
    total_pnl: number;
    win_rate: number;
  };
}

// ============================================================================
// PERMISSION LEVEL DESCRIPTIONS
// ============================================================================

const PERMISSION_LEVELS = {
  observe: {
    label: 'Observe',
    description: 'AI learns from your trades but never suggests',
    icon: <Brain size={18} />,
    color: 'text-zinc-400',
  },
  suggest: {
    label: 'Suggest',
    description: 'AI suggests trades, you decide to execute',
    icon: <Sparkles size={18} />,
    color: 'text-primary-400',
  },
  semi_auto: {
    label: 'Semi-Auto',
    description: 'AI executes after your confirmation',
    icon: <Zap size={18} />,
    color: 'text-warning',
  },
  full_auto: {
    label: 'Full Auto',
    description: 'AI trades automatically within limits',
    icon: <Bot size={18} />,
    color: 'text-success',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AICloneDashboard() {
  // State
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AICloneConfig | null>(null);
  const [stats, setStats] = useState<AICloneStats | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, patternsRes, suggestionsRes] = await Promise.all([
        fetch('/api/ai-clone/config', { credentials: 'include' }),
        fetch('/api/ai-clone/stats', { credentials: 'include' }),
        fetch('/api/ai-clone/patterns?min_confidence=0.6&limit=10', { credentials: 'include' }),
        fetch('/api/ai-clone/suggestions', { credentials: 'include' }),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (patternsRes.ok) {
        const data = await patternsRes.json();
        setPatterns(data.patterns || []);
      }

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching AI Clone data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      const response = await fetch('/api/ai-clone/train', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Training complete! Analyzed ${data.trades_analyzed} trades, found ${data.patterns_found} new patterns.`);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Training failed');
      }
    } catch (error) {
      console.error('Training error:', error);
      alert('Failed to train AI Clone');
    } finally {
      setIsTraining(false);
    }
  };

  const handleToggleActive = async () => {
    if (!config) return;

    try {
      const response = await fetch('/api/ai-clone/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !config.is_active }),
      });

      if (response.ok) {
        setConfig({ ...config, is_active: !config.is_active });
      }
    } catch (error) {
      console.error('Error toggling AI Clone:', error);
    }
  };

  const handlePermissionChange = async (level: AICloneConfig['permission_level']) => {
    try {
      const response = await fetch('/api/ai-clone/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permission_level: level }),
      });

      if (response.ok) {
        setConfig((prev) => prev ? { ...prev, permission_level: level } : null);
      }
    } catch (error) {
      console.error('Error updating permission level:', error);
    }
  };

  const handleSuggestionResponse = async (suggestionId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/ai-clone/suggestions/${suggestionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });

      if (response.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        fetchData(); // Refresh stats
      }
    } catch (error) {
      console.error('Error responding to suggestion:', error);
    }
  };

  const handleGenerateSuggestions = async () => {
    try {
      const response = await fetch('/api/ai-clone/suggestions/generate', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          alert(data.message || 'No new suggestions available');
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to generate suggestions');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Bot size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              AI Clone
              {config?.is_active && (
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              )}
            </h2>
            <p className="text-sm text-zinc-400">
              Your personal trading AI that learns from your style
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={config?.is_active ? 'destructive' : 'success'}
            onClick={handleToggleActive}
          >
            {config?.is_active ? <Pause size={18} className="mr-2" /> : <Play size={18} className="mr-2" />}
            {config?.is_active ? 'Pause' : 'Activate'}
          </Button>

          <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} className="mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Permission Level Selector */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">Permission Level:</span>
            <div className="flex items-center gap-2">
              {Object.entries(PERMISSION_LEVELS).map(([level, info]) => (
                <button
                  key={level}
                  onClick={() => handlePermissionChange(level as AICloneConfig['permission_level'])}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    config?.permission_level === level
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-500/50'
                      : 'bg-dark-surface text-zinc-400 hover:text-white hover:bg-dark-overlay'
                  }`}
                >
                  {info.icon}
                  <span className="text-sm font-medium">{info.label}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {config && PERMISSION_LEVELS[config.permission_level].description}
          </p>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Target size={20} className="text-primary-400" />
                <span className={`text-xs ${stats.patterns.total > 0 ? 'text-success' : 'text-zinc-500'}`}>
                  {stats.patterns.total > 0 ? 'Active' : 'No patterns'}
                </span>
              </div>
              <p className="text-2xl font-semibold mt-2">{stats.patterns.total}</p>
              <p className="text-xs text-zinc-500">Learned Patterns</p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Sparkles size={20} className="text-warning" />
                <span className="text-xs text-zinc-500">
                  {stats.config.acceptance_rate.toFixed(0)}% accepted
                </span>
              </div>
              <p className="text-2xl font-semibold mt-2">{stats.config.total_suggestions}</p>
              <p className="text-xs text-zinc-500">Total Suggestions</p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <BarChart3 size={20} className="text-success" />
                <span className={`text-xs ${stats.decisions.win_rate >= 50 ? 'text-success' : 'text-danger'}`}>
                  {stats.decisions.win_rate.toFixed(1)}% win rate
                </span>
              </div>
              <p className="text-2xl font-semibold mt-2">{stats.decisions.executed}</p>
              <p className="text-xs text-zinc-500">Executed Trades</p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {stats.decisions.total_pnl >= 0 ? (
                  <TrendingUp size={20} className="text-success" />
                ) : (
                  <TrendingDown size={20} className="text-danger" />
                )}
              </div>
              <p className={`text-2xl font-semibold mt-2 ${
                stats.decisions.total_pnl >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {stats.decisions.total_pnl >= 0 ? '+' : ''}${stats.decisions.total_pnl.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500">AI Clone P&L</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Suggestions */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-warning" />
              Trade Suggestions
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleGenerateSuggestions}>
              <RefreshCw size={14} className="mr-1" />
              Generate
            </Button>
          </CardHeader>
          <CardContent>
            {suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-4 bg-dark-surface rounded-lg border border-dark-overlay"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{suggestion.symbol}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            suggestion.side === 'long'
                              ? 'bg-success/20 text-success'
                              : 'bg-danger/20 text-danger'
                          }`}
                        >
                          {suggestion.side.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-zinc-500">Confidence:</span>
                        <span
                          className={`text-sm font-mono ${
                            suggestion.confidence >= 0.8
                              ? 'text-success'
                              : suggestion.confidence >= 0.7
                              ? 'text-warning'
                              : 'text-zinc-400'
                          }`}
                        >
                          {(suggestion.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400 mb-3">
                      {suggestion.reasoning.slice(0, 2).map((reason, i) => (
                        <p key={i}>• {reason}</p>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        {new Date(suggestion.suggested_at).toLocaleTimeString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSuggestionResponse(suggestion.id, false)}
                          className="text-danger hover:bg-danger/10"
                        >
                          <XCircle size={16} className="mr-1" />
                          Reject
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleSuggestionResponse(suggestion.id, true)}
                        >
                          <CheckCircle2 size={16} className="mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="mx-auto text-zinc-600 mb-2" size={32} />
                <p className="text-zinc-500">No active suggestions</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Train your AI Clone or generate new suggestions
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Patterns */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain size={18} className="text-primary-400" />
              Learned Patterns
            </CardTitle>
            <Button
              variant="premium"
              size="sm"
              onClick={handleTrain}
              disabled={isTraining}
            >
              {isTraining ? (
                <RefreshCw size={14} className="mr-1 animate-spin" />
              ) : (
                <Zap size={14} className="mr-1" />
              )}
              {isTraining ? 'Training...' : 'Train'}
            </Button>
          </CardHeader>
          <CardContent>
            {patterns.length > 0 ? (
              <div className="space-y-2">
                {patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="flex items-center justify-between p-3 bg-dark-surface rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          pattern.win_rate >= 0.6
                            ? 'bg-success/20'
                            : pattern.win_rate >= 0.5
                            ? 'bg-warning/20'
                            : 'bg-danger/20'
                        }`}
                      >
                        {pattern.win_rate >= 0.5 ? (
                          <ArrowUpRight className="text-success" size={18} />
                        ) : (
                          <ArrowDownRight className="text-danger" size={18} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pattern.symbol}</p>
                        <p className="text-xs text-zinc-500">
                          {pattern.setup_type} • {pattern.sample_size} trades
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-sm font-mono ${
                          pattern.win_rate >= 0.5 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {(pattern.win_rate * 100).toFixed(0)}% WR
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(pattern.confidence * 100).toFixed(0)}% conf
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="mx-auto text-zinc-600 mb-2" size={32} />
                <p className="text-zinc-500">No patterns learned yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Complete at least 10 trades to train your AI Clone
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={18} className="text-primary-400" />
              Risk & Safety Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Max Position Size (%)
                </label>
                <input
                  type="number"
                  value={config?.max_position_percent || 5}
                  className="w-full bg-dark-surface border border-dark-overlay rounded-lg px-3 py-2"
                  disabled
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Max Daily Trades
                </label>
                <input
                  type="number"
                  value={config?.max_daily_trades || 10}
                  className="w-full bg-dark-surface border border-dark-overlay rounded-lg px-3 py-2"
                  disabled
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Max Daily Loss (%)
                </label>
                <input
                  type="number"
                  value={config?.max_daily_loss_percent || 5}
                  className="w-full bg-dark-surface border border-dark-overlay rounded-lg px-3 py-2"
                  disabled
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Minimum Confidence (%)
                </label>
                <input
                  type="number"
                  value={(config?.min_confidence || 0.7) * 100}
                  className="w-full bg-dark-surface border border-dark-overlay rounded-lg px-3 py-2"
                  disabled
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Allowed Asset Classes
                </label>
                <div className="flex flex-wrap gap-2">
                  {(config?.allowed_asset_classes || ['crypto']).map((asset) => (
                    <span
                      key={asset}
                      className="px-2 py-1 bg-primary-600/20 text-primary-400 rounded text-xs"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Learning Status
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      config?.learning_enabled ? 'bg-success' : 'bg-zinc-500'
                    }`}
                  />
                  <span className="text-sm">
                    {config?.learning_enabled ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>

            {config?.last_retrain_at && (
              <div className="mt-4 pt-4 border-t border-dark-overlay flex items-center gap-2 text-xs text-zinc-500">
                <Clock size={12} />
                Last trained: {new Date(config.last_retrain_at).toLocaleString()}
              </div>
            )}

            <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-warning mt-0.5" />
                <div className="text-sm text-warning">
                  <p className="font-medium">Safety First</p>
                  <p className="text-xs text-warning/80 mt-1">
                    AI Clone will never exceed your risk limits. You can always pause or stop
                    the AI at any time. All automated trades require your prior authorization.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AICloneDashboard;

