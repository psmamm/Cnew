/**
 * Bybit Broker Adapter
 *
 * Implementation of IBroker for Bybit exchange.
 * Supports Spot, Futures, and Options trading.
 */

import { BaseBroker } from '../IBroker';
import {
  BrokerMetadata,
  BrokerCredentials,
  BrokerAccount,
  Balance,
  Trade,
  Position,
  Order,
  Symbol,
  Ticker,
  SyncOptions,
  SyncResult,
  ConnectionTestResult,
  BrokerError,
  BrokerErrorCodes,
} from '../types';
import { createHmac } from 'crypto';

// ============================================================================
// Bybit API Types
// ============================================================================

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

interface BybitWalletBalance {
  accountType: string;
  coin: Array<{
    coin: string;
    walletBalance: string;
    availableBalance: string;
    bonus: string;
  }>;
}

interface BybitTrade {
  symbol: string;
  orderId: string;
  orderLinkId: string;
  side: string;
  orderPrice: string;
  orderQty: string;
  execFee: string;
  execId: string;
  execPrice: string;
  execQty: string;
  execType: string;
  execValue: string;
  execTime: string;
  closedSize: string;
  category: string;
}

interface BybitPosition {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  positionValue: string;
  unrealisedPnl: string;
  cumRealisedPnl: string;
  leverage: string;
  liqPrice: string;
  positionIM: string;
  positionMM: string;
  tradeMode: number;
  bustPrice: string;
  createdTime: string;
  updatedTime: string;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class BybitAdapter extends BaseBroker {
  readonly metadata: BrokerMetadata = {
    id: 'bybit',
    name: 'bybit',
    displayName: 'Bybit',
    logo: '/exchanges/bybit.svg',
    category: 'crypto_cex',
    connectionType: 'api_key',
    features: ['spot', 'futures', 'options', 'copy_trading'],
    supportedAssetTypes: ['crypto'],
    apiDocsUrl: 'https://bybit-exchange.github.io/docs/',
    websiteUrl: 'https://www.bybit.com',
    supportsTestnet: true,
    rateLimits: {
      requestsPerMinute: 600,
      ordersPerSecond: 10,
    },
  };

  private baseUrl = 'https://api.bybit.com';

  // ==========================================================================
  // Connection
  // ==========================================================================

  async connect(credentials: BrokerCredentials): Promise<void> {
    this.credentials = credentials;

    if (credentials.isTestnet) {
      this.baseUrl = 'https://api-testnet.bybit.com';
    }

    const testResult = await this.testConnection(credentials);
    if (!testResult.success) {
      throw new BrokerError(
        testResult.error || 'Failed to connect',
        BrokerErrorCodes.INVALID_CREDENTIALS
      );
    }

    this.setConnected(true);
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
    this.setConnected(false);
  }

  async testConnection(credentials: BrokerCredentials): Promise<ConnectionTestResult> {
    try {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const params = `${timestamp}${credentials.apiKey}${recvWindow}`;
      const signature = createHmac('sha256', credentials.apiSecret)
        .update(params)
        .digest('hex');

      const response = await fetch(`${this.baseUrl}/v5/user/query-api`, {
        headers: {
          'X-BAPI-API-KEY': credentials.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': String(timestamp),
          'X-BAPI-RECV-WINDOW': String(recvWindow),
        },
      });

      const data: BybitResponse<{
        id: string;
        note: string;
        apiKey: string;
        readOnly: number;
        permissions: {
          Wallet?: string[];
          Exchange?: string[];
          SpotTrade?: string[];
          ContractTrade?: string[];
          Options?: string[];
        };
      }> = await response.json();

      if (data.retCode !== 0) {
        return {
          success: false,
          error: data.retMsg || 'Invalid API credentials',
          errorCode: String(data.retCode),
        };
      }

      const permissions: ('read' | 'trade' | 'withdraw')[] = ['read'];
      if (data.result.permissions.SpotTrade || data.result.permissions.ContractTrade) {
        permissions.push('trade');
      }
      if (data.result.permissions.Wallet?.includes('AccountTransfer')) {
        permissions.push('withdraw');
      }

      return {
        success: true,
        accountInfo: {
          id: data.result.id,
          name: data.result.note || 'Bybit Account',
          permissions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ==========================================================================
  // Account Information
  // ==========================================================================

  async getAccount(): Promise<BrokerAccount> {
    const balances = await this.getBalances();
    const totalBalance = balances.reduce((sum, b) => sum + (b.usdValue || b.total), 0);

    return {
      id: 'unified',
      name: 'Bybit Unified',
      type: this.credentials?.isTestnet ? 'testnet' : 'live',
      currency: 'USDT',
      balance: totalBalance,
      availableBalance: totalBalance,
      permissions: ['read', 'trade'],
    };
  }

  async getBalances(): Promise<Balance[]> {
    const data = await this.signedRequest<{ list: BybitWalletBalance[] }>(
      '/v5/account/wallet-balance',
      { accountType: 'UNIFIED' }
    );

    if (!data.list?.[0]?.coin) return [];

    return data.list[0].coin
      .filter((c) => parseFloat(c.walletBalance) > 0)
      .map((c) => ({
        asset: c.coin,
        free: parseFloat(c.availableBalance),
        locked: parseFloat(c.walletBalance) - parseFloat(c.availableBalance),
        total: parseFloat(c.walletBalance),
      }));
  }

  // ==========================================================================
  // Trade History
  // ==========================================================================

  async getTrades(options?: {
    symbol?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<Trade[]> {
    const params: Record<string, string> = {
      category: 'linear',
      limit: String(options?.limit || 50),
    };

    if (options?.symbol) params.symbol = options.symbol;
    if (options?.startTime) params.startTime = String(new Date(options.startTime).getTime());
    if (options?.endTime) params.endTime = String(new Date(options.endTime).getTime());

    const data = await this.signedRequest<{ list: BybitTrade[] }>(
      '/v5/execution/list',
      params
    );

    return (data.list || []).map((t) => this.mapTrade(t));
  }

  // ==========================================================================
  // Positions
  // ==========================================================================

  async getPositions(): Promise<Position[]> {
    const data = await this.signedRequest<{ list: BybitPosition[] }>(
      '/v5/position/list',
      { category: 'linear', settleCoin: 'USDT' }
    );

    return (data.list || [])
      .filter((p) => parseFloat(p.size) !== 0)
      .map((p) => this.mapPosition(p));
  }

  // ==========================================================================
  // Orders
  // ==========================================================================

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params: Record<string, string> = { category: 'linear' };
    if (symbol) params.symbol = symbol;

    const data = await this.signedRequest<{
      list: Array<{
        orderId: string;
        orderLinkId: string;
        symbol: string;
        side: string;
        orderType: string;
        price: string;
        qty: string;
        cumExecQty: string;
        cumExecValue: string;
        orderStatus: string;
        stopOrderType: string;
        triggerPrice: string;
        createdTime: string;
        updatedTime: string;
      }>;
    }>('/v5/order/realtime', params);

    return (data.list || []).map((o) => ({
      id: o.orderId,
      clientOrderId: o.orderLinkId,
      symbol: o.symbol,
      side: o.side.toLowerCase() as 'buy' | 'sell',
      type: this.mapBybitOrderType(o.orderType),
      quantity: parseFloat(o.qty),
      price: parseFloat(o.price) || undefined,
      stopPrice: parseFloat(o.triggerPrice) || undefined,
      timeInForce: 'GTC' as const,
      status: this.mapOrderStatus(o.orderStatus),
      filledQuantity: parseFloat(o.cumExecQty),
      createdAt: new Date(parseInt(o.createdTime)).toISOString(),
      updatedAt: new Date(parseInt(o.updatedTime)).toISOString(),
    }));
  }

  // ==========================================================================
  // Market Data
  // ==========================================================================

  async getSymbols(): Promise<Symbol[]> {
    const response = await fetch(`${this.baseUrl}/v5/market/instruments-info?category=linear`);
    const data: BybitResponse<{
      list: Array<{
        symbol: string;
        baseCoin: string;
        quoteCoin: string;
        status: string;
        lotSizeFilter: {
          minOrderQty: string;
          maxOrderQty: string;
          qtyStep: string;
        };
        priceFilter: {
          minPrice: string;
          maxPrice: string;
          tickSize: string;
        };
      }>;
    }> = await response.json();

    return (data.result.list || []).map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseCoin,
      quoteAsset: s.quoteCoin,
      status: s.status === 'Trading' ? 'trading' : 'halted',
      minQuantity: parseFloat(s.lotSizeFilter.minOrderQty),
      maxQuantity: parseFloat(s.lotSizeFilter.maxOrderQty),
      stepSize: parseFloat(s.lotSizeFilter.qtyStep),
      minNotional: 0,
      pricePrecision: this.countDecimals(s.priceFilter.tickSize),
      quantityPrecision: this.countDecimals(s.lotSizeFilter.qtyStep),
      isFuturesTradingAllowed: true,
    }));
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const response = await fetch(
      `${this.baseUrl}/v5/market/tickers?category=linear&symbol=${symbol}`
    );
    const data: BybitResponse<{
      list: Array<{
        symbol: string;
        lastPrice: string;
        bid1Price: string;
        ask1Price: string;
        highPrice24h: string;
        lowPrice24h: string;
        volume24h: string;
        price24hPcnt: string;
      }>;
    }> = await response.json();

    const ticker = data.result.list[0];

    return {
      symbol: ticker.symbol,
      lastPrice: parseFloat(ticker.lastPrice),
      bidPrice: parseFloat(ticker.bid1Price),
      askPrice: parseFloat(ticker.ask1Price),
      high24h: parseFloat(ticker.highPrice24h),
      low24h: parseFloat(ticker.lowPrice24h),
      volume24h: parseFloat(ticker.volume24h),
      priceChange24h: 0,
      priceChangePercent24h: parseFloat(ticker.price24hPcnt) * 100,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Sync
  // ==========================================================================

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let tradesImported = 0;
    let positionsUpdated = 0;
    let balancesUpdated = 0;

    try {
      // Sync trades
      const trades = await this.getTrades({
        startTime: options?.startDate,
        endTime: options?.endDate,
        symbol: options?.symbols?.[0],
      });
      tradesImported = trades.length;

      // Sync positions
      if (options?.includePositions !== false) {
        const positions = await this.getPositions();
        positionsUpdated = positions.length;
      }

      // Sync balances
      if (options?.includeBalances !== false) {
        const balances = await this.getBalances();
        balancesUpdated = balances.length;
      }

      this.setSyncTime();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Sync failed');
    }

    return {
      success: errors.length === 0,
      tradesImported,
      tradesMapped: tradesImported,
      positionsUpdated,
      balancesUpdated,
      errors,
      warnings,
      syncedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Mapping
  // ==========================================================================

  mapTrade(brokerTrade: unknown): Trade {
    const t = brokerTrade as BybitTrade;
    return {
      id: `bybit_${t.execId}`,
      brokerId: 'bybit',
      brokerOrderId: t.orderId,
      symbol: t.symbol,
      side: t.side.toLowerCase() as 'buy' | 'sell',
      type: 'market',
      quantity: parseFloat(t.execQty),
      price: parseFloat(t.execPrice),
      filledQuantity: parseFloat(t.execQty),
      avgFillPrice: parseFloat(t.execPrice),
      status: 'filled',
      fee: parseFloat(t.execFee),
      feeCurrency: 'USDT',
      createdAt: new Date(parseInt(t.execTime)).toISOString(),
      updatedAt: new Date(parseInt(t.execTime)).toISOString(),
      raw: t as unknown as Record<string, unknown>,
    };
  }

  mapPosition(brokerPosition: unknown): Position {
    const p = brokerPosition as BybitPosition;
    return {
      id: `bybit_${p.symbol}_${p.side}`,
      symbol: p.symbol,
      side: p.side === 'Buy' ? 'long' : 'short',
      quantity: parseFloat(p.size),
      entryPrice: parseFloat(p.entryPrice),
      currentPrice: parseFloat(p.markPrice),
      unrealizedPnL: parseFloat(p.unrealisedPnl),
      realizedPnL: parseFloat(p.cumRealisedPnl),
      leverage: parseInt(p.leverage),
      liquidationPrice: parseFloat(p.liqPrice),
      marginType: p.tradeMode === 0 ? 'cross' : 'isolated',
      createdAt: new Date(parseInt(p.createdTime)).toISOString(),
      updatedAt: new Date(parseInt(p.updatedTime)).toISOString(),
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async signedRequest<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    if (!this.credentials) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const timestamp = Date.now();
    const recvWindow = 5000;

    const queryString = new URLSearchParams(params).toString();
    const signPayload = `${timestamp}${this.credentials.apiKey}${recvWindow}${queryString}`;
    const signature = createHmac('sha256', this.credentials.apiSecret)
      .update(signPayload)
      .digest('hex');

    const url = queryString
      ? `${this.baseUrl}${endpoint}?${queryString}`
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'X-BAPI-API-KEY': this.credentials.apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': String(timestamp),
        'X-BAPI-RECV-WINDOW': String(recvWindow),
      },
    });

    const data: BybitResponse<T> = await response.json();

    if (data.retCode !== 0) {
      throw new BrokerError(
        data.retMsg || 'Request failed',
        BrokerErrorCodes.UNKNOWN_ERROR,
        String(data.retCode)
      );
    }

    return data.result;
  }

  private mapOrderStatus(
    status: string
  ): 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired' {
    const statusMap: Record<string, 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired'> = {
      Created: 'pending',
      New: 'open',
      Filled: 'filled',
      PartiallyFilled: 'partially_filled',
      Cancelled: 'cancelled',
      Rejected: 'rejected',
      Expired: 'expired',
      PendingCancel: 'pending',
    };
    return statusMap[status] || 'pending';
  }

  private mapBybitOrderType(orderType: string): 'market' | 'limit' | 'stop' | 'stop_limit' {
    const typeMap: Record<string, 'market' | 'limit' | 'stop' | 'stop_limit'> = {
      Market: 'market',
      Limit: 'limit',
      Stop: 'stop',
      StopLimit: 'stop_limit',
    };
    return typeMap[orderType] || 'market';
  }

  private countDecimals(value: string): number {
    const parts = value.split('.');
    return parts.length > 1 ? parts[1].replace(/0+$/, '').length : 0;
  }
}
