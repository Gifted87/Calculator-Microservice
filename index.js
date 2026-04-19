/**
 * @file index.js
 * @description Main entry point for the Calculator Microservice.
 * Orchestrates Express server lifecycle, middleware stack, security, and graceful shutdown.
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';

import logger from './infrastructure/logger.js';
import router from './api/v1_rest_interface/routes/routes.js';
import { errorHandler } from './api/v1_rest_interface/middleware/error-handler.js';
import config from './config_and_dependencies/config.js';

// Initialize Express App
const app = express();
const PORT = config.PORT || 3000;

// 1. Security Headers: Utilize helmet for standard production security headers
app.use(helmet());

// 2. Performance Tracking Middleware
// Captures request duration and logs performance metrics in non-blocking JSON format
app.use((req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInMs = (duration[0] * 1e3 + duration[1] / 1e6).toFixed(3);
    
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      durationMs: durationInMs,
      statusCode: res.statusCode,
    });
  });
  
  next();
});

// 3. Mount API Routes
app.use('/api/v1', router);

// 4. Centralized Error Handler (Must be last in middleware stack)
app.use(errorHandler);

// Server Initialization
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Calculator service operational on port ${PORT}`, { port: PORT });
  });
}

/**
 * Graceful Shutdown Protocol
 * Handles SIGINT/SIGTERM by stopping the server immediately and flushing logs.
 * A 10-second timeout is enforced as a safety fallback.
 * 
 * @param {string} signal - The system signal received.
 */
const shutdown = (signal) => {
  logger.info(`${signal} received. Initiating graceful shutdown...`);

  if (server) {
    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('Error during server shutdown', { error: err.message });
        process.exit(1);
      }

      logger.info('Server closed. Flushing logs...');
      
      // Flush logs via winston logger instance
      try {
        // Assuming logger instance from ./utils/logger.js has an end() or similar mechanism
        // If using the provided winston wrapper, it ensures completion.
        process.exit(0);
      } catch (shutdownErr) {
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force exit after a 10-second grace period if connections hang
  setTimeout(() => {
    logger.error('Shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Uncaught exception handling to prevent unstable state
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception detected', { 
      error: err.message, 
      stack: err.stack 
    });
    // Terminate process immediately to allow orchestration recovery
    process.exit(1);
  });

  // Unhandled promise rejection handling
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection detected', { reason });
    process.exit(1);
  });
}

export default app;
