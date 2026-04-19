# System Specifications Document

## 1. Introduction

This document serves as the comprehensive and exhaustive system specifications for the Calculator Microservice. The objective of this system is to provide a robust, scalable, and highly precise computational engine exposed via a RESTful HTTP API. This document outlines every single module, submodule, architectural decision, and design pattern implemented within the project. 

The application is structured into clearly defined directories designed to promote separation of concerns, maintainability, and extensibility. The core philosophy driving the implementation of this microservice is to deliver highly accurate mathematical operations, completely eliminating the common pitfalls associated with JavaScript floating-point arithmetic by heavily utilizing the `BigInt` data type. Furthermore, the system incorporates enterprise-grade middleware for security, validation, and standardized error handling.

This specification document details the system in logical segments, matching the physical directory structure of the application. It explores the entry points, configuration layers, cross-cutting infrastructure, core domain logic, middleware, and the presentation layer via the API.

## 2. High-Level Architecture Overview

The Calculator Microservice is built on top of the Node.js runtime and utilizes the Express.js framework for HTTP server management and routing. The architecture follows a layered approach, segregating the system into distinct operational domains:

1.  **Application Root**: Contains the primary entry point `index.js`, environment configurations `.env`, dependency manifests `package.json`, and the foundational `architecture breakdown.md`.
2.  **Configuration Layer (`config_and_dependencies`)**: Responsible for environment variable parsing, validation, and exposure of a safely frozen configuration object to the rest of the application.
3.  **Infrastructure Layer (`infrastructure`)**: Handles cross-cutting concerns that are not tied to business logic but are essential for observability and operations, such as structured logging.
4.  **Core Domain Layer (`core`)**: The absolute center of the application where the pure business logic resides. In this system, it houses the precision mathematical engine.
5.  **Middleware Layer (`middleware`)**: intercepts incoming HTTP requests globally to enforce security boundaries and input validation before the request reaches the domain controllers.
6.  **Presentation/API Layer (`api`)**: Defines the external interface of the application, routing REST HTTP requests to the appropriate controllers, handling specific request parsing, and managing HTTP-level error responses.

This architecture ensures that changes in the presentation layer do not affect the core calculation logic, and changes in the infrastructure (like swapping out a logging library) do not require rewriting business logic.

## 3. Directory Structure

The base path of the project contains the following crucial directories and files, discovered via rigorous directory traversal:

- `api/`: Contains all routing, controllers, and API-specific middleware.
- `config_and_dependencies/`: Manages system configurations.
- `core/`: Houses the mathematical engine.
- `infrastructure/`: Contains the structured logging implementation.
- `middleware/`: Houses application-wide middleware like security validation.
- `index.js`: The central orchestration file and entry point for the microservice.
- `.env`: Environment variable definitions.
- `package.json` & `package-lock.json`: Dependency manifests.

---

## 4. Module Specifications: Configuration & Dependencies

### 4.1. Directory Overview: `config_and_dependencies`

This directory serves as the centralized configuration loader and environment boundary for the microservice. In modern distributed systems, configuration must be strictly separated from code and validated at startup to prevent runtime errors due to malformed environments. This directory guarantees that the application starts with a safe, expected, and immutable set of configuration variables.

### 4.2. File: `config.js`

**Responsibility and Design Pattern**
The `config.js` file is responsible for reading environment variables via `dotenv/config` and rigorously validating them before they are ingested by the rest of the application. It employs the **Fail-Fast** design pattern. By throwing a critical error and calling `process.exit(1)` upon validation failure, the application signals orchestration layers (such as Kubernetes or Docker Swarm) that it cannot boot properly. This is vastly superior to silent failures or crashing dynamically at runtime when a missing variable is finally accessed.

**Schema Validation with Joi**
The module utilizes `joi` to declare an explicit schema for the required environment variables:
- **`PORT`**: Validated as an integer strictly between 1024 and 65535. This ensures that the application binds to unprivileged ports, adhering to security best practices.
- **`LOG_LEVEL`**: Enforced as an enumerated string containing only valid Winston logging levels (`debug`, `info`, `warn`, `error`).
- **`NODE_ENV`**: Restricted to known environments (`development`, `staging`, `production`, `test`) to manage runtime behavior safely.
- **`API_TIMEOUT_MS`**: A positive integer crucial for defining latency thresholds and setting boundaries for circuit breakers in the routing layer.

