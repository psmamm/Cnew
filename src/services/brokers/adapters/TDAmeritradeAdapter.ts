/**
 * TD Ameritrade / Schwab Adapter
 *
 * Implementation of IBroker for TD Ameritrade.
 * Note: TD Ameritrade has merged with Charles Schwab.
 * Uses OAuth2 for authentication.
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
  OAuthConfig,
} from '../types';

// ============================================================================
// TDA API Types
// ============================================================================

interface TDAAccount {
  securitiesAccount: {
    type: string;
    accountId: string;
    roundTrips: number;
    isDayTrader: boolean;
    isClosingOnlyRestricted: boolean;
    positions?: TDAPosition[];
    orderStrategies?: TDAOrder[];
    initialBalances: TDABalances;
    currentBalances: TDABalances;
    projectedBalances: TDABalances;
  };
}

interface TDABalances {
  accountValue: number;
  cashBalance: number;
  cashAvailableForTrading: number;
  cashAvailableForWithdrawal: number;
  liquidationValue: number;
  longOptionMarketValue: number;
  shortOptionMarketValue: number;
  longStockValue: number;
  shortStockValue: number;
  longMarginValue: number;
  shortMarginValue: number;
  marginBalance: number;
  equity: number;
  moneyMarketFund: number;
  savings: number;
  bondValue: number;
  pendingDeposits: number;
  availableFunds: number;
  buyingPower: number;
  dayTradingBuyingPower: number;
  dayTradingBuyingPowerCall: number;
  maintenanceCall: number;
  maintenanceRequirement: number;
  margin: number;
  marginEquity: number;
  mutualFundValue: number;
  regTCall: number;
  shortBalance: number;
  unsettledCash: number;
}

interface TDAPosition {
  shortQuantity: number;
  averagePrice: number;
  currentDayProfitLoss: number;
  currentDayProfitLossPercentage: number;
  longQuantity: number;
  settledLongQuantity: number;
  settledShortQuantity: number;
  instrument: {
    assetType: string;
    cusip: string;
    symbol: string;
    description: string;
  };
  marketValue: number;
  maintenanceRequirement: number;
  currentDayCost: number;
  previousSessionLongQuantity: number;
}

interface TDAOrder {
  session: string;
  duration: string;
  orderType: string;
  complexOrderStrategyType: string;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  requestedDestination: string;
  destinationLinkName: string;
  price?: number;
  stopPrice?: number;
  orderLegCollection: Array<{
    orderLegType: string;
    legId: number;
    instrument: {
      assetType: string;
      cusip: string;
      symbol: string;
    };
    instruction: string;
    positionEffect: string;
    quantity: number;
  }>;
  orderStrategyType: string;
  orderId: number;
  cancelable: boolean;
  editable: boolean;
  status: string;
  enteredTime: string;
  closeTime?: string;
  tag: string;
  accountId: number;
}

interface TDATransaction {
  type: string;
  clearingReferenceNumber: string;
  subAccount: string;
  settlementDate: string;
  orderId: string;
  netAmount: number;
  transactionDate: string;
  transactionSubType: string;
  transactionId: number;
  cashBalanceEffectFlag: boolean;
  description: string;
  fees: Record<string, number>;
  transactionItem: {
    accountId: number;
    amount: number;
    price: number;
    cost: number;
    instruction: string;
    instrument: {
      assetType: string;
      cusip: string;
      symbol: string;
    };
  };
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class TDAmeritradeAdapter extends BaseBroker {
  readonly metadata: BrokerMetadata = {
    id: 'td_ameritrade',
    name: 'td_ameritrade',
    displayName: 'TD Ameritrade',
    logo: '/brokers/tda.svg',
    category: 'stocks',
    connectionType: 'oauth',
    features: ['spot', 'margin', 'options'],
    supportedAssetTypes: ['stock', 'etf', 'option'],
    apiDocsUrl: 'https://developer.tdameritrade.com/apis',
    websiteUrl: 'https://www.tdameritrade.com',
    supportsTestnet: false,
    supportsOAuth: true,
    rateLimits: {
      requestsPerMinute: 120,
      ordersPerSecond: 2,
    },
  };

  private baseUrl = 'https://api.tdameritrade.com/v1';
  private accountId: string | null = null;

  static readonly oauthConfig: OAuthConfig = {
    clientId: '', // Set from environment
    clientSecret: '',
    redirectUri: '',
    scopes: ['PlaceTrades', 'AccountAccess', 'MoveMoney'],
    authorizationUrl: 'https://auth.tdameritrade.com/auth',
    tokenUrl: 'https://api.tdameritrade.com/v1/oauth2/token',
  };

  // ==========================================================================
  // Connection
  // ==========================================================================

  async connect(credentials: BrokerCredentials): Promise<void> {
    if (!credentials.accessToken) {
      throw new BrokerError(
        'TD Ameritrade requires OAuth authentication',
        BrokerErrorCodes.INVALID_CREDENTIALS
      );
    }

    this.credentials = credentials;

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
    this.accountId = null;
    this.setConnected(false);
  }

  async testConnection(credentials: BrokerCredentials): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Access token expired. Please re-authenticate.',
            errorCode: '401',
          };
        }
        return {
          success: false,
          error: 'Failed to connect to TD Ameritrade',
        };
      }

      const accounts: TDAAccount[] = await response.json();

      if (!accounts?.length) {
        return {
          success: false,
          error: 'No accounts found',
        };
      }

      this.accountId = accounts[0].securitiesAccount.accountId;

      return {
        success: true,
        accountInfo: {
          id: this.accountId,
          name: `TDA ${accounts[0].securitiesAccount.type}`,
          permissions: ['read', 'trade'],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async refreshAuth(): Promise<BrokerCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new BrokerError(
        'No refresh token available',
        BrokerErrorCodes.INVALID_CREDENTIALS
      );
    }

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: TDAmeritradeAdapter.oauthConfig.clientId,
      }),
    });

    if (!response.ok) {
      throw new BrokerError(
        'Failed to refresh token',
        BrokerErrorCodes.INVALID_CREDENTIALS
      );
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    this.credentials = {
      ...this.credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };

    return this.credentials;
  }

  // ==========================================================================
  // Account Information
  // ==========================================================================

  async getAccount(): Promise<BrokerAccount> {
    if (!this.accountId) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const account = await this.authenticatedRequest<TDAAccount>(
      `/accounts/${this.accountId}?fields=positions,orders`
    );

    const balances = account.securitiesAccount.currentBalances;

    return {
      id: account.securitiesAccount.accountId,
      name: `TD Ameritrade ${account.securitiesAccount.type}`,
      type: 'live',
      currency: 'USD',
      balance: balances.accountValue,
      availableBalance: balances.availableFunds,
      marginUsed: balances.maintenanceRequirement,
      marginAvailable: balances.buyingPower,
      permissions: ['read', 'trade', 'margin'],
    };
  }

  async getAccounts(): Promise<BrokerAccount[]> {
    const accounts = await this.authenticatedRequest<TDAAccount[]>('/accounts');

    return accounts.map((acc) => ({
      id: acc.securitiesAccount.accountId,
      name: `TDA ${acc.securitiesAccount.type}`,
      type: 'live' as const,
      currency: 'USD',
      balance: acc.securitiesAccount.currentBalances.accountValue,
      availableBalance: acc.securitiesAccount.currentBalances.availableFunds,
      permissions: ['read', 'trade'] as ('read' | 'trade')[],
    }));
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.accountId) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const account = await this.authenticatedRequest<TDAAccount>(
      `/accounts/${this.accountId}`
    );

    const balances = account.securitiesAccount.currentBalances;

    return [
      {
        asset: 'USD',
        free: balances.cashAvailableForTrading,
        locked: balances.cashBalance - balances.cashAvailableForTrading,
        total: balances.cashBalance,
        usdValue: balances.cashBalance,
      },
    ];
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
    if (!this.accountId) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const params = new URLSearchParams({
      type: 'TRADE',
    });

    if (options?.symbol) params.append('symbol', options.symbol);
    if (options?.startTime) params.append('startDate', options.startTime);
    if (options?.endTime) params.append('endDate', options.endTime);

    const transactions = await this.authenticatedRequest<TDATransaction[]>(
      `/accounts/${this.accountId}/transactions?${params.toString()}`
    );

    return (transactions || [])
      .filter((t) => t.type === 'TRADE')
      .slice(0, options?.limit || 100)
      .map((t) => this.mapTrade(t));
  }

  // ==========================================================================
  // Positions
  // ==========================================================================

  async getPositions(): Promise<Position[]> {
    if (!this.accountId) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const account = await this.authenticatedRequest<TDAAccount>(
      `/accounts/${this.accountId}?fields=positions`
    );

    return (account.securitiesAccount.positions || [])
      .filter((p) => p.longQuantity !== 0 || p.shortQuantity !== 0)
      .map((p) => this.mapPosition(p));
  }

  // ==========================================================================
  // Orders
  // ==========================================================================

  async getOpenOrders(): Promise<Order[]> {
    if (!this.accountId) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const orders = await this.authenticatedRequest<TDAOrder[]>(
      `/accounts/${this.accountId}/orders`
    );

    return (orders || [])
      .filter((o) => ['QUEUED', 'WORKING', 'PENDING_ACTIVATION'].includes(o.status))
      .map((o) => this.mapOrder(o));
  }

  // ==========================================================================
  // Market Data
  // ==========================================================================

  async getSymbols(): Promise<Symbol[]> {
    // TDA doesn't have a full symbol list endpoint
    // Symbols are searched via /instruments
    return [];
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const response = await fetch(
      `${this.baseUrl}/marketdata/${encodeURIComponent(symbol)}/quotes`,
      {
        headers: {
          Authorization: `Bearer ${this.credentials?.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new BrokerError(
        `Failed to get ticker for ${symbol}`,
        BrokerErrorCodes.INVALID_SYMBOL
      );
    }

    const data = await response.json() as Record<string, {
      symbol: string;
      lastPrice: number;
      bidPrice: number;
      askPrice: number;
      highPrice: number;
      lowPrice: number;
      totalVolume: number;
      netChange: number;
      netPercentChangeInDouble: number;
      quoteTimeInLong: number;
    }>;

    const quote = data[symbol];

    return {
      symbol: quote.symbol,
      lastPrice: quote.lastPrice,
      bidPrice: quote.bidPrice,
      askPrice: quote.askPrice,
      high24h: quote.highPrice,
      low24h: quote.lowPrice,
      volume24h: quote.totalVolume,
      priceChange24h: quote.netChange,
      priceChangePercent24h: quote.netPercentChangeInDouble,
      timestamp: new Date(quote.quoteTimeInLong).toISOString(),
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
    const t = brokerTrade as TDATransaction;
    const item = t.transactionItem;
    const totalFees = Object.values(t.fees).reduce((sum, fee) => sum + fee, 0);

    return {
      id: `tda_${t.transactionId}`,
      brokerId: 'td_ameritrade',
      brokerOrderId: t.orderId,
      symbol: item.instrument.symbol,
      side: item.instruction.toLowerCase().includes('buy') ? 'buy' : 'sell',
      type: 'market',
      quantity: Math.abs(item.amount),
      price: item.price,
      filledQuantity: Math.abs(item.amount),
      avgFillPrice: item.price,
      status: 'filled',
      fee: totalFees,
      feeCurrency: 'USD',
      createdAt: new Date(t.transactionDate).toISOString(),
      updatedAt: new Date(t.settlementDate).toISOString(),
      raw: t as unknown as Record<string, unknown>,
    };
  }

  mapPosition(brokerPosition: unknown): Position {
    const p = brokerPosition as TDAPosition;
    const quantity = p.longQuantity || p.shortQuantity;
    const side = p.longQuantity > 0 ? 'long' : 'short';

    return {
      id: `tda_${p.instrument.symbol}`,
      symbol: p.instrument.symbol,
      side,
      quantity: Math.abs(quantity),
      entryPrice: p.averagePrice,
      currentPrice: p.marketValue / Math.abs(quantity),
      unrealizedPnL: p.currentDayProfitLoss,
      realizedPnL: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private mapOrder(o: TDAOrder): Order {
    const leg = o.orderLegCollection[0];
    return {
      id: String(o.orderId),
      symbol: leg.instrument.symbol,
      side: leg.instruction.toLowerCase() as 'buy' | 'sell',
      type: this.mapOrderType(o.orderType),
      quantity: o.quantity,
      price: o.price,
      stopPrice: o.stopPrice,
      timeInForce: this.mapTimeInForce(o.duration),
      status: this.mapOrderStatus(o.status),
      filledQuantity: o.filledQuantity,
      createdAt: new Date(o.enteredTime).toISOString(),
      updatedAt: new Date(o.closeTime || o.enteredTime).toISOString(),
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async authenticatedRequest<T>(endpoint: string): Promise<T> {
    if (!this.credentials?.accessToken) {
      throw new BrokerError('Not connected', BrokerErrorCodes.INVALID_CREDENTIALS);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
      },
    });

    if (response.status === 401) {
      // Try to refresh token
      await this.refreshAuth();
      return this.authenticatedRequest(endpoint);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string };
      throw new BrokerError(
        error.error || `Request failed with status ${response.status}`,
        BrokerErrorCodes.UNKNOWN_ERROR,
        String(response.status)
      );
    }

    return response.json() as T;
  }

  private mapOrderType(orderType: string): 'market' | 'limit' | 'stop' | 'stop_limit' {
    const typeMap: Record<string, 'market' | 'limit' | 'stop' | 'stop_limit'> = {
      MARKET: 'market',
      LIMIT: 'limit',
      STOP: 'stop',
      STOP_LIMIT: 'stop_limit',
    };
    return typeMap[orderType] || 'market';
  }

  private mapTimeInForce(duration: string): 'GTC' | 'IOC' | 'FOK' | 'GTD' {
    const tifMap: Record<string, 'GTC' | 'IOC' | 'FOK' | 'GTD'> = {
      DAY: 'GTC',
      GOOD_TILL_CANCEL: 'GTC',
      FILL_OR_KILL: 'FOK',
    };
    return tifMap[duration] || 'GTC';
  }

  private mapOrderStatus(
    status: string
  ): 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired' {
    const statusMap: Record<string, 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired'> = {
      AWAITING_PARENT_ORDER: 'pending',
      AWAITING_CONDITION: 'pending',
      AWAITING_MANUAL_REVIEW: 'pending',
      ACCEPTED: 'pending',
      PENDING_ACTIVATION: 'pending',
      QUEUED: 'open',
      WORKING: 'open',
      FILLED: 'filled',
      CANCELED: 'cancelled',
      REJECTED: 'rejected',
      EXPIRED: 'expired',
    };
    return statusMap[status] || 'pending';
  }
}
