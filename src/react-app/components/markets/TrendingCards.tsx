import { motion } from 'framer-motion';
import { TrendingUp, Flame, Sparkles, BarChart3 } from 'lucide-react';
import { EnhancedMarketData } from '@/react-app/hooks/useBinanceMarkets';
import { useNavigate } from 'react-router';

interface TrendingCardsProps {
  hot: EnhancedMarketData[];
  newCoins: EnhancedMarketData[];
  topGainer: EnhancedMarketData[];
  topVolume: EnhancedMarketData[];
}

interface TrendingCardProps {
  title: string;
  icon: React.ReactNode;
  items: EnhancedMarketData[];
  color: string;
}

function TrendingCard({ title, icon, items, color }: TrendingCardProps) {
  const navigate = useNavigate();

  const formatPrice = (price: string): string => {
    const num = parseFloat(price);
    if (num >= 1) {
      // Binance-style formatting with commas
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toFixed(6)}`;
  };

  const formatPercent = (percent: string | undefined): string => {
    if (!percent) return '—';
    const num = parseFloat(percent);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getPercentColor = (percent: string | undefined): string => {
    if (!percent) return 'text-[#7F8C8D]';
    const num = parseFloat(percent);
    return num >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0D0F18] rounded-xl p-4 border border-white/10 flex-1 min-w-[280px]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded ${color}`}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <button className="text-xs text-[#6A3DF4] hover:text-[#8A5CFF] transition-colors font-medium">
          More &gt;
        </button>
      </div>

      <div className="space-y-2.5">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={item.symbol}
              onClick={() => navigate(`/markets/${item.symbol}`)}
              className="flex items-center justify-between py-2 hover:bg-white/5 cursor-pointer transition-colors rounded"
            >
              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
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
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{item.baseAsset}</div>
                  <div className="text-xs text-[#7F8C8D] truncate">{item.baseAsset}/{item.quoteAsset}</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 ml-2 flex-shrink-0">
                <div className="text-right">
                  <div className="font-semibold text-white text-sm whitespace-nowrap">{formatPrice(item.lastPrice)}</div>
                  <div className={`text-xs font-medium ${getPercentColor(item.priceChangePercent)} whitespace-nowrap`}>
                    {formatPercent(item.priceChangePercent)}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-[#7F8C8D] text-sm">No data available</div>
        )}
      </div>
    </motion.div>
  );
}

export default function TrendingCards({ hot, newCoins, topGainer, topVolume }: TrendingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <TrendingCard
        title="Hot"
        icon={<Flame className="w-4 h-4 text-white" />}
        items={hot}
        color="bg-[#E74C3C]/20"
      />
      <TrendingCard
        title="New"
        icon={<Sparkles className="w-4 h-4 text-white" />}
        items={newCoins}
        color="bg-[#6A3DF4]/20"
      />
      <TrendingCard
        title="Top Gainer"
        icon={<TrendingUp className="w-4 h-4 text-white" />}
        items={topGainer}
        color="bg-[#2ECC71]/20"
      />
      <TrendingCard
        title="Top Volume"
        icon={<BarChart3 className="w-4 h-4 text-white" />}
        items={topVolume}
        color="bg-[#3498DB]/20"
      />
    </div>
  );
}
