/**
 * Exchange Settings Page
 *
 * Manage connected exchanges, API keys, and sync settings.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Plus, Trash2, RefreshCw, Settings, Shield, Clock, AlertCircle,
  Check, Key, ChevronRight, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTheme } from '@/react-app/contexts/ThemeContext';
import { getCardBg, getCardBorder, getTextColor, getHoverBg } from '@/react-app/utils/themeUtils';
import ExchangeConnectionModal from '@/react-app/components/exchanges/ExchangeConnectionModal';
import DashboardLayout from '@/react-app/components/DashboardLayout';
import { useExchangeConnections, ExchangeConnection } from '@/react-app/hooks/useExchangeConnections';

// ============================================================================
// Types
// ============================================================================

interface ConnectedExchange {
  id: string;
  exchangeId: string;
  exchangeName: string;
  apiKeyPreview: string;
  isTestnet: boolean;
  status: 'connected' | 'syncing' | 'error';
  lastSync: string;
  tradesCount: number;
  permissions: string[];
  error?: string;
  createdAt: string;
}

// Helper to convert ExchangeConnection to ConnectedExchange
function mapConnectionToExchange(conn: ExchangeConnection): ConnectedExchange {
  return {
    id: String(conn.id),
    exchangeId: conn.exchange_id,
    exchangeName: conn.exchange_name || conn.exchange_id.charAt(0).toUpperCase() + conn.exchange_id.slice(1),
    apiKeyPreview: conn.api_key ? `${conn.api_key.slice(0, 4)}...${conn.api_key.slice(-4)}` : '****',
    isTestnet: false,
    status: conn.is_active !== false ? 'connected' : 'error',
    lastSync: conn.last_sync_at || conn.created_at,
    tradesCount: 0,
    permissions: ['Read'],
    createdAt: conn.created_at
  };
}

// ============================================================================
// Component
// ============================================================================

export default function ExchangeSettings() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Use the real hook for exchange connections
  const {
    connections,
    loading,
    syncing: syncingMap,
    sync,
    remove,
    refetch
  } = useExchangeConnections();

  // Map connections to UI format
  const [exchanges, setExchanges] = useState<ConnectedExchange[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<ConnectedExchange | null>(null);
  const [localSyncing, setLocalSyncing] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Update exchanges when connections change
  useEffect(() => {
    setExchanges(connections.map(mapConnectionToExchange));
  }, [connections]);

  const handleSync = async (exchangeId: string) => {
    const numericId = parseInt(exchangeId);
    if (isNaN(numericId)) {
      setLocalSyncing(exchangeId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setLocalSyncing(null);
      return;
    }

    try {
      await sync(numericId);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleDelete = async (exchangeId: string) => {
    const numericId = parseInt(exchangeId);
    if (!isNaN(numericId)) {
      try {
        await remove(numericId);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
    setDeleteConfirm(null);
    setSelectedExchange(null);
  };

  const handleAddSuccess = () => {
    // Refetch connections after successful add
    refetch();
    setShowAddModal(false);
  };

  // Check if a specific exchange is syncing
  const isSyncing = (exchangeId: string) => {
    const numericId = parseInt(exchangeId);
    return localSyncing === exchangeId || (!isNaN(numericId) && syncingMap[numericId]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className={`p-2 rounded-lg ${getHoverBg(theme)} transition-colors`}
            >
              <ArrowLeft className={`w-5 h-5 ${getTextColor(theme, 'secondary')}`} />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${getTextColor(theme, 'primary')}`}>
                Exchange Connections
              </h1>
              <p className={`${getTextColor(theme, 'muted')}`}>
                Manage your connected exchanges and brokers
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#6A3DF4] hover:bg-[#5A2DE4] text-white font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Exchange
          </button>
        </div>

        {/* Info Card */}
        <div className={`flex items-start gap-4 p-4 ${getCardBg(theme)} rounded-xl border ${getCardBorder(theme)} mb-6`}>
          <Shield className="w-6 h-6 text-[#6A3DF4] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className={`font-medium mb-1 ${getTextColor(theme, 'primary')}`}>
              Your API keys are secure
            </h3>
            <p className={`text-sm ${getTextColor(theme, 'muted')}`}>
              All API credentials are encrypted using AES-256 and stored securely.
              We recommend using read-only API keys with trade history access only.
            </p>
          </div>
        </div>

        {/* Connected Exchanges */}
        <div className="space-y-4">
          {loading ? (
            <div className={`p-12 text-center ${getCardBg(theme)} rounded-2xl border ${getCardBorder(theme)}`}>
              <RefreshCw className={`w-8 h-8 mx-auto mb-4 ${getTextColor(theme, 'muted')} animate-spin`} />
              <p className={getTextColor(theme, 'muted')}>Loading connections...</p>
            </div>
          ) : exchanges.length === 0 ? (
            <div className={`p-12 text-center ${getCardBg(theme)} rounded-2xl border ${getCardBorder(theme)}`}>
              <div className="w-16 h-16 mx-auto mb-4 bg-[#6A3DF4]/10 rounded-2xl flex items-center justify-center">
                <Link2 className="w-8 h-8 text-[#6A3DF4]" />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${getTextColor(theme, 'primary')}`}>
                No exchanges connected
              </h3>
              <p className={`${getTextColor(theme, 'muted')} mb-6`}>
                Connect your first exchange to start syncing trades
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#6A3DF4] hover:bg-[#5A2DE4] text-white font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Exchange
              </button>
            </div>
          ) : (
            exchanges.map(exchange => (
              <motion.div
                key={exchange.id}
                layout
                className={`${getCardBg(theme)} rounded-xl border ${getCardBorder(theme)} overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Logo Placeholder */}
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                        <span className="text-xl font-bold text-[#6A3DF4]">
                          {exchange.exchangeName.charAt(0)}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-medium ${getTextColor(theme, 'primary')}`}>
                            {exchange.exchangeName}
                          </h3>
                          {exchange.isTestnet && (
                            <span className="px-2 py-0.5 text-xs bg-[#F39C12]/20 text-[#F39C12] rounded">
                              Testnet
                            </span>
                          )}
                          {exchange.status === 'connected' && (
                            <Check className="w-4 h-4 text-[#2ECC71]" />
                          )}
                          {exchange.status === 'error' && (
                            <AlertCircle className="w-4 h-4 text-[#E74C3C]" />
                          )}
                        </div>
                        <div className={`flex items-center gap-4 text-sm ${getTextColor(theme, 'muted')}`}>
                          <span className="flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            {exchange.apiKeyPreview}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Synced {getTimeAgo(exchange.lastSync)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(exchange.id)}
                        disabled={isSyncing(exchange.id)}
                        className={`p-2 rounded-lg ${getHoverBg(theme)} transition-colors`}
                      >
                        <RefreshCw className={`w-5 h-5 ${getTextColor(theme, 'secondary')} ${
                          isSyncing(exchange.id) ? 'animate-spin' : ''
                        }`} />
                      </button>
                      <button
                        onClick={() => setSelectedExchange(exchange)}
                        className={`p-2 rounded-lg ${getHoverBg(theme)} transition-colors`}
                      >
                        <Settings className={`w-5 h-5 ${getTextColor(theme, 'secondary')}`} />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className={`text-xs ${getTextColor(theme, 'muted')}`}>Trades Synced</p>
                      <p className={`font-semibold ${getTextColor(theme, 'primary')}`}>
                        {exchange.tradesCount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${getTextColor(theme, 'muted')}`}>Permissions</p>
                      <p className={`font-semibold ${getTextColor(theme, 'primary')}`}>
                        {exchange.permissions.join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${getTextColor(theme, 'muted')}`}>Connected</p>
                      <p className={`font-semibold ${getTextColor(theme, 'primary')}`}>
                        {formatDate(exchange.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Error Message */}
                  {exchange.status === 'error' && exchange.error && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-[#E74C3C]/10 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-[#E74C3C]" />
                      <span className="text-sm text-[#E74C3C]">{exchange.error}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Exchange Detail Slide-over */}
        <AnimatePresence>
          {selectedExchange && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSelectedExchange(null)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed right-0 top-0 h-full w-full max-w-md ${getCardBg(theme)} border-l ${getCardBorder(theme)} z-50 overflow-y-auto`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-xl font-semibold ${getTextColor(theme, 'primary')}`}>
                      {selectedExchange.exchangeName} Settings
                    </h2>
                    <button
                      onClick={() => setSelectedExchange(null)}
                      className={`p-2 rounded-lg ${getHoverBg(theme)}`}
                    >
                      <ChevronRight className={`w-5 h-5 ${getTextColor(theme, 'secondary')}`} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="space-y-6">
                    {/* Connection Info */}
                    <div>
                      <h3 className={`text-sm font-medium mb-3 ${getTextColor(theme, 'secondary')}`}>
                        Connection Details
                      </h3>
                      <div className={`space-y-3 p-4 ${getCardBg(theme)} rounded-xl border ${getCardBorder(theme)}`}>
                        <div className="flex justify-between">
                          <span className={`text-sm ${getTextColor(theme, 'muted')}`}>Status</span>
                          <span className={`text-sm font-medium ${
                            selectedExchange.status === 'connected' ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
                          }`}>
                            {selectedExchange.status.charAt(0).toUpperCase() + selectedExchange.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-sm ${getTextColor(theme, 'muted')}`}>API Key</span>
                          <span className={`text-sm ${getTextColor(theme, 'primary')}`}>
                            {selectedExchange.apiKeyPreview}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-sm ${getTextColor(theme, 'muted')}`}>Last Sync</span>
                          <span className={`text-sm ${getTextColor(theme, 'primary')}`}>
                            {getTimeAgo(selectedExchange.lastSync)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-sm ${getTextColor(theme, 'muted')}`}>Environment</span>
                          <span className={`text-sm ${getTextColor(theme, 'primary')}`}>
                            {selectedExchange.isTestnet ? 'Testnet' : 'Mainnet'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sync Settings */}
                    <div>
                      <h3 className={`text-sm font-medium mb-3 ${getTextColor(theme, 'secondary')}`}>
                        Sync Settings
                      </h3>
                      <div className={`space-y-4 p-4 ${getCardBg(theme)} rounded-xl border ${getCardBorder(theme)}`}>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className={`text-sm ${getTextColor(theme, 'primary')}`}>
                            Auto-sync trades
                          </span>
                          <input type="checkbox" defaultChecked className="sr-only" />
                          <div className="w-10 h-6 bg-[#6A3DF4] rounded-full relative">
                            <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1" />
                          </div>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className={`text-sm ${getTextColor(theme, 'primary')}`}>
                            Sync balances
                          </span>
                          <input type="checkbox" defaultChecked className="sr-only" />
                          <div className="w-10 h-6 bg-[#6A3DF4] rounded-full relative">
                            <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1" />
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div>
                      <h3 className={`text-sm font-medium mb-3 text-[#E74C3C]`}>
                        Danger Zone
                      </h3>
                      <div className={`p-4 bg-[#E74C3C]/10 rounded-xl border border-[#E74C3C]/20`}>
                        <p className={`text-sm ${getTextColor(theme, 'muted')} mb-4`}>
                          Disconnecting will remove all synced data for this exchange.
                          This action cannot be undone.
                        </p>

                        {deleteConfirm === selectedExchange.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(selectedExchange.id)}
                              className="flex-1 px-4 py-2 bg-[#E74C3C] hover:bg-[#C0392B] text-white font-medium rounded-lg transition-colors"
                            >
                              Confirm Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className={`px-4 py-2 ${getCardBg(theme)} border ${getCardBorder(theme)} rounded-lg ${getTextColor(theme, 'secondary')}`}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(selectedExchange.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#E74C3C]/20 hover:bg-[#E74C3C]/30 text-[#E74C3C] font-medium rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Disconnect Exchange
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Add Exchange Modal */}
        <ExchangeConnectionModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      </div>
    </DashboardLayout>
  );
}



