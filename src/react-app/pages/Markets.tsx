import DashboardLayout from "@/react-app/components/DashboardLayout";
import { motion } from "framer-motion";
import {
  BarChart3,
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  Activity,
  Star,
  RefreshCw,
  ArrowUpDown,
  Eye,
  X,
  Globe
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useBinanceMarkets, type MarketFilters } from "@/react-app/hooks/useBinanceMarkets";
import MarketSparkline from "@/react-app/components/MarketSparkline";

import { useNavigate } from "react-router";

// Only USDT pairs for consistency
const SORT_OPTIONS = [
  { key: 'quoteVolume' as const, label: 'Volume' },
  { key: 'symbol' as const, label: 'Symbol' },
  { key: 'price' as const, label: 'Price' },
  { key: 'change24h' as const, label: '24h %' },
  { key: 'change1h' as const, label: '1h %' },
  { key: 'change7d' as const, label: '7d %' }
] as const;
const PAGE_SIZES = [50, 100, 200] as const;

export default function MarketsPage() {
  const navigate = useNavigate();
  const {
    enhancedData,
    loading,
    error,
    getFilteredData,
    calculateMarketStats,
    refetch
  } = useBinanceMarkets();

  // Filters state - Always use USDT pairs only
  const [filters, setFilters] = useState<MarketFilters>(() => {
    const saved = localStorage.getItem('tradecircle-market-filters');
    const defaultFilters = {
      search: '',
      quoteAssets: ['USDT'], // Always USDT only
      timeframe: '24h' as const,
      sortBy: 'quoteVolume' as const,
      sortOrder: 'desc' as const,
      pageSize: 100 as const
    };

    if (saved) {
      const parsed = JSON.parse(saved);
      // Force USDT-only even if saved filters had other quote assets
      return { ...parsed, quoteAssets: ['USDT'] };
    }
    return defaultFilters;
  });

  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [searchFocus, setSearchFocus] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('tradecircle-market-filters', JSON.stringify(filters));
  }, [filters]);

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tradecircle-watchlist');
    if (saved) {
      setWatchlist(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save watchlist to localStorage
  const saveWatchlist = (newWatchlist: Set<string>) => {
    setWatchlist(newWatchlist);
    localStorage.setItem('tradecircle-watchlist', JSON.stringify([...newWatchlist]));
  };

  // Toggle watchlist
  const toggleWatchlist = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newWatchlist = new Set(watchlist);

    if (newWatchlist.has(symbol)) {
      newWatchlist.delete(symbol);
    } else {
      newWatchlist.add(symbol);
    }

    saveWatchlist(newWatchlist);
  };

  // Get filtered and paginated data
  const { filteredData, stats, paginatedData, totalPages } = useMemo(() => {
    if (!enhancedData || Object.keys(enhancedData).length === 0) {
      return { filteredData: [], stats: { totalPairs: 0, totalQuoteVolume: 0, topGainer: null, topLoser: null }, paginatedData: [], totalPages: 0 };
    }

    const filtered = getFilteredData(filters);
    const stats = calculateMarketStats(filtered);

    // Pagination
    const startIndex = (currentPage - 1) * filters.pageSize;
    const endIndex = startIndex + filters.pageSize;
    const paginated = filtered.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filtered.length / filters.pageSize);

    return {
      filteredData: filtered,
      stats,
      paginatedData: paginated,
      totalPages
    };
  }, [enhancedData, filters, currentPage, getFilteredData, calculateMarketStats]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.quoteAssets, filters.timeframe]);

  // Format numbers
  const formatNumber = (num: number, compact = true): string => {
    if (num >= 1e9) return compact ? `$${(num / 1e9).toFixed(2)}B` : `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (num >= 1e6) return compact ? `$${(num / 1e6).toFixed(2)}M` : `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (num >= 1e3) return compact ? `$${(num / 1e3).toFixed(2)}K` : `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price: string, precision = 6): string => {
    const num = parseFloat(price);
    if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${num.toFixed(precision)}`;
  };

  const formatPercent = (percent: number | string | undefined): string => {
    if (percent === undefined || percent === null) return '—';
    const num = typeof percent === 'string' ? parseFloat(percent) : percent;
    if (isNaN(num)) return '—';
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getPercentColor = (percent: number | string | undefined): string => {
    if (percent === undefined || percent === null) return 'text-[#7F8C8D]';
    const num = typeof percent === 'string' ? parseFloat(percent) : percent;
    if (isNaN(num)) return 'text-[#7F8C8D]';
    return num >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]';
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Symbol', 'Base Asset', 'Quote Asset', 'Price', '1h %', '24h %', '7d %', '24h Volume', '24h High', '24h Low'];
    const rows = filteredData.map(item => [
      item.symbol,
      item.baseAsset,
      item.quoteAsset,
      item.lastPrice,
      item.priceChangePercent1h?.toFixed(2) || '',
      item.priceChangePercent || '',
      item.priceChangePercent7d?.toFixed(2) || '',
      item.quoteVolume,
      item.highPrice,
      item.lowPrice
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradecircle-markets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1E2232] rounded-2xl p-6 border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#6A3DF4]/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-[#6A3DF4]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Markets</h1>
                <p className="text-[#AAB0C0]">Real-time cryptocurrency market data</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 px-3 py-2 bg-[#6A3DF4]/10 border border-[#6A3DF4]/20 rounded-lg min-h-[44px]">
                <div className="w-2 h-2 bg-[#6A3DF4] rounded-full animate-pulse" />
                <span className="text-[#6A3DF4] text-sm font-medium">LIVE</span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-2 bg-[#2ECC71]/10 border border-[#2ECC71]/20 rounded-lg min-h-[44px]">
                <Globe className="w-4 h-4 text-[#2ECC71]" />
                <span className="text-[#2ECC71] text-sm font-medium">7 Chains</span>
              </div>
              <button
                onClick={refetch}
                disabled={loading}
                className="flex items-center space-x-2 bg-[#6A3DF4] hover:bg-[#8A5CFF] text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Market Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-[#6A3DF4]" />
                <span className="text-[#7F8C8D] text-sm">Total Pairs</span>
              </div>
              <div className="text-xl font-bold text-white">
                {loading ? '...' : stats.totalPairs.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="w-4 h-4 text-[#6A3DF4]" />
                <span className="text-[#7F8C8D] text-sm">24h Volume</span>
              </div>
              <div className="text-xl font-bold text-white">
                {loading ? '...' : formatNumber(stats.totalQuoteVolume)}
              </div>
            </div>

            <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[#2ECC71]" />
                <span className="text-[#7F8C8D] text-sm">Top Gainer</span>
              </div>
              <div className="text-lg font-bold text-white">
                {loading ? '...' : stats.topGainer ? (
                  <div>
                    <div className="text-sm text-[#AAB0C0]">{stats.topGainer.symbol}</div>
                    <div className="text-[#2ECC71]">+{stats.topGainer.change.toFixed(2)}%</div>
                  </div>
                ) : '—'}
              </div>
            </div>

            <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="w-4 h-4 text-[#E74C3C]" />
                <span className="text-[#7F8C8D] text-sm">Top Loser</span>
              </div>
              <div className="text-lg font-bold text-white">
                {loading ? '...' : stats.topLoser ? (
                  <div>
                    <div className="text-sm text-[#AAB0C0]">{stats.topLoser.symbol}</div>
                    <div className="text-[#E74C3C]">{stats.topLoser.change.toFixed(2)}%</div>
                  </div>
                ) : '—'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1E2232] rounded-2xl p-6 border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className={`relative transition-all ${searchFocus ? 'scale-[1.02]' : ''}`}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#7F8C8D]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by symbol or name..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setSearchFocus(false)}
                  className="w-full pl-12 pr-4 py-3 bg-[#0D0F18]/50 border border-white/10 focus:border-[#6A3DF4]/50 rounded-xl text-white placeholder-[#7F8C8D] focus:outline-none transition-all"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#7F8C8D] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:flex items-center gap-3">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="px-4 py-3 bg-[#0D0F18]/50 border border-white/10 rounded-xl text-white focus:border-[#6A3DF4]/50 focus:outline-none w-full sm:w-auto"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.key} value={option.key} className="bg-[#1E2232]">
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                className="px-3 py-3 bg-[#0D0F18]/50 border border-white/10 hover:border-white/20 rounded-xl text-[#AAB0C0] transition-all w-full sm:w-auto flex justify-center"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>

              <select
                value={filters.pageSize}
                onChange={(e) => setFilters(prev => ({ ...prev, pageSize: parseInt(e.target.value) as any }))}
                className="px-3 py-3 bg-[#0D0F18]/50 border border-white/10 rounded-xl text-white focus:border-[#6A3DF4]/50 focus:outline-none hidden sm:block"
              >
                {PAGE_SIZES.map(size => (
                  <option key={size} value={size} className="bg-[#1E2232]">
                    {size}
                  </option>
                ))}
              </select>

              <button
                onClick={exportToCSV}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-[#0D0F18]/50 border border-white/10 hover:border-white/20 rounded-xl text-[#AAB0C0] transition-all hidden sm:flex"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </motion.div>



        {/* Markets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1E2232] rounded-2xl border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] overflow-hidden"
        >
          {loading && Object.keys(enhancedData).length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 border-4 border-[#6A3DF4] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-white mb-2">Loading Market Data</h3>
              <p className="text-[#7F8C8D]">Fetching real-time data from Binance...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-[#E74C3C]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Activity className="w-8 h-8 text-[#E74C3C]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Market Data</h3>
              <p className="text-[#7F8C8D] mb-6">{error}</p>
              <button
                onClick={refetch}
                className="px-6 py-3 bg-[#6A3DF4] hover:bg-[#8A5CFF] text-white rounded-lg font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-[#6A3DF4]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-[#6A3DF4]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Markets Found</h3>
              <p className="text-[#7F8C8D] mb-6">Try adjusting your search or filters</p>
              <button
                onClick={() => setFilters(prev => ({ ...prev, search: '', quoteAssets: ['USDT'] }))}
                className="px-6 py-3 bg-[#6A3DF4] hover:bg-[#8A5CFF] text-white rounded-lg font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0D0F18]/30 border-b border-white/10">
                    <tr className="text-sm font-medium text-[#7F8C8D]">
                      <th className="text-left py-4 px-4 w-12 hidden sm:table-cell">★</th>
                      <th className="text-left py-4 px-4 w-16 hidden md:table-cell">#</th>
                      <th className="text-left py-4 px-4 min-w-[140px]">Market</th>
                      <th className="text-right py-4 px-4 min-w-[100px]">Price</th>
                      <th className="text-right py-4 px-4 min-w-[80px] hidden sm:table-cell">1h %</th>
                      <th className="text-right py-4 px-4 min-w-[80px]">24h %</th>
                      <th className="text-right py-4 px-4 min-w-[80px] hidden md:table-cell">7d %</th>
                      <th className="text-right py-4 px-4 min-w-[140px] hidden lg:table-cell">24h Volume</th>
                      <th className="text-center py-4 px-4 min-w-[120px] hidden xl:table-cell">7d Chart</th>
                      <th className="text-center py-4 px-4 w-16 hidden sm:table-cell">
                        <Eye className="w-4 h-4 mx-auto" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedData.map((item, index) => (
                      <motion.tr
                        key={item.symbol}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => navigate(`/markets/${item.symbol}`)}
                        className="hover:bg-[#0D0F18]/30 cursor-pointer transition-all group"
                      >
                        {/* Watchlist */}
                        <td className="py-4 px-4 hidden sm:table-cell">
                          <button
                            onClick={(e) => toggleWatchlist(item.symbol, e)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${watchlist.has(item.symbol)
                              ? 'text-[#F39C12] hover:text-[#E67E22] bg-[#F39C12]/10'
                              : 'text-[#7F8C8D] hover:text-[#AAB0C0] hover:bg-[#0D0F18]/50'
                              }`}
                          >
                            <Star className={`w-4 h-4 ${watchlist.has(item.symbol) ? 'fill-current' : ''}`} />
                          </button>
                        </td>

                        {/* Rank */}
                        <td className="py-4 px-4 hidden md:table-cell">
                          <span className="text-[#7F8C8D] text-sm font-medium">
                            {(currentPage - 1) * filters.pageSize + index + 1}
                          </span>
                        </td>

                        {/* Market */}
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#6A3DF4]/10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                              <img
                                src={item.logo}
                                alt={item.baseAsset}
                                className="w-6 h-6 sm:w-8 sm:h-8 object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<span class="text-[#BDC3C7] font-bold text-xs sm:text-sm">${item.baseAsset.slice(0, 2)}</span>`;
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-white text-sm sm:text-base">{item.baseAsset}</div>
                              <div className="text-xs sm:text-sm text-[#7F8C8D]">{item.baseAsset}/{item.quoteAsset}</div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-semibold text-white text-sm sm:text-base">{formatPrice(item.lastPrice)}</div>
                        </td>

                        {/* 1h % */}
                        <td className="py-4 px-4 text-right hidden sm:table-cell">
                          <span className={`font-semibold text-sm px-2 py-1 rounded ${getPercentColor(item.priceChangePercent1h)} ${item.priceChangePercent1h && parseFloat(item.priceChangePercent1h.toString()) !== 0
                            ? 'bg-current/10'
                            : ''
                            }`}>
                            {formatPercent(item.priceChangePercent1h)}
                          </span>
                        </td>

                        {/* 24h % */}
                        <td className="py-4 px-4 text-right">
                          <span className={`font-semibold text-sm px-2 py-1 rounded ${getPercentColor(item.priceChangePercent)} ${item.priceChangePercent && parseFloat(item.priceChangePercent.toString()) !== 0
                            ? 'bg-current/10'
                            : ''
                            }`}>
                            {formatPercent(item.priceChangePercent)}
                          </span>
                        </td>

                        {/* 7d % */}
                        <td className="py-4 px-4 text-right hidden md:table-cell">
                          <span className={`font-semibold text-sm px-2 py-1 rounded ${getPercentColor(item.priceChangePercent7d)} ${item.priceChangePercent7d && parseFloat(item.priceChangePercent7d.toString()) !== 0
                            ? 'bg-current/10'
                            : ''
                            }`}>
                            {formatPercent(item.priceChangePercent7d)}
                          </span>
                        </td>

                        {/* Volume */}
                        <td className="py-4 px-4 text-right hidden lg:table-cell">
                          <div className="text-[#AAB0C0] text-sm font-medium">
                            {formatNumber(parseFloat(item.quoteVolume || '0'))}
                          </div>
                        </td>

                        {/* Sparkline */}
                        <td className="py-4 px-4 text-center hidden xl:table-cell">
                          {item.sparklineData && item.sparklineData.length > 1 ? (
                            <div className="flex justify-center">
                              <MarketSparkline
                                data={item.sparklineData}
                                symbol={item.symbol}
                                color={item.priceChangePercent7d && parseFloat(item.priceChangePercent7d.toString()) >= 0 ? '#2ECC71' : '#E74C3C'}
                                width={80}
                                height={30}
                                showTradingView={false}
                              />
                            </div>
                          ) : (
                            <div className="w-[80px] h-[30px] bg-white/5 rounded mx-auto"></div>
                          )}
                        </td>

                        {/* View Detail */}
                        <td className="py-4 px-4 text-center hidden sm:table-cell">
                          <button
                            onClick={() => navigate(`/markets/${item.symbol}`)}
                            className="w-8 h-8 bg-[#6A3DF4]/10 hover:bg-[#6A3DF4]/20 rounded-full flex items-center justify-center text-[#6A3DF4] transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-white/10 bg-[#0D0F18]/30">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-[#7F8C8D]">
                      Showing {(currentPage - 1) * filters.pageSize + 1} to {Math.min(currentPage * filters.pageSize, filteredData.length)} of {filteredData.length} results
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-[#0D0F18]/50 border border-white/10 rounded-lg text-[#AAB0C0] hover:bg-[#0D0F18]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Previous
                      </button>

                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                          let page;
                          if (totalPages <= 7) {
                            page = i + 1;
                          } else if (currentPage <= 4) {
                            page = i + 1;
                          } else if (currentPage >= totalPages - 3) {
                            page = totalPages - 6 + i;
                          } else {
                            page = currentPage - 3 + i;
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentPage === page
                                ? 'bg-[#6A3DF4] text-white shadow-lg'
                                : 'text-[#AAB0C0] hover:bg-[#0D0F18]/50'
                                }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-[#0D0F18]/50 border border-white/10 rounded-lg text-[#AAB0C0] hover:bg-[#0D0F18]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
