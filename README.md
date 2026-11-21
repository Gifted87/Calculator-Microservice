# Calculator Microservice

A Node.js REST API for integer arithmetic using JavaScript `BigInt`. The service validates calculation requests, returns results as decimal strings, and offloads calculations through a worker pool.

## Features

- Integer addition, subtraction, multiplication, division, exponentiation, square root, and modulo
- `BigInt` calculations, with decimal-string results to preserve large integer values in JSON
- Request validation, correlation IDs, structured logs, and HTTP security headers
- Health endpoint and Prometheus metrics endpoint
- Docker and Kubernetes deployment examples

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
git clone https://github.com/Gifted87/Calculator-Microservice.git
cd Calculator-Microservice
npm ci
cp .env.example .env
npm start
```

The API listens on `http://localhost:3000` by default. The metrics listener uses port `9090`.

## Configuration

All variables below are required and validated when the service starts.

| Variable | Example | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP API port (1024–65535) |
| `NODE_ENV` | `development` | `development`, `staging`, `production`, or `test` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `API_TIMEOUT_MS` | `5000` | Calculation worker timeout in milliseconds |
| `WORKER_MIN_THREADS` | `1` | Minimum worker pool size |
| `WORKER_MAX_THREADS` | `2` | Maximum worker pool size |

## API

### `GET /api/v1/health`

Returns a basic health response:

```json
{"status":"ok","timestamp":"2026-01-01T00:00:00.000Z"}
```

### `POST /api/v1/calculate`

Send an operation and integer operands. Use strings for integer values, especially large values, to avoid JSON number precision loss.

```bash
curl -X POST http://localhost:3000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -H 'x-correlation-id: demo-123' \
  -d '{"operation":"exponentiation","operand1":"2","operand2":"100"}'
```

Successful response:

```json
{"status":"success","data":{"operation":"exponentiation","result":"1267650600228229401496703205376"}}
```

Supported operations are `add`, `subtract`, `multiply`, `divide`, `exponentiation`, `sqrt`, and `modulo`. Use `operand1` and `operand2` for binary operations. For `sqrt`, provide only `operand1`. Division truncates toward zero; square root returns the integer floor. Decimal values are not supported. Negative exponents and negative square-root inputs are invalid. Exponents above `100000` are rejected by request validation.

Validation failures return HTTP `400`; calculation errors such as division by zero return HTTP `422`; worker timeouts return HTTP `408`.

### Metrics

Prometheus metrics are served at `GET /metrics` on port `9090` (separate from the API listener).

## Development

```bash
npm test
```

The tests use Node's built-in test runner and Supertest.

## Docker

Build the image:

```bash
docker build -t calculator-microservice .
```

Run it with the required configuration, for example:

```bash
docker run --rm -p 3000:3000 -p 9090:9090 \
  -e PORT=3000 -e NODE_ENV=production -e LOG_LEVEL=info \
  -e API_TIMEOUT_MS=5000 -e WORKER_MIN_THREADS=1 -e WORKER_MAX_THREADS=2 \
  calculator-microservice
```

The repository also includes a Kubernetes manifest in `deployment.yaml`.

## Project layout

```text
api/v1_rest_interface/   HTTP routes, controller, and error handler
config_and_dependencies/ Environment configuration validation
core/                    Integer arithmetic operations
infrastructure/          Logging and worker-thread execution
middleware/              Request validation
test/                    Unit and API tests
```
