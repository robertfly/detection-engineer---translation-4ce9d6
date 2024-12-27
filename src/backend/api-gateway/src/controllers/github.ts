/**
 * GitHub Controller Module
 * Version: 1.0.0
 * 
 * Handles GitHub integration endpoints with enhanced security controls,
 * monitoring, and rate limiting for detection rule management.
 */

// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { RateLimit } from 'rate-limiter-flexible'; // v2.4.1

// Internal dependencies
import { 
  GitHubRepository, 
  GitHubBranch, 
  GitHubFile, 
  GitHubSyncStatus, 
  GitHubError 
} from '../interfaces/github';
import { GitHubService } from '../services/github';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants
const RATE_LIMIT_WINDOW = 60; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const SYNC_RATE_LIMIT_WINDOW = 300; // 5 minutes
const SYNC_RATE_LIMIT_MAX_REQUESTS = 50;

// Rate limiter configurations
const standardRateLimiter = new RateLimit({
  points: RATE_LIMIT_MAX_REQUESTS,
  duration: RATE_LIMIT_WINDOW,
  blockDuration: RATE_LIMIT_WINDOW,
  keyPrefix: 'github_standard',
});

const syncRateLimiter = new RateLimit({
  points: SYNC_RATE_LIMIT_MAX_REQUESTS,
  duration: SYNC_RATE_LIMIT_WINDOW,
  blockDuration: SYNC_RATE_LIMIT_WINDOW,
  keyPrefix: 'github_sync',
});

// Initialize GitHub service
const githubService = new GitHubService({
  accessToken: process.env.GITHUB_TOKEN || '',
  apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  organization: process.env.GITHUB_ORG || null,
  apiVersion: '2022-11-28',
});

/**
 * Lists available GitHub repositories with rate limiting and security controls
 */
export const listRepositories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Rate limit check
    await standardRateLimiter.consume(req.ip);
    metrics.recordRequestMetric('GET', '/api/v1/github/repositories', 200, 0, {
      rateLimitGroup: 'github_standard'
    });

    // Extract and validate query parameters
    const organization = req.query.organization as string;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 100;

    // Fetch repositories
    const repositories = await githubService.listRepositories(organization, {
      page,
      perPage,
    });

    logger.info('Successfully retrieved GitHub repositories', {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'list_repositories',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    // Record success metrics
    metrics.recordServiceMetric('github', 'list_repositories', 'success', 
      Date.now() - startTime, { healthScore: 1.0 });

    res.status(200).json({
      success: true,
      data: repositories,
      pagination: {
        page,
        perPage,
        total: repositories.length,
      },
    });
  } catch (error) {
    logger.error('Failed to list repositories', error as Error, {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'list_repositories_error',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    metrics.recordServiceMetric('github', 'list_repositories', 'error',
      Date.now() - startTime, { healthScore: 0.0 });

    next(error);
  }
};

/**
 * Gets branches for a repository with security validation
 */
export const getBranches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Rate limit check
    await standardRateLimiter.consume(req.ip);
    metrics.recordRequestMetric('GET', '/api/v1/github/branches', 200, 0, {
      rateLimitGroup: 'github_standard'
    });

    // Extract and validate parameters
    const { owner, repo } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 100;

    if (!owner || !repo) {
      throw new Error('Owner and repository name are required');
    }

    // Fetch branches
    const branches = await githubService.getBranches(owner, repo, {
      page,
      perPage,
    });

    logger.info('Successfully retrieved repository branches', {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'get_branches',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    metrics.recordServiceMetric('github', 'get_branches', 'success',
      Date.now() - startTime, { healthScore: 1.0 });

    res.status(200).json({
      success: true,
      data: branches,
      pagination: {
        page,
        perPage,
        total: branches.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get branches', error as Error, {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'get_branches_error',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    metrics.recordServiceMetric('github', 'get_branches', 'error',
      Date.now() - startTime, { healthScore: 0.0 });

    next(error);
  }
};

/**
 * Gets files from a repository path with security validation
 */
export const getFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Rate limit check
    await standardRateLimiter.consume(req.ip);
    metrics.recordRequestMetric('GET', '/api/v1/github/files', 200, 0, {
      rateLimitGroup: 'github_standard'
    });

    // Extract and validate parameters
    const { owner, repo, path = '', branch = 'main' } = req.params;
    const recursive = req.query.recursive === 'true';

    if (!owner || !repo) {
      throw new Error('Owner and repository name are required');
    }

    // Fetch files
    const files = await githubService.getFiles(owner, repo, path, branch, {
      recursive,
    });

    logger.info('Successfully retrieved repository files', {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'get_files',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    metrics.recordServiceMetric('github', 'get_files', 'success',
      Date.now() - startTime, { healthScore: 1.0 });

    res.status(200).json({
      success: true,
      data: files,
      metadata: {
        path,
        branch,
        recursive,
      },
    });
  } catch (error) {
    logger.error('Failed to get files', error as Error, {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'get_files_error',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    metrics.recordServiceMetric('github', 'get_files', 'error',
      Date.now() - startTime, { healthScore: 0.0 });

    next(error);
  }
};

/**
 * Synchronizes detection rules with enhanced validation
 */
export const syncRepository = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Rate limit check for sync operations
    await syncRateLimiter.consume(req.ip);
    metrics.recordRequestMetric('POST', '/api/v1/github/sync', 200, 0, {
      rateLimitGroup: 'github_sync'
    });

    // Extract and validate parameters
    const { repositoryId, branch = 'main', validateRules = true } = req.body;

    if (!repositoryId) {
      throw new Error('Repository ID is required');
    }

    // Start sync operation
    const syncStatus = await githubService.syncRepository(repositoryId, branch, {
      validateRules,
    });

    logger.info('Repository sync operation completed', {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'sync_repository',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
      metadata: {
        repositoryId,
        branch,
        filesProcessed: syncStatus.filesProcessed,
        totalFiles: syncStatus.totalFiles,
      },
    });

    metrics.recordServiceMetric('github', 'sync_repository', 'success',
      Date.now() - startTime, {
        healthScore: syncStatus.status === 'completed' ? 1.0 : 0.5,
      });

    res.status(200).json({
      success: true,
      data: syncStatus,
    });
  } catch (error) {
    logger.error('Failed to sync repository', error as Error, {
      requestId,
      service: 'github',
      traceId: requestId,
      spanId: 'sync_repository_error',
      environment: process.env.NODE_ENV || 'development',
      userId: req.user?.id || 'anonymous',
    });

    metrics.recordServiceMetric('github', 'sync_repository', 'error',
      Date.now() - startTime, { healthScore: 0.0 });

    next(error);
  }
};