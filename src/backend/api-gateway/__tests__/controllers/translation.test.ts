/**
 * Translation Controller Test Suite
 * Comprehensive tests for translation endpoints with error handling and validation
 * @version 1.0.0
 */

// External dependencies
import { jest, describe, beforeAll, beforeEach, afterEach, afterAll, it, expect } from '@jest/globals'; // ^29.7.0
import supertest from 'supertest'; // ^6.3.3

// Internal dependencies
import { translateDetection, translateBatch, getTranslationStatus } from '../../src/controllers/translation';
import { queueService } from '../../src/services/queue';
import { DetectionFormat } from '../../src/interfaces/detection';
import { TranslationJobStatus } from '../../src/interfaces/translation';

// Mock setup
jest.mock('../../src/services/queue');

// Test data fixtures
const validSplunkRequest = {
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  content: 'index=main source=firewall action=blocked',
  validateResult: true
};

const validBatchRequest = {
  detections: [
    {
      content: 'index=main source=firewall action=blocked',
      format: DetectionFormat.SPLUNK,
      metadata: { filename: 'test1.spl' }
    },
    {
      content: 'title: Suspicious Network Connection\nstatus: testing',
      format: DetectionFormat.SIGMA,
      metadata: { filename: 'test2.yml' }
    }
  ],
  targetFormat: DetectionFormat.KQL
};

// Mock response object
const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Translation Controller Tests', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeAll(() => {
    // Configure test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Reset request/response mocks
    req = {
      body: {},
      params: {},
      user: { id: 'test-user-id' }
    };
    res = mockResponse();
    next = jest.fn();

    // Reset queue service mocks
    jest.clearAllMocks();
    (queueService.publishTranslationRequest as jest.Mock).mockResolvedValue(undefined);
    (queueService.publishBatchRequest as jest.Mock).mockResolvedValue(undefined);
    (queueService.getQueueStatus as jest.Mock).mockResolvedValue({
      isConnected: true,
      messageCount: { translation_queue: 0 }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up test environment
    process.env.NODE_ENV = 'development';
  });

  describe('Single Translation Tests', () => {
    it('should accept valid translation request', async () => {
      req.body = validSplunkRequest;

      await translateDetection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          requestId: expect.any(String)
        })
      );
      expect(queueService.publishTranslationRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceFormat: DetectionFormat.SPLUNK,
          targetFormat: DetectionFormat.SIGMA
        })
      );
    });

    it('should handle invalid source format', async () => {
      req.body = {
        ...validSplunkRequest,
        sourceFormat: 'INVALID_FORMAT'
      };

      await translateDetection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('Invalid translation request')
        })
      );
    });

    it('should handle empty detection content', async () => {
      req.body = {
        ...validSplunkRequest,
        content: ''
      };

      await translateDetection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('Invalid translation request')
        })
      );
    });

    it('should handle queue service failure', async () => {
      req.body = validSplunkRequest;
      (queueService.publishTranslationRequest as jest.Mock).mockRejectedValue(
        new Error('Queue service error')
      );

      await translateDetection(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Batch Translation Tests', () => {
    it('should accept valid batch translation request', async () => {
      req.body = validBatchRequest;

      await translateBatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          batchId: expect.any(String),
          totalDetections: 2
        })
      );
      expect(queueService.publishBatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCount: 2,
          targetFormat: DetectionFormat.KQL
        })
      );
    });

    it('should handle empty batch request', async () => {
      req.body = {
        ...validBatchRequest,
        detections: []
      };

      await translateBatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('Invalid batch translation request')
        })
      );
    });

    it('should handle oversized batch request', async () => {
      req.body = {
        ...validBatchRequest,
        detections: Array(1001).fill(validBatchRequest.detections[0])
      };

      await translateBatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('Invalid batch translation request')
        })
      );
    });

    it('should handle queue service batch failure', async () => {
      req.body = validBatchRequest;
      (queueService.publishBatchRequest as jest.Mock).mockRejectedValue(
        new Error('Queue service error')
      );

      await translateBatch(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Translation Status Tests', () => {
    it('should retrieve valid job status', async () => {
      const jobId = 'test-job-id';
      req.params.jobId = jobId;
      (queueService.getJobStatus as jest.Mock).mockResolvedValue({
        status: TranslationJobStatus.COMPLETED,
        progress: 100,
        errors: []
      });

      await getTranslationStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          jobId,
          translationStatus: TranslationJobStatus.COMPLETED
        })
      );
    });

    it('should handle invalid job ID', async () => {
      req.params.jobId = 'invalid-job-id';
      (queueService.getJobStatus as jest.Mock).mockRejectedValue(
        new Error('Job not found')
      );

      await getTranslationStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle queue service status error', async () => {
      req.params.jobId = 'test-job-id';
      (queueService.getQueueStatus as jest.Mock).mockRejectedValue(
        new Error('Queue service error')
      );

      await getTranslationStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should include queue health in status response', async () => {
      req.params.jobId = 'test-job-id';
      (queueService.getJobStatus as jest.Mock).mockResolvedValue({
        status: TranslationJobStatus.IN_PROGRESS,
        progress: 50
      });
      (queueService.getQueueStatus as jest.Mock).mockResolvedValue({
        isConnected: true,
        messageCount: { translation_queue: 5 }
      });

      await getTranslationStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          systemStatus: {
            queueHealth: 'healthy',
            messageCount: expect.any(Object)
          }
        })
      );
    });
  });
});