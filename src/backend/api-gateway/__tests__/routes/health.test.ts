// External dependencies
import request from 'supertest'; // ^6.3.3
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // ^29.7.0
import express, { Express } from 'express'; // ^4.18.2

// Internal dependencies
import healthRouter from '../../src/routes/health';
import { metrics } from '../../src/utils/metrics';

// Test constants
const SERVICE_VERSION = '1.0.0';
const TEST_TIMEOUT = 10000;

// Mock dependencies
jest.mock('../../src/utils/metrics', () => ({
  recordRequestMetric: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue({
    requests: 100,
    latency_p95: 250,
    error_rate: 0.01
  })
}));

// Mock database, cache and queue health checks
const mockDependencyChecks = {
  databaseCheck: jest.fn().mockResolvedValue(true),
  cacheCheck: jest.fn().mockResolvedValue(true),
  queueCheck: jest.fn().mockResolvedValue(true)
};

// Test app setup
let app: Express;
let testServer: request.SuperTest<request.Test>;

describe('Health Routes', () => {
  beforeAll(() => {
    // Initialize Express app
    app = express();
    app.use(express.json());
    app.use(healthRouter);
    testServer = request(app);

    // Set environment variables
    process.env.SERVICE_VERSION = SERVICE_VERSION;
    process.env.NODE_ENV = 'test';

    // Configure test timeouts
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterAll(() => {
    // Clean up mocks
    jest.clearAllMocks();
    delete process.env.SERVICE_VERSION;
    delete process.env.NODE_ENV;
  });

  test('/health returns 200 with complete status', async () => {
    const response = await testServer
      .get('/health')
      .set('x-request-id', 'test-request-id')
      .set('x-trace-id', 'test-trace-id');

    // Verify response status and structure
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: 'healthy',
      version: SERVICE_VERSION,
      timestamp: expect.any(String),
      checks: expect.objectContaining({
        database: true,
        redis: true,
        queue: true,
        latencies: expect.any(Object),
        errors: expect.any(Object)
      }),
      metrics: expect.objectContaining({
        requests: expect.any(Number),
        latency_p95: expect.any(Number),
        error_rate: expect.any(Number)
      }),
      dependencies: expect.objectContaining({
        database: expect.objectContaining({
          status: 'up',
          latency: expect.any(Number)
        }),
        redis: expect.objectContaining({
          status: 'up',
          latency: expect.any(Number)
        }),
        queue: expect.objectContaining({
          status: 'up',
          latency: expect.any(Number)
        })
      })
    }));

    // Verify metrics recording
    expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
      'GET',
      '/health',
      200,
      expect.any(Number),
      { securityEvent: 'health_check' }
    );
  });

  test('/health/live returns 200 with critical checks', async () => {
    const response = await testServer
      .get('/health/live')
      .set('x-request-id', 'test-liveness-id')
      .set('x-trace-id', 'test-trace-id');

    // Verify response status and structure
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: 'alive',
      timestamp: expect.any(String)
    }));

    // Verify process uptime is positive
    expect(process.uptime()).toBeGreaterThan(0);

    // Verify metrics recording
    expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
      'GET',
      '/health/live',
      200,
      expect.any(Number),
      { securityEvent: 'liveness_check' }
    );
  });

  test('/health/ready returns 200 with dependency status', async () => {
    const response = await testServer
      .get('/health/ready')
      .set('x-request-id', 'test-readiness-id')
      .set('x-trace-id', 'test-trace-id');

    // Verify response status and structure
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: 'ready',
      timestamp: expect.any(String),
      checks: expect.objectContaining({
        dependencies: expect.objectContaining({
          database: true,
          redis: true,
          queue: true,
          latencies: expect.any(Object),
          errors: expect.any(Object)
        })
      })
    }));

    // Verify metrics recording
    expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
      'GET',
      '/health/ready',
      200,
      expect.any(Number),
      { securityEvent: 'readiness_check' }
    );
  });

  test('health check handles dependency failures', async () => {
    // Mock database failure
    mockDependencyChecks.databaseCheck.mockRejectedValueOnce(new Error('Database connection failed'));

    const response = await testServer
      .get('/health')
      .set('x-request-id', 'test-failure-id')
      .set('x-trace-id', 'test-trace-id');

    // Verify degraded status
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.database.status).toBe('down');
    expect(response.body.checks.errors).toHaveProperty('database');

    // Reset mock
    mockDependencyChecks.databaseCheck.mockResolvedValue(true);
  });

  test('health check handles timeout scenarios', async () => {
    // Mock timeout scenario
    jest.useFakeTimers();
    mockDependencyChecks.cacheCheck.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(resolve, 3000); // Simulate slow response
    }));

    const response = await testServer
      .get('/health')
      .set('x-request-id', 'test-timeout-id')
      .set('x-trace-id', 'test-trace-id');

    // Verify timeout handling
    expect(response.status).toBe(200);
    expect(response.body.dependencies.redis.latency).toBeGreaterThanOrEqual(1000);

    // Reset timers and mock
    jest.useRealTimers();
    mockDependencyChecks.cacheCheck.mockResolvedValue(true);
  });
});