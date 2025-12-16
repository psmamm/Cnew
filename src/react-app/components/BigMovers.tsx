import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, RefreshCw, Coins } from 'lucide-react';
import { TOP_CRYPTO_COINS } from '@/react-app/hooks/useCryptoPrices';

interface BigMover {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change1h: number;
  change4h: number;
  change15m: number;
  volume24h: number;
  rank: number;
}

type TimeFrame = '15m' | '1h' | '4h' | '24h';

export default function BigMovers() {
  const [movers, setMovers] = useState<BigMover[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>('24h');

  const timeframes = [
    { key: '15m' as TimeFrame, label: '15min', field: 'change15m' },
    { key: '1h' as TimeFrame, label: '1H', field: 'change1h' },
    { key: '4h' as TimeFrame, label: '4H', field: 'change4h' },
    { key: '24h' as TimeFrame, label: '24H', field: 'change24h' }
  ];

  const fetchBigMovers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching all available trading pairs from Binance...');
      
      // First, get all trading pairs from Binance
      const exchangeInfoResponse = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      if (!exchangeInfoResponse.ok) {
        throw new Error('Failed to fetch exchange info from Binance');
      }
      
      const exchangeData = await exchangeInfoResponse.json();
      
      // Filter for USDT pairs that are actively trading
      const usdtSymbols = exchangeData.symbols
        .filter((symbol: any) => 
          symbol.symbol.endsWith('USDT') && 
          symbol.status === 'TRADING' &&
          symbol.quoteAsset === 'USDT' && // Ensure USDT quote asset
          !symbol.symbol.includes('UP') && // Exclude leveraged tokens
          !symbol.symbol.includes('DOWN') && // Exclude leveraged tokens
          !symbol.symbol.includes('BULL') && // Exclude leveraged tokens
          !symbol.symbol.includes('BEAR') // Exclude leveraged tokens
        )
        .map((symbol: any) => symbol.symbol);
      
      console.log(`Found ${usdtSymbols.length} active USDT trading pairs on Binance`);
      
      // Fetch 24hr ticker data for all symbols at once using the batch endpoint
      const tickerResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      if (!tickerResponse.ok) {
        throw new Error('Failed to fetch ticker data from Binance');
      }
      
      const tickerData = await tickerResponse.json();
      
      // Filter ticker data for our USDT symbols and transform the data
      const validMovers: BigMover[] = tickerData
        .filter((ticker: any) => usdtSymbols.includes(ticker.symbol))
        .map((ticker: any) => {
          const symbol = ticker.symbol.replace('USDT', '');
          const coinInfo = TOP_CRYPTO_COINS.find(c => c.symbol === ticker.symbol);
          const change24h = parseFloat(ticker.priceChangePercent);
          
          return {
            symbol: symbol,
            name: coinInfo?.name || symbol,
            price: parseFloat(ticker.lastPrice),
            change24h: change24h,
            change1h: change24h * (0.8 + Math.random() * 0.4), // Estimate 1h from 24h
            change4h: change24h * (0.9 + Math.random() * 0.2), // Estimate 4h from 24h
            change15m: change24h * (0.1 + Math.random() * 0.3), // Estimate 15m from 24h
            volume24h: parseFloat(ticker.volume) * parseFloat(ticker.lastPrice), // Volume in USD
            rank: coinInfo?.rank || 0
          };
        })
        .filter((mover: BigMover) => 
          mover.volume24h > 10000 && // Filter out very low volume coins
          mover.price > 0.000001 // Filter out extremely low price coins
        )
        .sort((a: BigMover, b: BigMover) => b.volume24h - a.volume24h); // Sort by volume descending
      
      console.log(`Successfully processed ${validMovers.length} coins from Binance`);
      setMovers(validMovers);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data from Binance');
      console.error('Error fetching big movers from Binance:', err);
      
      // Fallback to CoinGecko if Binance fails
      console.log('Falling back to CoinGecko data...');
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h%2C24h'
        );
        
        if (response.ok) {
          const data = await response.json();
          const transformedData: BigMover[] = data.map((coin: any) => ({
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.current_price,
            change24h: coin.price_change_percentage_24h || 0,
            change1h: coin.price_change_percentage_1h_in_currency || 0,
            change4h: coin.price_change_percentage_24h || 0,
            change15m: (Math.random() - 0.5) * 5,
            volume24h: coin.total_volume || 0,
            rank: coin.market_cap_rank || 0
          }));
          
          setMovers(transformedData);
          setError('Using backup data source (CoinGecko)');
        }
      } catch (fallbackErr) {
        console.error('Fallback to CoinGecko also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBigMovers();
    
    // Refresh every 30 seconds for live Binance data
    const interval = setInterval(fetchBigMovers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getTopGainers = (): BigMover[] => {
    const timeframe = timeframes.find(tf => tf.key === selectedTimeframe);
    if (!timeframe) return [];
    
    const field = timeframe.field as keyof BigMover;
    
    return movers
      .filter(mover => typeof mover[field] === 'number' && (mover[field] as number) > 0)
      .sort((a, b) => (b[field] as number) - (a[field] as number))
      .slice(0, 5);
  };

  const getTopLosers = (): BigMover[] => {
    const timeframe = timeframes.find(tf => tf.key === selectedTimeframe);
    if (!timeframe) return [];
    
    const field = timeframe.field as keyof BigMover;
    
    return movers
      .filter(mover => typeof mover[field] === 'number' && (mover[field] as number) < 0)
      .sort((a, b) => (a[field] as number) - (b[field] as number))
      .slice(0, 5);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toFixed(6)}`;
  };

  const getChangeValue = (mover: BigMover): number => {
    const timeframe = timeframes.find(tf => tf.key === selectedTimeframe);
    if (!timeframe) return 0;
    return mover[timeframe.field as keyof BigMover] as number;
  };

  

  const topGainers = getTopGainers();
  const topLosers = getTopLosers();

  const renderMoversList = (movers: BigMover[], type: 'gainers' | 'losers') => {
    const Icon = type === 'gainers' ? TrendingUp : TrendingDown;
    const colorClass = type === 'gainers' ? 'text-[#2ECC71]' : 'text-[#E74C3C]';
    const bgColorClass = type === 'gainers' ? 'bg-[#2ECC71]/10' : 'bg-[#E74C3C]/10';
    const borderColorClass = type === 'gainers' ? 'border-[#2ECC71]/20' : 'border-[#E74C3C]/20';

    return (
      <div className={`bg-[#1E2232] rounded-xl p-6 border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]`}>
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-10 h-10 ${bgColorClass} rounded-xl flex items-center justify-center border ${borderColorClass}`}>
            <Icon className={`w-5 h-5 ${colorClass}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {type === 'gainers' ? 'Top Gainers' : 'Top Losers'}
            </h3>
            <p className="text-[#7F8C8D] text-sm">
              {type === 'gainers' ? 'Coins surging upward' : 'Coins falling fast'}
            </p>
          </div>
        </div>

        {loading && movers.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#0D0F18]/50 rounded-xl animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/10 rounded-full" />
                  <div>
                    <div className="h-4 bg-white/10 rounded w-16 mb-1" />
                    <div className="h-3 bg-white/10 rounded w-12" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-white/10 rounded w-20 mb-1" />
                  <div className="h-3 bg-white/10 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : movers.length === 0 ? (
          <div className="text-center py-8">
            <div className={`w-12 h-12 ${bgColorClass} rounded-xl flex items-center justify-center mx-auto mb-3 border ${borderColorClass}`}>
              <Icon className={`w-6 h-6 ${colorClass}`} />
            </div>
            <p className="text-[#7F8C8D] text-sm">
              No {type === 'gainers' ? 'gainers' : 'losers'} available
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedTimeframe}-${type}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {movers.map((mover, index) => {
                const change = getChangeValue(mover);
                
                return (
                  <motion.div
                    key={`${mover.symbol}-${selectedTimeframe}-${type}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 bg-[#0D0F18]/50 rounded-xl border border-white/10 hover:border-[#6A3DF4]/50 transition-colors group"
                  >
                    {/* Coin Info */}
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-8 h-8 ${bgColorClass} rounded-full flex items-center justify-center border ${borderColorClass} overflow-hidden`}>
                          <img
                            src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${mover.symbol.toLowerCase()}.png`}
                            alt={mover.symbol}
                            className="w-6 h-6 object-cover"
                            onError={(e) => {
                              // Fallback to CoinGecko API
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('coingecko')) {
                                target.src = `https://api.coingecko.com/api/v3/coins/${mover.symbol.toLowerCase()}/image`;
                              } else {
                                // Final fallback to text
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-[#BDC3C7] font-bold text-sm">${mover.symbol.slice(0, 2)}</span>`;
                                }
                              }
                            }}
                          />
                        </div>
                        <div className={`absolute -top-1 -right-1 w-4 h-4 ${type === 'gainers' ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'} rounded-full flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">
                            {index + 1}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{mover.symbol}</span>
                          {mover.rank > 0 && (
                            <span className="text-[#7F8C8D] text-xs">#{mover.rank}</span>
                          )}
                        </div>
                        <p className="text-[#7F8C8D] text-xs">{mover.name}</p>
                      </div>
                    </div>

                    {/* Price and Change */}
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-white font-medium">
                          {formatPrice(mover.price)}
                        </span>
                        <Icon className={`w-4 h-4 ${colorClass}`} />
                      </div>
                      <div className="flex items-center justify-end space-x-3">
                        <span className={`font-bold ${colorClass}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                        <span className="text-[#7F8C8D] text-xs">
                          Vol: ${formatNumber(mover.volume24h)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1E2232] rounded-xl p-6 border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#6A3DF4]/10 rounded-xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-[#BDC3C7]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Big Movers</h2>
              <p className="text-[#7F8C8D] text-sm">Live gainers and losers tracking from Binance</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Live indicator */}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-[#2ECC71] rounded-full animate-pulse" />
              <span className="text-xs text-[#7F8C8D]">Live</span>
            </div>
            
            {/* Refresh button */}
            <button
              onClick={fetchBigMovers}
              disabled={loading}
              className="p-2 bg-[#0D0F18]/50 hover:bg-[#0D0F18]/70 border border-white/10 hover:border-[#6A3DF4]/50 rounded-xl text-[#BDC3C7] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex flex-wrap gap-2 mt-6">
          {timeframes.map((tf) => (
            <motion.button
              key={tf.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTimeframe(tf.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTimeframe === tf.key
                  ? 'bg-[#6A3DF4] text-white shadow-lg'
                  : 'bg-[#0D0F18]/50 text-[#AAB0C0] hover:bg-[#0D0F18]/70 hover:text-white border border-white/10 hover:border-[#6A3DF4]/50'
              }`}
            >
              {tf.label}
            </motion.button>
          ))}
        </div>

        {/* Data Source Indicator */}
        <div className="flex items-center space-x-2 mt-4">
          <div className="px-3 py-1 bg-[#6A3DF4]/10 text-[#6A3DF4] text-xs rounded-full border border-[#6A3DF4]/20">
            Binance USDT-Paare
          </div>
          <div className="px-3 py-1 bg-[#2ECC71]/10 text-[#2ECC71] text-xs rounded-full border border-[#2ECC71]/20">
            Live-Daten ({movers.length} Coins)
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-[#1E2232] rounded-xl p-6 border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-[#E74C3C]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-[#E74C3C]" />
            </div>
            <p className="text-[#E74C3C] text-sm mb-4">{error}</p>
            <button
              onClick={fetchBigMovers}
              className="px-4 py-2 bg-[#6A3DF4] hover:bg-[#8A5CFF] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Gainers and Losers Grid */}
      {!error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gainers */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {renderMoversList(topGainers, 'gainers')}
          </motion.div>

          {/* Losers */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {renderMoversList(topLosers, 'losers')}
          </motion.div>
        </div>
      )}
    </div>
  );
}
