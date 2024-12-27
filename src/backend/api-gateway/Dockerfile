# -----------------------------
# Build Stage
# -----------------------------
FROM node:20-alpine AS builder

# Build arguments
ARG BUILD_VERSION
ARG NODE_VERSION=20

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with exact versions for reproducibility
RUN npm ci --ignore-scripts \
    && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Run security audit
RUN npm run security:audit

# Prune dev dependencies
RUN npm prune --production

# -----------------------------
# Development Stage
# -----------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Install development tools
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files and install dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# Set development environment
ENV NODE_ENV=development
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Expose API and debug ports
EXPOSE 3000 9229

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Development command with hot reload
CMD ["npm", "run", "dev"]

# -----------------------------
# Production Stage
# -----------------------------
FROM node:20-alpine AS production

# Build arguments and labels
ARG BUILD_VERSION
ARG BUILD_DATE

LABEL maintainer="DevOps Team <devops@company.com>" \
    version="${BUILD_VERSION}" \
    security.scan-date="${BUILD_DATE}"

# Create non-root user
RUN addgroup -g 1001 nodeapp && \
    adduser -u 1001 -G nodeapp -s /bin/sh -D nodeapp

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy production files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set secure permissions
RUN chown -R nodeapp:nodeapp /app && \
    chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    chmod 550 /app/package*.json

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Switch to non-root user
USER nodeapp

# Expose API port
EXPOSE 3000

# Enhanced health check for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set resource limits
ENV MEMORY_LIMIT="4Gi"
ENV CPU_LIMIT="2"

# Security hardening
RUN npm config set ignore-scripts true && \
    npm config set unsafe-perm false

# Start production server
CMD ["npm", "start"]

# Additional security measures
STOPSIGNAL SIGTERM