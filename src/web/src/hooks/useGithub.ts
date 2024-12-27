// react version: ^18.2.0
// react-redux version: ^8.0.5
import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  GitHubRepository, 
  GitHubFile, 
  GitHubSyncStatus 
} from '../interfaces/github';
import { 
  selectRepositories, 
  selectSelectedFiles, 
  selectSyncStatus,
  selectValidationStatus,
  selectSecurityContext,
  selectRateLimitStatus,
  setError,
  setLoading,
  setRepositories,
  setSelectedFiles,
  setSyncStatus,
  updateRateLimit,
  updateValidationStatus
} from '../store/githubSlice';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { API_REQUEST_LIMITS } from '../config/constants';

/**
 * Result type for GitHub operations with error handling
 */
type Result<T, E = Error> = {
  data?: T;
  error?: E;
  success: boolean;
};

/**
 * Interface for GitHub hook return value with enhanced security context
 */
interface UseGithubReturn {
  repositories: GitHubRepository[];
  selectedFiles: GitHubFile[];
  syncStatus: GitHubSyncStatus | null;
  loading: boolean;
  error: Error | null;
  securityContext: {
    userId: string;
    sessionId: string;
    userRole: string;
    permissions: string[];
  };
  rateLimitStatus: {
    remaining: number;
    reset: number;
    limit: number;
  };
  fetchRepositories: (organization: string) => Promise<Result<GitHubRepository[]>>;
  fetchRepositoryFiles: (
    repositoryId: number,
    branch: string,
    path?: string
  ) => Promise<Result<GitHubFile[]>>;
  syncRepository: (
    repositoryId: number,
    branch: string
  ) => Promise<Result<GitHubSyncStatus>>;
}

/**
 * Custom hook for managing GitHub integration with enhanced security and monitoring
 * @returns {UseGithubReturn} GitHub state and operations with security context
 */
