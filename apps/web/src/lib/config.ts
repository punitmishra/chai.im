/**
 * Shared application configuration.
 * Centralizes environment variables and constants.
 */

// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws';

// Application Constants
export const PERSISTED_MESSAGE_LIMIT = 500;
export const PING_INTERVAL_MS = 30000;
export const LOW_PREKEY_THRESHOLD = 10;
export const PREKEY_REPLENISH_COUNT = 20;

// Reconnection delays in milliseconds
export const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000] as const;

// IndexedDB Configuration
export const DB_NAME = 'chai-crypto';
export const STORE_NAME = 'keys';
export const DB_VERSION = 1;

// Environment helpers
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
