/**
 * Symbol Context
 * 
 * Global state management for the current trading symbol across all Terminal components.
 * Enables instant symbol synchronization between Chart, Orderbook, and Deal Ticket.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Symbol } from '../types/terminal';

interface SymbolContextType {
  symbol: Symbol;
  setSymbol: (symbol: Symbol) => void;
  previousSymbol: Symbol | null;
}

const SymbolContext = createContext<SymbolContextType | undefined>(undefined);

interface SymbolProviderProps {
  children: ReactNode;
  initialSymbol?: Symbol;
}

export function SymbolProvider({ children, initialSymbol = 'BTCUSDT' }: SymbolProviderProps) {
  const [symbol, setSymbolState] = useState<Symbol>(initialSymbol);
  const [previousSymbol, setPreviousSymbol] = useState<Symbol | null>(null);

  const setSymbol = useCallback((newSymbol: Symbol) => {
    if (newSymbol !== symbol) {
      setPreviousSymbol(symbol);
      setSymbolState(newSymbol);
    }
  }, [symbol]);

  return (
    <SymbolContext.Provider value={{ symbol, setSymbol, previousSymbol }}>
      {children}
    </SymbolContext.Provider>
  );
}

export function useSymbol(): SymbolContextType {
  const context = useContext(SymbolContext);
  if (context === undefined) {
    throw new Error('useSymbol must be used within a SymbolProvider');
  }
  return context;
}
