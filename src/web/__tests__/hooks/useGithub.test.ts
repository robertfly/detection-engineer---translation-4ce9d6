// @jest/globals version: ^29.0.0
// @testing-library/react-hooks version: ^8.0.1
// react-redux version: ^8.0.5
// @reduxjs/toolkit version: ^1.9.7
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useGithub } from '../../src/hooks/useGithub';
import { GitHubService } from '../../src/services/github';
import * as githubActions from '../../src/store/githubSlice';
import { metrics } from '../../src/utils/metrics';
import { logger } from '../../src/utils/logger';
import { API_REQUEST_LIMITS } from '../../src/config/constants';

// Mock dependencies
jest.mock('../../src/services/github');
jest.mock('../../src/utils/metrics');
jest.mock('../../src/utils/logger');

// Test data constants
const TEST_REPO = {
  id: 1,
  name: 'test-repo',
  fullName: 'org/test-repo',
  url: 'https://github.com/org/test-repo',
  defaultBranch: 'main',
  permissions: {
    admin: true,
    push: true,
    pull: true
  }
};

const TEST_FILE = {
  path: 'detections/test.spl',
  name: 'test.spl',
  sha: 'abc123',
  size: 1024,
  content: 'test content',
  encoding: 'utf8' as const,
  type: 'file' as const,
  lastModified: new Date()
};

const TEST_SYNC_STATUS = {
  repositoryId: 1,
  branch: 'main',
  lastSyncTimestamp: new Date(),
  status: 'completed' as const,
  progress: {
    current: 10,
    total: 10,
    percentage: 100
  }
};

// Test security context
const TEST_SECURITY_CONTEXT = {
  userId: 'test-user',
  sessionId: 'test-session',
  userRole: 'ENGINEER',
  lastAccess: new Date(),
  permissions: ['READ', 'WRITE']
};

// Test rate limit info
const TEST_RATE_LIMIT = {
  remaining: API_REQUEST_LIMITS.GITHUB_OPERATIONS.REQUESTS_PER_HOUR,
  reset: Date.now() + 3600000,
  limit: API_REQUEST_LIMITS.GITHUB_OPERATIONS.REQUESTS_PER_HOUR
};

