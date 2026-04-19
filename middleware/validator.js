/**
 * @file validator.js
 * @description Security middleware for request body validation and sanitization.
 * Enforces strict Joi schemas for calculator operations, preventing prototype pollution,
 * and normalizing numerical inputs to BigInt.
 */

import Joi from 'joi';
import logger from '../infrastructure/logger.js';

/**
 * Validates that a string can be safely represented as a BigInt.
 * @param {string|number} value - The input value to check.
 * @returns {bigint} - The converted BigInt.
 * @throws {Error} - If value cannot be converted to BigInt.
 */
const bigIntValidator = (value, helpers) => {
  try {
    return BigInt(value);
  } catch (err) {
    return helpers.error('any.invalid');
  }
};

/**
 * Strict validation schema for the /calculate endpoint.
 * - Restricts keys to allowed operation parameters.
 * - Validates numerical strings as BigInt.
 * - Prevents prototype pollution by strict key enforcement.
 */
const schema = Joi.object({
  operation: Joi.string()
    .valid('add', 'subtract', 'multiply', 'divide', 'exponentiation', 'sqrt', 'modulo')
    .required(),
  operand1: Joi.alternatives()
    .try(Joi.string().regex(/^-?\d+$/), Joi.number().integer())
    .custom(bigIntValidator)
    .required(),
  operand2: Joi.alternatives()
    .try(Joi.string().regex(/^-?\d+$/), Joi.number().integer())
    .custom(bigIntValidator)
    .optional(),
}).unknown(false);

/**
 * Middleware to validate incoming request bodies.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {Promise<void>}
 */
export const validateCalculateRequest = async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'n/a';

  try {
    // 1. Check for Prototype Pollution attempts
    const bodyKeys = Object.keys(req.body);
    const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];
    if (bodyKeys.some((key) => forbiddenKeys.includes(key))) {
      throw new Error('Forbidden property access detected');
    }

    // 2. Perform Schema Validation
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path[0],
        message: d.message,
      }));

      logger.warn({
        message: 'Validation failed',
        correlationId,
        details,
      });

      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details,
      });
    }

    // 3. Normalize values and attach to req for downstream use
    req.validatedBody = {
      operation: value.operation,
      operand1: value.operand1,
      operand2: value.operand2,
    };

    next();
  } catch (err) {
    logger.error({
      message: 'Critical validation error',
      correlationId,
      error: err.message,
    });

    res.status(400).json({
      status: 'error',
      code: 'INVALID_INPUT',
      message: 'Malformed input',
    });
  }
};