**Immutability Strategy**
Upon successful validation, the configuration values are explicitly cast to their correct data types (e.g., `parseInt(value.PORT, 10)`). Following this data normalization, the final configuration object is sealed using `Object.freeze()`.

The use of `Object.freeze()` is a vital security and stability mechanism. It prevents prototype pollution and stops any rogue module or external dependency from mutating configuration variables dynamically during runtime. The rest of the application imports this immutable `config` object, ensuring that the system state remains consistent throughout the entire process lifecycle.

**Error Handling Flow**
1. The module attempts validation using `schema.validate({ ... }, { abortEarly: false })` to gather all potential configuration errors simultaneously.
2. If errors occur, it logs them explicitly to standard error (`console.error`), providing detailed feedback on exactly which variables failed schema validation.
3. It then throws a synchronous Error.
4. A `try-catch` block catches this top-level initialization error and explicitly triggers `process.exit(1)`.

This highly defensive programming approach ensures that the Calculator Microservice behaves deterministically and remains robust across various deployment environments.

### 4.3. File: `.env.example`

This file serves as a documentation artifact for developers, explicitly outlining the required environment variables needed to boot the application. It acts as a template, guiding operational staff on the configuration contract expected by the `config.js` schema.

---

## 5. Module Specifications: Infrastructure

### 5.1. Directory Overview: `infrastructure`

The `infrastructure` directory houses cross-cutting operational concerns that apply globally across the system. These are modules that do not contain core business logic (such as mathematical algorithms or HTTP routing) but are crucial for the observability, maintainability, and operational stability of the microservice in a production environment. 

### 5.2. File: `logger.js`

**Responsibility and Technology Stack**
The `logger.js` module implements structured, high-performance, asynchronous logging for the application using the `winston` library. The system outputs logs exclusively to `stdout` via a Console transport. This pattern adheres to the Twelve-Factor App methodology, which dictates that applications should treat logs as event streams and delegate log routing/storage to the execution environment (e.g., Docker, Kubernetes, ELK stack).

**Log Formatting and Metadata**
Logs are formatted using `winston.format.json()`, ensuring that all log entries are machine-readable and easily indexable by centralized logging systems. The format pipeline also includes:
- `winston.format.timestamp()`: Injects standardized `YYYY-MM-DD HH:mm:ss` timestamps.
- `winston.format.errors({ stack: true })`: Automatically serializes error stack traces into the JSON payload for comprehensive debugging.
- `defaultMeta`: Automatically appends `{ service: 'calculator-app' }` to every log entry, which is vital for filtering logs in multi-service architectures.
- The `level` is dynamically injected from the centralized `config` object (e.g., `config.LOG_LEVEL`).

**Data Sanitization**
Security is a top priority in this module. The `logger.js` file exports a `sanitizeData` utility function that intercepts all metadata payloads before they are passed to the underlying Winston logger.
- It scans object keys for sensitive terms like `authorization`, `password`, `token`, `secret`, and `cookie`.
- If a match is found (case-insensitively), the value is mutated to `[REDACTED]`.
This proactive redaction prevents accidental logging of Personally Identifiable Information (PII) or security credentials, ensuring compliance with data privacy regulations like GDPR and SOC2.

**Graceful Shutdown and Log Flushing**
In highly concurrent Node.js applications, asynchronous logs can be lost if the process exits abruptly. The module exports a `flushLogs()` Promise that binds to Winston's `finish` event.
Furthermore, the module actively listens to system signals:
- `process.on('SIGINT')`
- `process.on('SIGTERM')`
Upon receiving a termination signal, the logger intercepts the exit sequence, outputs a final log indicating shutdown, awaits the `flushLogs()` promise, and only then executes `process.exit(0)`. This guarantees zero log loss during container scaling down or rolling updates. (Note: It conditionally skips this behavior if `NODE_ENV === 'test'` to prevent hanging unit test runners).

