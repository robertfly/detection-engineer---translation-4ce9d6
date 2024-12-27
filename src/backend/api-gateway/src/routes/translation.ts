/**
 * Translation Router Configuration
 * Implements secure, scalable, and monitored translation request handling
 * @version 1.0.0
 */

// External dependencies
import express, { Router } from 'express'; // ^4.18.2

// Internal dependencies
import {
  translateDetection,
  translateBatch,
  getTranslationStatus
} from '../controllers/translation';
import {
  authenticateRequest,
  checkPermissions
} from '../middleware/auth';
import {
  createRateLimiter
} from '../middleware/rateLimit';
import {
  validateTranslationRequest,
  validateBatchRequest
} from '../middleware/validation';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants for rate limiting and request configuration
const SINGLE_TRANSLATION_RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  burstLimit: 120,
  keyGenerator: (req: express.Request): string => {
    return `translation_${req.user?.id || req.ip}`;
  },
  handler: (req: express.Request, res: express.Response): void => {
    logger.warn('Rate limit exceeded for translation request', {
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.id || 'anonymous',
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: 'rate_limit',
      environment: process.env.NODE_ENV || 'development'
    });

    res.status(429).json({
      status: 'error',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil(60000 / 1000)
    });
  }
};

const BATCH_TRANSLATION_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  burstLimit: 15,
  keyGenerator: (req: express.Request): string => {
    return `batch_translation_${req.user?.id || req.ip}`;
  },
  handler: (req: express.Request, res: express.Response): void => {
    logger.warn('Rate limit exceeded for batch translation request', {
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.id || 'anonymous',
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: 'rate_limit',
      environment: process.env.NODE_ENV || 'development'
    });

    res.status(429).json({
      status: 'error',
      message: 'Batch translation rate limit exceeded',
      retryAfter: Math.ceil(60000 / 1000)
    });
  }
};

const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_BATCH_SIZE = 1000;

/**
 * Configures and returns the Express router with translation endpoints
 * Implements comprehensive security, validation, and monitoring
 */
function configureTranslationRoutes(): Router {
  const router = express.Router();

  // Add correlation ID middleware for request tracking
  router.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || 
      `translation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Single translation endpoint
  router.post('/translate',
    authenticateRequest,
    checkPermissions({ requiredPermissions: ['translate'] }),
    createRateLimiter(SINGLE_TRANSLATION_RATE_LIMIT),
    validateTranslationRequest,
    async (req, res, next) => {
      const startTime = Date.now();
      try {
        await translateDetection(req, res, next);
        metrics.recordRequestMetric(
          'POST',
          '/translate',
          res.statusCode,
          (Date.now() - startTime) / 1000
        );
      } catch (error) {
        next(error);
      }
    }
  );

  // Batch translation endpoint
  router.post('/translate/batch',
    authenticateRequest,
    checkPermissions({ requiredPermissions: ['translate'] }),
    createRateLimiter(BATCH_TRANSLATION_RATE_LIMIT),
    validateBatchRequest,
    async (req, res, next) => {
      const startTime = Date.now();
      try {
        // Validate batch size
        if (req.body.detections?.length > MAX_BATCH_SIZE) {
          return res.status(400).json({
            status: 'error',
            message: `Batch size exceeds maximum limit of ${MAX_BATCH_SIZE} detections`
          });
        }

        await translateBatch(req, res, next);
        metrics.recordRequestMetric(
          'POST',
          '/translate/batch',
          res.statusCode,
          (Date.now() - startTime) / 1000
        );
      } catch (error) {
        next(error);
      }
    }
  );

  // Translation status endpoint
  router.get('/translate/status/:jobId',
    authenticateRequest,
    checkPermissions({ requiredPermissions: ['translate'] }),
    async (req, res, next) => {
      const startTime = Date.now();
      try {
        await getTranslationStatus(req, res, next);
        metrics.recordRequestMetric(
          'GET',
          '/translate/status',
          res.statusCode,
          (Date.now() - startTime) / 1000
        );
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Translation route error', error, {
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.id || 'anonymous',
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: 'route_error',
      environment: process.env.NODE_ENV || 'development'
    });

    res.status(error.status || 500).json({
      status: 'error',
      message: error.message,
      code: error.name,
      requestId: req.headers['x-request-id']
    });
  });

  return router;
}

// Export configured router
export const router = configureTranslationRoutes();