export const useGithub = (): UseGithubReturn => {
  const dispatch = useDispatch();
  const [loading, setLocalLoading] = useState(false);
  const [error, setLocalError] = useState<Error | null>(null);

  // Select state from Redux with security context
  const repositories = useSelector(selectRepositories);
  const selectedFiles = useSelector(selectSelectedFiles);
  const syncStatus = useSelector(selectSyncStatus);
  const securityContext = useSelector(selectSecurityContext);
  const rateLimitStatus = useSelector(selectRateLimitStatus);
  const validationStatus = useSelector(selectValidationStatus);

  /**
   * Check rate limiting before GitHub operations
   */
  const checkRateLimit = useCallback((): boolean => {
    if (rateLimitStatus.remaining <= 0) {
      const error = new Error('GitHub rate limit exceeded');
      dispatch(setError({ 
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
        timestamp: new Date()
      }));
      return false;
    }
    return true;
  }, [rateLimitStatus, dispatch]);

  /**
   * Track security metrics for GitHub operations
   */
  const trackSecurityMetrics = useCallback((
    operation: string,
    details: Record<string, any>
  ) => {
    metrics.trackSecurityMetric(
      {
        type: 'github_operation',
        severity: 'medium',
        details: {
          operation,
          ...details
        },
        source: 'github_hook'
      },
      {
        userId: securityContext.userId,
        sessionId: securityContext.sessionId,
        userRole: securityContext.userRole,
        ipAddress: '', // Set by middleware
        timestamp: Date.now()
      }
    );
  }, [securityContext]);

  /**
   * Fetch repositories with security validation and monitoring
   */
  const fetchRepositories = useCallback(async (
    organization: string
  ): Promise<Result<GitHubRepository[]>> => {
    if (!checkRateLimit()) {
      return { success: false, error: new Error('Rate limit exceeded') };
    }

    try {
      setLocalLoading(true);
      dispatch(setLoading(true));

      // Track operation metrics
      trackSecurityMetrics('fetch_repositories', { organization });

      // Validate organization access
      if (!securityContext.permissions.includes('READ')) {
        throw new Error('Insufficient permissions to access repositories');
      }

      // Simulate API call (replace with actual implementation)
      const response = await Promise.resolve(repositories);

      dispatch(setRepositories(response));
      return { data: response, success: true };

    } catch (error: any) {
      logger.error('Failed to fetch repositories', { error, organization });
      setLocalError(error);
      dispatch(setError({
        code: error.code || 'FETCH_ERROR',
        message: error.message,
        timestamp: new Date()
      }));
      return { error, success: false };

    } finally {
      setLocalLoading(false);
      dispatch(setLoading(false));
    }
  }, [
    dispatch,
    repositories,
    securityContext,
    checkRateLimit,
    trackSecurityMetrics
  ]);

  /**
   * Fetch repository files with validation and security checks
   */
  const fetchRepositoryFiles = useCallback(async (
    repositoryId: number,
    branch: string,
    path: string = ''
  ): Promise<Result<GitHubFile[]>> => {
    if (!checkRateLimit()) {
      return { success: false, error: new Error('Rate limit exceeded') };
    }

    try {
      setLocalLoading(true);
      dispatch(setLoading(true));

      // Track operation metrics
      trackSecurityMetrics('fetch_files', { repositoryId, branch, path });

      // Validate repository access
      const repository = repositories.find(r => r.id === repositoryId);
      if (!repository?.permissions.pull) {
        throw new Error('Insufficient repository permissions');
      }

      // Simulate API call (replace with actual implementation)
      const response = await Promise.resolve(selectedFiles);

      dispatch(setSelectedFiles(response));
      return { data: response, success: true };

    } catch (error: any) {
      logger.error('Failed to fetch repository files', { 
        error, 
        repositoryId,
        branch 
      });
      setLocalError(error);
      dispatch(setError({
        code: error.code || 'FETCH_FILES_ERROR',
        message: error.message,
        timestamp: new Date()
      }));
      return { error, success: false };

    } finally {
      setLocalLoading(false);
      dispatch(setLoading(false));
    }
  }, [
    dispatch,
    repositories,
    selectedFiles,
    securityContext,
    checkRateLimit,
    trackSecurityMetrics
  ]);

  /**
   * Sync repository with progress tracking and validation
   */
  const syncRepository = useCallback(async (
    repositoryId: number,
    branch: string
  ): Promise<Result<GitHubSyncStatus>> => {
    if (!checkRateLimit()) {
      return { success: false, error: new Error('Rate limit exceeded') };
    }

    try {
      setLocalLoading(true);
      dispatch(setLoading(true));

      // Track operation metrics
      trackSecurityMetrics('sync_repository', { repositoryId, branch });

      // Validate repository access
      const repository = repositories.find(r => r.id === repositoryId);
      if (!repository?.permissions.push) {
        throw new Error('Insufficient repository permissions');
      }

      // Initialize sync status
      const initialStatus: GitHubSyncStatus = {
        repositoryId,
        branch,
        lastSyncTimestamp: new Date(),
        status: 'pending',
        progress: {
          current: 0,
          total: 0,
          percentage: 0
        }
      };

      dispatch(setSyncStatus(initialStatus));

      // Simulate sync operation (replace with actual implementation)
      const response = await Promise.resolve({
        ...initialStatus,
        status: 'completed' as const
      });

      dispatch(setSyncStatus(response));
      return { data: response, success: true };

    } catch (error: any) {
      logger.error('Failed to sync repository', { 
        error, 
        repositoryId,
        branch 
      });
      setLocalError(error);
      dispatch(setError({
        code: error.code || 'SYNC_ERROR',
        message: error.message,
        timestamp: new Date()
      }));
      return { error, success: false };

    } finally {
      setLocalLoading(false);
      dispatch(setLoading(false));
    }
  }, [
    dispatch,
    repositories,
    securityContext,
    checkRateLimit,
    trackSecurityMetrics
  ]);

  return {
    repositories,
    selectedFiles,
    syncStatus,
    loading,
    error,
    securityContext,
    rateLimitStatus,
    fetchRepositories,
    fetchRepositoryFiles,
    syncRepository
  };
};