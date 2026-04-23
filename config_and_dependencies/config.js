/**
 * @file config.js
 * @description Centralized configuration loader for the microservice.
 * Enforces strict validation of environment variables via Joi to guarantee
 * runtime safety and fail-fast behavior during startup.
 */

import 'dotenv/config';
import Joi from 'joi';

/**
 * Configuration schema definition.
 * 
 * - PORT: Integer between 1024 and 65535, required for service binding.
 * - LOG_LEVEL: Enumerated string, controls verbosity of the application logs.
 * - NODE_ENV: Environment indicator, restricts runtime behavior profiles.
 * - API_TIMEOUT_MS: Positive integer, defines latency thresholds for circuit breakers.
 */
const schema = Joi.object({
  PORT: Joi.number()
    .integer()
    .min(1024)
    .max(65535)
    .required(),
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .required(),
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .required(),
  API_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .required(),
  WORKER_MIN_THREADS: Joi.number()
    .integer()
    .min(1)
    .required(),
  WORKER_MAX_THREADS: Joi.number()
    .integer()
    .min(1)
    .required(),
});

/**
 * Validates environment variables and freezes the resulting configuration object.
 * 
 * @throws {Error} Throws error on validation failure.
 * @returns {Readonly<Object>} The frozen configuration object.
 */
export const validateConfig = () => {
  const { error, value } = schema.validate({
    PORT: process.env.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    API_TIMEOUT_MS: process.env.API_TIMEOUT_MS,
    WORKER_MIN_THREADS: process.env.WORKER_MIN_THREADS,
    WORKER_MAX_THREADS: process.env.WORKER_MAX_THREADS,
  }, { abortEarly: false });

  if (error) {
    console.error('CRITICAL: Configuration Validation Failed.');
    error.details.forEach((detail) => {
      console.error(`- Validation Error: ${detail.message}`);
    });
    throw new Error('CRITICAL: Configuration Validation Failed.');
  }

  // Freeze object to ensure immutability during application lifecycle.
  return Object.freeze({
    PORT: parseInt(value.PORT, 10),
    LOG_LEVEL: value.LOG_LEVEL,
    NODE_ENV: value.NODE_ENV,
    API_TIMEOUT_MS: parseInt(value.API_TIMEOUT_MS, 10),
    WORKER_MIN_THREADS: parseInt(value.WORKER_MIN_THREADS, 10),
    WORKER_MAX_THREADS: parseInt(value.WORKER_MAX_THREADS, 10),
  });
};

/**
 * Finalized, immutable configuration object exported for the application.
 */
let config;
try {
  config = validateConfig();
} catch (e) {
  // Exit with status code 1 to signal orchestration layers (K8s/Docker) to restart.
  process.exit(1);
}

export default config;
