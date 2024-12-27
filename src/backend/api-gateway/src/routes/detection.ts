/**
 * Detection Router Configuration
 * Implements secure RESTful endpoints for detection rule management with comprehensive
 * validation, rate limiting, and monitoring capabilities.
 * @version 1.0.0
 */

// External dependencies
import express, { Router } from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0

// Internal dependencies
import {
  createDetection,
  getDetection,
  updateDetection,
  deleteDetection,
  listDetections
} from '../controllers/detection';
import {
  authenticateRequest,
  checkPermissions
} from '../middleware/auth';
import validateRequest from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimit';
import logger from '../utils/logger';
import metrics from '../utils/metrics';

// Constants for permissions and rate limiting
const DETECTION_PERMISSIONS = {
  LIST: 'detection:list',
  CREATE: 'detection:create',
  READ: 'detection:read',
  UPDATE: 'detection:update',
  DELETE: 'detection:delete'
} as const;

const RATE_LIMIT_CONFIG = {
  LIST: { maxRequests: 200, windowMs: 60000, burstLimit: 250 },
  CREATE: { maxRequests: 100, windowMs: 60000, burstLimit: 120 },
  READ: { maxRequests: 200, windowMs: 60000, burstLimit: 250 },
  UPDATE: { maxRequests: 100, windowMs: 60000, burstLimit: 120 },
  DELETE: { maxRequests: 50, windowMs: 60000, burstLimit: 60 }
} as const;

const ERROR_MESSAGES = {
  INVALID_FORMAT: 'Invalid detection format specified',
  VALIDATION_FAILED: 'Detection validation failed',
  NOT_FOUND: 'Detection not found',
  UNAUTHORIZED: 'Insufficient permissions',
  RATE_LIMITED: 'Too many requests'
} as const;

/**
 * Configures and returns an Express router with secured detection endpoints
 * @returns Configured Express router instance
 */
const configureDetectionRoutes = (): Router => {
  const router = Router();

  // Apply security middleware
  router.use(helmet());
  router.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 600 // 10 minutes
  }));

  // Authentication middleware for all routes
  router.use(authenticateRequest);

  // List detections endpoint
  router.get('/detections',
    createRateLimiter(RATE_LIMIT_CONFIG.LIST),
    checkPermissions({ requiredPermissions: [DETECTION_PERMISSIONS.LIST] }),
    async (req, res, next) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string;

      try {
        const result = await listDetections(req, res);
        
        metrics.recordRequestMetric(
          'GET',
          '/detections',
          res.statusCode,
          Date.now() - startTime
        );

        return result;
      } catch (error) {
        logger.error('Failed to list detections', error as Error, {
          requestId,
          userId: req.user?.id || 'anonymous',
          service: 'api_gateway',
          traceId: req.headers['x-trace-id'] as string,
          spanId: 'list_detections',
          environment: process.env.NODE_ENV || 'development'
        });
        next(error);
      }
    }
  );

  // Create detection endpoint
  router.post('/detections',
    createRateLimiter(RATE_LIMIT_CONFIG.CREATE),
    checkPermissions({ requiredPermissions: [DETECTION_PERMISSIONS.CREATE] }),
    validateRequest,
    async (req, res, next) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string;

      try {
        const result = await createDetection(req, res);

        metrics.recordRequestMetric(
          'POST',
          '/detections',
          res.statusCode,
          Date.now() - startTime
        );

        return result;
      } catch (error) {
        logger.error('Failed to create detection', error as Error, {
          requestId,
          userId: req.user?.id || 'anonymous',
          service: 'api_gateway',
          traceId: req.headers['x-trace-id'] as string,
          spanId: 'create_detection',
          environment: process.env.NODE_ENV || 'development'
        });
        next(error);
      }
    }
  );

  // Get single detection endpoint
  router.get('/detections/:id',
    createRateLimiter(RATE_LIMIT_CONFIG.READ),
    checkPermissions({ requiredPermissions: [DETECTION_PERMISSIONS.READ] }),
    async (req, res, next) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string;

      try {
        const result = await getDetection(req, res);

        metrics.recordRequestMetric(
          'GET',
          '/detections/:id',
          res.statusCode,
          Date.now() - startTime
        );

        return result;
      } catch (error) {
        logger.error('Failed to get detection', error as Error, {
          requestId,
          userId: req.user?.id || 'anonymous',
          service: 'api_gateway',
          traceId: req.headers['x-trace-id'] as string,
          spanId: 'get_detection',
          environment: process.env.NODE_ENV || 'development'
        });
        next(error);
      }
    }
  );

  // Update detection endpoint
  router.put('/detections/:id',
    createRateLimiter(RATE_LIMIT_CONFIG.UPDATE),
    checkPermissions({ requiredPermissions: [DETECTION_PERMISSIONS.UPDATE] }),
    validateRequest,
    async (req, res, next) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string;

      try {
        const result = await updateDetection(req, res);

        metrics.recordRequestMetric(
          'PUT',
          '/detections/:id',
          res.statusCode,
          Date.now() - startTime
        );

        return result;
      } catch (error) {
        logger.error('Failed to update detection', error as Error, {
          requestId,
          userId: req.user?.id || 'anonymous',
          service: 'api_gateway',
          traceId: req.headers['x-trace-id'] as string,
          spanId: 'update_detection',
          environment: process.env.NODE_ENV || 'development'
        });
        next(error);
      }
    }
  );

  // Delete detection endpoint
  router.delete('/detections/:id',
    createRateLimiter(RATE_LIMIT_CONFIG.DELETE),
    checkPermissions({ requiredPermissions: [DETECTION_PERMISSIONS.DELETE] }),
    async (req, res, next) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string;

      try {
        const result = await deleteDetection(req, res);

        metrics.recordRequestMetric(
          'DELETE',
          '/detections/:id',
          res.statusCode,
          Date.now() - startTime
        );

        return result;
      } catch (error) {
        logger.error('Failed to delete detection', error as Error, {
          requestId,
          userId: req.user?.id || 'anonymous',
          service: 'api_gateway',
          traceId: req.headers['x-trace-id'] as string,
          spanId: 'delete_detection',
          environment: process.env.NODE_ENV || 'development'
        });
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    logger.error('Router error handler', error, {
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.id || 'anonymous',
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: 'router_error',
      environment: process.env.NODE_ENV || 'development'
    });

    metrics.recordRequestMetric(
      req.method,
      req.path,
      statusCode,
      0,
      { errorType: error.name }
    );

    res.status(statusCode).json({
      error: true,
      message,
      requestId: req.headers['x-request-id']
    });
  });

  return router;
};

export default configureDetectionRoutes();