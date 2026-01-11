/**
 * Broker Service Types
 *
 * Unified type definitions for all broker/exchange integrations.
 * Supports both crypto exchanges and traditional brokers.
 */

// ============================================================================
// Broker Categories
// ============================================================================

export type BrokerCategory =
  | 'crypto_cex'      // Centralized crypto exchanges (Binance, Bybit)
  | 'crypto_dex'      // Decentralized exchanges (Hyperliquid)
  | 'stocks'          // Stock brokers (Interactive Brokers, TD Ameritrade)
  | 'forex'           // Forex brokers (OANDA)
  | 'futures'         // Futures platforms
  | 'options';        // Options platforms

export type BrokerConnectionType =
  | 'api_key'         // API key + secret
  | 'oauth'           // OAuth2 flow
  | 'bridge'          // Local bridge connection (MetaTrader, NinjaTrader)
  | 'websocket';      // Direct WebSocket connection

// ============================================================================
// Credentials
// ============================================================================

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;           // OKX, Coinbase Pro
  isTestnet?: boolean;
  accessToken?: string;          // OAuth token
  refreshToken?: string;         // OAuth refresh
  expiresAt?: string;            // Token expiration
  accountId?: string;            // For brokers that need account selection
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

// ============================================================================
// Account & Balance
// ============================================================================

export interface BrokerAccount {
  id: string;
  name: string;
  type: 'live' | 'paper' | 'testnet';
  currency: string;
  balance: number;
  availableBalance: number;
  marginUsed?: number;
  marginAvailable?: number;
  unrealizedPnL?: number;
  permissions: BrokerPermission[];
}

export type BrokerPermission =
  | 'read'            // View account info
  | 'trade'           // Execute trades
  | 'withdraw'        // Withdraw funds
  | 'transfer'        // Internal transfers
  | 'margin'          // Margin trading
  | 'futures'         // Futures trading
  | 'options';        // Options trading

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue?: number;
}

// ============================================================================
// Trade Types
// ============================================================================

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';
export type PositionSide = 'long' | 'short' | 'both';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTD';

export interface Trade {
  id: string;
  brokerId: string;
  brokerOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  filledQuantity: number;
  avgFillPrice: number;
  status: OrderStatus;
  fee: number;
  feeCurrency: string;
  realizedPnL?: number;
  leverage?: number;
  positionSide?: PositionSide;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  raw?: Record<string, unknown>; // Original broker response
}

export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  leverage?: number;
  liquidationPrice?: number;
  marginType?: 'cross' | 'isolated';
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice?: number;
  fee?: number;
  feeCurrency?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Market Data
// ============================================================================

export interface Symbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'trading' | 'halted' | 'closed';
  minQuantity: number;
  maxQuantity: number;
  stepSize: number;
  minNotional: number;
  pricePrecision: number;
  quantityPrecision: number;
  isMarginTradingAllowed?: boolean;
  isFuturesTradingAllowed?: boolean;
}

export interface Ticker {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  timestamp: string;
}

export interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================================================
// Sync & Import
// ============================================================================

export interface SyncOptions {
  startDate?: string;
  endDate?: string;
  symbols?: string[];
  includeOpenOrders?: boolean;
  includePositions?: boolean;
  includeBalances?: boolean;
}

export interface SyncResult {
  success: boolean;
  tradesImported: number;
  tradesMapped: number;
  positionsUpdated: number;
  balancesUpdated: number;
  errors: string[];
  warnings: string[];
  syncedAt: string;
}

// ============================================================================
// Connection Status
// ============================================================================

export interface ConnectionStatus {
  isConnected: boolean;
  lastConnectedAt?: string;
  lastSyncAt?: string;
  error?: string;
  rateLimitRemaining?: number;
  rateLimitResetAt?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  accountInfo?: {
    id: string;
    name: string;
    permissions: BrokerPermission[];
  };
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Broker Metadata
// ============================================================================

export interface BrokerMetadata {
  id: string;
  name: string;
  displayName: string;
  logo?: string;
  category: BrokerCategory;
  connectionType: BrokerConnectionType;
  features: BrokerFeature[];
  supportedAssetTypes: AssetType[];
  apiDocsUrl?: string;
  websiteUrl?: string;
  requiresPassphrase?: boolean;
  supportsTestnet?: boolean;
  supportsOAuth?: boolean;
  rateLimits?: {
    requestsPerMinute: number;
    ordersPerSecond?: number;
  };
}

export type BrokerFeature =
  | 'spot'
  | 'margin'
  | 'futures'
  | 'options'
  | 'copy_trading'
  | 'staking'
  | 'lending'
  | 'earn'
  | 'nft';

export type AssetType =
  | 'crypto'
  | 'stock'
  | 'etf'
  | 'forex'
  | 'commodity'
  | 'index'
  | 'bond'
  | 'option'
  | 'future';

// ============================================================================
// Error Types
// ============================================================================

export class BrokerError extends Error {
  constructor(
    message: string,
    public code: string,
    public brokerCode?: string,
    public isRetryable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'BrokerError';
  }
}

export const BrokerErrorCodes = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_SYMBOL: 'INVALID_SYMBOL',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ORDER_REJECTED: 'ORDER_REJECTED',
  POSITION_NOT_FOUND: 'POSITION_NOT_FOUND',
  BROKER_UNAVAILABLE: 'BROKER_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;
