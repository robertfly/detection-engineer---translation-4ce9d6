/**
 * Translation Routes Test Suite
 * Comprehensive testing for translation endpoints including authentication,
 * rate limiting, validation, and error handling
 * @version 1.0.0
 */

// External dependencies
import request from 'supertest'; // ^6.3.3
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.7.0

// Internal dependencies
import { router } from '../../src/routes/translation';
import { 
  TranslationRequest, 
  BatchTranslationRequest, 
  TranslationResult, 
  ValidationResult 
} from '../../src/interfaces/translation';
import { DetectionFormat } from '../../src/interfaces/detection';

// Mock dependencies
jest.mock('../../src/middleware/auth', () => ({
  authenticateRequest: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', role: 'engineer' };
    next();
  }),
  checkPermissions: () => jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  createRateLimiter: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../src/services/queue', () => ({
  queueService: {
    publishTranslationRequest: jest.fn(),
    publishBatchRequest: jest.fn(),
    getQueueStatus: jest.fn()
  }
}));

// Test data constants
const mockValidTranslationRequest: TranslationRequest = {
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  content: 'search index=* | where source="security" | stats count by src_ip, dest_ip',
  validateResult: true
};

const mockValidBatchRequest: BatchTranslationRequest = {
  detections: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      content: 'search index=* | where source="security"',
      format: DetectionFormat.SPLUNK
    }
  ],
  targetFormat: DetectionFormat.SIGMA,
  validateResults: true
};

describe('Translation Routes', () => {
  let app: any;

  beforeEach(() => {
    app = request(router);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('/translate POST endpoint', () => {
    it('should accept valid translation request and return 202', async () => {
      const response = await app
        .post('/translate')
        .send(mockValidTranslationRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(202);

      expect(response.body).toMatchObject({
        status: 'accepted',
        requestId: expect.any(String),
        message: 'Translation request accepted'
      });
    });

    it('should validate required fields in translation request', async () => {
      const invalidRequest = { ...mockValidTranslationRequest, content: undefined };
      
      const response = await app
        .post('/translate')
        .send(invalidRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('Invalid translation request')
      });
    });

    it('should enforce rate limiting on translation requests', async () => {
      // Mock rate limiter to simulate limit exceeded
      const rateLimiter = require('../../src/middleware/rateLimit');
      rateLimiter.createRateLimiter.mockImplementationOnce(() => (req, res, next) => {
        res.status(429).json({
          status: 'error',
          message: 'Rate limit exceeded',
          retryAfter: 60
        });
      });

      await app
        .post('/translate')
        .send(mockValidTranslationRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(429);
    });

    it('should validate source and target format compatibility', async () => {
      const incompatibleRequest = {
        ...mockValidTranslationRequest,
        sourceFormat: DetectionFormat.YARA,
        targetFormat: DetectionFormat.SPLUNK
      };

      const response = await app
        .post('/translate')
        .send(incompatibleRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.message).toContain('format compatibility');
    });

    it('should handle authentication failures', async () => {
      const auth = require('../../src/middleware/auth');
      auth.authenticateRequest.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ message: 'Invalid token' });
      });

      await app
        .post('/translate')
        .send(mockValidTranslationRequest)
        .expect(401);
    });
  });

  describe('/translate/batch POST endpoint', () => {
    it('should accept valid batch translation request and return 202', async () => {
      const response = await app
        .post('/translate/batch')
        .send(mockValidBatchRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(202);

      expect(response.body).toMatchObject({
        status: 'accepted',
        batchId: expect.any(String),
        totalDetections: mockValidBatchRequest.detections.length
      });
    });

    it('should validate batch size limits', async () => {
      const oversizedBatch = {
        ...mockValidBatchRequest,
        detections: Array(1001).fill(mockValidBatchRequest.detections[0])
      };

      const response = await app
        .post('/translate/batch')
        .send(oversizedBatch)
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.message).toContain('Batch size exceeds maximum limit');
    });

    it('should enforce batch-specific rate limits', async () => {
      const rateLimiter = require('../../src/middleware/rateLimit');
      rateLimiter.createRateLimiter.mockImplementationOnce(() => (req, res, next) => {
        res.status(429).json({
          status: 'error',
          message: 'Batch translation rate limit exceeded',
          retryAfter: 60
        });
      });

      await app
        .post('/translate/batch')
        .send(mockValidBatchRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(429);
    });

    it('should validate all detections in batch request', async () => {
      const invalidBatch = {
        ...mockValidBatchRequest,
        detections: [
          ...mockValidBatchRequest.detections,
          { content: '', format: 'invalid' }
        ]
      };

      const response = await app
        .post('/translate/batch')
        .send(invalidBatch)
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('/translate/status/:jobId GET endpoint', () => {
    it('should return translation job status', async () => {
      const mockStatus = {
        status: 'completed',
        progress: 100,
        errors: [],
        warnings: []
      };

      const queueService = require('../../src/services/queue').queueService;
      queueService.getJobStatus.mockResolvedValueOnce(mockStatus);

      const response = await app
        .get('/translate/status/test-job-id')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        translationStatus: 'completed'
      });
    });

    it('should handle non-existent job IDs', async () => {
      const queueService = require('../../src/services/queue').queueService;
      queueService.getJobStatus.mockRejectedValueOnce(new Error('Job not found'));

      await app
        .get('/translate/status/non-existent-id')
        .set('Authorization', 'Bearer test-token')
        .expect(404);
    });

    it('should require authentication for status checks', async () => {
      const auth = require('../../src/middleware/auth');
      auth.authenticateRequest.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ message: 'Authentication required' });
      });

      await app
        .get('/translate/status/test-job-id')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      const queueService = require('../../src/services/queue').queueService;
      queueService.publishTranslationRequest.mockRejectedValueOnce(new Error('Queue service error'));

      const response = await app
        .post('/translate')
        .send(mockValidTranslationRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        code: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should handle validation service failures', async () => {
      const validation = require('../../src/middleware/validation');
      validation.validateTranslationRequest.mockRejectedValueOnce(new Error('Validation service error'));

      const response = await app
        .post('/translate')
        .send(mockValidTranslationRequest)
        .set('Authorization', 'Bearer test-token')
        .expect(500);

      expect(response.body.message).toContain('validation');
    });
  });
});