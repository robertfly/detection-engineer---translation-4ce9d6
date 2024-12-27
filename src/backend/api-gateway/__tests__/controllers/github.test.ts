/**
 * GitHub Controller Test Suite
 * Version: 1.0.0
 * 
 * Comprehensive test suite for GitHub integration endpoints validating
 * repository management, file operations, security controls, and error handling.
 */

// External dependencies
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.7.0
import supertest from 'supertest'; // v6.3.3
import { Request, Response, NextFunction } from 'express'; // v4.18.2

// Internal dependencies
import { 
  listRepositories, 
  getBranches, 
  getFiles, 
  syncRepository 
} from '../../src/controllers/github';
import { 
  GitHubRepository, 
  GitHubBranch, 
  GitHubFile, 
  GitHubSyncStatus, 
  GitHubError 
} from '../../src/interfaces/github';
import { GitHubService } from '../../src/services/github';

// Mock GitHub service
jest.mock('../../src/services/github');

// Mock request, response, and next function
const mockRequest = jest.fn().mockImplementation(() => ({
  headers: { 
    authorization: 'Bearer test-token',
    'x-request-id': 'test-request-id'
  },
  query: {},
  params: {},
  user: { id: 'test-user' },
  ip: '127.0.0.1'
}));

const mockResponse = jest.fn().mockImplementation(() => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
}));

const mockNext = jest.fn();

// Test timeout configuration
jest.setTimeout(30000);

describe('GitHub Controller', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = mockRequest() as unknown as Request;
    res = mockResponse() as unknown as Response;
    next = mockNext;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('listRepositories', () => {
    const mockRepositories: GitHubRepository[] = [
      {
        id: 1,
        name: 'test-repo',
        fullName: 'org/test-repo',
        url: 'https://github.com/org/test-repo',
        defaultBranch: 'main',
        private: false,
        description: 'Test repository'
      }
    ];

    test('should successfully list repositories with pagination', async () => {
      const GitHubServiceMock = GitHubService as jest.MockedClass<typeof GitHubService>;
      GitHubServiceMock.prototype.listRepositories.mockResolvedValueOnce(mockRepositories);

      req.query = { page: '1', perPage: '30', organization: 'test-org' };
      await listRepositories(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRepositories,
        pagination: {
          page: 1,
          perPage: 30,
          total: 1
        }
      });
    });

    test('should handle rate limit exceeded error', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      GitHubService.prototype.listRepositories.mockRejectedValueOnce(rateLimitError);

      await listRepositories(req, res, next);

      expect(next).toHaveBeenCalledWith(rateLimitError);
    });

    test('should handle invalid organization parameter', async () => {
      req.query = { organization: '' };
      await listRepositories(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBranches', () => {
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

    test('should successfully list branches', async () => {
      GitHubService.prototype.getBranches.mockResolvedValueOnce(mockBranches);

      req.params = { owner: 'org', repo: 'test-repo' };
      await getBranches(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBranches,
        pagination: {
          page: 1,
          perPage: 100,
          total: 1
        }
      });
    });

    test('should handle missing repository parameters', async () => {
      req.params = {};
      await getBranches(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Owner and repository name are required'
        })
      );
    });
  });

  describe('getFiles', () => {
    const mockFiles: GitHubFile[] = [
      {
        path: 'detections/test.yml',
        name: 'test.yml',
        sha: 'def456',
        size: 1024,
        content: 'detection content',
        type: 'file',
        encoding: 'utf-8',
        url: 'https://api.github.com/repos/org/test-repo/contents/detections/test.yml'
      }
    ];

    test('should successfully list files with filtering', async () => {
      GitHubService.prototype.getFiles.mockResolvedValueOnce(mockFiles);

      req.params = { 
        owner: 'org', 
        repo: 'test-repo', 
        path: 'detections', 
        branch: 'main' 
      };
      req.query = { recursive: 'true' };
      
      await getFiles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockFiles,
        metadata: {
          path: 'detections',
          branch: 'main',
          recursive: true
        }
      });
    });

    test('should handle path traversal attempts', async () => {
      req.params = { 
        owner: 'org', 
        repo: 'test-repo', 
        path: '../../../secrets', 
        branch: 'main' 
      };
      
      await getFiles(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('syncRepository', () => {
    const mockSyncStatus: GitHubSyncStatus = {
      repositoryId: 1,
      branch: 'main',
      lastSyncTimestamp: new Date(),
      status: 'completed',
      error: null,
      filesProcessed: 10,
      totalFiles: 10
    };

    test('should successfully sync repository', async () => {
      GitHubService.prototype.syncRepository.mockResolvedValueOnce(mockSyncStatus);

      req.body = { 
        repositoryId: 1, 
        branch: 'main', 
        validateRules: true 
      };
      
      await syncRepository(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSyncStatus
      });
    });

    test('should handle sync conflicts', async () => {
      const syncError = new Error('Sync conflict detected');
      GitHubService.prototype.syncRepository.mockRejectedValueOnce(syncError);

      req.body = { repositoryId: 1 };
      await syncRepository(req, res, next);

      expect(next).toHaveBeenCalledWith(syncError);
    });

    test('should validate required sync parameters', async () => {
      req.body = {};
      await syncRepository(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Repository ID is required'
        })
      );
    });
  });
});