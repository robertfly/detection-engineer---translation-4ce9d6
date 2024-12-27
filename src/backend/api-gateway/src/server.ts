/**
 * API Gateway Server Configuration
 * Implements secure request routing, comprehensive middleware stack, advanced monitoring,
 * and robust error handling with high availability features.
 * @version 1.0.0
 */

// External dependencies
import express from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.1.0
import cors from 'cors'; // ^2.8.5
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import rateLimit from 'express-rate-limit'; // ^7.1.5
import promMiddleware from 'express-prometheus-middleware'; // ^1.2.0
import { expressjwt as jwt } from 'express-jwt'; // ^8.4.1

// Internal dependencies
import { authConfig } from './config/auth';
import { authenticateRequest } from './middleware/auth';
import errorHandler from './middleware/error';
import detectionRouter from './routes/detection';
import translationRouter from './routes/translation';
import githubRouter from './routes/github';
import healthRouter from './routes/health';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

// Constants for configuration
const PORT = process.env.PORT || 3000;

const CORS_OPTIONS = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400
};

const RATE_LIMIT_OPTIONS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100,
  standardHeaders: true,
  legacyHeaders: false
};

const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: true,
  xssFilter: true
};

/**
 * Configures comprehensive Express application middleware stack
 * @param app Express application instance
 */
function configureMiddleware(app: express.Application): void {
  // Security middleware
  app.use(helmet(HELMET_OPTIONS));
  app.use(cors(CORS_OPTIONS));

  // Request parsing and compression
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Request logging with correlation IDs
  app.use(morgan('combined', {
    stream: {
      write: (message) => {
        logger.info(message.trim(), {
          requestId: 'server_log',
          service: 'api_gateway',
          traceId: 'system',
          spanId: 'log',
          environment: process.env.NODE_ENV || 'development',
          userId: 'system'
        });
      }
    }
  }));

  // Rate limiting
  app.use(rateLimit(RATE_LIMIT_OPTIONS));

  // Metrics collection
  app.use(promMiddleware({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10],
    requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
    responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400]
  }));

  // JWT authentication
  app.use(jwt({
    secret: authConfig.jwtPublicKey,
    algorithms: ['RS256'],
    credentialsRequired: false
  }).unless({ path: ['/health', '/health/live', '/health/ready', '/metrics'] }));
}

/**
 * Configures API routes with proper middleware chains and validation
 * @param app Express application instance
 */
function configureRoutes(app: express.Application): void {
  // Health check routes
  app.use('/health', healthRouter);

  // API routes with authentication
  app.use('/api/v1/detections', authenticateRequest, detectionRouter);
  app.use('/api/v1/translations', authenticateRequest, translationRouter);
  app.use('/api/v1/github', authenticateRequest, githubRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      status: 'error',
      message: 'Resource not found',
      path: req.path
    });
  });

  // Error handling
  app.use(errorHandler);
}

/**
 * Initializes and starts the Express server with graceful shutdown handling
 * @returns Promise<express.Application>
 */
async function startServer(): Promise<express.Application> {
  const app = express();

  try {
    // Configure middleware and routes
    configureMiddleware(app);
    configureRoutes(app);

    // Initialize metrics collection
    metrics.initializeMetrics();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`API Gateway server started on port ${PORT}`, {
        requestId: 'server_start',
        service: 'api_gateway',
        traceId: 'system',
        spanId: 'start',
        environment: process.env.NODE_ENV || 'development',
        userId: 'system'
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully', {
        requestId: 'server_shutdown',
        service: 'api_gateway',
        traceId: 'system',
        spanId: 'shutdown',
        environment: process.env.NODE_ENV || 'development',
        userId: 'system'
      });

      server.close(() => {
        logger.info('Server closed', {
          requestId: 'server_closed',
          service: 'api_gateway',
          traceId: 'system',
          spanId: 'close',
          environment: process.env.NODE_ENV || 'development',
          userId: 'system'
        });
        process.exit(0);
      });
    });

    return app;
  } catch (error) {
    logger.error('Failed to start server', error as Error, {
      requestId: 'server_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'error',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system'
    });
    throw error;
  }
}

// Export the configured Express application
export const app = startServer();

export default app;