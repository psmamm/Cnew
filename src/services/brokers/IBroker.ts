/**
 * IBroker Interface
 *
 * Unified interface for all broker/exchange integrations.
 * All broker adapters must implement this interface.
 */

import {
  BrokerCredentials,
  BrokerMetadata,
  BrokerAccount,
  Balance,
  Trade,
  Position,
  Order,
  OrderSide,
  OrderType,
  TimeInForce,
  Symbol,
  Ticker,
  OHLCV,
  SyncOptions,
  SyncResult,
  ConnectionStatus,
  ConnectionTestResult,
} from './types';

// ============================================================================
// Core Interface
// ============================================================================

export interface IBroker {
  /**
   * Broker metadata (id, name, features, etc.)
   */
  readonly metadata: BrokerMetadata;

  /**
   * Current connection status
   */
  readonly status: ConnectionStatus;

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Initialize the broker with credentials
   */
  connect(credentials: BrokerCredentials): Promise<void>;

  /**
   * Disconnect and cleanup resources
   */
  disconnect(): Promise<void>;

  /**
   * Test connection with provided credentials
   */
  testConnection(credentials: BrokerCredentials): Promise<ConnectionTestResult>;

  /**
   * Refresh OAuth tokens if applicable
   */
  refreshAuth?(): Promise<BrokerCredentials>;

  // ==========================================================================
  // Account Information
  // ==========================================================================

  /**
   * Get account information
   */
  getAccount(): Promise<BrokerAccount>;

  /**
   * Get all available accounts (for brokers with multiple accounts)
   */
  getAccounts?(): Promise<BrokerAccount[]>;

  /**
   * Get all balances
   */
  getBalances(): Promise<Balance[]>;

  /**
   * Get balance for specific asset
   */
  getBalance(asset: string): Promise<Balance | null>;

  // ==========================================================================
  // Trade History
  // ==========================================================================

  /**
   * Get historical trades
   */
  getTrades(options?: {
    symbol?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<Trade[]>;

  /**
   * Get trade by ID
   */
  getTrade(tradeId: string): Promise<Trade | null>;

  // ==========================================================================
  // Positions
  // ==========================================================================

  /**
   * Get all open positions
   */
  getPositions(): Promise<Position[]>;

  /**
   * Get position for specific symbol
   */
  getPosition(symbol: string): Promise<Position | null>;

  // ==========================================================================
  // Orders (Optional - for trade execution)
  // ==========================================================================

  /**
   * Get open orders
   */
  getOpenOrders?(symbol?: string): Promise<Order[]>;

  /**
   * Get order by ID
   */
  getOrder?(orderId: string): Promise<Order | null>;

  /**
   * Place a new order
   */
  placeOrder?(params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: TimeInForce;
    clientOrderId?: string;
  }): Promise<Order>;

  /**
   * Cancel an order
   */
  cancelOrder?(orderId: string, symbol?: string): Promise<void>;

  /**
   * Cancel all orders for a symbol
   */
  cancelAllOrders?(symbol?: string): Promise<void>;

  // ==========================================================================
  // Market Data (Optional)
  // ==========================================================================

  /**
   * Get available trading symbols
   */
  getSymbols?(): Promise<Symbol[]>;

  /**
   * Get ticker for symbol
   */
  getTicker?(symbol: string): Promise<Ticker>;

  /**
   * Get historical OHLCV data
   */
  getOHLCV?(
    symbol: string,
    interval: string,
    options?: { startTime?: string; endTime?: string; limit?: number }
  ): Promise<OHLCV[]>;

  // ==========================================================================
  // Sync & Import
  // ==========================================================================

  /**
   * Full sync of account data
   */
  sync(options?: SyncOptions): Promise<SyncResult>;

  /**
   * Map broker trade to our standardized Trade format
   */
  mapTrade(brokerTrade: unknown): Trade;

  /**
   * Map broker position to our standardized Position format
   */
  mapPosition?(brokerPosition: unknown): Position;
}

// ============================================================================
// Abstract Base Class
// ============================================================================

export abstract class BaseBroker implements IBroker {
  abstract readonly metadata: BrokerMetadata;

  protected _status: ConnectionStatus = {
    isConnected: false,
  };

  protected credentials: BrokerCredentials | null = null;

  get status(): ConnectionStatus {
    return { ...this._status };
  }

  // Abstract methods that must be implemented
  abstract connect(credentials: BrokerCredentials): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(credentials: BrokerCredentials): Promise<ConnectionTestResult>;
  abstract getAccount(): Promise<BrokerAccount>;
  abstract getBalances(): Promise<Balance[]>;
  abstract getTrades(options?: {
    symbol?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<Trade[]>;
  abstract getPositions(): Promise<Position[]>;
  abstract sync(options?: SyncOptions): Promise<SyncResult>;
  abstract mapTrade(brokerTrade: unknown): Trade;

  // Default implementations
  async getBalance(asset: string): Promise<Balance | null> {
    const balances = await this.getBalances();
    return balances.find((b) => b.asset === asset) || null;
  }

  async getTrade(tradeId: string): Promise<Trade | null> {
    const trades = await this.getTrades();
    return trades.find((t) => t.id === tradeId) || null;
  }

  async getPosition(symbol: string): Promise<Position | null> {
    const positions = await this.getPositions();
    return positions.find((p) => p.symbol === symbol) || null;
  }

  // Utility methods
  protected setConnected(connected: boolean): void {
    this._status.isConnected = connected;
    if (connected) {
      this._status.lastConnectedAt = new Date().toISOString();
    }
  }

  protected setError(error: string | null): void {
    this._status.error = error || undefined;
  }

  protected setSyncTime(): void {
    this._status.lastSyncAt = new Date().toISOString();
  }

  protected updateRateLimit(remaining: number, resetAt?: string): void {
    this._status.rateLimitRemaining = remaining;
    this._status.rateLimitResetAt = resetAt;
  }
}
