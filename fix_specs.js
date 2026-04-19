const fs = require('fs');

const content = fs.readFileSync('SPECIFICATIONS.md', 'utf8');

const missingSections = `

## 8. Module Specifications: Presentation Layer (API)

### 8.1. Directory Overview: \`api/v1_rest_interface\`

The \`api\` directory represents the external presentation layer of the microservice. It exposes the underlying domain logic via an HTTP REST interface. The sub-directory \`v1_rest_interface\` indicates a strict API versioning strategy. Future iterations (e.g., \`v2\` using GraphQL or gRPC) can be added as adjacent directories without breaking the existing \`v1\` contract.

### 8.2. File: \`routes/routes.js\`

**Responsibility and Middleware Chaining**
This file acts as the primary traffic controller for the \`v1\` API. It utilizes \`express.Router()\` to define isolated route handlers.
- **Correlation ID Injection**: It implements a \`correlationMiddleware\` that inspects incoming headers for \`x-correlation-id\`. If missing, it generates a UUIDv4. This ID is attached to the request, response headers, and all subsequent logs, enabling distributed tracing across microservices.
- **Payload Parsing**: Uses \`express.json({ limit: '10kb' })\` to parse incoming JSON. The strict \`10kb\` limit is an intentional security measure to prevent Denial of Service (DoS) via massive payload parsing.
- **Route Definitions**: Exposes \`POST /calculate\` (the primary business endpoint) and \`GET /health\` (a liveness probe for Kubernetes/Docker Swarm to verify container health).

### 8.3. File: \`controllers/controller.js\`

**Responsibility and Domain Orchestration**
The controller bridges the gap between the HTTP transport layer and the pure domain logic (\`core/calculator.js\`).
- **Performance Profiling**: Utilizes Node's native \`perf_hooks\` (\`performance.now()\`) to track the exact millisecond duration of every calculation. This metric is injected into the logger for APM (Application Performance Monitoring) purposes.
- **Direct Invocation Mapping**: To prevent dynamic execution vulnerabilities, the controller uses a strict \`switch(operation)\` statement to manually map the requested operation to the precise engine function.
- **Error Translation**: Implements \`getHttpStatusCode()\`. Pure domain errors (like \`DIVISION_BY_ZERO\`) are cleanly mapped to HTTP \`422 Unprocessable Entity\` rather than generic \`500\` or \`400\` codes.
- **Serialization**: Because \`JSON.stringify\` natively throws an error when encountering a \`BigInt\`, the controller safely calls \`.toString()\` on the \`BigInt\` result payload before constructing the JSON response.

### 8.4. File: \`middleware/error-handler.js\`

**Responsibility and Global Exception Handling**
This module is registered as the final middleware in the Express application stack. It serves as a catch-all for any asynchronous or synchronous exceptions that escape the route handlers.
- **Security Sanitization**: It detects if the application is running in \`production\` mode. If so, it actively strips error \`.stack\` traces and raw error messages from \`500\` level errors.
- **Severity-Based Logging**: \`5xx\` internal errors trigger a Winston \`error\` log. \`4xx\` business logic errors trigger a \`warn\` log.
- **Serialization Safety**: Wraps the final \`res.json()\` call in a \`try-catch\` block, falling back to a hardcoded string response (\`res.send()\`) if serialization fails.

## 9. Module Specifications: Application Root Orchestrator

### 9.1. File: \`index.js\`

**Responsibility and Server Lifecycle**
The \`index.js\` file located at the base path of the project serves as the ultimate conductor. It instantiates the Express server and binds all modularized components (security headers, routes, error handling, logging) into a single functional pipeline.

- **Security Hardening**: It imports and binds \`helmet()\`, automatically equipping the Express response with 11 crucial HTTP security headers to prevent Cross-Site Scripting (XSS) and clickjacking.
- **Graceful Shutdown Engineering**: It attaches listeners to \`process.on('SIGINT')\` and \`SIGTERM\`. Rather than letting a container orchestrator violently kill active calculation requests, the root script triggers a controlled shutdown sequence. It stops the server from accepting new TCP connections (\`server.close()\`), waits for existing responses to finish, flushes the Winston asynchronous log buffer, and exits safely. A 10-second \`setTimeout\` acts as a failsafe to forcefully kill the process if connections hang.
- **Panic Handlers**: Explicit hooks for \`uncaughtException\` and \`unhandledRejection\` are registered. Instead of ignoring unhandled promises which can leave Node.js in a memory-leaking zombie state, the system logs the panic via Winston and forcefully executes \`process.exit(1)\`, trusting the external orchestrator (like Kubernetes) to restart the pod from a clean slate.

`;

const updatedContent = content.replace('## 10. Deep Dive', missingSections + '## 10. Deep Dive');

fs.writeFileSync('SPECIFICATIONS.md', updatedContent, 'utf8');
console.log('Successfully injected sections 8 and 9 into SPECIFICATIONS.md');
