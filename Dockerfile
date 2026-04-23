# Stage 1: Build & Prune
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Use --omit=dev to install only production dependencies and speed up build
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy only production dependencies and necessary application files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./
COPY --from=builder /app/core ./core
COPY --from=builder /app/api ./api
COPY --from=builder /app/infrastructure ./infrastructure
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/config_and_dependencies ./config_and_dependencies

# Run as non-root user for enhanced security
USER node

# Expose API port and internal metrics port
EXPOSE 3000 9090
CMD ["node", "index.js"]
