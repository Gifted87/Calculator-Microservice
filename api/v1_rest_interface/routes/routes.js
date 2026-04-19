/**
 * @file routes.js
 * @description RESTful routing interface for the Calculator microservice.
 * Defines the /calculate endpoint with strict validation, correlation ID propagation,
 * and asynchronous controller binding.
 */

import express from 'express';
import { validateCalculateRequest } from '../../../middleware/validator.js';
import { calculate } from '../controllers/controller.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Middleware for Correlation ID instrumentation.
 * Ensures every incoming request has a unique identifier for distributed tracing.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
const correlationMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};

/**
 * @route POST /calculate
 * @description Performs mathematical operations based on the provided payload.
 * 
 * Middleware Sequence:
 * 1. correlationMiddleware: Injects/Propagates correlation ID.
 * 2. express.json(): Parses request body.
 * 3. validateCalculateRequest: Validates payload against Joi schema and strips unknown keys.
 * 4. calculate: Executes the requested math operation via the arithmetic engine.
 */
router.post(
  '/calculate',
  correlationMiddleware,
  express.json({ limit: '10kb' }),
  validateCalculateRequest,
  calculate
);

/**
 * Health check endpoint for container orchestrators.
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
