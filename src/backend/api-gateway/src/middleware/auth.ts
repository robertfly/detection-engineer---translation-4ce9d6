// External dependencies
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { UnauthorizedError, ForbiddenError } from 'http-errors'; // ^2.0.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1

// Internal dependencies
import { verifyToken, TokenPayload } from '../auth/jwt';
import { rolePermissions, SecurityContext } from '../config/auth';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants for metrics and security
const AUTH_METRIC_NAME = 'auth_requests_total';
const PERMISSION_METRIC_NAME = 'permission_checks_total';
const RATE_LIMIT_METRIC_NAME = 'rate_limit_checks_total';
const SECURITY_EVENT_METRIC_NAME = 'security_events_total';
const TOKEN_VERSION_KEY = 'token_version';
const RATE_LIMIT_WINDOW = 60; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // Maximum requests per window

/**
 * Extended Express Request interface with security context
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  securityContext?: SecurityContext;
  rateLimitInfo?: RateLimitInfo;
}

/**
 * Interface for permission check options
 */
interface PermissionOptions {
  requiredPermissions: string[];
  requireAll?: boolean;
  enforceRateLimit?: boolean;
  securityLevel?: 'low' | 'medium' | 'high';
}

/**
 * Interface for rate limiting information
 */
interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  identifier: string;
}

// Initialize Redis-based rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: global.redisClient, // Assuming Redis client is initialized globally
  points: RATE_LIMIT_MAX_REQUESTS,
  duration: RATE_LIMIT_WINDOW,
  blockDuration: RATE_LIMIT_WINDOW,
  keyPrefix: 'rl',
});

/**
 * Enhanced authentication middleware with comprehensive security features
 */
export const authenticateRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token with enhanced security checks
    const decodedToken = await verifyToken(token);

    // Create security context
    const securityContext: SecurityContext = {
      userId: decodedToken.userId,
      role: decodedToken.role,
      permissions: decodedToken.permissions,
      tokenVersion: decodedToken.version,
      issuer: decodedToken.issuer,
      securityLevel: 'high',
    };

    // Apply rate limiting
    const rateLimitKey = `${securityContext.userId}:${req.path}`;
    const rateLimitResult = await rateLimiter.consume(rateLimitKey);

    // Attach user and security information to request
    req.user = decodedToken;
    req.securityContext = securityContext;
    req.rateLimitInfo = {
      remaining: rateLimitResult.remainingPoints,
      resetTime: rateLimitResult.msBeforeNext,
      identifier: rateLimitKey,
    };

    // Record security metrics
    metrics.recordRequestMetric(
      req.method,
      req.path,
      200,
      Date.now() - startTime,
      {
        securityEvent: 'authentication_success',
        rateLimitGroup: securityContext.role,
      }
    );

    // Log successful authentication
    logger.debug('Authentication successful', {
      requestId,
      userId: securityContext.userId,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: req.headers['x-span-id'] as string,
      environment: process.env.NODE_ENV || 'development',
    });

    next();
  } catch (error) {
    // Handle rate limit errors
    if (error.name === 'RateLimiterError') {
      res.setHeader('Retry-After', error.msBeforeNext / 1000);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: error.msBeforeNext / 1000,
      });
      return;
    }

    // Record security failure metrics
    metrics.recordRequestMetric(
      req.method,
      req.path,
      401,
      Date.now() - startTime,
      {
        errorType: error.name,
        securityEvent: 'authentication_failure',
      }
    );

    // Log authentication failure
    logger.error('Authentication failed', error as Error, {
      requestId,
      userId: 'unknown',
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: req.headers['x-span-id'] as string,
      environment: process.env.NODE_ENV || 'development',
    });

    next(error);
  }
};

/**
 * Enhanced permission checking middleware factory with security monitoring
 */
export const checkPermissions = (options: PermissionOptions) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      if (!req.securityContext) {
        throw new UnauthorizedError('Security context not initialized');
      }

      const { permissions, role } = req.securityContext;

      // Verify required permissions
      const hasPermissions = options.requireAll
        ? options.requiredPermissions.every(p => permissions.includes(p))
        : options.requiredPermissions.some(p => permissions.includes(p));

      if (!hasPermissions) {
        throw new ForbiddenError('Insufficient permissions');
      }

      // Additional security level checks
      if (options.securityLevel === 'high' && !req.secure) {
        throw new ForbiddenError('Secure connection required');
      }

      // Record authorization metrics
      metrics.recordRequestMetric(
        req.method,
        req.path,
        200,
        Date.now() - startTime,
        {
          securityEvent: 'authorization_success',
          rateLimitGroup: role,
        }
      );

      next();
    } catch (error) {
      // Record authorization failure metrics
      metrics.recordRequestMetric(
        req.method,
        req.path,
        403,
        Date.now() - startTime,
        {
          errorType: error.name,
          securityEvent: 'authorization_failure',
        }
      );

      // Log authorization failure
      logger.error('Authorization failed', error as Error, {
        requestId,
        userId: req.securityContext?.userId || 'unknown',
        service: 'api_gateway',
        traceId: req.headers['x-trace-id'] as string,
        spanId: req.headers['x-span-id'] as string,
        environment: process.env.NODE_ENV || 'development',
      });

      next(error);
    }
  };
};

// Export interfaces for external use
export { AuthenticatedRequest };