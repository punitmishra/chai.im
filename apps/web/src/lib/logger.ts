/**
 * Centralized logger utility.
 * Respects environment (dev/prod) for appropriate logging.
 */

import { isDevelopment } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: Date;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Only show debug logs in development
const MIN_LOG_LEVEL: LogLevel = isDevelopment ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatMessage(prefix: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${prefix}] ${message}`;
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (shouldLog('debug')) {
      if (data !== undefined) {
        console.debug(formatMessage('DEBUG', message), data);
      } else {
        console.debug(formatMessage('DEBUG', message));
      }
    }
  },

  info(message: string, data?: unknown): void {
    if (shouldLog('info')) {
      if (data !== undefined) {
        console.info(formatMessage('INFO', message), data);
      } else {
        console.info(formatMessage('INFO', message));
      }
    }
  },

  warn(message: string, data?: unknown): void {
    if (shouldLog('warn')) {
      if (data !== undefined) {
        console.warn(formatMessage('WARN', message), data);
      } else {
        console.warn(formatMessage('WARN', message));
      }
    }
  },

  error(message: string, error?: unknown): void {
    if (shouldLog('error')) {
      if (error !== undefined) {
        console.error(formatMessage('ERROR', message), error);
      } else {
        console.error(formatMessage('ERROR', message));
      }
    }
  },

  // For WebSocket-specific logging
  ws: {
    connected(): void {
      logger.info('WebSocket connected');
    },

    disconnected(): void {
      logger.info('WebSocket disconnected');
    },

    error(error: unknown): void {
      logger.error('WebSocket error', error);
    },

    messageSent(type: string): void {
      logger.debug(`WebSocket message sent: ${type}`);
    },

    messageReceived(type: string): void {
      logger.debug(`WebSocket message received: ${type}`);
    },

    sessionInitialized(userId: string): void {
      logger.debug(`Session initialized with user: ${userId}`);
    },

    sessionRestored(userId: string): void {
      logger.debug(`Session restored for: ${userId}`);
    },

    sessionRestoreFailed(userId: string, error: unknown): void {
      logger.warn(`Failed to restore session for ${userId}`, error);
    },
  },

  // For crypto-specific logging
  crypto: {
    identityCreated(): void {
      logger.info('New identity created');
    },

    identityRestored(): void {
      logger.debug('Identity restored from storage');
    },

    identityRestoreFailed(error: unknown): void {
      logger.warn('Failed to restore identity', error);
    },

    encryptionFailed(error: unknown): void {
      logger.error('Encryption failed', error);
    },

    decryptionFailed(error: unknown): void {
      logger.error('Decryption failed', error);
    },

    sessionSaved(peerId: string): void {
      logger.debug(`Session saved for: ${peerId}`);
    },

    sessionSaveFailed(error: unknown): void {
      logger.warn('Failed to save session', error);
    },
  },
};

export default logger;