describe('useGithub', () => {
  let mockStore: any;
  let wrapper: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Configure mock store with initial state
    mockStore = configureStore({
      reducer: {
        github: (state = {
          repositories: [],
          selectedFiles: [],
          syncStatus: null,
          loading: false,
          error: null,
          validationStatus: {
            isValid: true,
            errors: [],
            lastValidated: null
          },
          securityContext: TEST_SECURITY_CONTEXT,
          rateLimitStatus: TEST_RATE_LIMIT,
          operationMetrics: {
            operationCount: 0,
            lastOperation: null,
            errorCount: 0
          }
        }, action: any) => state
      }
    });

    // Configure wrapper with Redux Provider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Mock GitHubService implementation
    (GitHubService as jest.Mock).mockImplementation(() => ({
      validateAndProcessRepository: jest.fn().mockResolvedValue(TEST_REPO),
      listFiles: jest.fn().mockResolvedValue([TEST_FILE]),
      syncRepository: jest.fn().mockResolvedValue(TEST_SYNC_STATUS)
    }));
  });

  test('should initialize with correct default values', () => {
    const { result } = renderHook(() => useGithub(), { wrapper });

    expect(result.current.repositories).toEqual([]);
    expect(result.current.selectedFiles).toEqual([]);
    expect(result.current.syncStatus).toBeNull();
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
    expect(result.current.securityContext).toEqual(TEST_SECURITY_CONTEXT);
    expect(result.current.rateLimitStatus).toEqual(TEST_RATE_LIMIT);
  });

  test('should fetch repositories with security validation', async () => {
    const { result } = renderHook(() => useGithub(), { wrapper });

    await act(async () => {
      const response = await result.current.fetchRepositories('test-org');
      expect(response.success).toBeTruthy();
      expect(response.data).toEqual([TEST_REPO]);
    });

    // Verify security metrics were tracked
    expect(metrics.trackSecurityMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'github_operation',
        severity: 'medium',
        details: expect.objectContaining({
          operation: 'fetch_repositories'
        })
      }),
      expect.objectContaining(TEST_SECURITY_CONTEXT)
    );
  });

  test('should handle rate limit exceeded', async () => {
    const { result } = renderHook(() => useGithub(), {
      wrapper: ({ children }) => (
        <Provider store={configureStore({
          reducer: {
            github: (state = {
              ...mockStore.getState().github,
              rateLimitStatus: { ...TEST_RATE_LIMIT, remaining: 0 }
            }, action: any) => state
          }
        })}>
          {children}
        </Provider>
      )
    });

    await act(async () => {
      const response = await result.current.fetchRepositories('test-org');
      expect(response.success).toBeFalsy();
      expect(response.error?.message).toContain('Rate limit exceeded');
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit exceeded'),
      expect.any(Object)
    );
  });

  test('should fetch repository files with access validation', async () => {
    const { result } = renderHook(() => useGithub(), { wrapper });

    await act(async () => {
      const response = await result.current.fetchRepositoryFiles(1, 'main', 'detections');
      expect(response.success).toBeTruthy();
      expect(response.data).toEqual([TEST_FILE]);
    });

    // Verify security validation
    expect(metrics.trackSecurityMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'github_operation',
        details: expect.objectContaining({
          operation: 'fetch_files'
        })
      }),
      expect.objectContaining(TEST_SECURITY_CONTEXT)
    );
  });

  test('should sync repository with progress tracking', async () => {
    const { result } = renderHook(() => useGithub(), { wrapper });

    await act(async () => {
      const response = await result.current.syncRepository(1, 'main');
      expect(response.success).toBeTruthy();
      expect(response.data).toEqual(TEST_SYNC_STATUS);
    });

    // Verify progress tracking
    expect(metrics.trackUserActivity).toHaveBeenCalledWith(
      'github_sync',
      expect.objectContaining({
        status: 'completed',
        repositoryId: 1
      }),
      expect.objectContaining(TEST_SECURITY_CONTEXT)
    );
  });

  test('should handle insufficient permissions', async () => {
    const { result } = renderHook(() => useGithub(), {
      wrapper: ({ children }) => (
        <Provider store={configureStore({
          reducer: {
            github: (state = {
              ...mockStore.getState().github,
              securityContext: {
                ...TEST_SECURITY_CONTEXT,
                permissions: []
              }
            }, action: any) => state
          }
        })}>
          {children}
        </Provider>
      )
    });

    await act(async () => {
      const response = await result.current.fetchRepositories('test-org');
      expect(response.success).toBeFalsy();
      expect(response.error?.message).toContain('Insufficient permissions');
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch repositories',
      expect.objectContaining({
        error: expect.any(Error)
      })
    );
  });

  test('should track operation metrics', async () => {
    const { result } = renderHook(() => useGithub(), { wrapper });

    await act(async () => {
      await result.current.fetchRepositories('test-org');
      await result.current.fetchRepositoryFiles(1, 'main');
      await result.current.syncRepository(1, 'main');
    });

    // Verify metrics tracking
    expect(metrics.trackSecurityMetric).toHaveBeenCalledTimes(3);
    expect(metrics.trackUserActivity).toHaveBeenCalledWith(
      'github_sync',
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('should handle API errors with proper logging', async () => {
    const testError = new Error('API Error');
    (GitHubService as jest.Mock).mockImplementation(() => ({
      validateAndProcessRepository: jest.fn().mockRejectedValue(testError)
    }));

    const { result } = renderHook(() => useGithub(), { wrapper });

    await act(async () => {
      const response = await result.current.fetchRepositories('test-org');
      expect(response.success).toBeFalsy();
      expect(response.error).toBe(testError);
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch repositories',
      expect.objectContaining({
        error: testError
      })
    );
  });
});