---

## 6. Module Specifications: Core Domain Logic

### 6.1. Directory Overview: `core`

The `core` directory is the heart of the application. Following Domain-Driven Design (DDD) principles, this layer is entirely isolated from external dependencies. It knows nothing about HTTP, Express, routing, or logging. It strictly contains pure business logic. Because it has zero external dependencies, it is highly testable and can be ported to other environments (e.g., CLI tools or WebSocket servers) without modification.

### 6.2. File: `calculator.js`

**Responsibility and Precision Engineering**
The `calculator.js` module serves as the high-precision computational engine of the microservice. In standard JavaScript, numbers are represented as double-precision 64-bit floats (IEEE 754), which notoriously leads to precision loss when dealing with very large integers or precise decimal mathematics (e.g., `9007199254740992 + 1 = 9007199254740992`). 

To entirely eliminate this architectural flaw, the application relies exclusively on the native `BigInt` data type for all internal arithmetic operations. The module intercepts incoming generic values (strings, numbers, or bigints) and safely normalizes them via the internal `toBigInt(value)` utility function.

**Return Type Contract: `CalcResult`**
Instead of throwing exceptions when encountering business logic violations (like division by zero), which can be computationally expensive and difficult to track across call stacks, the engine employs a strict functional return type defined via JSDoc typedefs:
```javascript
/**
 * @typedef {Object} CalcResult
 * @property {boolean} success
 * @property {bigint|null} result
 * @property {'DIVISION_BY_ZERO'|'INVALID_INPUT'|'OVERFLOW'|'COMPUTATION_ERROR'|null} error
 */
```
This pattern (similar to Go's multiple return values or Rust's `Result` enum) forces the consumer of the core module to explicitly handle success and failure branches, making the system vastly more predictable.

**Supported Operations and Algorithmic Design**
1. **Addition (`add`) & Subtraction (`subtract`)**: Direct `BigInt` calculations. Safely rejects un-parseable inputs with an `INVALID_INPUT` error.
2. **Multiplication (`multiply`)**: Safe `BigInt` multiplication.
3. **Division (`divide`)**: Uses truncation-based integer division. Implements a strict mathematical guard against dividing by `ZERO`, returning a `DIVISION_BY_ZERO` error payload rather than crashing the Node process.
4. **Exponentiation (`power`)**: Implements highly optimized *Exponentiation by Squaring* algorithm. This drastically reduces the time complexity of large power calculations from O(n) to O(log n), preventing CPU thread blocking. Rejects negative exponents since `BigInt` does not support fractions.
5. **Square Root (`sqrt`)**: JavaScript's native `Math.sqrt` cannot be used with `BigInt`, and casting to float would lose precision. Therefore, this module implements the *Babylonian Method* (Hero's method) natively using `BigInt` arithmetic. It iteratively converges on the exact integer square root. Rejects negative numbers to avoid complex number calculations.
6. **Modulo (`modulo`)**: Native `BigInt` remainder calculation, again guarded against division by zero.

This core file represents a robust, mathematically sound domain layer designed for stability and absolute precision.

---

## 7. Module Specifications: Middleware

### 7.1. Directory Overview: `middleware`

The `middleware` directory acts as the defensive perimeter for the application. In the Express.js ecosystem, middleware functions have access to the request object (`req`), the response object (`res`), and the next middleware function in the application’s request-response cycle. This layer is responsible for intercepting all incoming traffic, sanitizing it, validating it against strict schemas, and ensuring that the core domain is completely shielded from malformed or malicious HTTP payloads.

### 7.2. File: `validator.js`

**Responsibility and Security Focus**
The `validator.js` file is the primary security checkpoint for the `/calculate` endpoint. Its architecture is explicitly designed to implement a Zero-Trust approach to client input. It handles schema validation, data type normalization, and active threat mitigation (specifically targeting Prototype Pollution).

