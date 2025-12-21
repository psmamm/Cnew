import DashboardLayout from "@/react-app/components/DashboardLayout";
import { motion } from "framer-motion";
import {
  Search,
  Download,
  Star,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useBinanceMarkets, type MarketFilters } from "@/react-app/hooks/useBinanceMarkets";
import { useCoinGeckoMarketCap } from "@/react-app/hooks/useCoinGeckoMarketCap";
import MarketTabs, { type MarketTab } from "@/react-app/components/markets/MarketTabs";
import TrendingCards from "@/react-app/components/markets/TrendingCards";
import CategoryFilters, { type CategoryType, type SubFilterType } from "@/react-app/components/markets/CategoryFilters";
import TradingDataTab from "@/react-app/components/markets/TradingDataTab";
import AISelectTab from "@/react-app/components/markets/AISelectTab";
import TokenUnlockTab from "@/react-app/components/markets/TokenUnlockTab";
import { useNavigate } from "react-router";
import { useLanguageCurrency } from "@/react-app/contexts/LanguageCurrencyContext";

const SORT_OPTIONS = [
  { key: 'marketCap' as const, label: 'Market Cap' },
  { key: 'quoteVolume' as const, label: 'Volume' },
  { key: 'symbol' as const, label: 'Symbol' },
  { key: 'price' as const, label: 'Price' },
  { key: 'change24h' as const, label: '24h %' },
  { key: 'change1h' as const, label: '1h %' },
  { key: 'change7d' as const, label: '7d %' }
] as const;
const PAGE_SIZES = [50, 100, 200] as const;

// Available quote assets for filtering
const QUOTE_ASSETS = ['All', 'USDT', 'BTC', 'ETH', 'BNB', 'USDC', 'TUSD', 'PAX', 'BUSD'] as const;

