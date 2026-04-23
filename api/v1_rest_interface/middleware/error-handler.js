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
  const statusCode = err.status || err.statusCode || 500;
  
  if (statusCode >= 500) {
    logger.error('Internal System Error', {
      correlationId,
      error: err,
      request: {
        path: req.path,
        method: req.method,
        body: req.body,
      },
    });
  } else {
    logger.warn('Client/Business Logic Error', {
      correlationId,
      status: statusCode,
      error: err.message,
    });
  }

  // 2. Prepare the response body
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

  // 3. Send response
  try {
    res.status(statusCode).json(responseBody);
  } catch (serializationErr) {
    console.error('Critical failure in error handler serialization:', serializationErr);
    res.status(500).type('json').send('{"status": "error", "code": "INTERNAL_SERVER_ERROR"}');
  }
};