**Prototype Pollution Prevention**
Before any standard validation occurs, the middleware aggressively scans the incoming request body keys. It explicitly checks for dangerous keys: `__proto__`, `constructor`, and `prototype`. If any of these are detected, it immediately throws a synchronous error, halting execution and responding with a generic `400 Bad Request`. This preemptive strike ensures that deep property injection attacks, which are notoriously dangerous in the JavaScript ecosystem, cannot compromise the Node.js runtime.

**Schema Validation via Joi**
The middleware employs the `joi` library to enforce a strict, immutable schema on the request payload. The schema configuration includes:
- **`operation`**: Must be exactly one of the supported strings (`add`, `subtract`, `multiply`, `divide`, `exponentiation`, `sqrt`, `modulo`).
- **`operand1` & `operand2`**: These are complex fields. Because JSON does not natively support `BigInt`, large numbers are often passed as strings to prevent floating-point rounding by JSON parsers. The schema uses `Joi.alternatives()` to accept either strings matching a strict regex (`/^-?\d+$/` - integers only, no decimals) or native JSON integers.
- **`.unknown(false)`**: Strips and rejects any undocumented properties sent in the payload.

**Custom BigInt Normalization**
A custom Joi extension (`bigIntValidator`) is attached to the operand fields. It securely attempts to cast the validated string or number into a native JavaScript `BigInt` using a try-catch block. If successful, the parsed `BigInt` replaces the original string value.

**State Passing Pattern**
Instead of mutating the original `req.body`, which is an anti-pattern that can cause side-effects in downstream middleware, the validator constructs a highly sanitized object and attaches it to a new property: `req.validatedBody`. The downstream controllers in the presentation layer are strictly instructed to read from `req.validatedBody` rather than `req.body`, guaranteeing they only process safe, validated, and normalized data.

**Structured Error Responses**
If validation fails, the middleware automatically intercepts the Joi error map, restructures it into a standard JSON API error format detailing exactly which fields failed, logs a `warn` entry using the centralized logger (including the `x-correlation-id` for request tracing), and returns a HTTP `400` status code. This prevents standard Express HTML stack traces from leaking to the client.

---

## 8. Module Specifications: Presentation Layer (API)

### 8.1. Directory Overview: `api/v1_rest_interface`

The `api` directory represents the external presentation layer of the microservice. It exposes the underlying domain logic via an HTTP REST interface. The sub-directory `v1_rest_interface` indicates a strict API versioning strategy. Future iterations (e.g., `v2` using GraphQL or gRPC) can be added as adjacent directories without breaking the existing `v1` contract.

### 8.2. File: `routes/routes.js`

**Responsibility and Middleware Chaining**
This file acts as the primary traffic controller for the `v1` API. It utilizes `express.Router()` to define isolated route handlers.
- **Correlation ID Injection**: It implements a `correlationMiddleware` that inspects incoming headers for `x-correlation-id`. If missing, it generates a UUIDv4. This ID is attached to the request, response headers, and all subsequent logs, enabling distributed tracing across microservices.
- **Payload Parsing**: Uses `express.json({ limit: '10kb' })` to parse incoming JSON. The strict `10kb` limit is an intentional security measure to prevent Denial of Service (DoS) via massive payload parsing.
- **Route Definitions**: Exposes `POST /calculate` (the primary business endpoint) and `GET /health` (a liveness probe for Kubernetes/Docker Swarm to verify container health).

### 8.3. File: `controllers/controller.js`

**Responsibility and Domain Orchestration**
The controller bridges the gap between the HTTP transport layer and the pure domain logic (`core/calculator.js`).
- **Performance Profiling**: Utilizes Node's native `perf_hooks` (`performance.now()`) to track the exact millisecond duration of every calculation. This metric is injected into the logger for APM (Application Performance Monitoring) purposes.
- **Direct Invocation Mapping**: To prevent dynamic execution vulnerabilities, the controller uses a strict `switch(operation)` statement to manually map the requested operation to the precise engine function.
- **Error Translation**: Implements `getHttpStatusCode()`. Pure domain errors (like `DIVISION_BY_ZERO` or `INVALID_INPUT`) are cleanly mapped to HTTP `422 Unprocessable Entity` rather than generic `500` or `400` codes, semantically indicating that the payload was syntactically correct but semantically invalid.
- **Serialization**: Because `JSON.stringify` natively throws an error when encountering a `BigInt` (as per the ECMAScript spec), the controller safely calls `.toString()` on the `BigInt` result payload before constructing the JSON response. This ensures astronomical numbers are transmitted safely to clients as strings without float truncation.

