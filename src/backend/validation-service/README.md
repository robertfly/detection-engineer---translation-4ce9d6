# Detection Rule Validation Service

A high-performance, enterprise-grade validation service for security detection rules, providing comprehensive validation, accuracy verification, and detailed feedback across multiple SIEM formats.

## Overview

### Service Description

The Detection Rule Validation Service is a critical component of the AI-Driven Detection Translation Platform, responsible for ensuring high-fidelity validation of translated security detections with a required accuracy rate of >95%. Built with Go 1.21+, the service provides robust validation capabilities across major security platforms including:

- Splunk SPL
- QRadar
- SIGMA
- Microsoft Azure KQL
- Palo Alto Networks
- Crowdstrike NG-SIEM
- YARA
- YARA-L

### Key Features

- High-performance validation engine with horizontal scaling capability
- Comprehensive validation across multiple detection formats
- Detailed validation feedback and error reporting
- Confidence scoring with configurable thresholds
- Prometheus metrics integration for monitoring
- Secure audit logging and sensitive data masking
- Support for both single and batch validation operations

### Architecture

The service follows a microservices architecture pattern with the following key components:

- RESTful API endpoints for validation requests
- Format-specific validation engines
- Metrics collection and monitoring
- Structured logging with ELK Stack integration
- Secure configuration management

### Technology Stack

- **Language**: Go 1.21+
- **Frameworks**:
  - chi router (v5.0.10) - HTTP routing
  - zap (v1.26.0) - High-performance logging
  - prometheus (v1.17.0) - Metrics collection
- **Infrastructure**: Kubernetes-ready with horizontal scaling

## Installation

### Prerequisites

1. Go 1.21 or higher
2. Docker 24.0+ (for containerized deployment)
3. Access to required dependencies:
   ```bash
   go mod download github.com/go-chi/chi/v5@v5.0.10
   go mod download go.uber.org/zap@v1.26.0
   go mod download github.com/prometheus/client_golang@v1.17.0
   ```

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd src/backend/validation-service
   ```

2. Install dependencies:
   ```bash
   go mod download
   go mod verify
   ```

3. Configure environment variables:
   ```bash
   export APP_ENV=development
   export SERVER_PORT=8080
   export LOG_LEVEL=debug
   export METRICS_ENABLED=true
   ```

4. Run the service:
   ```bash
   go run cmd/server/main.go
   ```

### Docker Setup

1. Build the container:
   ```bash
   docker build -t validation-service:latest .
   ```

2. Run the container:
   ```bash
   docker run -d \
     -p 8080:8080 \
     -p 9090:9090 \
     -e APP_ENV=production \
     -e LOG_LEVEL=info \
     validation-service:latest
   ```

### Troubleshooting

Common issues and solutions:

1. **Validation Timeouts**:
   - Increase `REQUEST_TIMEOUT` environment variable
   - Check system resources and scaling configuration

2. **Memory Issues**:
   - Adjust `MAX_RULE_SIZE` configuration
   - Monitor memory metrics via Prometheus

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| APP_ENV | Deployment environment | development | Yes |
| SERVER_HOST | Server host address | 0.0.0.0 | No |
| SERVER_PORT | Server port | 8080 | No |
| REQUEST_TIMEOUT | Request timeout duration | 30s | No |
| LOG_LEVEL | Logging level | info | No |
| METRICS_ENABLED | Enable Prometheus metrics | true | No |
| MAX_RULE_SIZE | Maximum detection rule size | 1MB | No |
| ENCRYPTION_KEY | Encryption key for sensitive data | - | Yes (production) |

### Validation Rules

Configure validation behavior in `config.json`:

```json
{
  "validation": {
    "strict_validation": true,
    "validation_timeout": "5s",
    "supported_formats": [
      "splunk", "qradar", "sigma", "kql",
      "paloalto", "crowdstrike", "yara", "yara-l"
    ]
  }
}
```

### Performance Tuning

Optimize performance through the following settings:

1. **Concurrency Control**:
   ```json
   {
     "validation": {
       "max_concurrent_validations": 100,
       "batch_size": 50
     }
   }
   ```

2. **Resource Limits**:
   ```json
   {
     "resources": {
       "max_memory": "2Gi",
       "max_cpu": "1000m"
     }
   }
   ```

### Security Settings

Configure security parameters:

```json
{
  "security": {
    "enable_audit_log": true,
    "mask_sensitive_data": true,
    "audit_log_path": "/var/log/validation-service/audit.log"
  }
}
```

## API Documentation

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/v1/validate | POST | Validate single detection |
| /api/v1/validate/batch | POST | Validate multiple detections |
| /metrics | GET | Prometheus metrics endpoint |
| /health | GET | Service health check |

### Request/Response Format

Single Validation Request:
```json
{
  "source_detection": {
    "content": "...",
    "format": "splunk"
  },
  "target_detection": {
    "content": "...",
    "format": "sigma"
  }
}
```

Response:
```json
{
  "validation_result": {
    "status": "success",
    "confidence_score": 98.5,
    "issues": [],
    "metadata": {
      "validation_time": "125ms",
      "validated_fields": ["...]
    }
  }
}
```

### Error Handling

The service provides detailed error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field": "content",
      "reason": "Invalid syntax"
    }
  }
}
```

## Development

### Code Structure

```
validation-service/
├── cmd/
│   └── server/
├── internal/
│   ├── config/
│   ├── models/
│   └── services/
├── pkg/
│   ├── logger/
│   └── metrics/
└── tests/
```

### Testing Guidelines

1. Run unit tests:
   ```bash
   go test ./... -v -cover
   ```

2. Run integration tests:
   ```bash
   go test ./tests/integration -tags=integration
   ```

### Contribution Workflow

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit pull request with detailed description

### Code Review Process

All contributions must:
- Pass all tests
- Meet >80% code coverage
- Follow Go best practices
- Include comprehensive documentation

## Deployment

### Production Guidelines

1. Configure production settings:
   ```bash
   export APP_ENV=production
   export LOG_LEVEL=info
   export METRICS_ENABLED=true
   export ENCRYPTION_KEY=<secure-key>
   ```

2. Deploy using Kubernetes:
   ```bash
   kubectl apply -f k8s/validation-service.yaml
   ```

### Monitoring Setup

1. Configure Prometheus metrics:
   ```yaml
   metrics:
     endpoint: /metrics
     port: 9090
     interval: 15s
   ```

2. Set up Grafana dashboards for:
   - Validation success rates
   - Response times
   - Error rates
   - Resource utilization

### Security Best Practices

1. Enable security features:
   - TLS encryption
   - Authentication/Authorization
   - Audit logging
   - Data encryption

2. Regular security updates:
   - Dependency scanning
   - Vulnerability checks
   - Security patch application