export default function MarketsPage() {
  const navigate = useNavigate();
  const {
    enhancedData,
    loading,
    error,
    getFilteredData,
    calculateMarketStats,
    getTrendingData,
    refetch
  } = useBinanceMarkets();
  
  const { getMarketCap } = useCoinGeckoMarketCap();
  const { currency, convertCurrency } = useLanguageCurrency();

  // Tab state
  const [activeTab, setActiveTab] = useState<MarketTab>('overview');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('cryptos');
  const [activeSubFilter, setActiveSubFilter] = useState<SubFilterType>('all');

  // Filters state - ALL quote assets by default
  const [filters, setFilters] = useState<MarketFilters>(() => {
    const saved = localStorage.getItem('tradecircle-market-filters');
    const defaultFilters = {
      search: '',
      quoteAssets: [], // Empty = all quote assets
      timeframe: '24h' as const,
      sortBy: 'marketCap' as const,
      sortOrder: 'desc' as const,
      pageSize: 100 as const
    };

    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, sortBy: parsed.sortBy || 'marketCap' };
    }
    return defaultFilters;
  });

  // Quote asset filter state
  const [selectedQuoteAssets, setSelectedQuoteAssets] = useState<string[]>(['All']);
  const [showQuoteAssetDropdown, setShowQuoteAssetDropdown] = useState(false);

  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [searchFocus, setSearchFocus] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quoteAssetDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quoteAssetDropdownRef.current && !quoteAssetDropdownRef.current.contains(event.target as Node)) {
        setShowQuoteAssetDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // Handle quote asset filter change
  const handleQuoteAssetChange = (asset: string) => {
    if (asset === 'All') {
      setSelectedQuoteAssets(['All']);
      setFilters(prev => ({ ...prev, quoteAssets: [] }));
    } else {
      const newSelection = selectedQuoteAssets.includes(asset)
        ? selectedQuoteAssets.filter(a => a !== asset && a !== 'All')
        : [...selectedQuoteAssets.filter(a => a !== 'All'), asset];
      
      if (newSelection.length === 0) {
        setSelectedQuoteAssets(['All']);
        setFilters(prev => ({ ...prev, quoteAssets: [] }));
      } else {
        setSelectedQuoteAssets(newSelection);
        setFilters(prev => ({ ...prev, quoteAssets: newSelection }));
      }
    }
    setShowQuoteAssetDropdown(false);
  };

  // Get filtered and paginated data with market cap
  const { filteredData, paginatedData, totalPages } = useMemo(() => {
    if (!enhancedData || Object.keys(enhancedData).length === 0) {
      return { 
        filteredData: [], 
        stats: { totalPairs: 0, totalQuoteVolume: 0, topGainer: null, topLoser: null }, 
        paginatedData: [], 
        totalPages: 0,
        enhancedFilteredData: []
      };
    }

    // Create a filter copy without marketCap sort for getFilteredData
    const filtersForData = filters.sortBy === 'marketCap' 
      ? { ...filters, sortBy: 'quoteVolume' as const }
      : filters;
    
    let filtered = getFilteredData(filtersForData);

    // Apply category filter
    if (activeCategory === 'favorites') {
      filtered = filtered.filter(item => watchlist.has(item.symbol));
    }

    // Apply sub-filter (simplified - would need actual category data)
    // For now, we'll just pass through

    // Enhance with market cap data
    const enhanced = filtered.map(item => {
      const marketCapInfo = getMarketCap(item.baseAsset);
      return {
        ...item,
        marketCap: marketCapInfo?.market_cap,
        marketCapRank: marketCapInfo?.market_cap_rank,
      };
    });

    // Sort by market cap if selected (handled separately since it's added after market cap data)
    if (filters.sortBy === 'marketCap') {
      enhanced.sort((a, b) => {
        const aCap = a.marketCap || 0;
        const bCap = b.marketCap || 0;
        return filters.sortOrder === 'asc' ? aCap - bCap : bCap - aCap;
      });
    }

    const stats = calculateMarketStats(enhanced);

    // Pagination
    const startIndex = (currentPage - 1) * filters.pageSize;
    const endIndex = startIndex + filters.pageSize;
    const paginated = enhanced.slice(startIndex, endIndex);
    const totalPages = Math.ceil(enhanced.length / filters.pageSize);

    return {
      filteredData: enhanced,
      stats,
      paginatedData: paginated,
      totalPages
    };
  }, [enhancedData, filters, currentPage, activeCategory, watchlist, getFilteredData, calculateMarketStats, getMarketCap]);

  // Get trending data
  const trendingData = useMemo(() => {
    if (!enhancedData || Object.keys(enhancedData).length === 0) {
      return { hot: [], new: [], topGainer: [], topVolume: [] };
    }
    return getTrendingData();
  }, [enhancedData, getTrendingData]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.quoteAssets, filters.timeframe, activeCategory, activeSubFilter]);

  // Format numbers
  // State for currency conversion rates
  const [conversionRate, setConversionRate] = useState<number>(1);
  const currencyCode = currency.split('-')[0];
  const currencySymbol = currency.split('-')[1] || currencyCode;

  // Load conversion rate when currency changes
  useEffect(() => {
    const loadRate = async () => {
      if (currencyCode === 'USD') {
        setConversionRate(1);
      } else {
        const rate = await convertCurrency(1, 'USD');
        setConversionRate(rate);
      }
    };
    loadRate();
  }, [currency, convertCurrency, currencyCode]);

  // Format numbers with currency conversion (synchronous)
  const formatNumber = (num: number, compact = true): string => {
    const converted = num * conversionRate;
    
    if (compact) {
      if (converted >= 1e9) return `${currencySymbol}${(converted / 1e9).toFixed(2)}B`;
      if (converted >= 1e6) return `${currencySymbol}${(converted / 1e6).toFixed(2)}M`;
      if (converted >= 1e3) return `${currencySymbol}${(converted / 1e3).toFixed(2)}K`;
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  };

  // Format price with currency conversion (synchronous)
  const formatPrice = (price: string, precision = 6): string => {
    const num = parseFloat(price) * conversionRate;
    
    if (num >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    }
    
    // For small numbers, use the precision parameter
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: Math.min(precision, 8),
      maximumFractionDigits: Math.min(precision, 8),
    }).format(num);
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
    const headers = ['Symbol', 'Base Asset', 'Quote Asset', 'Price', 'Market Cap', '1h %', '24h %', '7d %', '24h Volume', '24h High', '24h Low'];
    const rows = filteredData.map(item => [
      item.symbol,
      item.baseAsset,
      item.quoteAsset,
      item.lastPrice,
      item.marketCap?.toLocaleString() || '',
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
      <div className="space-y-4">
        {/* Tab Navigation - Direct on main background */}
        <MarketTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Trending Cards */}
            <TrendingCards
              hot={trendingData.hot}
              newCoins={trendingData.new}
              topGainer={trendingData.topGainer}
              topVolume={trendingData.topVolume}
            />

            {/* Category Filters */}
            <CategoryFilters
              activeCategory={activeCategory}
              activeSubFilter={activeSubFilter}
              onCategoryChange={setActiveCategory}
              onSubFilterChange={setActiveSubFilter}
            />

            {/* Search and Filters - Direct on main background */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="pb-3"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  {/* Search */}
                  <div className="flex-1">
                    <div className={`relative transition-all ${searchFocus ? 'scale-[1.02]' : ''}`}>
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#7F8C8D]" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search by symbol or name..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        onFocus={() => setSearchFocus(true)}
                        onBlur={() => setSearchFocus(false)}
                        className="w-full pl-10 pr-4 py-2 bg-[#0D0F18]/50 border border-white/10 focus:border-[#6A3DF4]/50 rounded-lg text-white placeholder-[#7F8C8D] focus:outline-none transition-all text-sm"
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

                  {/* Quote Asset Filter */}
                  <div className="relative" ref={quoteAssetDropdownRef}>
                    <button
                      onClick={() => setShowQuoteAssetDropdown(!showQuoteAssetDropdown)}
                      className="flex items-center space-x-2 px-3 py-2 bg-[#0D0F18]/50 border border-white/10 hover:border-[#6A3DF4]/50 rounded-lg text-white transition-all text-sm"
                    >
                      <span className="text-sm">
                        {selectedQuoteAssets.includes('All') ? 'All Quote Assets' : selectedQuoteAssets.join(', ')}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showQuoteAssetDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showQuoteAssetDropdown && (
                      <div className="absolute top-full mt-2 left-0 bg-[#1E2232] border border-white/10 rounded-xl shadow-lg z-50 min-w-[200px] max-h-60 overflow-y-auto">
                        {QUOTE_ASSETS.map((asset) => (
                          <button
                            key={asset}
                            onClick={() => handleQuoteAssetChange(asset)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#0D0F18]/50 transition-colors ${
                              (asset === 'All' && selectedQuoteAssets.includes('All')) ||
                              (asset !== 'All' && selectedQuoteAssets.includes(asset))
                                ? 'text-[#6A3DF4] bg-[#6A3DF4]/10'
                                : 'text-white'
                            }`}
                          >
                            {asset}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2">
                    <select
                      value={filters.sortBy}
                      onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                      className="px-3 py-2 bg-[#0D0F18]/50 border border-white/10 rounded-lg text-white focus:border-[#6A3DF4]/50 focus:outline-none text-sm"
                    >
                      {SORT_OPTIONS.map(option => (
                        <option key={option.key} value={option.key} className="bg-[#1E2232]">
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                      className="px-3 py-2 bg-[#0D0F18]/50 border border-white/10 hover:border-white/20 rounded-lg text-[#AAB0C0] transition-all"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <select
                      value={filters.pageSize}
                      onChange={(e) => setFilters(prev => ({ ...prev, pageSize: parseInt(e.target.value) as any }))}
                      className="px-3 py-2 bg-[#0D0F18]/50 border border-white/10 rounded-lg text-white focus:border-[#6A3DF4]/50 focus:outline-none text-sm"
                    >
                      {PAGE_SIZES.map(size => (
                        <option key={size} value={size} className="bg-[#1E2232]">
                          {size}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={exportToCSV}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-[#0D0F18]/50 border border-white/10 hover:border-white/20 rounded-lg text-[#AAB0C0] transition-all text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Markets Table - Direct on main background, no container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="overflow-x-auto">
              {loading && Object.keys(enhancedData).length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 border-4 border-[#6A3DF4] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-white mb-2">Loading Market Data</h3>
                  <p className="text-[#7F8C8D]">Fetching real-time data from Binance...</p>
                </div>
              ) : error ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-[#E74C3C]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-[#E74C3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                    </svg>
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
                    onClick={() => {
                      setFilters(prev => ({ ...prev, search: '', quoteAssets: [] }));
                      setSelectedQuoteAssets(['All']);
                    }}
                    className="px-6 py-3 bg-[#6A3DF4] hover:bg-[#8A5CFF] text-white rounded-lg font-medium transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div>
                  {/* Table */}
                  <table className="w-full">
                    <thead>
                      <tr className="text-sm font-medium text-[#7F8C8D] border-b border-white/10">
                        <th className="text-left py-3 px-4">
                          <button
                            onClick={() => {
                              const newSortBy = filters.sortBy === 'symbol' && filters.sortOrder === 'asc' ? 'symbol' : 'symbol';
                              const newOrder = filters.sortBy === 'symbol' ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
                              setFilters(prev => ({ ...prev, sortBy: newSortBy, sortOrder: newOrder }));
                            }}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Name</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`w-3 h-3 ${filters.sortBy === 'symbol' && filters.sortOrder === 'asc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                              <ChevronDown className={`w-3 h-3 -mt-1 ${filters.sortBy === 'symbol' && filters.sortOrder === 'desc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                            </div>
                          </button>
                        </th>
                        <th className="text-right py-3 px-4">
                          <button
                            onClick={() => {
                              const newSortBy = 'price';
                              const newOrder = filters.sortBy === 'price' ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
                              setFilters(prev => ({ ...prev, sortBy: newSortBy, sortOrder: newOrder }));
                            }}
                            className="flex items-center space-x-1 hover:text-white transition-colors ml-auto"
                          >
                            <span>Price</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`w-3 h-3 ${filters.sortBy === 'price' && filters.sortOrder === 'asc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                              <ChevronDown className={`w-3 h-3 -mt-1 ${filters.sortBy === 'price' && filters.sortOrder === 'desc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                            </div>
                          </button>
                        </th>
                        <th className="text-right py-3 px-4">
                          <button
                            onClick={() => {
                              const newSortBy = 'change24h';
                              const newOrder = filters.sortBy === 'change24h' ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
                              setFilters(prev => ({ ...prev, sortBy: newSortBy, sortOrder: newOrder }));
                            }}
                            className={`flex items-center space-x-1 transition-colors ml-auto px-2 py-1 rounded ${
                              filters.sortBy === 'change24h' 
                                ? 'text-white bg-white/10' 
                                : 'text-[#7F8C8D] hover:text-white'
                            }`}
                          >
                            <span>24h</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`w-3 h-3 ${filters.sortBy === 'change24h' && filters.sortOrder === 'asc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                              <ChevronDown className={`w-3 h-3 -mt-1 ${filters.sortBy === 'change24h' && filters.sortOrder === 'desc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                            </div>
                          </button>
                        </th>
                        <th className="text-right py-3 px-4">
                          <button
                            onClick={() => {
                              const newSortBy = 'change24h';
                              const newOrder = filters.sortBy === 'change24h' ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
                              setFilters(prev => ({ ...prev, sortBy: newSortBy, sortOrder: newOrder }));
                            }}
                            className="flex items-center space-x-1 hover:text-white transition-colors ml-auto"
                          >
                            <span>Change</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`w-3 h-3 ${filters.sortBy === 'change24h' && filters.sortOrder === 'asc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                              <ChevronDown className={`w-3 h-3 -mt-1 ${filters.sortBy === 'change24h' && filters.sortOrder === 'desc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                            </div>
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 hidden lg:table-cell">
                          <button
                            onClick={() => {
                              const newSortBy = 'quoteVolume';
                              const newOrder = filters.sortBy === 'quoteVolume' ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
                              setFilters(prev => ({ ...prev, sortBy: newSortBy, sortOrder: newOrder }));
                            }}
                            className="flex items-center space-x-1 hover:text-white transition-colors ml-auto"
                          >
                            <span>24h Volume</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`w-3 h-3 ${filters.sortBy === 'quoteVolume' && filters.sortOrder === 'asc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                              <ChevronDown className={`w-3 h-3 -mt-1 ${filters.sortBy === 'quoteVolume' && filters.sortOrder === 'desc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                            </div>
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 hidden xl:table-cell">
                          <button
                            onClick={() => {
                              const newSortBy = 'marketCap';
                              const newOrder = filters.sortBy === 'marketCap' ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
                              setFilters(prev => ({ ...prev, sortBy: newSortBy, sortOrder: newOrder }));
                            }}
                            className="flex items-center space-x-1 hover:text-white transition-colors ml-auto"
                          >
                            <span>Market Cap</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`w-3 h-3 ${filters.sortBy === 'marketCap' && filters.sortOrder === 'asc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                              <ChevronDown className={`w-3 h-3 -mt-1 ${filters.sortBy === 'marketCap' && filters.sortOrder === 'desc' ? 'text-[#F39C12]' : 'text-[#7F8C8D]'}`} />
                            </div>
                          </button>
                        </th>
                        <th className="text-center py-3 px-4">
                          <span>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((item, index) => (
                        <motion.tr
                          key={item.symbol}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => navigate(`/markets/${item.symbol}`)}
                          className="hover:bg-white/5 cursor-pointer transition-all group border-b border-white/5"
                        >
                          {/* Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={(e) => toggleWatchlist(item.symbol, e)}
                                className={`flex-shrink-0 transition-all ${
                                  watchlist.has(item.symbol)
                                    ? 'text-[#F39C12] hover:text-[#E67E22]'
                                    : 'text-[#7F8C8D] hover:text-[#AAB0C0]'
                                }`}
                              >
                                <Star className={`w-4 h-4 ${watchlist.has(item.symbol) ? 'fill-current' : ''}`} />
                              </button>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[#0D0F18]/50">
                                {item.logo ? (
                                  <img
                                    src={item.logo}
                                    alt={item.baseAsset}
                                    className="w-6 h-6 object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = `<span class="text-[#BDC3C7] font-bold text-xs">${item.baseAsset.slice(0, 2)}</span>`;
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-[#BDC3C7] font-bold text-xs">{item.baseAsset.slice(0, 2)}</span>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-white text-sm">{item.baseAsset}</div>
                                <div className="text-xs text-[#7F8C8D]">{item.baseAsset}/{item.quoteAsset}</div>
                              </div>
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-semibold text-white text-sm">{formatPrice(item.lastPrice)}</div>
                          </td>

                          {/* 24h % */}
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold text-sm ${getPercentColor(item.priceChangePercent)}`}>
                              {formatPercent(item.priceChangePercent)}
                            </span>
                          </td>

                          {/* 7d Change */}
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold text-sm ${getPercentColor(item.priceChangePercent7d || 0)}`}>
                              {formatPercent(item.priceChangePercent7d || 0)}
                            </span>
                          </td>

                          {/* 24h Volume */}
                          <td className="py-3 px-4 text-right hidden lg:table-cell">
                            <div className="text-[#AAB0C0] text-sm">
                              {formatNumber(parseFloat(item.quoteVolume || '0'))}
                            </div>
                          </td>

                          {/* Market Cap */}
                          <td className="py-3 px-4 text-right hidden xl:table-cell">
                            <div className="text-[#AAB0C0] text-sm">
                              {item.marketCap ? formatNumber(item.marketCap) : '—'}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/markets/${item.symbol}`);
                                }}
                                className="p-1.5 text-[#7F8C8D] hover:text-white transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          </motion.tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pt-4 mt-4 border-t border-white/10">
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
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                    currentPage === page
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
                </div>
              )}
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'trading-data' && <TradingDataTab />}
        {activeTab === 'ai-select' && <AISelectTab />}
        {activeTab === 'token-unlock' && <TokenUnlockTab />}
      </div>
    </DashboardLayout>
  );
}
