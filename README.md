This Repository was fully engineered, compiled and tested by The Genesis Machine from one simple prompt.

# Calculator App System - Official README

## Table of Contents
1. [Introduction & Purpose](#1-introduction--purpose)
2. [Architectural Principles](#2-architectural-principles)
3. [Prerequisites & Getting Started](#3-prerequisites--getting-started)
4. [Project Structure Breakdown](#4-project-structure-breakdown)
5. [Configuration Management](#5-configuration-management)
6. [Server Orchestration & Lifecycle](#6-server-orchestration--lifecycle)
7. [Using the REST API](#7-using-the-rest-api)
8. [Testing Strategy](#8-testing-strategy)
9. [Advanced Usage Scenarios](#9-advanced-usage-scenarios)
10. [Operational Guide & Deployment Strategies](#10-operational-guide--deployment-strategies)
11. [Observability, Telemetry, and Monitoring](#11-observability-telemetry-and-monitoring)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Extensibility and Future Roadmap](#13-extensibility-and-future-roadmap)
14. [The Deep Philosophy Behind BigInt Serialization Over Floats](#14-the-deep-philosophy-behind-bigint-serialization-over-floats)
15. [Local Development Workflows](#15-local-development-workflows)

---

## 1. Introduction & Purpose

Welcome to the official repository of the **Calculator App System** microservice. This project is a production-grade, highly resilient computational engine designed to expose mathematical operations over a secure RESTful HTTP API. 

The primary goal of this system is to completely eliminate the common, well-documented pitfalls of JavaScript's standard floating-point arithmetic (IEEE 754 double-precision) when handling massive numbers or strict integer math. By leveraging the native ECMAScript `BigInt` data type, this calculator provides absolute precision for critical operations, ensuring that mathematical overflows and rounding errors are physically impossible within the domain layer.

This README serves as the ultimate source of truth for the repository's configuration, usage, development workflows, and architectural design. It complements the more granular `SPECIFICATIONS.md` document by focusing on developer onboarding, deployment, and practical usage.

---

## 2. Architectural Principles

This microservice was not built as a simple Express.js prototype; it was designed utilizing enterprise software architecture patterns, specifically drawing from **Domain-Driven Design (DDD)** and the **Twelve-Factor App methodology**.

### 2.1. Separation of Concerns
The system is divided into strict layers:
- **Core Domain**: The pure algorithmic math engine. It has zero knowledge of HTTP, JSON, or Express.
- **Presentation Layer (API)**: The HTTP transport layer that serializes responses and manages routing.
- **Middleware Boundary**: A strict Zero-Trust security layer that normalizes and validates all incoming data before it ever touches the controllers.
- **Infrastructure**: Cross-cutting tools like asynchronous JSON logging (via Winston).

### 2.2. Zero-Trust Input Validation
All incoming HTTP payloads are aggressively validated using `Joi`. The system actively prevents prototype pollution attacks and normalizes generic strings into strict `BigInt` types before allowing the controller to process them. Any undocumented properties in the JSON payload are instantly stripped, and malformed requests return sanitized `400 Bad Request` or `422 Unprocessable Entity` errors.

### 2.3. ES Module Exclusivity
The entire repository is configured as an ECMAScript Module (`"type": "module"` in `package.json`), dropping legacy CommonJS (`require()`) patterns in favor of modern, statically analyzable `import` and `export` statements.

---

## 3. Prerequisites & Getting Started

### 3.1. System Requirements
To run this microservice locally or deploy it to a production environment, your system must meet the following baseline requirements:
- **Node.js**: Version 18.0.0 or higher (Native `BigInt`, `--test` runner, and stable ES Modules required).
- **NPM**: Version 9.0.0 or higher.
- **Operating System**: Linux, macOS, or Windows (WSL2 recommended).

### 3.2. Installation Workflow
Follow these steps strictly to bootstrap the project:

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd calculator_app_system
   ```

2. **Install Dependencies:**
   The project requires highly specific security and operational libraries (Express 5.x, Helmet, Joi, Winston, UUID). Install them via NPM:
   ```bash
   npm install
   ```
   *Note: This will also install `supertest` as a development dependency for integration testing.*

3. **Environment Configuration:**
   Copy the provided `.env.example` file to create your active `.env` file:
   ```bash
   cp .env.example .env
   ```
   Ensure the following variables are properly set:
   - `PORT`: (e.g., 3000)
   - `NODE_ENV`: `development` (use `production` for deployments)
   - `LOG_LEVEL`: `info` or `debug`
   - `API_TIMEOUT_MS`: `5000`
   - `WORKER_MIN_THREADS`: `1`
   - `WORKER_MAX_THREADS`: `2`

### 3.3. Running the Service
To start the microservice in a production-like state, run:
```bash
npm start
```
This executes `NODE_ENV=production node index.js`. You should see a startup log from Winston confirming the application has bound to the specified port.

---

## 4. Project Structure Breakdown

The codebase is structured to isolate dependencies, prevent circular references, and ensure that the core mathematical logic remains perfectly intact regardless of how the API layer evolves.

```
calculator_app_system/
├── index.js                     # Main application entry point & orchestrator
├── package.json                 # Dependency and script manifests
├── .env.example                 # Environment configuration template
├── architecture breakdown.md    # Initial system design reference
├── SPECIFICATIONS.md            # Detailed, highly technical internal documentation
│
├── api/                         # Presentation Layer
│   └── v1_rest_interface/       # Versioned API implementations
│       ├── controllers/         # Orchestrates requests to the math engine
│       ├── middleware/          # API-specific middleware (e.g., error handler)
│       └── routes/              # Express routing definitions
│
├── config_and_dependencies/     # Configuration Layer
│   └── config.js                # Joi-validated immutable configuration object
│
├── core/                        # Domain Layer (Pure Logic)
│   └── calculator.js            # The high-precision BigInt math engine
│
├── infrastructure/              # Cross-cutting concerns
│   └── logger.js                # Winston asynchronous structured logging
│
└── middleware/                  # Global Application Middleware
    └── validator.js             # Security and payload schema validation
```

---

## 5. Configuration Management

The system strictly adheres to the principle of "configuration through environment variables". 

**Important:** The application will **Fail-Fast** (crash immediately on boot) if the configuration is invalid. This prevents unpredictable runtime states.

The `config_and_dependencies/config.js` module uses `Joi` to validate the environment variables. Once validated, the object is sealed using `Object.freeze()` to prevent runtime prototype pollution or accidental mutations.

| Variable | Type | Required | Description |
|---|---|---|---|
| `PORT` | Integer | Yes | The port the HTTP server binds to (1024-65535). |
| `NODE_ENV` | String | Yes | Application environment (`development`, `production`, `test`). |
| `LOG_LEVEL` | String | Yes | Winston logging verbosity (`debug`, `info`, `warn`, `error`). |
| `API_TIMEOUT_MS` | Integer | Yes | Default timeout boundary for requests. |
| `WORKER_MIN_THREADS`| Integer | Yes | Minimum number of threads for the pooling engine. |
| `WORKER_MAX_THREADS`| Integer | Yes | Maximum number of threads (bind to K8s CPU limits). |

---

## 6. Server Orchestration & Lifecycle

The root `index.js` file is the conductor of the microservice. It is responsible for setting up the Express application and weaving the various layers together securely.

### 6.1. Security Headers & Performance Tracking
Before a request even hits the router, `index.js` injects `helmet()` to automatically configure standard production HTTP security headers (e.g., HSTS, X-Content-Type-Options, X-Frame-Options). Following this, a custom performance tracking middleware records the exact start time using Node's `process.hrtime()` and emits an asynchronous log when the response finishes, capturing the precise millisecond duration.

### 6.2. Graceful Shutdown Protocol
When running in containerized environments (Kubernetes, Docker), applications are frequently scaled up or down. Abruptly killing the process (`kill -9`) drops active connections and loses logs.

`index.js` actively listens for `SIGINT` and `SIGTERM` signals. Upon receipt, it:
1. Stops accepting new HTTP connections via `server.close()`.
2. Flushes the asynchronous Winston log buffer to standard output.
3. Sets a hard 10-second timeout. If active connections refuse to close within 10 seconds, it forcefully exits `process.exit(1)` to prevent hanging containers.
4. It also implements global catch-alls for `uncaughtException` and `unhandledRejection`, instantly crashing the app safely to let the orchestrator restart it from a clean state.

---

## 7. Using the REST API

The microservice exposes a single, highly flexible endpoint to perform calculations.

### POST `/api/v1/calculate`

**Headers:**
- `Content-Type: application/json`
- `x-correlation-id: <uuid>` *(Optional. If omitted, the server will generate and return one for distributed tracing).*

**Supported Operations:**
`add`, `subtract`, `multiply`, `divide`, `exponentiation`, `sqrt`, `modulo`.

**Request Body Schema:**
```json
{
  "operation": "multiply",
  "operand1": "9007199254740992",
  "operand2": "100"
}
```
*Note: Operands can be sent as strings or integers. To prevent JSON float rounding issues on the client side, sending large numbers as strings is highly recommended.*

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "operation": "multiply",
    "result": "900719925474099200"
  }
}
```

**Error Handling Strategy:**
If you attempt to divide by zero, the system will not crash. It intercepts the domain error and returns a sanitized `422 Unprocessable Entity` response:
```json
{
  "status": "error",
  "code": "DIVISION_BY_ZERO",
  "message": "Calculation error: DIVISION_BY_ZERO",
  "correlationId": "a1b2c3d4-e5f6-7890"
}
```
Validation failures (e.g., passing `"operand1": "foo"`) will return a `400 Bad Request` outlining exactly which Joi schema constraint failed.

---

## 8. Testing Strategy

The repository contains a highly robust testing suite located in the `test/` directory.

### 8.1. Native Node Test Runner
We utilize the native `node --test` runner introduced in modern Node.js versions. This eliminates the need for heavy external frameworks like Jest or Mocha, drastically reducing the dependency footprint and increasing test execution speed.

### 8.2. Test Coverage
- **Unit Tests (`core.calculator.test.js`)**: Tests the pure BigInt math engine in total isolation, hammering it with massive numbers, negative values, and edge cases like division by zero.
- **Middleware Tests (`validator.test.js`, `error-handler.test.js`)**: Tests the security boundary, ensuring Prototype Pollution payloads are correctly intercepted and standard errors are formatted correctly based on `NODE_ENV`.
- **Integration Tests (`app.test.js`)**: Spins up the Express server in-memory using `supertest` and simulates real HTTP traffic to verify the entire request lifecycle.

To execute the test suite:
```bash
npm test
```
This forces `NODE_ENV=test` to silence production logs and bypass the physical port binding.

---

## 9. Advanced Usage Scenarios

The REST API provided by this application is not merely a wrapper around simple math; it is a robust engine designed to handle edge cases that would normally crash standard JavaScript applications or return mathematically incorrect responses. The following advanced scenarios demonstrate the power and strictness of the Calculator App System.

### 9.1. Handling Astronomical Numbers (BigInt Serialization)
Standard JSON responses natively truncate numbers larger than `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991). If an API attempts to return `9007199254740992` as a raw integer, the client will likely parse it incorrectly.

**The Solution:**
The Calculator App System intercepts the calculation at the controller layer, converts the native `BigInt` into a strict string representation, and transmits it via the JSON payload. 

**Example: Exponentiation**
Request:
```json
{
  "operation": "exponentiation",
  "operand1": "2",
  "operand2": "256"
}
```
Response:
```json
{
  "status": "success",
  "data": {
    "operation": "exponentiation",
    "result": "115792089237316195423570985008687907853269984665640564039457584007913129639936"
  }
}
```
By transmitting the result as a string, we ensure that clients (whether they are web browsers, Python scripts, or Go binaries) receive the exact, un-truncated mathematical result.

### 9.2. Precision Truncation (Division and Square Roots)
Because `BigInt` strictly represents whole integers, floating-point results are impossible. The mathematical engine explicitly employs truncation.

**Example: Division**
Request:
```json
{
  "operation": "divide",
  "operand1": "10",
  "operand2": "3"
}
```
Response:
```json
{
  "status": "success",
  "data": {
    "operation": "divide",
    "result": "3"
  }
}
```
This is not a bug; it is a feature of integer division. The remainder is intentionally discarded. If the remainder is required, the client must explicitly request the `modulo` operation in a separate API call.

**Example: Integer Square Root**
The application implements the Babylonian method (Hero's method) native to `BigInt` because `Math.sqrt()` would cast the integer to a float, resulting in catastrophic precision loss for large numbers.
Request:
```json
{
  "operation": "sqrt",
  "operand1": "26"
}
```
Response:
```json
{
  "status": "success",
  "data": {
    "operation": "sqrt",
    "result": "5"
  }
}
```
The true square root of 26 is ~5.099. The engine correctly snaps to the nearest lowest integer (`5`).

### 9.3. Strict Error State Management
When mathematical laws are violated, the API does not crash. It intercepts the domain error and maps it to a specific HTTP status code (`422 Unprocessable Entity`).

**Example: Division by Zero**
Request:
```json
{
  "operation": "divide",
  "operand1": "100",
  "operand2": "0"
}
```
Response:
```json
{
  "status": "error",
  "code": "DIVISION_BY_ZERO",
  "message": "Calculation error: DIVISION_BY_ZERO"
}
```

---

## 10. Operational Guide & Deployment Strategies

The Calculator App System is container-ready. It adheres to the Twelve-Factor App methodology, meaning it stores configuration in the environment, treats logs as event streams, and is completely stateless.

### 10.1. Docker Containerization
To deploy this application in a modern cloud environment, it must be containerized. Below is the recommended multi-stage `Dockerfile` architecture you should implement.

```dockerfile
# Build Stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Project Source
COPY . .

# Production Stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Bind to API and Metrics ports
EXPOSE 3000 9090
USER node
CMD ["npm", "start"]
```
By utilizing an Alpine Linux base image and a multi-stage build, the final container size is drastically reduced, and build tools are stripped out, minimizing the attack surface. Running as the `node` user prevents privilege escalation if the application is somehow compromised.

### 10.2. Kubernetes Orchestration (K8s)
When deploying to Kubernetes, the application requires a Deployment and a Service manifest. The `/api/v1/health` endpoint is explicitly designed for Kubernetes Liveness and Readiness probes.

**Recommended `deployment.yaml` setup:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: calculator-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: calculator
  template:
    metadata:
      labels:
        app: calculator
    spec:
      containers:
      - name: calculator-app
        image: your-registry/calculator-app:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: LOG_LEVEL
          value: "info"
        - name: WORKER_MIN_THREADS
          value: "2"
        - name: WORKER_MAX_THREADS
          value: "4"
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```
This configuration ensures zero-downtime rolling updates. The `readinessProbe` guarantees that a new pod will not receive traffic until the Express server is fully initialized and bound to the port.

### 10.3. Continuous Integration and Continuous Deployment (CI/CD)
To maintain the high quality of this codebase, any pull request or merge to the `main` branch must trigger an automated pipeline (e.g., GitHub Actions, GitLab CI, or Jenkins).

**Pipeline Stages:**
1. **Linting and Formatting**: Enforce strict JavaScript style guides (e.g., ESLint).
2. **Security Auditing**: Run `npm audit` to check the dependency tree (Express, Joi, Winston, Helmet) for known CVEs.
3. **Unit Testing**: Execute `npm test` natively using Node.js. The pipeline must fail if any test assertion fails.
4. **Build & Push**: If tests pass, build the Docker image and push it to a secure Container Registry (ECR, GCR, DockerHub).
5. **Deployment**: Trigger an automated rollout to the staging environment, perform end-to-end integration tests, and then promote to production.

---

## 11. Observability, Telemetry, and Monitoring

In a microservice architecture, observability is non-negotiable. Without it, determining why a request failed or tracing a performance bottleneck across distributed systems is impossible. The Calculator App System implements a deeply integrated logging and telemetry strategy.

### 11.1. Centralized Structured Logging (Winston)
The application completely abandons `console.log()` in favor of structured JSON logging via the `Winston` library (located in `infrastructure/logger.js`).

**Why JSON Logging?**
When logs are output as raw strings, centralized aggregators (like ELK Stack - Elasticsearch, Logstash, Kibana - or Datadog) have to use complex Regex patterns (Grok) to extract meaningful data. By outputting pure JSON natively, the aggregator instantly indexes fields like `durationMs`, `correlationId`, and `statusCode`.

**Example Production Log:**
```json
{
  "level": "info",
  "message": "Calculation successful",
  "service": "calculator-app",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "operation": "add",
  "duration": "1.245ms",
  "timestamp": "2023-10-27 14:32:01"
}
```
This allows DevOps engineers to instantly query: *"Show me all logs where `duration` > 500ms and `operation` is 'exponentiation'."*

### 11.2. Internal Metrics with Prometheus
To prevent infrastructure leakage, the system exposes a `/metrics` endpoint on an isolated internal port (**9090**). This allows Prometheus to scrape detailed telemetry (event loop lag, request histograms, math operations) without exposing this data to the public internet on the main API port.

### 11.3. Distributed Tracing (Correlation IDs)
Every request entering the system is either assigned a unique UUIDv4 by the router or inherits an existing `x-correlation-id` from the HTTP headers (if an API Gateway or a frontend upstream service provided one).

This ID is relentlessly passed through every layer of the system. If the `validator.js` middleware rejects the payload, it logs the failure alongside the `correlationId`. If the domain engine throws an error, the `controller.js` catches it and logs the stack trace alongside the identical `correlationId`. When the client receives the `4xx` or `5xx` error, the `correlationId` is embedded in the response body.

This allows a user to submit a support ticket containing the `correlationId`, enabling developers to pinpoint the exact sequence of events that led to the failure across millions of logs in a matter of seconds.

### 11.3. Active Data Sanitization
Logging systems are notoriously susceptible to leaking Personally Identifiable Information (PII) or security tokens. The `infrastructure/logger.js` module includes a strict interceptor: `sanitizeData()`. Before Winston converts the metadata to JSON, the sanitizer recursively scans the object keys. If it detects highly sensitive keys like `authorization`, `password`, `token`, `secret`, or `cookie`, it actively mutates the value to `[REDACTED]`. This guarantees compliance with strict data privacy laws (GDPR, HIPAA, SOC2) and ensures credentials are never written to disk or sent to a third-party aggregator.

---

## 12. Troubleshooting Guide

Even the most robust applications encounter operational issues. This guide outlines common errors and their remediation steps.

### 12.1. Application Fails to Boot (Immediate Crash)
**Symptom:** You run `npm start`, and the application immediately exits with code `1`.
**Diagnosis:** The configuration initialization (`config_and_dependencies/config.js`) failed its Joi schema validation.
**Resolution:** Look at the standard error output. It will explicitly list the missing or malformed environment variables. Ensure `.env` is present in the root directory or that the environment variables are correctly injected into the Docker container. Check that `PORT` is a number and `LOG_LEVEL` is valid.

### 12.2. Error: "Forbidden property access detected"
**Symptom:** A request returns `400 Bad Request` with the message "Malformed input", and the logs indicate "Critical validation error: Forbidden property access detected."
**Diagnosis:** The client sent a JSON payload containing `__proto__`, `constructor`, or `prototype` keys. This is a deliberate security intervention by the `validator.js` middleware to prevent Prototype Pollution attacks.
**Resolution:** Ensure the client application is not dynamically serializing dangerous prototype properties into the JSON payload. If this is a deliberate penetration test, the application is functioning correctly.

### 12.3. Error: "Calculation error: INVALID_INPUT"
**Symptom:** The API returns a `422 Unprocessable Entity` with `INVALID_INPUT`.
**Diagnosis:** The Joi schema in the middleware successfully parsed the strings, but the core domain engine (`core/calculator.js`) rejected the parameters. This often occurs if a user attempts to pass a fractional decimal string (`"10.5"`) or attempts to use negative numbers in operations that strictly forbid them (like exponentiation `power` with a negative exponent, or `sqrt` of a negative integer).
**Resolution:** Ensure operands are strict integers. If fractions are required, the architectural scope of this specific `BigInt` microservice does not support them; clients must multiply to whole integers before submission.

### 12.4. Hanging Requests / Gateway Timeout (504)
**Symptom:** Requests to the `/calculate` endpoint eventually timeout.
**Diagnosis:** While Exponentiation by Squaring is optimized ($O(\log n)$), calculating the power of an astronomically massive base to an astronomically massive exponent can still consume significant CPU cycles. Because Node.js is single-threaded, a blocking calculation will stall the event loop, causing all concurrent requests to queue up.
**Resolution:** If the service is under heavy computational load, scale horizontally by increasing the replica count in Kubernetes. Consider implementing a hard mathematical upper boundary in the `Joi` schema (e.g., restricting exponents to a maximum value of `1000000`) if this vector is being abused maliciously (ReDoS / Algorithmic Complexity Attack).

---

## 13. Extensibility and Future Roadmap

The layered architecture of this project makes it trivially easy to extend without breaking existing functionality. 

- **Adding a New Operation:** To add a new mathematical function (e.g., `factorial`), you simply add the pure algorithm to `core/calculator.js`, add `'factorial'` to the allowed operations in `middleware/validator.js`, and add a single case to the switch statement in `api/v1_rest_interface/controllers/controller.js`. The routing, logging, and configuration layers remain completely untouched.
- **Protocol Buffers & gRPC:** Because the core domain logic is entirely isolated from Express, a developer could easily create `api/v1_grpc_interface/` and expose the identical math engine over HTTP/2 using Protobufs for internal microservice-to-microservice communication, achieving massive latency reductions.
- **Message Queues:** The engine could be hooked up to an asynchronous job queue (RabbitMQ or Apache Kafka) where massive background calculations are processed offline by worker nodes, rather than blocking the synchronous HTTP response.

This microservice represents the gold standard in robust, maintainable, and mathematically precise backend engineering.

## 14. The Deep Philosophy Behind BigInt Serialization Over Floats
In traditional computing systems, handling money or precise data utilizing `float64` is universally condemned. The standard Javascript engine adheres to IEEE 754 standards, meaning large numbers completely lose mathematical certainty at exact boundaries. The core directive behind this `Calculator App System` is absolute and non-negotiable functional determinism. When a user requests to add `9007199254740992` and `2`, the result must never be `9007199254740994` or truncated down. 
This requirement ripples through every single directory explored in this project. The `api` directory must convert payloads to strings. The `middleware` directory must intercept numeric strings before they default to standard JS primitives. The `core` logic must execute algorithms specifically built for BigInt (like the Babylonian square root). The entire system dances around this strict typed constraint to guarantee enterprise-level calculations. 
This makes the application uniquely positioned to act as a core backend utility in FinTech applications, cryptocurrency exchanges, astronomical data parsing pipelines, or any other domain where a rounding error could cost millions of dollars or compromise critical data integrity.

## 15. Local Development Workflows
For local development, use Node.js version 18+. After copying the `.env.example` to `.env`, use standard npm scripts. The repository uses `npm run test` for full integration coverage. A developer should always run `npm run test` before committing any code changes to `main`. If you add any new module to the `core/` folder, a corresponding `test/` file must be created to maintain 100% branch and statement coverage. 

For advanced debugging, you can change `LOG_LEVEL` to `debug` in your `.env` file. This will output verbose JSON payloads from the Winston logger, printing exact object states and middleware traversal traces straight to your terminal stdout, making it vastly easier to track variable mutation. 
