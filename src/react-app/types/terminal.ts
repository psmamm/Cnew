/**
 * Terminal Type Definitions
 * 
 * Type-safe definitions for the High-Frequency Trading Terminal components.
 */

/**
 * Supported trading symbols
 */
export type Symbol = 
  | 'BTCUSDT'
  | 'ETHUSDT'
  | 'BNBUSDT'
  | 'SOLUSDT'
  | 'XRPUSDT'
  | 'ADAUSDT'
  | 'DOGEUSDT'
  | 'DOTUSDT'
  | 'MATICUSDT'
  | 'AVAXUSDT'
  | string; // Allow other symbols

/**
 * Orderbook Level (single price level)
 */
export interface OrderbookLevel {
  price: number;
  size: number;
  total: number; // Cumulative total for depth visualization
}

/**
 * Orderbook Data Structure
 */
export interface OrderbookData {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
  symbol: Symbol;
  lastUpdateId?: number; // For WebSocket sequence tracking
}

/**
 * Aggregation Level for Orderbook
 */
export type TickSize = 0.1 | 0.5 | 1.0 | 5.0 | 10.0;

/**
 * Deal Ticket State
 */
export interface DealTicketState {
  // Risk-First Input (Primary)
  riskAmount: number; // $ Risk in Fiat
  
  // Price Levels
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  
  // Position Parameters
  leverage: number;
  marginMode: 'isolated' | 'cross';
  
  // Calculated Values
  positionSize: number; // Calculated: Risk / (Entry - SL)
  orderValue: number; // Position Size * Entry Price
  marginRequired: number;
  
  // Order Type
  orderType: 'Market' | 'Limit' | 'Conditional';
  
  // Side
  side: 'Buy' | 'Sell';
  
  // Validation
  isValid: boolean;
  errors: string[];
}

/**
 * Bybit WebSocket Message Types
 */
export interface BybitOrderbookSnapshot {
  topic: string;
  type: 'snapshot';
  ts: number;
  data: {
    s: string; // Symbol
    b: [string, string][]; // Bids [price, size]
    a: [string, string][]; // Asks [price, size]
    u: number; // Update ID
    seq: number; // Sequence number
  };
}

export interface BybitOrderbookDelta {
  topic: string;
  type: 'delta';
  ts: number;
  data: {
    s: string; // Symbol
    b: [string, string][]; // Bid updates
    a: [string, string][]; // Ask updates
    u: number; // Update ID
    seq: number; // Sequence number
    prevSeq: number; // Previous sequence
  };
}

/**
 * Terminal Header Stats
 */
export interface TerminalStats {
  mark: number;
  index: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  priceChange24h: number;
  priceChangePercent24h: number;
}

/**
 * Position Entry
 */
export interface Position {
  symbol: Symbol;
  side: 'Long' | 'Short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  margin: number;
  pnl: number;
  roe: number; // Return on Equity %
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: boolean;
}

/**
 * Order Entry
 */
export interface Order {
  orderId: string;
  symbol: Symbol;
  side: 'Buy' | 'Sell';
  orderType: 'Market' | 'Limit' | 'Conditional';
  qty: number;
  price?: number;
  status: 'New' | 'PartiallyFilled' | 'Filled' | 'Canceled' | 'Rejected';
  createdAt: number;
  updatedAt: number;
}

/**
 * Chart Timeframe
 */
export type Timeframe = '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M';

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  orderLatency?: number; // Order execution latency in ms
  orderbookUpdateRate?: number; // Updates per second
  chartRenderTime?: number; // Chart render time in ms
  memoryUsage?: number; // Memory usage in MB
}
