/**
 * @file index.js
 * @description Main entry point for the Calculator Microservice.
 * Orchestrates Express server lifecycle, middleware stack, security, and graceful shutdown.
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import promClient from 'prom-client';

import logger, { flushLogs, panic } from './infrastructure/logger.js';
import router from './api/v1_rest_interface/routes/routes.js';
import { errorHandler } from './api/v1_rest_interface/middleware/error-handler.js';
import config from './config_and_dependencies/config.js';

// Initialize Express App
const app = express();
const PORT = config.PORT || 3000;

// 0. Prometheus Metrics Configuration
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

// 1. Security & Lifecycle Middleware
app.use(helmet());
app.use(cors()); // Enable CORS for browser-based clients

// 2. Load Balancing & Performance
// Rate-limiting is intentionally omitted at the application layer to avoid
// state fragmentation in K8s (siloed pods). Implement at the Ingress/Gateway level.
app.use(cors()); // Enable CORS for browser-based clients
// Captures request duration and logs performance metrics in non-blocking JSON format
app.use((req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    const durationInMs = parseFloat((durationInSeconds * 1000).toFixed(3));
    
    // 1. Log to Winston
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      durationMs: durationInMs,
      statusCode: res.statusCode,
    });

    // 2. Record to Prometheus
    httpRequestDuration
      .labels(req.method, req.route ? req.route.path : req.path, res.statusCode)
      .observe(durationInSeconds);
  });
  
  next();
});

// 4. Metrics Exposure (Internal Only - Port 9090)
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

let metricsServer;
if (process.env.NODE_ENV !== 'test') {
  metricsServer = metricsApp.listen(9090, () => {
    logger.info('Internal metrics operational on port 9090', { port: 9090 });
  });
}

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
 */
const shutdown = (signal) => {
  logger.info(`${signal} received. Initiating graceful shutdown...`);

  // Force exit after a 10-second grace period if connections hang
  const forceExit = setTimeout(() => {
    console.error('Shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000);

  const cleanup = async () => {
    try {
      logger.info('Flushing logs...');
      await flushLogs();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      console.error('Error during log flush', err);
      process.exit(1);
    }
  };

  if (server) {
    // 1. Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('Error during server shutdown', err);
        process.exit(1);
      }
      logger.info('Server closed.');
      cleanup();
    });

    // 2. Proactively terminate keep-alive connections
    if (metricsServer) metricsServer.close();

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    if (typeof server.closeAllConnections === 'function') {
      // Small delay to allow headers/small-payloads to finish naturally
      // before a hard termination of all sockets.
      setTimeout(() => server.closeAllConnections(), 2000);
    }
  } else {
    cleanup();
  }
};

// Listen for termination signals
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Uncaught exception handling to prevent unstable state
  process.on('uncaughtException', async (err) => {
    panic('Uncaught Exception', err);
    await flushLogs();
    process.exit(1);
  });

  // Unhandled promise rejection handling
  process.on('unhandledRejection', async (reason) => {
    panic('Unhandled Promise Rejection', reason);
    await flushLogs();
    process.exit(1);
  });
}

export { app as default, metricsApp };
