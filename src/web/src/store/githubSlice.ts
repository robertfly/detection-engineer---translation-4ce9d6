// @reduxjs/toolkit version: ^1.9.7
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GitHubRepository, GitHubFile, GitHubSyncStatus } from '../interfaces/github';
import { GitHubService } from '../services/github';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { API_REQUEST_LIMITS } from '../config/constants';

// Enhanced interfaces for GitHub state management
interface ValidationState {
  isValid: boolean;
  errors: string[];
  lastValidated: Date | null;
}

interface SecurityContext {
  userId: string;
  sessionId: string;
  userRole: string;
  lastAccess: Date;
  permissions: string[];
}

interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

interface MetricsData {
  operationCount: number;
  lastOperation: Date | null;
  errorCount: number;
}

interface ErrorState {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

// Main GitHub state interface
interface GitHubState {
  repositories: GitHubRepository[];
  selectedFiles: GitHubFile[];
  syncStatus: GitHubSyncStatus | null;
  loading: boolean;
  error: ErrorState | null;
  validationStatus: ValidationState;
  securityContext: SecurityContext;
  rateLimitStatus: RateLimitInfo;
  operationMetrics: MetricsData;
}

// Initial state with security and monitoring
const initialState: GitHubState = {
  repositories: [],
  selectedFiles: [],
  syncStatus: null,
  loading: false,
  error: null,
  validationStatus: {
    isValid: false,
    errors: [],
    lastValidated: null
  },
  securityContext: {
    userId: '',
    sessionId: '',
    userRole: '',
    lastAccess: new Date(),
    permissions: []
  },
  rateLimitStatus: {
    remaining: API_REQUEST_LIMITS.GITHUB_OPERATIONS.REQUESTS_PER_HOUR,
    reset: 0,
    limit: API_REQUEST_LIMITS.GITHUB_OPERATIONS.REQUESTS_PER_HOUR
  },
  operationMetrics: {
    operationCount: 0,
    lastOperation: null,
    errorCount: 0
  }
};

// Create the GitHub slice with enhanced security and monitoring
const githubSlice = createSlice({
  name: 'github',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      state.operationMetrics.lastOperation = new Date();
    },

    setError: (state, action: PayloadAction<ErrorState>) => {
      state.error = action.payload;
      state.operationMetrics.errorCount += 1;
      logger.error('GitHub operation error', { error: action.payload });
    },

    clearError: (state) => {
      state.error = null;
    },

    setRepositories: (state, action: PayloadAction<GitHubRepository[]>) => {
      state.repositories = action.payload;
      state.operationMetrics.operationCount += 1;
      state.validationStatus.lastValidated = new Date();
    },

    setSelectedFiles: (state, action: PayloadAction<GitHubFile[]>) => {
      state.selectedFiles = action.payload;
      state.operationMetrics.operationCount += 1;
      state.securityContext.lastAccess = new Date();
    },

    setSyncStatus: (state, action: PayloadAction<GitHubSyncStatus>) => {
      state.syncStatus = action.payload;
      metrics.trackUserActivity('github_sync', {
        status: action.payload.status,
        repositoryId: action.payload.repositoryId
      }, {
        userId: state.securityContext.userId,
        sessionId: state.securityContext.sessionId,
        userRole: state.securityContext.userRole,
        ipAddress: '', // Set by middleware
        timestamp: Date.now()
      });
    },

    updateRateLimit: (state, action: PayloadAction<RateLimitInfo>) => {
      state.rateLimitStatus = action.payload;
      if (action.payload.remaining < (action.payload.limit * 0.1)) {
        logger.warn('GitHub rate limit running low', { 
          remaining: action.payload.remaining,
          reset: action.payload.reset 
        });
      }
    },

    setSecurityContext: (state, action: PayloadAction<SecurityContext>) => {
      state.securityContext = action.payload;
      logger.info('Security context updated', { 
        userId: action.payload.userId,
        role: action.payload.userRole 
      });
    },

    updateValidationStatus: (state, action: PayloadAction<ValidationState>) => {
      state.validationStatus = action.payload;
      if (!action.payload.isValid) {
        logger.warn('GitHub validation failed', { 
          errors: action.payload.errors 
        });
      }
    }
  }
});

// Export actions and reducer
export const {
  setLoading,
  setError,
  clearError,
  setRepositories,
  setSelectedFiles,
  setSyncStatus,
  updateRateLimit,
  setSecurityContext,
  updateValidationStatus
} = githubSlice.actions;

// Selectors with memoization consideration
export const selectRepositories = (state: { github: GitHubState }) => state.github.repositories;
export const selectSelectedFiles = (state: { github: GitHubState }) => state.github.selectedFiles;
export const selectSyncStatus = (state: { github: GitHubState }) => state.github.syncStatus;
export const selectLoading = (state: { github: GitHubState }) => state.github.loading;
export const selectError = (state: { github: GitHubState }) => state.github.error;
export const selectValidationStatus = (state: { github: GitHubState }) => state.github.validationStatus;
export const selectSecurityContext = (state: { github: GitHubState }) => state.github.securityContext;
export const selectRateLimitStatus = (state: { github: GitHubState }) => state.github.rateLimitStatus;
export const selectOperationMetrics = (state: { github: GitHubState }) => state.github.operationMetrics;

// Export reducer
export default githubSlice.reducer;

// Async thunks would typically be defined in a separate file (e.g., githubThunks.ts)
// but are included here for completeness
export const fetchRepositories = (organization?: string) => async (
  dispatch: any,
  getState: () => { github: GitHubState }
) => {
  const githubService = new GitHubService({
    accessToken: '', // Set via environment/config
    apiUrl: '', // Set via environment/config
    organization: organization || null,
    rateLimitConfig: API_REQUEST_LIMITS.GITHUB_OPERATIONS
  });

  try {
    dispatch(setLoading(true));
    dispatch(clearError());

    const repositories = await githubService.validateAndProcessRepository(
      organization || '',
      ''
    );

    dispatch(setRepositories([repositories]));
    metrics.trackUserActivity('fetch_repositories', {
      organization,
      count: repositories.length
    }, getState().github.securityContext);

  } catch (error: any) {
    dispatch(setError({
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error,
      timestamp: new Date()
    }));
  } finally {
    dispatch(setLoading(false));
  }
};