# syntax=docker/dockerfile:1.4

# Build stage
FROM python:3.11-slim AS builder
# python:3.11-slim version 3.11.7-slim-bookworm

# Build arguments
ARG PYTHON_VERSION=3.11
ARG PORT=8000
ARG PYTHON_ENV=production
ARG BUILD_VERSION=1.0.0
ARG MODEL_VERSION=latest
ARG ENABLE_TELEMETRY=true

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    POETRY_VERSION=1.4.2 \
    PYTHONPATH=/app

# Set working directory
WORKDIR /app

# Install system dependencies required for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download and optimize AI models
RUN mkdir -p /app/models && \
    chmod 755 /app/models

# Clean up build artifacts
RUN apt-get purge -y --auto-remove build-essential gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Production stage
FROM python:3.11-slim AS final

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    PYTHON_ENV=production \
    MODEL_PATH=/app/models \
    MAX_WORKERS=4

# Create non-root user and group
RUN groupadd -g 10001 translation-service && \
    useradd -u 10001 -g translation-service -s /bin/bash -m translation-service

# Set working directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy AI models from builder
COPY --from=builder --chown=translation-service:translation-service /app/models /app/models

# Create necessary directories with appropriate permissions
RUN mkdir -p /tmp && \
    chown -R translation-service:translation-service /tmp && \
    chmod 1777 /tmp

# Set up read-only root filesystem
RUN chmod -R 755 /app && \
    chmod -R 755 /opt/venv

# Labels
LABEL maintainer="Security Engineering Team" \
      application="translation-service" \
      version="1.0.0" \
      component="detection-translator" \
      environment="production"

# Switch to non-root user
USER translation-service

# Expose port
EXPOSE 8000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Resource limits (applied at runtime via container orchestrator)
# CPU: 4
# Memory: 8Gi
# Ephemeral Storage: 1Gi
# Max Processes: 128
# Open Files: 1024

# Start application with production server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--limit-max-requests", "10000", "--timeout-keep-alive", "30", "--log-level", "info"]