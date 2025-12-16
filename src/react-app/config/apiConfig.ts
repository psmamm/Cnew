/**
 * API Configuration
 * Centralizes all external API endpoints for easier management and security
 */

const BINANCE_API_BASE_URL = import.meta.env.VITE_BINANCE_API_BASE_URL || 'https://api.binance.com';

export const apiConfig = {
  binance: {
    baseUrl: BINANCE_API_BASE_URL,
    endpoints: {
      exchangeInfo: `${BINANCE_API_BASE_URL}/api/v3/exchangeInfo`,
      ticker24hr: `${BINANCE_API_BASE_URL}/api/v3/ticker/24hr`,
      klines: (symbol: string, interval: string, limit: number, endTime?: number) => {
        const params = new URLSearchParams({
          symbol,
          interval,
          limit: limit.toString(),
        });
        if (endTime) {
          params.append('endTime', endTime.toString());
        }
        return `${BINANCE_API_BASE_URL}/api/v3/klines?${params.toString()}`;
      },
    },
  },
} as const;

