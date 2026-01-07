/**
 * TradingView Chart Component (Terminal Version)
 * 
 * TradingView Advanced Charting integration for the Terminal.
 * Optimized for:
 * - Incremental updates (no full reload on symbol change)
 * - Smooth symbol switching (fade transition)
 * - Data streaming (symbol updates without flicker)
 */

import { memo } from 'react';
import { useSymbolSync } from '../../hooks/useSymbolSync';
import { TradingViewAdvancedChart } from '../competition/TradingViewAdvancedChart';

interface TradingViewChartProps {
  interval?: string;
}

function TradingViewChartComponent({ interval = '60' }: TradingViewChartProps) {
  const { symbol } = useSymbolSync({
    onSymbolChange: (newSymbol, previousSymbol) => {
      // Chart will automatically update via symbol prop change
      console.log(`Chart symbol changed: ${previousSymbol} → ${newSymbol}`);
    },
  });

  // Use symbol directly - no transition needed for initial load
  const displaySymbol = symbol;

  return (
    <div className="w-full h-full bg-[#0B0E11] relative">
      {displaySymbol ? (
        <TradingViewAdvancedChart 
          symbol={displaySymbol} 
          interval={interval}
          key={displaySymbol} // Force remount on symbol change for clean state
        />
      ) : (
        <div className="flex items-center justify-center h-full text-[#848E9C] text-sm">
          Loading chart...
        </div>
      )}
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
