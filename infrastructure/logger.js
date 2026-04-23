import winston from 'winston';
import fs from 'fs';
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
/**
 * Sanitizes potentially sensitive data from log payloads recursively.
 * Implements granular circular reference detection and depth limiting.
 */
export const sanitizeData = (data, stack = new Set(), depth = 0) => {
  // Guard against extreme recursion depth or non-object types
  if (!data || typeof data !== 'object' || depth > 10) return data;

  // Handle Circular References (Ancestor detection)
  if (stack.has(data)) return '[Circular]';
  stack.add(data);

  const sensitiveKeys = ['authorization', 'password', 'token', 'secret', 'cookie', 'apikey'];

  // Handle Arrays
  if (Array.isArray(data)) {
    const result = data.map((item) => sanitizeData(item, stack, depth + 1));
    stack.delete(data);
    return result;
  }

  // Handle Error Objects specifically to capture non-enumerable properties
  const base = data instanceof Error ? {
    message: data.message,
    stack: data.stack,
    ...data
  } : { ...data };

  const sanitized = {};
  Object.keys(base).forEach((key) => {
    const value = base[key];
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value, stack, depth + 1);
    } else {
      sanitized[key] = value;
    }
  });

  stack.delete(data);
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
 * Includes a safety timeout to prevent zombie processes if streams are blocked.
 */
export const flushLogs = () => {
  const finishPromise = new Promise((resolve) => {
    // If the logger is already closed, resolve immediately
    if (logger.transports.every(t => t._writableState && t._writableState.ended)) {
      return resolve();
    }
    logger.on('finish', resolve);
    logger.end();
  });

  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));

  return Promise.race([finishPromise, timeoutPromise]);
};

/**
 * Panic log function as a last-resort for fatal crashes.
 * Uses synchronous fs.writeSync to FD 1 (stdout) to guarantee output
 * even if the event loop or Winston is compromised.
 */
export const panic = (message, err) => {
  const fatalLog = {
    level: 'fatal',
    message: `PANIC: ${message}`,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    timestamp: new Date().toISOString()
  };
  try {
    fs.writeSync(1, `${JSON.stringify(fatalLog)}\n`);
  } catch (writeErr) {
    console.error('Even PANIC logging failed:', writeErr);
  }
};

export default customLogger;
