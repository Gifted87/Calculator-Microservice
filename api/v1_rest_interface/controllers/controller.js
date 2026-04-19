/**
 * @file controller.js
 * @description Controller orchestration layer for the Calculator microservice.
 * Maps validated API requests to the arithmetic engine, handles error translation,
 * observability, and BigInt serialization.
 */

import * as mathEngine from '../../../core/calculator.js';
import logger from '../../../infrastructure/logger.js';
import { performance } from 'perf_hooks';

/**
 * Maps domain-specific errors to HTTP status codes.
 * 
 * @param {string} errorType - The error type returned by the math engine.
 * @returns {number} - The corresponding HTTP status code.
 */
const getHttpStatusCode = (errorType) => {
  switch (errorType) {
    case 'DIVISION_BY_ZERO':
    case 'INVALID_INPUT':
    case 'OVERFLOW':
      return 422;
    default:
      return 500;
  }
};

/**
 * Handles incoming calculation requests.
 * 
 * @param {import('express').Request} req - Express request object containing validatedBody.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const calculate = async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || 'n/a';
  const startTime = performance.now();

  try {
    const { operation, operand1, operand2 } = req.validatedBody;
    let resultPayload;

    // Direct invocation mapping to ensure security and prevent dynamic injection
    switch (operation) {
      case 'add':
        resultPayload = await Promise.resolve(mathEngine.add(operand1, operand2));
        break;
      case 'subtract':
        resultPayload = await Promise.resolve(mathEngine.subtract(operand1, operand2));
        break;
      case 'multiply':
        resultPayload = await Promise.resolve(mathEngine.multiply(operand1, operand2));
        break;
      case 'divide':
        resultPayload = await Promise.resolve(mathEngine.divide(operand1, operand2));
        break;
      case 'exponentiation':
        resultPayload = await Promise.resolve(mathEngine.power(operand1, operand2));
        break;
      case 'sqrt':
        resultPayload = await Promise.resolve(mathEngine.sqrt(operand1));
        break;
      case 'modulo':
        resultPayload = await Promise.resolve(mathEngine.modulo(operand1, operand2));
        break;
      default:
        return res.status(400).json({ status: 'error', code: 'INVALID_OPERATION', message: 'Unsupported operation' });
    }

    const duration = performance.now() - startTime;

    if (!resultPayload.success) {
      logger.warn({
        message: 'Calculation failed',
        correlationId,
        operation,
        error: resultPayload.error,
        duration: `${duration.toFixed(3)}ms`
      });

      return res.status(getHttpStatusCode(resultPayload.error)).json({
        status: 'error',
        code: resultPayload.error,
        message: `Calculation error: ${resultPayload.error}`
      });
    }

    // Convert BigInt to string for JSON serialization
    const resultString = resultPayload.result.toString();

    logger.info({
      message: 'Calculation successful',
      correlationId,
      operation,
      duration: `${duration.toFixed(3)}ms`
    });

    return res.status(200).json({
      status: 'success',
      data: {
        operation,
        result: resultString
      }
    });

  } catch (err) {
    const duration = performance.now() - startTime;
    logger.error({
      message: 'Unhandled system exception during calculation',
      correlationId,
      error: err.message,
      stack: err.stack,
      duration: `${duration.toFixed(3)}ms`
    });

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred processing the request'
    });
  }
};
