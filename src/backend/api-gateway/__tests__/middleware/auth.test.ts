// External dependencies
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals'; // ^29.7.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { MockRequest, MockResponse } from 'jest-mock-express'; // ^0.2.2

// Internal dependencies
import { authenticateRequest, checkPermissions, AuthenticatedRequest } from '../../src/middleware/auth';
import { verifyToken, TokenPayload } from '../../src/auth/jwt';
import { rolePermissions } from '../../src/config/auth';
import { metrics } from '../../src/utils/metrics';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/auth/jwt');
jest.mock('../../src/utils/metrics');
jest.mock('../../src/utils/logger');

// Test constants
const VALID_TOKEN = 'valid.jwt.token';
const INVALID_TOKEN = 'invalid.token';
const TEST_USER_ID = 'test-user-123';
const TEST_REQUEST_ID = 'req-123';

// Mock token payload
const mockTokenPayload: TokenPayload = {
  userId: TEST_USER_ID,
  role: 'engineer',
  permissions: ['create:detection', 'edit:detection', 'translate:detection'],
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  jti: 'token-123',
  version: 1,
  issuer: 'detection-translator-api',
  audience: 'detection-translator-services'
};

describe('Authentication Middleware', () => {
  let mockRequest: MockRequest & AuthenticatedRequest;
  let mockResponse: MockResponse;
  let mockNext: jest.MockedFunction<NextFunction>;
  let mockVerifyToken: jest.MockedFunction<typeof verifyToken>;
  let mockRecordMetric: jest.MockedFunction<typeof metrics.recordRequestMetric>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup request mock
    mockRequest = {
      headers: {
        authorization: `Bearer ${VALID_TOKEN}`,
        'x-request-id': TEST_REQUEST_ID,
        'x-trace-id': 'trace-123',
        'x-span-id': 'span-123'
      },
      method: 'POST',
      path: '/api/v1/translate',
      secure: true
    } as MockRequest & AuthenticatedRequest;

    // Setup response mock
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    } as unknown as MockResponse;

    // Setup next function mock
    mockNext = jest.fn();

    // Setup token verification mock
    mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
    mockVerifyToken.mockResolvedValue(mockTokenPayload);

    // Setup metrics recording mock
    mockRecordMetric = metrics.recordRequestMetric as jest.MockedFunction<typeof metrics.recordRequestMetric>;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('authenticateRequest', () => {
    it('should successfully authenticate with valid JWT token', async () => {
      await authenticateRequest(mockRequest, mockResponse, mockNext);

      expect(mockVerifyToken).toHaveBeenCalledWith(VALID_TOKEN);
      expect(mockRequest.user).toEqual(mockTokenPayload);
      expect(mockRequest.securityContext).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRecordMetric).toHaveBeenCalledWith(
        'POST',
        '/api/v1/translate',
        200,
        expect.any(Number),
        expect.objectContaining({
          securityEvent: 'authentication_success',
          rateLimitGroup: 'engineer'
        })
      );
    });

    it('should fail authentication with missing authorization header', async () => {
      mockRequest.headers.authorization = undefined;

      await authenticateRequest(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing or invalid authorization header'
        })
      );
      expect(mockRecordMetric).toHaveBeenCalledWith(
        'POST',
        '/api/v1/translate',
        401,
        expect.any(Number),
        expect.objectContaining({
          securityEvent: 'authentication_failure'
        })
      );
    });

    it('should fail authentication with invalid token', async () => {
      mockRequest.headers.authorization = `Bearer ${INVALID_TOKEN}`;
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      await authenticateRequest(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token'
        })
      );
      expect(mockRecordMetric).toHaveBeenCalledWith(
        'POST',
        '/api/v1/translate',
        401,
        expect.any(Number),
        expect.objectContaining({
          errorType: 'Error',
          securityEvent: 'authentication_failure'
        })
      );
    });

    it('should handle rate limiting correctly', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimiterError';
      rateLimitError.msBeforeNext = 60000;

      mockVerifyToken.mockRejectedValue(rateLimitError);

      await authenticateRequest(mockRequest, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 60);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
          retryAfter: 60
        })
      );
    });
  });

  describe('checkPermissions', () => {
    beforeEach(() => {
      mockRequest.securityContext = {
        userId: TEST_USER_ID,
        role: 'engineer',
        permissions: ['create:detection', 'edit:detection', 'translate:detection'],
        tokenVersion: 1,
        issuer: 'detection-translator-api',
        securityLevel: 'high'
      };
    });

    it('should allow access with sufficient permissions', async () => {
      const middleware = checkPermissions({
        requiredPermissions: ['create:detection'],
        requireAll: true,
        securityLevel: 'high'
      });

      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRecordMetric).toHaveBeenCalledWith(
        'POST',
        '/api/v1/translate',
        200,
        expect.any(Number),
        expect.objectContaining({
          securityEvent: 'authorization_success',
          rateLimitGroup: 'engineer'
        })
      );
    });

    it('should deny access with insufficient permissions', async () => {
      const middleware = checkPermissions({
        requiredPermissions: ['manage:system'],
        requireAll: true,
        securityLevel: 'high'
      });

      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions'
        })
      );
      expect(mockRecordMetric).toHaveBeenCalledWith(
        'POST',
        '/api/v1/translate',
        403,
        expect.any(Number),
        expect.objectContaining({
          errorType: 'ForbiddenError',
          securityEvent: 'authorization_failure'
        })
      );
    });

    it('should enforce security level requirements', async () => {
      mockRequest.secure = false;
      const middleware = checkPermissions({
        requiredPermissions: ['create:detection'],
        securityLevel: 'high'
      });

      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Secure connection required'
        })
      );
    });

    it('should handle missing security context', async () => {
      mockRequest.securityContext = undefined;
      const middleware = checkPermissions({
        requiredPermissions: ['create:detection']
      });

      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Security context not initialized'
        })
      );
    });

    it('should support permission combination logic', async () => {
      const middleware = checkPermissions({
        requiredPermissions: ['create:detection', 'edit:detection'],
        requireAll: false
      });

      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});