/**
 * @file error-handler.js
 * @description Centralized Express error handling middleware for the calculator microservice.
 * Provides standardized JSON error responses, sanitizes output, integrates with Winston,
 * and handles edge cases for production stability.
 */

import logger from '../../../infrastructure/logger.js';
import config from '../../../config_and_dependencies/config.js';

/**
 * Standardized Error Handler Middleware.
 * Captures application errors, logs them appropriately based on severity,
 * and returns a sanitized JSON response to the client.
 *
 * @param {Error} err - The error object thrown by the application.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const errorHandler = (err, req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'n/a';
  const isProduction = config.NODE_ENV === 'production';

  // 1. Log the error internally (Async/Non-blocking via Winston)
  // For 500-series errors, log as 'error' level to alert, otherwise log as 'warn'
  const statusCode = err.status || err.statusCode || 500;
  
  if (statusCode >= 500) {
    logger.error({
      message: 'Internal System Error',
      correlationId,
      error: {
        message: err.message,
        stack: err.stack,
      },
      request: {
        path: req.path,
        method: req.method,
        body: req.body,
      },
    });
  } else {
    logger.warn({
      message: 'Client/Business Logic Error',
      correlationId,
      status: statusCode,
      message: err.message,
    });
  }

  // 2. Prepare the response body
  // Sanitize for production: never leak internal stack traces or raw Error object details.
  const responseBody = {
    status: 'error',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: statusCode === 500 && isProduction 
      ? 'An internal server error occurred' 
      : err.message,
    correlationId,
  };

  // Include error details if not in production and available
  if (!isProduction && err.details) {
    responseBody.details = err.details;
  }

  // 3. Handle specific operational scenarios
  // Timeout handling (503/504)
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(504).json({
      status: 'error',
      code: 'GATEWAY_TIMEOUT',
      message: 'The request timed out while processing',
      correlationId,
    });
  }

  // Fallback for response serialization failure
  try {
    res.status(statusCode).json(responseBody);
  } catch (serializationErr) {
    // If res.json fails (e.g. circular reference), send plain text to ensure output
    console.error('Critical failure in error handler serialization:', serializationErr);
    res.status(500).send('{"status": "error", "code": "INTERNAL_SERVER_ERROR"}');
  }
};
