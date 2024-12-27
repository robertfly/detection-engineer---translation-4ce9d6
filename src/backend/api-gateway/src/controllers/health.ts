// External dependencies
import { Request, Response } from 'express'; // ^4.18.2

// Internal dependencies
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants for service configuration
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const HEALTH_CHECK_TIMEOUT = 5000;
const DEPENDENCY_CHECK_TIMEOUTS = {
  database: 2000,
  redis: 1000,
  queue: 1000,
} as const;

// Interfaces for health check responses
interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  checks: ServiceChecks;
  metrics: any;
  dependencies: {
    [key: string]: {
      status: string;
      latency: number;
    };
  };
}

interface ServiceChecks {
  database: boolean;
  redis: boolean;
  queue: boolean;
  latencies: {
    [key: string]: number;
  };
  errors: {
    [key: string]: string;
  };
}

/**
 * Comprehensive health check handler with enhanced monitoring
 * @param req Express request object
 * @param res Express response object
 */
async function getHealth(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `health-${Date.now()}`;

  try {
    // Perform comprehensive health checks
    const checks = await performHealthChecks();
    const currentMetrics = await metrics.getMetrics();

    const healthStatus: HealthStatus = {
      status: checks.database && checks.redis && checks.queue ? 'healthy' : 'degraded',
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      checks,
      metrics: currentMetrics,
      dependencies: {
        database: {
          status: checks.database ? 'up' : 'down',
          latency: checks.latencies.database || 0,
        },
        redis: {
          status: checks.redis ? 'up' : 'down',
          latency: checks.latencies.redis || 0,
        },
        queue: {
          status: checks.queue ? 'up' : 'down',
          latency: checks.latencies.queue || 0,
        },
      },
    };

    // Record health check metrics
    metrics.recordRequestMetric(
      'GET',
      '/health',
      200,
      Date.now() - startTime,
      { securityEvent: 'health_check' }
    );

    // Log health check result
    logger.info('Health check completed', {
      requestId: requestId as string,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || requestId as string,
      spanId: 'health_check',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', error as Error, {
      requestId: requestId as string,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || requestId as string,
      spanId: 'health_check',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });

    res.status(503).json({
      status: 'unhealthy',
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
}

/**
 * Kubernetes liveness probe handler with basic health verification
 * @param req Express request object
 * @param res Express response object
 */
async function getLiveness(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const requestId = `liveness-${Date.now()}`;

  try {
    // Basic service health verification
    const isAlive = process.uptime() > 0;

    metrics.recordRequestMetric(
      'GET',
      '/health/live',
      isAlive ? 200 : 503,
      Date.now() - startTime,
      { securityEvent: 'liveness_check' }
    );

    logger.info('Liveness check completed', {
      requestId,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || requestId,
      spanId: 'liveness_check',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });

    res.status(isAlive ? 200 : 503).json({
      status: isAlive ? 'alive' : 'dead',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Liveness check failed', error as Error, {
      requestId,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || requestId,
      spanId: 'liveness_check',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });

    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
}

/**
 * Kubernetes readiness probe handler with dependency checks
 * @param req Express request object
 * @param res Express response object
 */
async function getReadiness(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const requestId = `readiness-${Date.now()}`;

  try {
    const checks = await performHealthChecks();
    const isReady = checks.database && checks.redis && checks.queue;

    metrics.recordRequestMetric(
      'GET',
      '/health/ready',
      isReady ? 200 : 503,
      Date.now() - startTime,
      { securityEvent: 'readiness_check' }
    );

    logger.info('Readiness check completed', {
      requestId,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || requestId,
      spanId: 'readiness_check',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        dependencies: checks,
      },
    });
  } catch (error) {
    logger.error('Readiness check failed', error as Error, {
      requestId,
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string || requestId,
      spanId: 'readiness_check',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });

    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
}

/**
 * Performs comprehensive health checks on all service dependencies
 * @returns Promise<ServiceChecks> Results of all dependency checks
 */
async function performHealthChecks(): Promise<ServiceChecks> {
  const checks: ServiceChecks = {
    database: false,
    redis: false,
    queue: false,
    latencies: {},
    errors: {},
  };

  const checkPromises = [
    checkDatabaseHealth(checks),
    checkRedisHealth(checks),
    checkQueueHealth(checks),
  ];

  await Promise.all(checkPromises);
  return checks;
}

/**
 * Checks database health with timeout
 * @param checks ServiceChecks object to update
 */
async function checkDatabaseHealth(checks: ServiceChecks): Promise<void> {
  const startTime = Date.now();
  try {
    // Implement actual database health check here
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, DEPENDENCY_CHECK_TIMEOUTS.database)),
      // Add actual database check here
      Promise.resolve(),
    ]);
    checks.database = true;
    checks.latencies.database = Date.now() - startTime;
  } catch (error) {
    checks.database = false;
    checks.errors.database = (error as Error).message;
    checks.latencies.database = DEPENDENCY_CHECK_TIMEOUTS.database;
  }
}

/**
 * Checks Redis health with timeout
 * @param checks ServiceChecks object to update
 */
async function checkRedisHealth(checks: ServiceChecks): Promise<void> {
  const startTime = Date.now();
  try {
    // Implement actual Redis health check here
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, DEPENDENCY_CHECK_TIMEOUTS.redis)),
      // Add actual Redis check here
      Promise.resolve(),
    ]);
    checks.redis = true;
    checks.latencies.redis = Date.now() - startTime;
  } catch (error) {
    checks.redis = false;
    checks.errors.redis = (error as Error).message;
    checks.latencies.redis = DEPENDENCY_CHECK_TIMEOUTS.redis;
  }
}

/**
 * Checks message queue health with timeout
 * @param checks ServiceChecks object to update
 */
async function checkQueueHealth(checks: ServiceChecks): Promise<void> {
  const startTime = Date.now();
  try {
    // Implement actual queue health check here
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, DEPENDENCY_CHECK_TIMEOUTS.queue)),
      // Add actual queue check here
      Promise.resolve(),
    ]);
    checks.queue = true;
    checks.latencies.queue = Date.now() - startTime;
  } catch (error) {
    checks.queue = false;
    checks.errors.queue = (error as Error).message;
    checks.latencies.queue = DEPENDENCY_CHECK_TIMEOUTS.queue;
  }
}

// Export health check controller functions
export const healthController = {
  getHealth,
  getLiveness,
  getReadiness,
};

export default healthController;