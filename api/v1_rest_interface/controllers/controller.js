import Piscina from 'piscina';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../../infrastructure/logger.js';
import config from '../../../config_and_dependencies/config.js';
import { performance } from 'perf_hooks';
import * as mathEngine from '../../../core/calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_PATH = path.resolve(__dirname, '../../../infrastructure/math-worker.js');

// Initialize Worker Pool with bound resource limits
const workerPool = new Piscina({
  filename: WORKER_PATH,
  minThreads: config.WORKER_MIN_THREADS,
  maxThreads: config.WORKER_MAX_THREADS,
  idleTimeout: 30000,
  maxQueueSize: 100,
});

/**
 * Executes math operations with a hard timeout using the worker pool.
 */
const executeWithPool = async (task) => {
  try {
    // AbortController for granular timeout control
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.API_TIMEOUT_MS);

    const result = await workerPool.run(task, { signal: controller.signal });
    clearTimeout(timeout);
    return result;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('Task timed out')) {
      throw new Error('COMPUTATION_TIMEOUT');
    }
    throw err;
  }
};

/**
 * Maps domain-specific errors to HTTP status codes.
 */
const getHttpStatusCode = (errorType) => {
  switch (errorType) {
    case 'DIVISION_BY_ZERO':
    case 'INVALID_INPUT':
    case 'OVERFLOW':
    case 'COMPUTATION_TIMEOUT':
      return 422;
    default:
      return 500;
  }
};

/**
 * Handles incoming calculation requests.
 */
export const calculate = async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || 'n/a';
  const startTime = performance.now();

  try {
    const { operation, operand1, operand2 } = req.validatedBody;
    
    // Heuristic: Execute simple/small operations synchronously to avoid IPC overhead.
    // Structural cloning into workers is more expensive than O(1) BigInt addition.
    const isSimpleOp = ['add', 'subtract', 'multiply'].includes(operation);
    
    // Efficient bit-length estimation to avoid O(N^2) toString() overhead
    const getEstimateDigits = (v) => {
      let bits = 0;
      let t = v < 0n ? -v : v;
      while (t > 0n) { t >>= 64n; bits += 64; }
      return bits * 0.301; // log10(2) approx
    };

    const isSmallInput = getEstimateDigits(operand1) < 50 && (!operand2 || getEstimateDigits(operand2) < 50);

    let resultPayload;
    if (isSimpleOp && isSmallInput) {
      resultPayload = mathEngine[operation](operand1, operand2);
    } else {
      // Offload complex tasks to worker pool to prevent resource exhaustion and event-loop blocking
      resultPayload = await executeWithPool({ operation, operand1, operand2 });
    }

    const duration = parseFloat((performance.now() - startTime).toFixed(3));

    if (!resultPayload.success) {
      logger.warn('Calculation failed', {
        correlationId,
        operation,
        error: resultPayload.error,
        durationMs: duration
      });

      return res.status(getHttpStatusCode(resultPayload.error)).json({
        status: 'error',
        code: resultPayload.error,
        message: `Calculation error: ${resultPayload.error}`
      });
    }

    const resultString = resultPayload.result.toString();

    logger.info('Calculation successful', {
      correlationId,
      operation,
      durationMs: duration
    });

    return res.status(200).json({
      status: 'success',
      data: {
        operation,
        result: resultString
      }
    });

  } catch (err) {
    const duration = parseFloat((performance.now() - startTime).toFixed(3));
    const isTimeout = err.message === 'COMPUTATION_TIMEOUT';

    logger.error(isTimeout ? 'Calculation timed out' : 'Unhandled system exception during calculation', {
      correlationId,
      error: err.message,
      stack: err.stack,
      durationMs: duration
    });

    const statusCode = isTimeout ? 408 : 500;
    return res.status(statusCode).json({
      status: 'error',
      code: isTimeout ? 'TIMEOUT_ERROR' : 'INTERNAL_SERVER_ERROR',
      message: isTimeout ? 'The calculation exceeded the allowed time limit' : 'An unexpected error occurred'
    });
  }
};