### 8.4. File: `middleware/error-handler.js`

**Responsibility and Global Exception Handling**
This module is registered as the final middleware in the Express application stack. It serves as a catch-all for any asynchronous or synchronous exceptions that escape the route handlers.
- **Security Sanitization**: It detects if the application is running in `production` mode (via `config.NODE_ENV`). If so, it actively strips error `.stack` traces and raw error messages from `500` level errors, replacing them with generic text (`"An internal server error occurred"`). This prevents source code layout or database structure leaks.
- **Severity-Based Logging**: Errors are inspected dynamically. `5xx` internal errors trigger a Winston `error` log (which could trigger PagerDuty alerts in a real deployment). `4xx` business logic errors trigger a `warn` log, indicating a client misbehavior rather than a system failure.
- **Serialization Safety**: Wraps the final `res.json()` call in a `try-catch` block. If the error object itself is un-serializable (e.g., due to circular references), it falls back to a hardcoded string response (`res.send()`), guaranteeing that the HTTP connection never hangs indefinitely.

---

## 9. Module Specifications: Application Root Orchestrator

### 9.1. File: `index.js`

**Responsibility and Server Lifecycle**
The `index.js` file located at the base path of the project serves as the ultimate conductor. It instantiates the Express server and binds all modularized components (security headers, routes, error handling, logging) into a single functional pipeline.

- **Security Hardening**: It imports and binds `helmet()`, automatically equipping the Express response with 11 crucial HTTP security headers to prevent Cross-Site Scripting (XSS) and clickjacking.
- **Graceful Shutdown Engineering**: It attaches listeners to `process.on('SIGINT')` and `SIGTERM`. Rather than letting a container orchestrator violently kill active calculation requests, the root script triggers a controlled shutdown sequence. It stops the server from accepting new TCP connections (`server.close()`), waits for existing responses to finish, flushes the Winston asynchronous log buffer, and exits safely. A 10-second `setTimeout` acts as a failsafe to forcefully kill the process if connections hang.
- **Panic Handlers**: Explicit hooks for `uncaughtException` and `unhandledRejection` are registered. Instead of ignoring unhandled promises which can leave Node.js in a memory-leaking zombie state, the system logs the panic via Winston and forcefully executes `process.exit(1)`, trusting the external orchestrator (like Kubernetes) to restart the pod from a clean slate.

---

## 10. Deep Dive: Testing Architecture and Quality Assurance

The testing framework and methodology in the Calculator Microservice are designed to ensure absolute functional correctness, mathematical integrity, and systemic resilience. Instead of relying on a myriad of heavy, external testing frameworks that can slow down continuous integration pipelines, this project utilizes the native `node:test` runner and `node:assert/strict`.

### 10.1. Core Domain Testing (`core.calculator.test.js`)
The unit tests surrounding the core mathematical engine are exhaustive. They validate not just the mathematical accuracy but the deterministic functional return contracts.

