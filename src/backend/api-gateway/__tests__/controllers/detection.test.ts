/**
 * Detection Controller Test Suite
 * Comprehensive tests for detection management, translation, and GitHub integration
 * @version 1.0.0
 */

// External dependencies
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // ^29.7.0
import { MockRequest, MockResponse } from 'jest-mock-req-res'; // ^1.0.2
import nock from 'nock'; // ^13.3.8
import redisMock from 'redis-mock'; // ^0.56.3

// Internal dependencies
import {
  createDetection,
  getDetection,
  updateDetection,
  deleteDetection,
  listDetections,
  batchTranslate,
  validateDetection,
  syncGitHub
} from '../../src/controllers/detection';
import { Detection, DetectionFormat, ValidationResult } from '../../src/interfaces/detection';
import { metrics } from '../../src/utils/metrics';
import { logger } from '../../src/utils/logger';
import { queueService } from '../../src/services/queue';

// Mock services
jest.mock('../../src/utils/metrics');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/queue');

// Test data
const mockDetections = {
  splunk: {
    id: 'test-uuid-1',
    content: 'search src_ip=* dest_port=*',
    format: DetectionFormat.SPLUNK,
    created_at: new Date('2023-01-01T00:00:00Z'),
    user_id: 'test-user-1',
    is_active: true,
    validation_score: 0.98,
    metadata: {
      description: 'Test Splunk detection',
      tags: ['test', 'splunk']
    }
  },
  sigma: {
    id: 'test-uuid-2',
    content: `
      title: Test Detection
      status: test
      logsource:
        product: windows
        service: security
    `,
    format: DetectionFormat.SIGMA,
    created_at: new Date('2023-01-01T00:00:00Z'),
    user_id: 'test-user-1',
    is_active: true,
    validation_score: 0.95,
    metadata: {
      description: 'Test SIGMA detection',
      tags: ['test', 'sigma']
    }
  }
};

describe('Detection Controller Integration', () => {
  let mockReq: MockRequest;
  let mockRes: MockResponse;

  beforeAll(() => {
    // Initialize mock Redis client
    const mockRedisClient = redisMock.createClient();
    
    // Setup GitHub API mocks
    nock('https://api.github.com')
      .persist()
      .get('/repos/test-org/detections/contents')
      .reply(200, [{ path: 'detections/test.yml', type: 'file' }]);

    // Initialize metrics
    metrics.recordRequestMetric = jest.fn();
    metrics.recordServiceMetric = jest.fn();
  });

  beforeEach(() => {
    mockReq = new MockRequest();
    mockRes = new MockResponse();
    mockReq.user = { id: 'test-user-1' };
    mockReq.headers = { 'x-request-id': 'test-request-1' };
    jest.clearAllMocks();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('Create Detection', () => {
    test('should create a valid Splunk detection', async () => {
      mockReq.body = {
        content: mockDetections.splunk.content,
        format: DetectionFormat.SPLUNK,
        metadata: mockDetections.splunk.metadata
      };

      await createDetection(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(201);
      expect(mockRes._getJSONData()).toMatchObject({
        success: true,
        data: expect.objectContaining({
          content: mockDetections.splunk.content,
          format: DetectionFormat.SPLUNK
        })
      });
      expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
        'POST',
        '/detections',
        201,
        expect.any(Number)
      );
    });

    test('should reject invalid detection format', async () => {
      mockReq.body = {
        content: 'invalid content',
        format: DetectionFormat.SPLUNK
      };

      await expect(createDetection(mockReq, mockRes)).rejects.toThrow();
      expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
        'POST',
        '/detections',
        400,
        expect.any(Number),
        { errorType: 'BadRequestError' }
      );
    });
  });

  describe('Batch Translation', () => {
    test('should process batch translation request', async () => {
      mockReq.body = {
        detections: [mockDetections.splunk, mockDetections.sigma],
        targetFormat: DetectionFormat.KQL
      };

      await batchTranslate(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(202);
      expect(mockRes._getJSONData()).toMatchObject({
        success: true,
        batchId: expect.any(String),
        status: 'queued'
      });
      expect(queueService.publishBatchRequest).toHaveBeenCalled();
    });

    test('should reject oversized batch requests', async () => {
      mockReq.body = {
        detections: Array(101).fill(mockDetections.splunk),
        targetFormat: DetectionFormat.KQL
      };

      await expect(batchTranslate(mockReq, mockRes)).rejects.toThrow();
    });
  });

  describe('Format Validation', () => {
    test('should validate Splunk SPL format', async () => {
      mockReq.body = {
        content: 'search index=* | stats count by src_ip',
        format: DetectionFormat.SPLUNK
      };

      const result = await validateDetection(mockReq, mockRes);
      expect(result.validation_score).toBeGreaterThan(0.9);
    });

    test('should validate SIGMA format', async () => {
      mockReq.body = {
        content: mockDetections.sigma.content,
        format: DetectionFormat.SIGMA
      };

      const result = await validateDetection(mockReq, mockRes);
      expect(result.validation_score).toBeGreaterThan(0.9);
    });
  });

  describe('GitHub Integration', () => {
    test('should sync detections from GitHub', async () => {
      mockReq.body = {
        repository: 'test-org/detections',
        branch: 'main',
        formats: [DetectionFormat.SIGMA, DetectionFormat.SPLUNK]
      };

      await syncGitHub(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(202);
      expect(mockRes._getJSONData()).toMatchObject({
        success: true,
        syncId: expect.any(String)
      });
      expect(queueService.publishGitHubSync).toHaveBeenCalled();
    });

    test('should handle GitHub API errors gracefully', async () => {
      nock('https://api.github.com')
        .get('/repos/invalid/repo/contents')
        .reply(404);

      mockReq.body = {
        repository: 'invalid/repo',
        branch: 'main'
      };

      await expect(syncGitHub(mockReq, mockRes)).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    test('should record request metrics', async () => {
      mockReq.body = mockDetections.splunk;
      await createDetection(mockReq, mockRes);

      expect(metrics.recordRequestMetric).toHaveBeenCalledWith(
        'POST',
        '/detections',
        201,
        expect.any(Number)
      );
    });

    test('should record service metrics for batch operations', async () => {
      mockReq.body = {
        detections: [mockDetections.splunk],
        targetFormat: DetectionFormat.KQL
      };

      await batchTranslate(mockReq, mockRes);

      expect(metrics.recordServiceMetric).toHaveBeenCalledWith(
        'queue_service',
        'publish_batch',
        'success',
        expect.any(Number)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors', async () => {
      mockReq.body = {
        content: '',
        format: 'INVALID_FORMAT'
      };

      await expect(createDetection(mockReq, mockRes)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle queue service errors', async () => {
      queueService.publishBatchRequest.mockRejectedValueOnce(new Error('Queue error'));

      mockReq.body = {
        detections: [mockDetections.splunk],
        targetFormat: DetectionFormat.KQL
      };

      await expect(batchTranslate(mockReq, mockRes)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});