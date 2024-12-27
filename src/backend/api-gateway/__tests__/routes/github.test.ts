/**
 * GitHub Integration Routes Test Suite
 * Version: 1.0.0
 * 
 * Comprehensive test suite for GitHub integration routes with enhanced security,
 * performance monitoring, and validation testing.
 */

// External dependencies
import request from 'supertest'; // v6.3.3
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.7.0
import nock from 'nock'; // v13.3.8

// Internal dependencies
import router from '../../src/routes/github';
import { GitHubRepository, GitHubBranch, GitHubFile } from '../../src/interfaces/github';

// Mock data for testing
const mockRepositories: GitHubRepository[] = [
  {
    id: 1,
    name: 'test-repo',
    fullName: 'org/test-repo',
    url: 'https://github.com/org/test-repo',
    defaultBranch: 'main',
    private: true,
    description: 'Test repository'
  }
];

const mockBranches: GitHubBranch[] = [
  {
    name: 'main',
    commit: {
      sha: 'abc123',
      url: 'https://api.github.com/repos/org/test-repo/commits/abc123'
    },
    protected: true
  }
];

const mockFiles: GitHubFile[] = [
  {
    path: 'detections/test.yml',
    name: 'test.yml',
    sha: 'def456',
    size: 1024,
    content: 'title: Test Detection\ndetection:\n  keywords: ["test"]',
    type: 'file',
    encoding: 'utf-8',
    url: 'https://api.github.com/repos/org/test-repo/contents/detections/test.yml'
  }
];

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user',
      permissions: ['github:read', 'github:write']
    };
    next();
  },
  checkPermissions: () => (req: any, res: any, next: any) => next()
}));

describe('GitHub Routes', () => {
  const app = require('express')();
  app.use('/api/v1/github', router);

  beforeEach(() => {
    // Configure nock for GitHub API mocking
    nock('https://api.github.com')
      .persist()
      .get('/user/repos')
      .reply(200, mockRepositories)
      .get('/repos/org/test-repo/branches')
      .reply(200, mockBranches)
      .get('/repos/org/test-repo/contents')
      .reply(200, mockFiles);
  });

  afterEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('GET /repositories', () => {
    test('should return list of repositories with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/github/repositories')
        .query({ page: 1, perPage: 10 })
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String)
          })
        ]),
        pagination: {
          page: 1,
          perPage: 10,
          total: expect.any(Number)
        }
      });
    });

    test('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/v1/github/repositories')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should handle rate limiting', async () => {
      // Make multiple requests to trigger rate limit
      const requests = Array(101).fill(null).map(() =>
        request(app)
          .get('/api/v1/github/repositories')
          .set('Authorization', 'Bearer test-token')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body).toHaveProperty('error', 'Too Many Requests');
    });
  });

  describe('GET /repositories/:id/branches', () => {
    test('should return list of branches for valid repository', async () => {
      const response = await request(app)
        .get('/api/v1/github/repositories/1/branches')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            commit: expect.objectContaining({
              sha: expect.any(String)
            })
          })
        ])
      });
    });

    test('should handle invalid repository ID', async () => {
      const response = await request(app)
        .get('/api/v1/github/repositories/999/branches')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /repositories/:id/files', () => {
    test('should return list of files with path filtering', async () => {
      const response = await request(app)
        .get('/api/v1/github/repositories/1/files')
        .query({ path: 'detections', recursive: true })
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            type: expect.any(String)
          })
        ]),
        metadata: {
          path: 'detections',
          recursive: true
        }
      });
    });

    test('should validate path parameters', async () => {
      const response = await request(app)
        .get('/api/v1/github/repositories/1/files')
        .query({ path: '../invalid/path' })
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /repositories/:id/sync', () => {
    test('should initiate repository synchronization', async () => {
      const response = await request(app)
        .post('/api/v1/github/repositories/1/sync')
        .send({
          branch: 'main',
          validateRules: true
        })
        .set('Authorization', 'Bearer test-token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          repositoryId: 1,
          status: expect.any(String),
          filesProcessed: expect.any(Number)
        })
      });
    });

    test('should validate sync parameters', async () => {
      const response = await request(app)
        .post('/api/v1/github/repositories/1/sync')
        .send({
          branch: '../invalid/branch',
          validateRules: true
        })
        .set('Authorization', 'Bearer test-token')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should enforce rate limits for sync operations', async () => {
      // Make multiple sync requests to trigger rate limit
      const requests = Array(11).fill(null).map(() =>
        request(app)
          .post('/api/v1/github/repositories/1/sync')
          .send({ branch: 'main' })
          .set('Authorization', 'Bearer test-token')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body).toHaveProperty('error', 'Too Many Requests');
    });
  });
});