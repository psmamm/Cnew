/**
 * Binance Broker Adapter
 *
 * Implementation of IBroker for Binance exchange.
 * Supports Spot and Futures trading.
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
// Binance API Types
// ============================================================================

interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  accountType: string;
  balances: BinanceBalance[];
  permissions: string[];
}

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceTrade {
  id: number;
  symbol: string;
  orderId: number;
  orderListId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

interface BinanceFuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;
  updateTime: number;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class BinanceAdapter extends BaseBroker {
  readonly metadata: BrokerMetadata = {
    id: 'binance',
    name: 'binance',
    displayName: 'Binance',
    logo: '/exchanges/binance.svg',
    category: 'crypto_cex',
    connectionType: 'api_key',
    features: ['spot', 'margin', 'futures', 'staking'],
    supportedAssetTypes: ['crypto'],
    apiDocsUrl: 'https://binance-docs.github.io/apidocs/',
    websiteUrl: 'https://www.binance.com',
    supportsTestnet: true,
    rateLimits: {
      requestsPerMinute: 1200,
      ordersPerSecond: 10,
    },
  };

  private baseUrl = 'https://api.binance.com';
  private futuresUrl = 'https://fapi.binance.com';

  // ==========================================================================
  // Connection
  // ==========================================================================

  async connect(credentials: BrokerCredentials): Promise<void> {
    this.credentials = credentials;

    if (credentials.isTestnet) {
      this.baseUrl = 'https://testnet.binance.vision';
      this.futuresUrl = 'https://testnet.binancefuture.com';
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
      const queryString = `timestamp=${timestamp}`;
      const signature = this.sign(queryString, credentials.apiSecret);

      const response = await fetch(
        `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': credentials.apiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.msg || 'Invalid API credentials',
          errorCode: String(error.code),
        };
      }

      const accountInfo: BinanceAccountInfo = await response.json();

      return {
        success: true,
        accountInfo: {
          id: accountInfo.accountType,
          name: `Binance ${accountInfo.accountType}`,
          permissions: this.mapPermissions(accountInfo.permissions, accountInfo),
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
    const accountInfo = await this.signedRequest<BinanceAccountInfo>('/api/v3/account');
    const balances = await this.getBalances();

    const totalUsdValue = balances.reduce((sum, b) => sum + (b.usdValue || 0), 0);

    return {
      id: accountInfo.accountType,
      name: `Binance ${accountInfo.accountType}`,
      type: this.credentials?.isTestnet ? 'testnet' : 'live',
      currency: 'USDT',
      balance: totalUsdValue,
      availableBalance: totalUsdValue,
      permissions: this.mapPermissions(accountInfo.permissions, accountInfo),
    };
  }

  async getBalances(): Promise<Balance[]> {
    const accountInfo = await this.signedRequest<BinanceAccountInfo>('/api/v3/account');

    return accountInfo.balances
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
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
    const trades: Trade[] = [];

    // Get symbols to fetch trades for
    let symbols: string[] = [];
    if (options?.symbol) {
      symbols = [options.symbol];
    } else {
      // Get all traded symbols from recent balances
      const balances = await this.getBalances();
      symbols = balances
        .filter((b) => b.total > 0)
        .map((b) => `${b.asset}USDT`);
    }

    // Fetch trades for each symbol
    for (const symbol of symbols.slice(0, 10)) {
      // Limit to avoid rate limits
      try {
        const params: Record<string, string> = { symbol };
        if (options?.startTime) params.startTime = String(new Date(options.startTime).getTime());
        if (options?.endTime) params.endTime = String(new Date(options.endTime).getTime());
        if (options?.limit) params.limit = String(options.limit);

        const symbolTrades = await this.signedRequest<BinanceTrade[]>(
          '/api/v3/myTrades',
          params
        );

        trades.push(...symbolTrades.map((t) => this.mapTrade(t)));
      } catch {
        // Symbol may not exist, continue
      }
    }

    return trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==========================================================================
  // Positions (Futures)
  // ==========================================================================

  async getPositions(): Promise<Position[]> {
    try {
      const positions = await this.signedFuturesRequest<BinanceFuturesPosition[]>(
        '/fapi/v2/positionRisk'
      );

      return positions
        .filter((p) => parseFloat(p.positionAmt) !== 0)
        .map((p) => this.mapPosition(p));
    } catch {
      return []; // Futures not enabled
    }
  }

  // ==========================================================================
  // Orders
  // ==========================================================================

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params: Record<string, string> = {};
    if (symbol) params.symbol = symbol;

    const orders = await this.signedRequest<Array<{
      symbol: string;
      orderId: number;
      clientOrderId: string;
      price: string;
      origQty: string;
      executedQty: string;
      status: string;
      type: string;
      side: string;
      stopPrice: string;
      time: number;
      updateTime: number;
    }>>('/api/v3/openOrders', params);

    return orders.map((o) => ({
      id: String(o.orderId),
      clientOrderId: o.clientOrderId,
      symbol: o.symbol,
      side: o.side.toLowerCase() as 'buy' | 'sell',
      type: o.type.toLowerCase() as 'market' | 'limit' | 'stop' | 'stop_limit',
      quantity: parseFloat(o.origQty),
      price: parseFloat(o.price) || undefined,
      stopPrice: parseFloat(o.stopPrice) || undefined,
      timeInForce: 'GTC' as const,
      status: this.mapOrderStatus(o.status),
      filledQuantity: parseFloat(o.executedQty),
      createdAt: new Date(o.time).toISOString(),
      updatedAt: new Date(o.updateTime).toISOString(),
    }));
  }

  // ==========================================================================
  // Market Data
  // ==========================================================================

  async getSymbols(): Promise<Symbol[]> {
    const response = await fetch(`${this.baseUrl}/api/v3/exchangeInfo`);
    const data = await response.json() as {
      symbols: Array<{
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
        status: string;
        filters: Array<{
          filterType: string;
          minQty?: string;
          maxQty?: string;
          stepSize?: string;
          minNotional?: string;
        }>;
        quotePrecision: number;
        baseAssetPrecision: number;
        isMarginTradingAllowed: boolean;
      }>;
    };

    return data.symbols.map((s) => {
      const lotSize = s.filters.find((f) => f.filterType === 'LOT_SIZE');
      const minNotional = s.filters.find((f) => f.filterType === 'MIN_NOTIONAL');

      return {
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        status: s.status === 'TRADING' ? 'trading' : 'halted',
        minQuantity: parseFloat(lotSize?.minQty || '0'),
        maxQuantity: parseFloat(lotSize?.maxQty || '0'),
        stepSize: parseFloat(lotSize?.stepSize || '0'),
        minNotional: parseFloat(minNotional?.minNotional || '0'),
        pricePrecision: s.quotePrecision,
        quantityPrecision: s.baseAssetPrecision,
        isMarginTradingAllowed: s.isMarginTradingAllowed,
      };
    });
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const response = await fetch(`${this.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`);
    const data = await response.json() as {
      symbol: string;
      lastPrice: string;
      bidPrice: string;
      askPrice: string;
      highPrice: string;
      lowPrice: string;
      volume: string;
      priceChange: string;
      priceChangePercent: string;
      closeTime: number;
    };

    return {
      symbol: data.symbol,
      lastPrice: parseFloat(data.lastPrice),
      bidPrice: parseFloat(data.bidPrice),
      askPrice: parseFloat(data.askPrice),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume24h: parseFloat(data.volume),
      priceChange24h: parseFloat(data.priceChange),
      priceChangePercent24h: parseFloat(data.priceChangePercent),
      timestamp: new Date(data.closeTime).toISOString(),
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
    const t = brokerTrade as BinanceTrade;
    return {
      id: `binance_${t.id}`,
      brokerId: 'binance',
      brokerOrderId: String(t.orderId),
      symbol: t.symbol,
      side: t.isBuyer ? 'buy' : 'sell',
      type: 'market', // Binance doesn't provide this in trade history
      quantity: parseFloat(t.qty),
      price: parseFloat(t.price),
      filledQuantity: parseFloat(t.qty),
      avgFillPrice: parseFloat(t.price),
      status: 'filled',
      fee: parseFloat(t.commission),
      feeCurrency: t.commissionAsset,
      createdAt: new Date(t.time).toISOString(),
      updatedAt: new Date(t.time).toISOString(),
      raw: t as unknown as Record<string, unknown>,
    };
  }

  mapPosition(brokerPosition: unknown): Position {
    const p = brokerPosition as BinanceFuturesPosition;
    const positionAmt = parseFloat(p.positionAmt);

    return {
      id: `binance_${p.symbol}_${p.positionSide}`,
      symbol: p.symbol,
      side: positionAmt >= 0 ? 'long' : 'short',
      quantity: Math.abs(positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      currentPrice: parseFloat(p.markPrice),
      unrealizedPnL: parseFloat(p.unRealizedProfit),
      realizedPnL: 0,
      leverage: parseInt(p.leverage),
      liquidationPrice: parseFloat(p.liquidationPrice),
      marginType: p.marginType.toLowerCase() as 'cross' | 'isolated',
      createdAt: new Date(p.updateTime).toISOString(),
      updatedAt: new Date(p.updateTime).toISOString(),
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private sign(queryString: string, secret: string): string {
    return createHmac('sha256', secret).update(queryString).digest('hex');
  }

  private async signedRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.credentials) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const timestamp = Date.now();
    const allParams = { ...params, timestamp: String(timestamp) };
    const queryString = new URLSearchParams(allParams).toString();
    const signature = this.sign(queryString, this.credentials.apiSecret);

    const response = await fetch(
      `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': this.credentials.apiKey,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json() as { msg?: string; code?: number };
      throw new BrokerError(
        error.msg || 'Request failed',
        BrokerErrorCodes.UNKNOWN_ERROR,
        String(error.code)
      );
    }

    return response.json() as T;
  }

  private async signedFuturesRequest<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    if (!this.credentials) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const timestamp = Date.now();
    const allParams = { ...params, timestamp: String(timestamp) };
    const queryString = new URLSearchParams(allParams).toString();
    const signature = this.sign(queryString, this.credentials.apiSecret);

    const response = await fetch(
      `${this.futuresUrl}${endpoint}?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': this.credentials.apiKey,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json() as { msg?: string; code?: number };
      throw new BrokerError(
        error.msg || 'Request failed',
        BrokerErrorCodes.UNKNOWN_ERROR,
        String(error.code)
      );
    }

    return response.json() as T;
  }

  private mapPermissions(
    permissions: string[],
    accountInfo: BinanceAccountInfo
  ): ('read' | 'trade' | 'withdraw' | 'margin' | 'futures')[] {
    const mapped: ('read' | 'trade' | 'withdraw' | 'margin' | 'futures')[] = ['read'];

    if (accountInfo.canTrade) mapped.push('trade');
    if (accountInfo.canWithdraw) mapped.push('withdraw');
    if (permissions.includes('MARGIN')) mapped.push('margin');
    if (permissions.includes('FUTURES')) mapped.push('futures');

    return mapped;
  }

  private mapOrderStatus(
    status: string
  ): 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired' {
    const statusMap: Record<string, 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired'> = {
      NEW: 'open',
      PARTIALLY_FILLED: 'partially_filled',
      FILLED: 'filled',
      CANCELED: 'cancelled',
      PENDING_CANCEL: 'pending',
      REJECTED: 'rejected',
      EXPIRED: 'expired',
    };
    return statusMap[status] || 'pending';
  }
}
