// External dependencies
import express from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v7.1.0
import RedisStore from 'rate-limit-redis'; // v4.0.0
import IORedis from 'ioredis'; // v5.3.2

// Internal dependencies
import { createRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Global constants
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute in milliseconds
const DEFAULT_MAX_REQUESTS = 100;
const RATE_LIMIT_PREFIX = 'rate_limit:';
const REDIS_RETRY_ATTEMPTS = 3;
const REDIS_RETRY_DELAY = 1000;
const BURST_MULTIPLIER = 1.2;

// Interfaces
interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  enableRedisFailover?: boolean;
  redisRetryAttempts?: number;
  redisRetryDelay?: number;
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
  burstRemaining: number;
  isInBurst: boolean;
}

// Default configuration
const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: DEFAULT_WINDOW_MS,
  maxRequests: DEFAULT_MAX_REQUESTS,
  burstLimit: 120,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  enableRedisFailover: true,
  redisRetryAttempts: REDIS_RETRY_ATTEMPTS,
  redisRetryDelay: REDIS_RETRY_DELAY,
};

// Endpoint-specific rate limits based on technical specifications
const endpointLimits: Record<string, RateLimitConfig> = {
  singleTranslation: {
    endpoint: '/api/v1/translate',
    maxRequests: 100,
    windowMs: 60000,
    burstLimit: 120,
  },
  batchProcessing: {
    endpoint: '/api/v1/batch',
    maxRequests: 10,
    windowMs: 60000,
    burstLimit: 15,
  },
  githubOperations: {
    endpoint: '/api/v1/github',
    maxRequests: 30,
    windowMs: 3600000, // 1 hour
    burstLimit: 35,
  },
  validation: {
    endpoint: '/api/v1/validate',
    maxRequests: 200,
    windowMs: 60000,
    burstLimit: 250,
  },
};

/**
 * Creates a configured rate limiter middleware instance with enhanced features
 * @param config Rate limit configuration options
 * @returns Configured rate limiting middleware
 */
export const createRateLimiter = (config: RateLimitConfig): express.RequestHandler => {
  const redisClient = createRedisClient();
  const store = new RedisStore({
    prefix: RATE_LIMIT_PREFIX,
    // @ts-expect-error - Type mismatch in RedisStore constructor
    client: redisClient as unknown as IORedis.Redis,
    sendCommand: (...args: string[]) => redisClient.call(...args),
  });

  let retryCount = 0;
  const finalConfig = { ...defaultRateLimitConfig, ...config };

  const limiter = rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    skip: (req) => {
      const statusCode = req.res?.statusCode;
      if (finalConfig.skipFailedRequests && statusCode && statusCode >= 400) {
        return true;
      }
      if (finalConfig.skipSuccessfulRequests && statusCode && statusCode < 400) {
        return true;
      }
      return false;
    },
    keyGenerator: (req) => {
      const identifier = req.user?.id || req.ip;
      return `${RATE_LIMIT_PREFIX}${config.endpoint}:${identifier}`;
    },
    handler: (req, res) => {
      const rateLimitInfo = res.getHeader('RateLimit-Remaining') as string;
      logger.warn('Rate limit exceeded', {
        requestId: req.id as string,
        userId: req.user?.id || 'anonymous',
        service: 'api_gateway',
        traceId: req.headers['x-trace-id'] as string,
        spanId: 'rate_limit',
        environment: process.env.NODE_ENV || 'development',
      });

      metrics.recordRequestMetric(
        req.method,
        req.path,
        429,
        0,
        {
          errorType: 'rate_limit_exceeded',
          rateLimitGroup: config.endpoint,
        }
      );

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(finalConfig.windowMs / 1000),
        limit: finalConfig.maxRequests,
        remaining: parseInt(rateLimitInfo || '0'),
      });
    },
  });

  // Handle Redis failures
  store.client.on('error', (err) => {
    logger.error('Redis rate limit store error', err, {
      requestId: 'redis_rate_limit_error',
      userId: 'system',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'redis_error',
      environment: process.env.NODE_ENV || 'development',
    });

    metrics.recordServiceMetric('redis', 'rate_limit', 'error', 0, { healthScore: 0 });

    if (finalConfig.enableRedisFailover && retryCount < finalConfig.redisRetryAttempts!) {
      retryCount++;
      setTimeout(() => {
        store.client.connect();
      }, finalConfig.redisRetryDelay);
    }
  });

  return limiter;
};

/**
 * Enhanced Express middleware that applies rate limiting with comprehensive monitoring
 */
export const rateLimitMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const endpoint = req.path;
  const config = Object.values(endpointLimits).find(
    (limit) => endpoint.startsWith(limit.endpoint)
  ) || defaultRateLimitConfig;

  const limiter = createRateLimiter(config);
  
  // Apply burst limit if available
  if (config.burstLimit) {
    const currentRequests = parseInt(res.getHeader('RateLimit-Remaining') as string);
    if (currentRequests > config.maxRequests) {
      const burstRemaining = config.burstLimit - currentRequests;
      res.setHeader('X-RateLimit-Burst-Remaining', burstRemaining);
      res.setHeader('X-RateLimit-Burst-Active', 'true');
    }
  }

  // Record metrics before applying rate limit
  metrics.recordRequestMetric(
    req.method,
    req.path,
    res.statusCode,
    0,
    {
      rateLimitGroup: config.endpoint,
    }
  );

  limiter(req, res, next);
};

export default {
  createRateLimiter,
  rateLimitMiddleware,
};