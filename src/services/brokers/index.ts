/**
 * Broker Services Module
 *
 * Unified broker/exchange integration layer.
 * Supports both crypto exchanges and traditional brokers.
 */

// Core interface
export { IBroker, BaseBroker } from './IBroker';

// Factory functions
export {
  createBroker,
  connectBroker,
  disconnectBroker,
  disconnectAllBrokers,
  testBrokerConnection,
  getActiveBroker,
  getSupportedBrokers,
  getBrokerMetadata,
  isBrokerSupported,
  getBrokersByCategory,
  getCryptoExchanges,
  getTraditionalBrokers,
  registerBroker,
  unregisterBroker,
} from './BrokerFactory';

// Types
export * from './types';

// Adapters (for direct use if needed)
export { BinanceAdapter } from './adapters/BinanceAdapter';
export { BybitAdapter } from './adapters/BybitAdapter';
export { InteractiveBrokersAdapter } from './adapters/InteractiveBrokersAdapter';
export { TDAmeritradeAdapter } from './adapters/TDAmeritradeAdapter';
