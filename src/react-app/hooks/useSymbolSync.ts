/**
 * useSymbolSync Hook
 * 
 * Synchronizes symbol changes across Terminal components (Chart, Orderbook, Deal Ticket).
 * Ensures instant symbol updates without full page reload.
 */

import { useEffect, useRef } from 'react';
import { useSymbol } from '../contexts/SymbolContext';
import type { Symbol } from '../types/terminal';

interface UseSymbolSyncOptions {
  onSymbolChange?: (symbol: Symbol, previousSymbol: Symbol | null) => void;
  debounceMs?: number;
}

/**
 * Hook for synchronizing symbol changes across components
 * 
 * @param options - Configuration options
 * @returns Current symbol and change handler
 */
export function useSymbolSync(options: UseSymbolSyncOptions = {}) {
  const { symbol, setSymbol, previousSymbol } = useSymbol();
  const { onSymbolChange, debounceMs = 0 } = options;
  const debounceTimerRef = useRef<number | null>(null);
  const previousSymbolRef = useRef<Symbol | null>(null);

  // Track symbol changes and trigger callbacks
  useEffect(() => {
    // Skip initial render
    if (previousSymbolRef.current === null) {
      previousSymbolRef.current = symbol;
      return;
    }

    // Only trigger if symbol actually changed
    if (previousSymbolRef.current !== symbol) {
      const changedFrom = previousSymbolRef.current;
      
      // Clear existing debounce timer
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce callback if specified
      if (debounceMs > 0) {
        debounceTimerRef.current = window.setTimeout(() => {
          onSymbolChange?.(symbol, changedFrom);
        }, debounceMs);
      } else {
        // Immediate callback
        onSymbolChange?.(symbol, changedFrom);
      }

      previousSymbolRef.current = symbol;
    }
  }, [symbol, onSymbolChange, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    symbol,
    setSymbol,
    previousSymbol,
    hasChanged: previousSymbol !== null && previousSymbol !== symbol,
  };
}
