import winston from 'winston';
import config from '../config_and_dependencies/config.js';

/**
 * Logger Configuration for the Calculator Application.
 * Utilizes winston for high-performance, asynchronous JSON logging.
 * Configured for stdout (containerized environments) and supports
 * dynamic log levels via environment variables.
 */

const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'calculator-app' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Sanitizes potentially sensitive data from log payloads.
 * Removes known sensitive keys (e.g., authorization, password).
 */
export const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...data };
  const sensitiveKeys = ['authorization', 'password', 'token', 'secret', 'cookie'];
  
  Object.keys(sanitized).forEach((key) => {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

/**
 * Enhanced logging methods with automated sanitization.
 */
const customLogger = {
  info: (message, meta) => logger.info(message, sanitizeData(meta)),
  error: (message, meta) => logger.error(message, sanitizeData(meta)),
  warn: (message, meta) => logger.warn(message, sanitizeData(meta)),
  debug: (message, meta) => logger.debug(message, sanitizeData(meta)),
};

/**
 * Graceful shutdown handler to ensure all logs are flushed before exit.
 */
export const flushLogs = () => {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
};

process.on('SIGINT', async () => {
  customLogger.info('SIGINT received. Flushing logs...');
  if (process.env.NODE_ENV !== 'test') {
    await flushLogs();
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  customLogger.info('SIGTERM received. Flushing logs...');
  if (process.env.NODE_ENV !== 'test') {
    await flushLogs();
    process.exit(0);
  }
});

export default customLogger;
