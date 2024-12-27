// External dependencies
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // v29.7.0
import supertest from 'supertest'; // v6.3.3
import express from 'express'; // v4.18.2
import RedisMock from 'ioredis-mock'; // v8.9.0

// Internal dependencies
import { createRateLimiter, rateLimitMiddleware } from '../../src/middleware/rateLimit';
import { createRedisClient } from '../../src/config/redis';
import { metrics } from '../../src/utils/metrics';

// Mock Redis client
jest.mock('../../src/config/redis', () => ({
  createRedisClient: jest.fn(() => new RedisMock()),
}));

// Mock metrics recording
jest.mock('../../src/utils/metrics', () => ({
  metrics: {
    recordRequestMetric: jest.fn(),
    recordRateLimitExceeded: jest.fn(),
  },
}));

// Test constants based on technical specifications
const TEST_RATE_LIMITS = {
  translation: {
    endpoint: '/api/v1/translate',
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    burstLimit: 120,
  },
  batch: {
    endpoint: '/api/v1/batch',
    windowMs: 60000,
    maxRequests: 10,
    burstLimit: 15,
  },
  github: {
    endpoint: '/api/v1/github',
    windowMs: 3600000, // 1 hour
    maxRequests: 30,
    burstLimit: 35,
  },
  validation: {
    endpoint: '/api/v1/validate',
    windowMs: 60000,
    maxRequests: 200,
    burstLimit: 250,
  },
};

describe('Rate Limit Middleware', () => {
  let app: express.Application;
  let redisClient: RedisMock;

  beforeAll(async () => {
    // Initialize test Express app
    app = express();
    redisClient = new RedisMock();
    (createRedisClient as jest.Mock).mockReturnValue(redisClient);

    // Configure test endpoints with rate limits
    Object.values(TEST_RATE_LIMITS).forEach(({ endpoint, windowMs, maxRequests, burstLimit }) => {
      const limiter = createRateLimiter({
        endpoint,
        windowMs,
        maxRequests,
        burstLimit,
      });
      app.get(endpoint, limiter, (req, res) => res.sendStatus(200));
    });

    // Add default rate limit middleware
    app.use(rateLimitMiddleware);
  });

  afterAll(async () => {
    await redisClient.quit();
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    await redisClient.flushall();
    jest.clearAllMocks();
  });

  test('should enforce endpoint-specific rate limits', async () => {
    const { translation } = TEST_RATE_LIMITS;
    const request = supertest(app);

    // Test within limit
    for (let i = 0; i < translation.maxRequests; i++) {
      const response = await request.get(translation.endpoint);
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe(String(translation.maxRequests));
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBe(translation.maxRequests - i - 1);
    }

    // Test exceeding limit
    const response = await request.get(translation.endpoint);
    expect(response.status).toBe(429);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil(translation.windowMs / 1000),
    }));

    // Verify metrics recording
    expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
      'GET',
      translation.endpoint,
      429,
      expect.any(Number),
      expect.objectContaining({
        errorType: 'rate_limit_exceeded',
        rateLimitGroup: translation.endpoint,
      })
    );
  });

  test('should handle burst limits correctly', async () => {
    const { batch } = TEST_RATE_LIMITS;
    const request = supertest(app);

    // Test normal rate limit
    for (let i = 0; i < batch.maxRequests; i++) {
      const response = await request.get(batch.endpoint);
      expect(response.status).toBe(200);
    }

    // Test burst allowance
    for (let i = 0; i < (batch.burstLimit - batch.maxRequests); i++) {
      const response = await request.get(batch.endpoint);
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-burst-active']).toBe('true');
      expect(parseInt(response.headers['x-ratelimit-burst-remaining'])).toBe(
        batch.burstLimit - batch.maxRequests - i - 1
      );
    }

    // Test exceeding burst limit
    const response = await request.get(batch.endpoint);
    expect(response.status).toBe(429);
  });

  test('should handle Redis failures gracefully', async () => {
    const request = supertest(app);
    const mockError = new Error('Redis connection failed');

    // Simulate Redis failure
    redisClient.emit('error', mockError);

    // Test fallback behavior
    const response = await request.get(TEST_RATE_LIMITS.validation.endpoint);
    expect(response.status).toBe(200);

    // Verify error metrics
    expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
      'GET',
      TEST_RATE_LIMITS.validation.endpoint,
      200,
      expect.any(Number),
      expect.any(Object)
    );
  });

  test('should record rate limit metrics correctly', async () => {
    const { github } = TEST_RATE_LIMITS;
    const request = supertest(app);

    // Generate rate limit events
    for (let i = 0; i <= github.maxRequests; i++) {
      await request.get(github.endpoint);
    }

    // Verify metrics recording
    expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
      'GET',
      github.endpoint,
      429,
      expect.any(Number),
      expect.objectContaining({
        errorType: 'rate_limit_exceeded',
        rateLimitGroup: github.endpoint,
      })
    );
  });

  test('should respect different time windows', async () => {
    const { github } = TEST_RATE_LIMITS;
    const request = supertest(app);

    // Test hourly limit
    for (let i = 0; i < github.maxRequests; i++) {
      const response = await request.get(github.endpoint);
      expect(response.status).toBe(200);
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBe(github.maxRequests - i - 1);
    }

    // Verify hourly reset time
    const response = await request.get(github.endpoint);
    expect(response.status).toBe(429);
    expect(parseInt(response.headers['retry-after'])).toBeLessThanOrEqual(3600);
  });

  test('should handle concurrent requests correctly', async () => {
    const { validation } = TEST_RATE_LIMITS;
    const request = supertest(app);

    // Send concurrent requests
    const requests = Array(validation.maxRequests + 5)
      .fill(null)
      .map(() => request.get(validation.endpoint));

    const responses = await Promise.all(requests);

    // Verify rate limiting worked under load
    const successCount = responses.filter(r => r.status === 200).length;
    const rateLimitedCount = responses.filter(r => r.status === 429).length;

    expect(successCount).toBe(validation.maxRequests);
    expect(rateLimitedCount).toBe(5);
  });
});