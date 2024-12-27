// External dependencies
import { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2

// Internal dependencies
import { healthController } from '../controllers/health';
import { logger } from '../utils/logger';

// Constants for health check routes
const HEALTH_ROUTES = {
  base: '/health',
  liveness: '/health/live',
  readiness: '/health/ready',
} as const;

/**
 * Configures and returns an Express router with comprehensive health check endpoints
 * including error handling and logging
 * @returns Configured Express router instance
 */
const configureHealthRoutes = (): Router => {
  // Create router with strict routing enabled
  const router = Router({ strict: true });

  // Request logging middleware for health routes
  router.use(HEALTH_ROUTES.base, (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Health check request received', {
      requestId: req.headers['x-request-id'] as string || `health-${Date.now()}`,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || `health-${Date.now()}`,
      spanId: 'health_route',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });
    next();
  });

  // Basic health check endpoint
  router.get(
    HEALTH_ROUTES.base,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await healthController.getHealth(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Kubernetes liveness probe endpoint
  router.get(
    HEALTH_ROUTES.liveness,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await healthController.getLiveness(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Kubernetes readiness probe endpoint
  router.get(
    HEALTH_ROUTES.readiness,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await healthController.getReadiness(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling middleware for health routes
  router.use(HEALTH_ROUTES.base, (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Health check route error', err, {
      requestId: req.headers['x-request-id'] as string || `health-${Date.now()}`,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || `health-${Date.now()}`,
      spanId: 'health_error',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    res.status(500).json({
      status: 'error',
      message: 'Internal server error during health check',
      timestamp: new Date().toISOString(),
    });
  });

  // Log successful route initialization
  logger.debug('Health check routes configured successfully', {
    requestId: 'health_routes_init',
    service: 'api_gateway',
    traceId: 'system',
    spanId: 'init',
    environment: process.env.NODE_ENV || 'development',
    userId: 'system',
  });

  return router;
};

// Create and export the configured health check router
export const healthRouter = configureHealthRoutes();

export default healthRouter;