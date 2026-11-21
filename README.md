# 🧮 Calculator Microservice

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)](https://expressjs.com/)
[![Worker Pool](https://img.shields.io/badge/Threading-Piscina%20Worker%20Pool-blueviolet)](https://github.com/piscinajs/piscina)
[![Observability](https://img.shields.io/badge/Metrics-Prometheus%20(Port%209090)-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Container](https://img.shields.io/badge/Container-Docker%20%26%20Kubernetes-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-ISC-brightgreen.svg)](LICENSE)

An enterprise-grade, high-performance Node.js REST microservice designed for **arbitrary-precision integer arithmetic**. Powered by native JavaScript `BigInt` and offloaded to a **Piscina worker thread pool**, this service eliminates the precision boundaries and floating-point rounding errors inherent to standard IEEE 754 64-bit numbers.

---

## 📑 Table of Contents

- [Overview & Problem Statement](#-overview--problem-statement)
- [Key Features](#-key-features)
- [Architecture & Worker Pool](#-architecture--worker-pool)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Configuration (.env)](#-configuration-env)
- [API Reference](#-api-reference)
  - [Health Check](#1-health-check)
  - [Prometheus Metrics](#2-prometheus-metrics)
  - [Calculate Endpoint](#3-calculate-endpoint)
- [Security & Defensive Engineering](#-security--defensive-engineering)
- [Docker & Kubernetes Deployment](#-docker--kubernetes-deployment)
- [Testing](#-testing)
- [Contributing & License](#-contributing--license)

---

## 🎯 Overview & Problem Statement

JavaScript's standard `Number` primitive adheres to IEEE 754 double-precision floating-point arithmetic. Consequently, numbers exceeding `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 = 9,090,071,992,547,409,991$) suffer from immediate precision degradation:

```javascript
9007199254740992 + 1 === 9007199254740992 // true! (Precision lost)
```

In mission-critical fintech applications, cryptographic ledger operations, high-frequency accounting, and scientific computing, rounding errors are unacceptable. 

The **Calculator Microservice** solves this problem by:
1. Ingesting arbitrary-precision numbers strictly formatted as decimal strings.
2. Executing calculations using native 64-bit/unbounded `BigInt` arithmetic.
3. Returning exact calculation results serialized as decimal strings within JSON envelopes.
4. Offloading heavy CPU computations to dedicated background worker threads to keep the Node.js event loop responsive.

---

## 🚀 Key Features

- **Arbitrary Precision Arithmetic**:
  - Full support for `add`, `subtract`, `multiply`, `divide` (truncated toward zero), `exponentiation`, `sqrt` (integer floor), and `modulo`.
  - Zero precision loss for arbitrarily large integers.
- **Piscina Worker Pool Offloading**:
  - CPU-bound computations (such as large-exponent powers or integer square roots) run in a bounded worker pool.
  - Granular execution limits enforced via `AbortController` timeouts.
  - Zero IPC overhead for micro-operations via a smart bit-length heuristic bypass.
- **Enterprise Observability**:
  - Structured, non-blocking JSON logging powered by **Winston**.
  - Distributed tracing with correlation IDs (`x-correlation-id`).
  - Isolated Prometheus metrics server on port `9090` (preventing telemetry leakage on the public API port).
- **Defense-in-Depth Security**:
  - **Helmet** HTTP security headers.
  - Prototype pollution detection and rejection.
  - Strict input sanitization and schema validation with **Joi**.
  - Fail-fast configuration validation at boot time.
- **Cloud Native & Production Ready**:
  - Multi-stage unprivileged Alpine Docker image.
  - Production-ready Kubernetes manifest with liveness/readiness probes.

---

## 🏛️ Architecture & Worker Pool

The microservice follows a clean layered design separating transport protocols, validation, thread pooling, and mathematical core logic:

```
                  ┌─────────────────────────────────────────┐
                  │          HTTP Request (Port 3000)       │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │    Security & Middleware Stack          │
                  │   - Helmet & CORS                       │
                  │   - Correlation ID Tracing              │
                  │   - Joi Schema & Prototype Guard        │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │            API Controller               │
                  │   Bit-Length Heuristic Execution Check  │
                  └─────────┬─────────────────────┬─────────┘
                            │                     │
               [Simple Op / Small Bit-Length]     │ [Complex / Large BigInt]
                            │                     │
                            ▼                     ▼
             ┌────────────────────────┐  ┌──────────────────────────────────┐
             │ Synchronous Core Math  │  │ Piscina Worker Thread Pool       │
             │ (core/calculator.js)   │  │ (infrastructure/math-worker.js)  │
             │                        │  │ - AbortController Timeout Guard  │
             │                        │  │ - Isolated V8 Worker Context     │
             └──────────────┬─────────┘  └────────────────┬─────────────────┘
                            │                             │
                            └──────────────┬──────────────┘
                                           │
                                           ▼
                  ┌─────────────────────────────────────────┐
                  │      Response Serializer (BigInt -> Str)│
                  │   Winston Log & Prometheus Metric Emit  │
                  └─────────────────────────────────────────┘
```

### Heuristic Execution Optimization

Worker thread message passing incurs V8 serialization and IPC cloning overhead. To maximize throughput:
- **Fast-path (Synchronous)**: Operations (`add`, `subtract`, `multiply`) on small operands (< 50 decimal digits) execute directly on the main thread via fast 64-bit integer bit-shift estimation.
- **Worker-path (Asynchronous)**: Operations involving heavy exponentiation, integer square roots, large modulo, or operands $\ge 50$ digits are dispatched to the Piscina thread pool.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js (ESM)** | Modern JavaScript runtime with native `BigInt` support |
| **Express.js 5.x** | High-performance routing framework |
| **Piscina** | Worker thread pool executor with resource limits |
| **Joi** | Defensive schema validation and input sanitization |
| **Winston** | High-throughput structured JSON logging |
| **Prom-Client** | Prometheus metrics collector and exporter |
| **Helmet & CORS** | HTTP header hardening and cross-origin resource sharing |
| **Docker & K8s** | Containerization and cloud-native orchestration |

---

## 📂 Project Structure

```text
├── api/
│   └── v1_rest_interface/
│       ├── controllers/
│       │   └── controller.js         # API logic & worker dispatch
│       ├── middleware/
│       │   └── error-handler.js      # Unified HTTP error handling
│       └── routes/
│           └── routes.js             # API route definitions
├── config_and_dependencies/
│   ├── config.js                     # Joi-validated immutable configuration
│   └── package.json                  # Submodule definition
├── core/
│   └── calculator.js                 # Pure BigInt precision math algorithms
├── infrastructure/
│   ├── logger.js                     # Winston JSON logger & panic handlers
│   └── math-worker.js                # Piscina worker task executor
├── middleware/
│   └── validator.js                  # Request body & prototype pollution guard
├── test/
│   ├── api.test.js                   # Supertest HTTP integration suite
│   └── calculator.test.js            # Core BigInt algorithm unit tests
├── Dockerfile                        # Multi-stage Alpine container specification
├── deployment.yaml                   # Kubernetes deployment & service manifest
├── consolidator.py                   # Codebase consolidation utility
├── index.js                          # Service bootstrap and dual-server setup
└── package.json                      # Top-level dependencies and npm scripts
```

---

## ⚙️ Prerequisites & Installation

### Prerequisites
- **Node.js** $\ge 18.0.0$ (LTS recommended)
- **npm** $\ge 9.0.0$

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Gifted87/Calculator-Microservice.git
   cd Calculator-Microservice
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Start the microservice:**
   ```bash
   npm start
   ```

The REST API will bind to port `3000` (or `PORT` from `.env`), and the Prometheus metrics server will bind to port `9090`.

---

## 🔧 Configuration (.env)

The service enforces strict **Fail-Fast** startup validation. If any variable is missing or malformed, the application will refuse to start and terminate with `exit code 1`.

| Variable | Type | Allowed Values | Default | Description |
|---|---|---|---|---|
| `PORT` | Integer | `1024` – `65535` | `3000` | HTTP REST API listening port |
| `NODE_ENV` | String | `development`, `staging`, `production`, `test` | `development` | Runtime environment profile |
| `LOG_LEVEL` | String | `debug`, `info`, `warn`, `error` | `info` | Winston logging threshold |
| `API_TIMEOUT_MS` | Integer | $> 0$ | `5000` | Worker pool calculation timeout in milliseconds |
| `WORKER_MIN_THREADS` | Integer | $\ge 1$ | `1` | Minimum Piscina worker thread count |
| `WORKER_MAX_THREADS` | Integer | $\ge 1$ | `2` | Maximum Piscina worker thread count (tune to CPU limits) |

---

## 📖 API Reference

### 1. Health Check

Verifies server liveness and operational readiness.

- **Endpoint**: `GET /api/v1/health`
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-11-21T12:00:00.000Z"
}
```

---

### 2. Prometheus Metrics

Exposed exclusively on **port 9090** to prevent internal telemetry exposure to public clients.

- **Endpoint**: `GET http://localhost:9090/metrics`
- **Output**: Standard Prometheus exposition format containing process memory, event loop latency, and `http_request_duration_seconds` histograms.

---

### 3. Calculate Endpoint

- **Endpoint**: `POST /api/v1/calculate`
- **Headers**:
  - `Content-Type: application/json`
  - `x-correlation-id: <optional-uuid>` (Auto-generated if omitted)

#### Supported Operations

| Operation | Type | Operands | Notes |
|---|---|---|---|
| `add` | Binary | `operand1`, `operand2` | Sum of integers |
| `subtract` | Binary | `operand1`, `operand2` | Difference ($op_1 - op_2$) |
| `multiply` | Binary | `operand1`, `operand2` | Product |
| `divide` | Binary | `operand1`, `operand2` | Truncates toward zero. Returns `422` on zero divisor |
| `exponentiation` | Binary | `operand1`, `operand2` | $op_1^{op_2}$. $op_2 \ge 0$, max exponent: $100,000$ |
| `modulo` | Binary | `operand1`, `operand2` | Remainder of division ($op_1 \pmod{op_2}$) |
| `sqrt` | Unary | `operand1` | Integer square root floor ($\lfloor\sqrt{op_1}\rfloor$). Rejects negative inputs |

#### Example Requests & Responses

##### Exponentiation (Arbitrary Precision)
```bash
curl -X POST http://localhost:3000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: trace-calc-001" \
  -d '{
    "operation": "exponentiation",
    "operand1": "2",
    "operand2": "128"
  }'
```
**Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "operation": "exponentiation",
    "result": "340282366920938463463374607431768211456"
  }
}
```

##### Integer Square Root
```bash
curl -X POST http://localhost:3000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "sqrt",
    "operand1": "1000000000000000000000000000000"
  }'
```
**Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "operation": "sqrt",
    "result": "31622776601683"
  }
}
```

##### Error Handling: Division by Zero
```bash
curl -X POST http://localhost:3000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "divide",
    "operand1": "100",
    "operand2": "0"
  }'
```
**Response (`422 Unprocessable Entity`)**:
```json
{
  "status": "error",
  "code": "DIVISION_BY_ZERO",
  "message": "Calculation error: DIVISION_BY_ZERO"
}
```

#### HTTP Status Codes

| Status Code | Description | Scenario |
|---|---|---|
| `200 OK` | Success | Calculation executed successfully |
| `400 Bad Request` | Validation Error | Missing parameters, non-integer inputs, prototype pollution |
| `408 Request Timeout` | Worker Timeout | Computation exceeded `API_TIMEOUT_MS` |
| `422 Unprocessable` | Domain Math Error | Division by zero, negative exponent, negative square root |
| `500 Server Error` | System Exception | Unexpected internal failure |

---

## 🛡️ Security & Defensive Engineering

1. **Prototype Pollution Protection**:
   Incoming request keys are inspected recursively. Payloads containing `__proto__`, `constructor`, or `prototype` keys are immediately blocked with `400 Bad Request`.
2. **Resource Exhaustion Guardrails**:
   Exponents are capped at `100,000` to prevent memory exhaustion and excessive CPU starvation attacks.
3. **Fail-Fast Startup**:
   Configuration schema is validated at process startup using Joi. Misconfigurations halt boot sequences instantly.
4. **Least-Privilege Containerization**:
   The Docker container drops root privileges and executes as the unprivileged `node` user.

---

## 🐳 Docker & Kubernetes Deployment

### Docker

Build the multi-stage Alpine Docker image:
```bash
docker build -t calculator-microservice .
```

Run the container:
```bash
docker run -d --rm \
  --name calculator-service \
  -p 3000:3000 \
  -p 9090:9090 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e API_TIMEOUT_MS=5000 \
  -e WORKER_MIN_THREADS=2 \
  -e WORKER_MAX_THREADS=4 \
  calculator-microservice
```

### Kubernetes

Deploy the service to a Kubernetes cluster using the provided manifest:
```bash
kubectl apply -f deployment.yaml
```

The manifest includes:
- **Deployment** with 3 replicas, resource requests/limits, and environment configurations.
- **Liveness & Readiness Probes** checking `/api/v1/health` on port `3000`.
- **Dual-port Service** exposing both API (`3000`) and Prometheus metrics (`9090`).

---

## 🧪 Testing

The repository uses Node's built-in test runner (`node --test`) along with **Supertest** for integration validation:

```bash
# Run all unit and integration tests
npm test
```

### Test Coverage Highlights
- ✅ BigInt precision operations (`add`, `subtract`, `multiply`, `divide`, `power`, `sqrt`, `modulo`)
- ✅ Zero division and negative input domain constraints
- ✅ Prototype pollution injection resistance
- ✅ Calculation timeout enforcement via `AbortController`
- ✅ Health check & Prometheus telemetry scraping

---

## 🤝 Contributing & License

Contributions are welcome! Please ensure that:
1. All unit and integration tests pass cleanly (`npm test`).
2. Changes follow structured logging and correlation ID standards.
3. Commit messages are clear and follow semantic conventions.

Distributed under the **ISC License**.
