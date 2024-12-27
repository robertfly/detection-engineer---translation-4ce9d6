# Stage 1: Builder
FROM golang:1.21-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    git \
    ca-certificates \
    && update-ca-certificates

# Copy go.mod and go.sum for dependency caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build optimized binary with security flags
# CGO_ENABLED=0 for static binary
# -trimpath for reproducible builds
# -ldflags for stripping debug info
# -a to force rebuild of packages
# -installsuffix cgo to use cgo-independent search path
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -a -installsuffix cgo \
    -ldflags='-w -s -extldflags "-static"' \
    -o validator ./cmd/server

# Stage 2: Final minimal image
FROM alpine:3.18

# Install CA certificates for HTTPS
RUN apk add --no-cache ca-certificates \
    && update-ca-certificates

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/validator .

# Set secure permissions
RUN chown -R appuser:appgroup /app \
    && chmod 550 /app/validator

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/app/validator", "health"] || exit 1

# Switch to non-root user
USER appuser

# Expose validation service port
EXPOSE 8082

# Set read-only root filesystem
# This enhances security by preventing runtime file writes
VOLUME ["/tmp"]

# Set resource limits
# These match the technical specifications
ENV GOMEMLIMIT=4GiB
ENV GOMAXPROCS=2

# Run the validation service
ENTRYPOINT ["/app/validator"]