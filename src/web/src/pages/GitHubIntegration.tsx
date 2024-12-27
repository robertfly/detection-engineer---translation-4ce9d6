// React version: ^18.2.0
// Material UI version: ^5.14.0
import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Alert, 
  CircularProgress, 
  Button,
  Divider,
  Paper
} from '@mui/material';
import RepoBrowser from '../components/github/RepoBrowser';
import RepoConnect from '../components/github/RepoConnect';
import { useGithub } from '../hooks/useGithub';
import { GitHubConfig, GitHubFile } from '../interfaces/github';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { UI_CONSTANTS, API_REQUEST_LIMITS } from '../config/constants';

/**
 * Interface for component state management
 */
interface GitHubIntegrationState {
  isConnected: boolean;
  validationStatus: {
    isValid: boolean;
    message: string;
  };
  securityContext: {
    userId: string;
    sessionId: string;
    userRole: string;
    permissions: string[];
  };
  operationMetrics: {
    operationCount: number;
    lastOperation: Date | null;
    errorCount: number;
  };
}

/**
 * Enhanced GitHub Integration page component with comprehensive security and monitoring
 */
const GitHubIntegration: React.FC = () => {
  // State management with security context
  const [state, setState] = useState<GitHubIntegrationState>({
    isConnected: false,
    validationStatus: {
      isValid: false,
      message: ''
    },
    securityContext: {
      userId: sessionStorage.getItem('userId') || '',
      sessionId: sessionStorage.getItem('sessionId') || '',
      userRole: sessionStorage.getItem('userRole') || '',
      permissions: []
    },
    operationMetrics: {
      operationCount: 0,
      lastOperation: null,
      errorCount: 0
    }
  });

  // GitHub hook with enhanced security and monitoring
  const { 
    repositories,
    selectedFiles,
    syncStatus,
    loading,
    error,
    rateLimitStatus,
    fetchRepositories,
    fetchRepositoryFiles,
    syncRepository
  } = useGithub();

  /**
   * Initialize security context and validate permissions
   */
  useEffect(() => {
    const validateSecurityContext = () => {
      const context = {
        userId: sessionStorage.getItem('userId') || '',
        sessionId: sessionStorage.getItem('sessionId') || '',
        userRole: sessionStorage.getItem('userRole') || '',
        permissions: sessionStorage.getItem('permissions')?.split(',') || []
      };

      if (!context.userId || !context.sessionId) {
        logger.error('Invalid security context', { context });
        return false;
      }

      setState(prev => ({
        ...prev,
        securityContext: context
      }));

      return true;
    };

    const isValid = validateSecurityContext();
    if (!isValid) {
      // Handle invalid security context
      logger.error('Security context validation failed');
    }
  }, []);

  /**
   * Handle GitHub connection with enhanced security and monitoring
   */
  const handleConnect = useCallback(async (config: GitHubConfig) => {
    try {
      setState(prev => ({
        ...prev,
        operationMetrics: {
          ...prev.operationMetrics,
          operationCount: prev.operationMetrics.operationCount + 1,
          lastOperation: new Date()
        }
      }));

      // Track connection metrics
      metrics.trackSecurityMetric(
        {
          type: 'github_connection',
          severity: 'medium',
          details: { config: { ...config, accessToken: '[REDACTED]' } },
          source: 'github_integration'
        },
        state.securityContext
      );

      // Fetch initial repositories
      const result = await fetchRepositories(config.organization || '');
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          validationStatus: {
            isValid: true,
            message: 'Successfully connected to GitHub'
          }
        }));

        logger.info('GitHub connection established', {
          organization: config.organization
        });
      }
    } catch (error: any) {
      logger.error('GitHub connection failed', { error });
      setState(prev => ({
        ...prev,
        validationStatus: {
          isValid: false,
          message: error.message
        },
        operationMetrics: {
          ...prev.operationMetrics,
          errorCount: prev.operationMetrics.errorCount + 1
        }
      }));
    }
  }, [fetchRepositories, state.securityContext]);

  /**
   * Handle file selection with validation and security checks
   */
  const handleFileSelect = useCallback(async (files: GitHubFile[]) => {
    try {
      // Validate rate limits
      if (rateLimitStatus.remaining <= 0) {
        throw new Error('GitHub rate limit exceeded');
      }

      setState(prev => ({
        ...prev,
        operationMetrics: {
          ...prev.operationMetrics,
          operationCount: prev.operationMetrics.operationCount + 1,
          lastOperation: new Date()
        }
      }));

      // Track file selection metrics
      metrics.trackUserActivity(
        'github_file_selection',
        {
          fileCount: files.length,
          paths: files.map(f => f.path)
        },
        state.securityContext
      );

      // Process selected files
      for (const file of files) {
        await fetchRepositoryFiles(
          parseInt(file.path.split('/')[0]),
          'main',
          file.path
        );
      }
    } catch (error: any) {
      logger.error('File selection failed', { error });
      setState(prev => ({
        ...prev,
        operationMetrics: {
          ...prev.operationMetrics,
          errorCount: prev.operationMetrics.errorCount + 1
        }
      }));
    }
  }, [fetchRepositoryFiles, rateLimitStatus.remaining, state.securityContext]);

  /**
   * Handle repository sync with progress tracking
   */
  const handleSync = useCallback(async () => {
    if (!state.isConnected) return;

    try {
      setState(prev => ({
        ...prev,
        operationMetrics: {
          ...prev.operationMetrics,
          operationCount: prev.operationMetrics.operationCount + 1,
          lastOperation: new Date()
        }
      }));

      // Track sync metrics
      metrics.trackUserActivity(
        'github_sync',
        {
          repositoryCount: repositories.length
        },
        state.securityContext
      );

      for (const repo of repositories) {
        await syncRepository(repo.id, repo.defaultBranch);
      }
    } catch (error: any) {
      logger.error('Repository sync failed', { error });
      setState(prev => ({
        ...prev,
        operationMetrics: {
          ...prev.operationMetrics,
          errorCount: prev.operationMetrics.errorCount + 1
        }
      }));
    }
  }, [repositories, syncRepository, state.isConnected, state.securityContext]);

  /**
   * Handle disconnection with cleanup
   */
  const handleDisconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      validationStatus: {
        isValid: false,
        message: ''
      }
    }));

    metrics.trackUserActivity(
      'github_disconnect',
      {},
      state.securityContext
    );

    logger.info('GitHub connection terminated');
  }, [state.securityContext]);

  return (
    <Container maxWidth="lg" sx={{ py: UI_CONSTANTS.SPACING.LARGE }}>
      <Typography variant="h4" component="h1" gutterBottom>
        GitHub Integration
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: UI_CONSTANTS.SPACING.MEDIUM }}
        >
          {error.message}
        </Alert>
      )}

      <Paper sx={{ mb: UI_CONSTANTS.SPACING.LARGE, p: UI_CONSTANTS.SPACING.MEDIUM }}>
        <RepoConnect
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isConnected={state.isConnected}
          rateLimitConfig={API_REQUEST_LIMITS.GITHUB_OPERATIONS}
        />
      </Paper>

      {state.isConnected && (
        <>
          <Box sx={{ mb: UI_CONSTANTS.SPACING.MEDIUM }}>
            <Typography variant="h5" gutterBottom>
              Repository Browser
            </Typography>
            {loading ? (
              <CircularProgress />
            ) : (
              <RepoBrowser
                onFileSelect={handleFileSelect}
                maxFileSize={1024 * 1024} // 1MB
                className="github-browser"
              />
            )}
          </Box>

          <Divider sx={{ my: UI_CONSTANTS.SPACING.LARGE }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={handleSync}
              disabled={loading || rateLimitStatus.remaining <= 0}
            >
              Sync Repositories
            </Button>
            
            {syncStatus && (
              <Typography variant="body2" color="textSecondary">
                Last sync: {new Date(syncStatus.lastSyncTimestamp).toLocaleString()}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Container>
  );
};

export default GitHubIntegration;