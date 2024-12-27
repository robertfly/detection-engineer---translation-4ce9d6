# syntax=docker/dockerfile:1.4

# -----------------------------
# Common Build Arguments
# -----------------------------
ARG NODE_VERSION=20
ARG PYTHON_VERSION=3.11
ARG GO_VERSION=1.21
ARG BUILD_VERSION=1.0.0
ARG BUILD_DATE
ARG BUILD_COMMIT

# -----------------------------
# API Gateway Base Stage
# -----------------------------
FROM node:${NODE_VERSION}-alpine AS api-gateway-base

# Security hardening
RUN addgroup -g 10001 nodeapp && \
    adduser -u 10001 -G nodeapp -s /bin/sh -D nodeapp

# Install common dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# -----------------------------
# Translation Service Base Stage
# -----------------------------
FROM python:${PYTHON_VERSION}-slim AS translation-service-base

# Security hardening
RUN groupadd -g 10002 translation-service && \
    useradd -u 10002 -g translation-service -s /bin/bash -m translation-service

# Set Python environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app

WORKDIR /app

# -----------------------------
# Validation Service Base Stage
# -----------------------------
FROM golang:${GO_VERSION}-alpine AS validation-service-base

# Security hardening
RUN addgroup -g 10003 validation-service && \
    adduser -u 10003 -G validation-service -s /bin/sh -D validation-service

# Install common dependencies
RUN apk add --no-cache \
    git \
    ca-certificates \
    && update-ca-certificates

WORKDIR /app

# -----------------------------
# Common Security Configuration
# -----------------------------
FROM scratch AS security-config

# Security labels
LABEL org.opencontainers.image.title="Detection Translation Platform" \
      org.opencontainers.image.description="Enterprise-grade detection translation services" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${BUILD_COMMIT}" \
      org.opencontainers.image.vendor="Detection Translation Platform Team" \
      org.opencontainers.image.licenses="MIT" \
      security.scan-date="${BUILD_DATE}"

# Common security configurations
ENV DOCKER_CONTENT_TRUST=1 \
    DOCKER_BUILDKIT=1 \
    COMPOSE_DOCKER_CLI_BUILD=1

# Security capabilities
COPY --chmod=644 <<EOF /security/seccomp.json
{
    "defaultAction": "SCMP_ACT_ERRNO",
    "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_ARM64"],
    "syscalls": [
        {"names": ["accept", "bind", "listen"], "action": "SCMP_ACT_ALLOW"},
        {"names": ["read", "write", "open", "close"], "action": "SCMP_ACT_ALLOW"},
        {"names": ["socket", "connect"], "action": "SCMP_ACT_ALLOW"}
    ]
}
EOF

# -----------------------------
# Common Health Check Configuration
# -----------------------------
FROM scratch AS healthcheck-config

# API Gateway health check
COPY --chmod=755 <<EOF /healthcheck/api-gateway.sh
#!/bin/sh
curl -f http://localhost:3000/health || exit 1
EOF

# Translation Service health check
COPY --chmod=755 <<EOF /healthcheck/translation-service.sh
#!/bin/sh
curl -f http://localhost:8000/health || exit 1
EOF

# Validation Service health check
COPY --chmod=755 <<EOF /healthcheck/validation-service.sh
#!/bin/sh
wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1
EOF

# -----------------------------
# Common Build Configuration
# -----------------------------
FROM scratch AS build-config

# Build arguments configuration
ENV BUILD_VERSION=${BUILD_VERSION} \
    BUILD_DATE=${BUILD_DATE} \
    BUILD_COMMIT=${BUILD_COMMIT} \
    NODE_ENV=production \
    PYTHON_ENV=production \
    GO_ENV=production

# Resource limits configuration
ENV MEMORY_LIMIT_API="4Gi" \
    MEMORY_LIMIT_TRANSLATION="8Gi" \
    MEMORY_LIMIT_VALIDATION="4Gi" \
    CPU_LIMIT_API="2" \
    CPU_LIMIT_TRANSLATION="4" \
    CPU_LIMIT_VALIDATION="2"

# Build optimization configuration
ENV BUILDKIT_INLINE_CACHE=1 \
    DOCKER_SCAN_SUGGEST=false

# -----------------------------
# Final Stage Instructions
# -----------------------------
# Usage instructions for service-specific Dockerfiles:
#
# API Gateway:
# FROM api-gateway-base AS api-gateway
# COPY --from=security-config /security/seccomp.json /etc/docker/seccomp.json
# COPY --from=healthcheck-config /healthcheck/api-gateway.sh /healthcheck.sh
# USER nodeapp
# EXPOSE 3000
# HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD ["/healthcheck.sh"]
#
# Translation Service:
# FROM translation-service-base AS translation-service
# COPY --from=security-config /security/seccomp.json /etc/docker/seccomp.json
# COPY --from=healthcheck-config /healthcheck/translation-service.sh /healthcheck.sh
# USER translation-service
# EXPOSE 8000
# HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD ["/healthcheck.sh"]
#
# Validation Service:
# FROM validation-service-base AS validation-service
# COPY --from=security-config /security/seccomp.json /etc/docker/seccomp.json
# COPY --from=healthcheck-config /healthcheck/validation-service.sh /healthcheck.sh
# USER validation-service
# EXPOSE 9000
# HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD ["/healthcheck.sh"]