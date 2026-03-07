# Stage 1: Build React frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Install root deps (for concurrently etc – not needed in build but keeps structure clean)
COPY package*.json ./
RUN npm ci --omit=dev

# Build frontend
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built frontend from builder
COPY --from=builder /app/client/dist ./client/dist

# Create data directory for SQLite volume and non-root user
RUN mkdir -p /app/data && \
    addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "server/index.js"]