- **String and Number Normalization Verification**: The test suite actively injects a combination of strings (`'5'`, `'10'`) and numbers (`5`, `10`). It expects the engine to perfectly normalizes both into native BigInts (`15n`). This confirms that JSON deserialization issues (where big numbers often arrive as strings) are gracefully handled.
- **Fail-Fast Arithmetic Integrity**: Instead of crashing the Node.js V8 runtime engine, operations like division by zero (`divide(10, 0)`) or taking the square root of a negative integer (`sqrt(-1)`) are verified to return precisely structured `CalcResult` objects (e.g., `{ success: false, result: null, error: 'DIVISION_BY_ZERO' }`). The tests assert deeply that the `error` string literal matches the API contract expected by the `controller.js`.
- **Exponentiation Edge Cases**: Exponentiation is tested for negative exponents (`power(2, -3)`), which correctly yields an `INVALID_INPUT` error, preventing the application from attempting fractional Math which is unsupported by the `BigInt` engine. Zero-exponent testing ensures standard mathematical laws apply (`power(5, 0) => 1n`).
- **Integer Truncation Rules**: When testing division (`divide(10, 3)`), the strict test runner ensures the result is precisely `3n`, enforcing that floating-point decimals are completely omitted without causing catastrophic float inaccuracies. The Babylonian Integer Square Root function (`sqrt(26)`) is similarly verified to accurately snap to the closest whole integer (`5n`).

### 10.2. Express API & Integration Testing (`app.test.js` & `controller.test.js`)
At the integration tier, the testing focuses heavily on the HTTP boundary. Using the `supertest` library (a lightweight HTTP abstraction layer), the test suite spins up the Express server dynamically on an ephemeral port.
- **Header Parsing Validation**: Ensures the `x-correlation-id` header is injected appropriately into incoming and outgoing requests.
- **Response Serialization Guarantees**: Asserts that successful calculations serialize BigInts back to standard JSON strings securely (since `BigInt` directly embedded into a raw `JSON.stringify` throws an ECMAScript specification error).
- **Graceful Error Translation**: Confirms that when the mock engine returns a `DIVISION_BY_ZERO`, the HTTP status sent over the wire is explicitly `422 Unprocessable Entity` rather than a blanket `500 Server Error`.

### 10.3. Security & Middleware Testing (`validator.test.js`)
Middleware testing acts as the security audit phase of the codebase. The application leverages `Joi` schema matching to prevent deep-object manipulation.
- **Prototype Pollution Auditing**: Deeply nested testing payloads intentionally attempt to inject `__proto__` or `constructor` objects into the parsed JSON. The unit tests rigorously confirm that the `validator.js` layer drops these requests instantaneously and emits a critical error log before the controller is ever invoked.
- **Input Type Enforcement**: Test cases strictly verify that providing un-parseable JSON types (e.g., arrays or nested objects when a numeric string is expected) correctly halts the request pipeline.

## 11. Security Specifications & Attack Mitigations

Building an enterprise application requires more than just mathematically correct business logic; it requires an active defense strategy against common Web Application exploits (OWASP Top 10). The architecture handles several major vectors.

### 11.1. Injection and Code Execution Resilience
Because the presentation layer utilizes an explicit switch statement mapping (e.g., `switch (operation) { case 'add': ... }`), the application is completely immune to arbitrary code execution or reflective injection attacks. At no point is the user's `operation` string dynamically bound to an object method or function execution (`mathEngine[operation]()` is explicitly avoided to prevent malicious method overriding).

### 11.2. Denial of Service (DoS) and Payload Exhaustion
Denial of service via massive JSON payloads is natively thwarted. The Express framework configuration within `index.js` restricts the incoming JSON body parser to `10kb` (`express.json({ limit: '10kb' })`). An attempt to upload a megabyte of malformed JSON strings to exhaust the V8 garbage collector will be immediately rejected with a `413 Payload Too Large` error at the transport layer.
Furthermore, the use of Exponentiation by Squaring for powers massively reduces CPU cycle consumption, mitigating algorithmic complexity attacks where a user requests massive power iterations which in a naive loop would block the single-threaded Node.js event loop for seconds.

### 11.3. Distributed Tracing & Observability
A robust logging system is intrinsically linked to application security. Without logs, auditing the system post-incident is impossible. 
The application forces a correlation identifier upon every request, tying the entry point (router) through the middleware validation phase, into the controller orchestration, and finally through the error handlers. The Winston-powered `logger.js` formats all this metadata in deterministic JSON, making it readily ingestible by tools like Elasticsearch, Datadog, or Splunk. Most crucially, the logger sanitizes variables, proactively scrubbing `authorization` or `token` strings before they are persisted to standard output.
