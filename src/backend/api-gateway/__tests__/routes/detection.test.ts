/**
 * Detection Routes Test Suite
 * Comprehensive testing of detection management endpoints with security and validation
 * @version 1.0.0
 */

// External dependencies
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // v29.7.0
import supertest from 'supertest'; // v6.3.3
import express from 'express'; // v4.18.2
import nock from 'nock'; // v13.3.8

// Internal dependencies
import router from '../../src/routes/detection';
import { authenticate, authorize } from '../../src/middleware/auth';
import { rateLimit } from '../../src/middleware/rateLimit';
import { DetectionFormat } from '../../src/interfaces/detection';

// Test constants
const TEST_DETECTIONS = {
  SIGMA: {
    content: `
      title: Test SIGMA Rule
      description: Test detection for SIGMA format
      logsource:
        product: windows
        service: security
      detection:
        selection:
          EventID: 4625
        condition: selection
    `,
    format: DetectionFormat.SIGMA
  },
  SPLUNK: {
    content: 'index=windows source=WinEventLog:Security EventCode=4625 | stats count by src_ip',
    format: DetectionFormat.SPLUNK
  },
  YARA: {
    content: `
      rule TestMalware {
        meta:
          description = "Test YARA rule"
        strings:
          $a = "malicious_string"
        condition:
          $a
      }
    `,
    format: DetectionFormat.YARA
  }
};

const TEST_USERS = {
  ADMIN: {
    id: 'admin-id',
    permissions: ['detection:create', 'detection:read', 'detection:update', 'detection:delete']
  },
  USER: {
    id: 'user-id',
    permissions: ['detection:read']
  },
  NONE: {
    id: 'none-id',
    permissions: []
  }
};

const RATE_LIMITS = {
  STANDARD: { window: '1m', max: 100 },
  BATCH: { window: '1m', max: 10 }
};

// Test app setup
const app = express();
app.use(express.json());
app.use('/api/v1', router);

// Mock services
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next()),
  authorize: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  rateLimit: jest.fn((req, res, next) => next())
}));

describe('Detection Routes', () => {
  beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe('Authentication and Authorization', () => {
    test('should reject requests without authentication token', async () => {
      const response = await supertest(app)
        .get('/api/v1/detections')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should reject requests with invalid authentication token', async () => {
      const response = await supertest(app)
        .get('/api/v1/detections')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    test('should reject requests with insufficient permissions', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections')
        .set('Authorization', 'Bearer valid-token')
        .send(TEST_DETECTIONS.SIGMA)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on detection endpoints', async () => {
      // Mock rate limit exceeded
      (rateLimit as jest.Mock).mockImplementationOnce((req, res, next) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded'
        });
      });

      const response = await supertest(app)
        .get('/api/v1/detections')
        .set('Authorization', 'Bearer valid-token')
        .expect(429);

      expect(response.body).toHaveProperty('error', 'Too Many Requests');
    });
  });

  describe('Detection CRUD Operations', () => {
    test('should create new detection with valid data', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send(TEST_DETECTIONS.SIGMA)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('format', DetectionFormat.SIGMA);
    });

    test('should retrieve existing detection', async () => {
      const response = await supertest(app)
        .get('/api/v1/detections/test-id')
        .set('Authorization', `Bearer ${TEST_USERS.USER.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    test('should update existing detection', async () => {
      const response = await supertest(app)
        .put('/api/v1/detections/test-id')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send({
          content: TEST_DETECTIONS.SIGMA.content,
          format: DetectionFormat.SIGMA
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should delete existing detection', async () => {
      const response = await supertest(app)
        .delete('/api/v1/detections/test-id')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Format Validation', () => {
    test('should validate SIGMA format correctly', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send(TEST_DETECTIONS.SIGMA)
        .expect(201);

      expect(response.body.validation).toHaveProperty('success', true);
    });

    test('should validate Splunk format correctly', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send(TEST_DETECTIONS.SPLUNK)
        .expect(201);

      expect(response.body.validation).toHaveProperty('success', true);
    });

    test('should reject invalid detection format', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send({
          content: 'invalid content',
          format: DetectionFormat.SIGMA
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid detection format');
    });
  });

  describe('Batch Operations', () => {
    test('should process batch detection creation', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections/batch')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send({
          detections: [
            TEST_DETECTIONS.SIGMA,
            TEST_DETECTIONS.SPLUNK,
            TEST_DETECTIONS.YARA
          ]
        })
        .expect(202);

      expect(response.body).toHaveProperty('batchId');
      expect(response.body).toHaveProperty('status', 'queued');
    });

    test('should enforce batch size limits', async () => {
      const oversizedBatch = Array(101).fill(TEST_DETECTIONS.SIGMA);
      
      const response = await supertest(app)
        .post('/api/v1/detections/batch')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send({ detections: oversizedBatch })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Batch size exceeds limit');
    });
  });

  describe('GitHub Integration', () => {
    test('should sync detections from GitHub repository', async () => {
      const response = await supertest(app)
        .post('/api/v1/detections/github/sync')
        .set('Authorization', `Bearer ${TEST_USERS.ADMIN.id}`)
        .send({
          repository: 'org/detection-rules',
          branch: 'main'
        })
        .expect(202);

      expect(response.body).toHaveProperty('syncId');
      expect(response.body).toHaveProperty('status', 'queued');
    });
  });
});