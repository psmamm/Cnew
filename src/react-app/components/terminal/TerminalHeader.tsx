/**
 * Terminal Header Component
 * 
 * Displays symbol selector, current price, and market statistics (Mark, Index, 24h High/Low, Volume, OI, Funding).
 * Bybit UTA 2.0 style header bar.
 */

import { useState } from 'react';
import { Star, ChevronDown, Settings } from 'lucide-react';
import { useSymbol } from '../../contexts/SymbolContext';
import type { Symbol, TerminalStats } from '../../types/terminal';

interface TerminalHeaderProps {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  stats?: TerminalStats;
}

const SYMBOLS: Symbol[] = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT'];

export function TerminalHeader({
  currentPrice,
  priceChange24h,
  priceChangePercent24h,
  stats,
}: TerminalHeaderProps) {
  const { symbol, setSymbol } = useSymbol();
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);

  const isPositive = priceChange24h >= 0;
  const priceColor = isPositive ? 'text-[#2EAD65]' : 'text-[#F6465D]';

  return (
    <header className="h-14 bg-[#161A1E] border-b border-[#2B2F36] flex items-center px-4 shrink-0 terminal-panel">
      <div className="flex items-center gap-6 flex-1">
        {/* Symbol Selector */}
        <div className="relative flex items-center gap-2">
          <Star className="w-4 h-4 text-[#848E9C] hover:text-[#F0B90B] cursor-pointer" />
          <div className="relative">
            <button
              onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
              className="flex items-center gap-2 text-[#EAECEF] font-semibold text-lg hover:text-[#F0B90B] transition-colors"
            >
              <span>{symbol}</span>
              <span className="text-[#848E9C] text-xs bg-[#2B2F36] px-1.5 py-0.5 rounded">Perpetual</span>
              <ChevronDown className="w-4 h-4 text-[#848E9C]" />
            </button>
            
            {isSymbolDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-[#161A1E] border border-[#2B2F36] rounded shadow-lg z-50 min-w-[200px]">
                {SYMBOLS.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => {
                      setSymbol(sym);
                      setIsSymbolDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#2B2F36] transition-colors ${
                      sym === symbol ? 'text-[#F0B90B]' : 'text-[#EAECEF]'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Price Display */}
        <div className="flex items-center gap-3">
          <span className={`text-xl font-mono font-semibold ${priceColor}`}>
            {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-xs ${priceColor}`}>
            {isPositive ? '+' : ''}{priceChangePercent24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-xs">
        {stats && (
          <>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">Mark</span>
              <span className="text-[#EAECEF] font-mono">{stats.mark.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">Index</span>
              <span className="text-[#EAECEF] font-mono">{stats.index.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">24h High</span>
              <span className="text-[#EAECEF] font-mono">{stats.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">24h Low</span>
              <span className="text-[#EAECEF] font-mono">{stats.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">24h Vol(BTC)</span>
              <span className="text-[#EAECEF] font-mono">{stats.volume24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">Open Interest</span>
              <span className="text-[#EAECEF] font-mono">${(stats.openInterest / 1e9).toFixed(2)}B</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#848E9C]">Funding</span>
              <span className={`font-mono ${stats.fundingRate >= 0 ? 'text-[#2EAD65]' : 'text-[#F6465D]'}`}>
                {(stats.fundingRate * 100).toFixed(4)}%
              </span>
            </div>
          </>
        )}
        <Settings className="w-4 h-4 text-[#848E9C] hover:text-[#EAECEF] cursor-pointer ml-2" />
      </div>
    </header>
  );
}
