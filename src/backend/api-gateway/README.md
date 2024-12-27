# API Gateway Service

The API Gateway service is a critical component of the Detection Translation Platform, providing centralized request routing, authentication, and API orchestration capabilities. This service is built with Node.js/Express and implements enterprise-grade security, monitoring, and scalability features.

## Overview

The API Gateway serves as the primary entry point for all client requests, handling:
- Request routing and load balancing
- Authentication and authorization
- Rate limiting and throttling
- Request validation
- Error standardization
- Monitoring and metrics
- Service mesh integration

## Features

### Core Capabilities
- Advanced request routing with dynamic service discovery
- JWT-based authentication with RBAC authorization
- Redis-backed rate limiting and request throttling
- Schema-based request validation using JSON Schema
- Standardized error handling and logging
- Prometheus/Grafana monitoring integration
- GitHub API integration for repository management
- Service mesh compatibility with Istio

### Security Features
- Token-based authentication
- Role-based access control (RBAC)
- Request encryption (TLS 1.3)
- API key management
- Security headers (CORS, CSP, HSTS)
- Request sanitization
- Audit logging

## Prerequisites

### Required Software
- Node.js 20 LTS
- npm 9+ or yarn 1.22+
- Redis 7.2+
- RabbitMQ 3.12+
- MongoDB 7.0+
- Docker 24.0+
- kubectl (for Kubernetes deployment)

### Development Tools
- TypeScript 5.0+
- ESLint
- Jest
- ts-node-dev

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd src/backend/api-gateway
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build the project:
```bash
npm run build
```

5. Start the service:
```bash
npm start
```

## API Documentation

### Authentication
- POST `/api/v1/auth/login` - User authentication
- POST `/api/v1/auth/refresh` - Token refresh
- POST `/api/v1/auth/logout` - User logout

### Detection Management
- POST `/api/v1/detections` - Create detection
- GET `/api/v1/detections` - List detections
- GET `/api/v1/detections/:id` - Get detection
- PUT `/api/v1/detections/:id` - Update detection
- DELETE `/api/v1/detections/:id` - Delete detection

### Translation Processing
- POST `/api/v1/translate` - Single translation
- POST `/api/v1/batch` - Batch translation
- GET `/api/v1/formats` - List supported formats

### GitHub Integration
- POST `/api/v1/github/sync` - Sync repository
- GET `/api/v1/github/repos` - List repositories
- GET `/api/v1/github/files` - List detection files

### System
- GET `/health` - Service health check
- GET `/metrics` - Prometheus metrics
- GET `/status` - Service status

## Development

### Local Setup
1. Install development dependencies:
```bash
npm install --include=dev
```

2. Start development server:
```bash
npm run dev
```

### Available Scripts
- `npm start` - Launch production server
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript source
- `npm test` - Run test suite with coverage
- `npm run lint` - Run linting with automatic fixes

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| NODE_ENV | Environment mode | development | Yes |
| PORT | Server port | 3000 | Yes |
| JWT_SECRET | JWT signing secret | - | Yes |
| REDIS_URL | Redis connection string | - | Yes |
| RABBITMQ_URL | RabbitMQ connection string | - | Yes |
| MONGODB_URI | MongoDB connection string | - | Yes |
| GITHUB_TOKEN | GitHub API token | - | Yes |

## Deployment

### Docker
```bash
# Build image
docker build -t api-gateway:latest .

# Run container
docker run -p 3000:3000 api-gateway:latest
```

### Kubernetes
```bash
# Apply configuration
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n detection-platform
```

## Troubleshooting

### Common Issues
1. Connection Errors
   - Verify environment variables
   - Check service dependencies
   - Validate network connectivity

2. Authentication Issues
   - Verify JWT token configuration
   - Check user permissions
   - Validate token expiration

3. Performance Issues
   - Monitor resource usage
   - Check rate limiting configuration
   - Verify cache settings

### Logging
- Application logs: `/var/log/api-gateway/app.log`
- Error logs: `/var/log/api-gateway/error.log`
- Access logs: `/var/log/api-gateway/access.log`

### Support
For additional support:
- Create an issue in the repository
- Contact the platform team
- Consult the technical documentation

## References

- [Express.js Documentation](https://expressjs.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)

## License

Copyright © 2023 Detection Translation Platform. All rights reserved.