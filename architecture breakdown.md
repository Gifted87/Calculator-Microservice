# Architecture Breakdown

## Root Directory

The project consists of the following top-level modules and directories:
- `api`
- `config_and_dependencies`
- `core`
- `infrastructure`
- `middleware`
- `index.js` (Root file)

---

## Module: `index.js` (Root file)
- **Role**: Main entry point for the Calculator Microservice.
- **Responsibility**: Orchestrates Express server lifecycle, middleware stack, security (Helmet), graceful shutdown, and binds routing and centralized error handling.
- **Imports Verified**: Yes (fixed path for logger, router, error-handler, config).
- **Dependencies Installed**: Express, Helmet, Dotenv.
- **Compilation/Run**: Runs without error.

---

## Module: `config_and_dependencies`
Contains application configuration logic.

### Sub-module: `config.js`
- **Role**: Centralized configuration loader.
- **Responsibility**: Validates environment variables (PORT, LOG_LEVEL, NODE_ENV, API_TIMEOUT_MS) using Joi and freezes the configuration object to ensure runtime safety.
- **Imports Verified**: Yes.
- **Dependencies Installed**: Joi, dotenv.
- **Compilation/Run**: Converted to ES module and runs without error.

---

## Module: `infrastructure`
Contains cross-cutting concerns like logging.

### Sub-module: `logger.js`
- **Role**: Structured logging implementation.
- **Responsibility**: Utilizes Winston for high-performance JSON logging. Sanitizes sensitive data from log payloads and handles log flushing during graceful shutdown.
- **Imports Verified**: Yes.
- **Dependencies Installed**: Winston.
- **Compilation/Run**: Converted to ES module and runs without error.

---

## Module: `core`
Contains the domain business logic.

### Sub-module: `calculator.js`
- **Role**: High-precision computational engine.
- **Responsibility**: Performs robust arithmetic (add, subtract, multiply, divide, power, sqrt, modulo) using BigInt to avoid floating-point precision issues. Handles error cases like division by zero or invalid input.
- **Imports Verified**: Yes (No external dependencies).
- **Dependencies Installed**: None required.
- **Compilation/Run**: Valid ES module, runs without error.

---

## Module: `middleware`
Contains core application middleware.

### Sub-module: `validator.js`
- **Role**: Security and validation middleware.
- **Responsibility**: Validates incoming calculation requests against strict Joi schemas. Normalizes numerical inputs to BigInt and prevents prototype pollution.
- **Imports Verified**: Yes (fixed logger import path).
- **Dependencies Installed**: Joi.
- **Compilation/Run**: Valid ES module, runs without error.

---

## Module: `api`
Contains API presentation logic.

### Sub-module: `v1_rest_interface`
API Version 1 REST controllers, routes, and specific middleware.

#### `routes/routes.js`
- **Role**: RESTful routing interface.
- **Responsibility**: Defines the `/calculate` endpoint and `/health` check. Injects correlation IDs and applies request validation before hitting the controller.
- **Imports Verified**: Yes (fixed path for validator).
- **Dependencies Installed**: Express, uuid.
- **Compilation/Run**: Valid ES module, runs without error.

#### `controllers/controller.js`
- **Role**: Controller orchestration layer.
- **Responsibility**: Maps validated API requests to the `core/calculator.js` engine. Measures performance, handles response serialization, and translates domain errors to HTTP status codes.
- **Imports Verified**: Yes (fixed paths for mathEngine and logger).
- **Dependencies Installed**: None specific.
- **Compilation/Run**: Valid ES module, runs without error.

#### `middleware/error-handler.js`
- **Role**: Centralized Express error handler.
- **Responsibility**: Catches unhandled exceptions and business logic errors. Standardizes JSON error responses, sanitizes output for production, and integrates with the structured logger.
- **Imports Verified**: Yes (fixed path for logger and config).
- **Dependencies Installed**: None specific.
- **Compilation/Run**: Valid ES module, runs without error.

#### `index.js`
- **Role**: Secondary entry point for just the API v1 layer, or legacy entry point now subsumed by root `index.js`.
- **Responsibility**: Provides a self-contained Express app specific to the `v1_rest_interface` if one were to mount it as a separate microservice.
- **Imports Verified**: Yes (fixed path for logger and config).
- **Dependencies Installed**: Express, Helmet.
- **Compilation/Run**: Valid ES module, runs without error.

---

### End of Breakdown
The entire project has been researched, all imports corrected, missing dependencies installed (Express, Helmet, Dotenv, Joi, Winston, Uuid), ES module compatibility enforced, and the application compiles and successfully runs without a hitch.
