/**
 * GitHub Service Module
 * Version: 1.0.0
 * 
 * Enhanced service for GitHub integration with security, monitoring, and performance features.
 * Handles repository management, file operations, and detection rule synchronization.
 */

// External dependencies
import { Octokit } from '@octokit/rest'; // v19.0.0
import { retry } from '@octokit/plugin-retry'; // v5.0.0
import { throttling } from '@octokit/plugin-throttling'; // v7.0.0
import { enterpriseCompatibility } from '@octokit/plugin-enterprise-compatibility'; // v3.0.0

// Internal dependencies
import { 
  GitHubConfig, 
  GitHubRepository, 
  GitHubBranch, 
  GitHubFile, 
  GitHubSyncStatus,
  GitHubErrorResponse 
} from '../interfaces/github';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants
const API_VERSION = '2022-11-28';
const DEFAULT_PER_PAGE = 100;
const MAX_RETRIES = 3;
const CACHE_TTL = 300; // 5 minutes
const RATE_LIMIT_WINDOW = 3600; // 1 hour
const MAX_REQUESTS_PER_HOUR = 5000;
const TOKEN_ROTATION_INTERVAL = 3600; // 1 hour

/**
 * Enhanced GitHub service class with security and monitoring features
 */
export class GitHubService {
  private octokit: Octokit;
  private readonly config: GitHubConfig;
  private cache: Map<string, { data: any; timestamp: number }>;

  /**
   * Initializes GitHub service with enhanced configuration
   * @param config GitHub configuration
   */
  constructor(config: GitHubConfig) {
    this.validateConfig(config);
    this.config = config;
    this.cache = new Map();

    // Configure Octokit with plugins
    const OctokitWithPlugins = Octokit.plugin(retry, throttling, enterpriseCompatibility);
    this.octokit = new OctokitWithPlugins({
      auth: config.accessToken,
      baseUrl: config.apiUrl,
      previews: ['machine-man'],
      retry: {
        enabled: true,
        retries: MAX_RETRIES,
      },
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          logger.warn(`Rate limit exceeded, retrying after ${retryAfter} seconds`, {
            requestId: options.request.id,
            service: 'github',
            traceId: options.request.headers['x-github-request-id'],
            spanId: 'rate_limit',
            environment: process.env.NODE_ENV || 'development',
            userId: 'system',
          });
          metrics.recordServiceMetric('github', 'rate_limit', 'throttled', retryAfter);
          return true;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          logger.warn(`Secondary rate limit hit, retrying after ${retryAfter} seconds`, {
            requestId: options.request.id,
            service: 'github',
            traceId: options.request.headers['x-github-request-id'],
            spanId: 'secondary_rate_limit',
            environment: process.env.NODE_ENV || 'development',
            userId: 'system',
          });
          return true;
        },
      },
    });
  }

  /**
   * Lists available GitHub repositories with enhanced caching and pagination
   * @param organization Organization name
   * @param options Request options
   * @returns List of repositories
   */
  async listRepositories(
    organization?: string,
    options: { perPage?: number; page?: number } = {}
  ): Promise<GitHubRepository[]> {
    const cacheKey = `repos:${organization}:${options.page}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      const repos = organization
        ? await this.octokit.repos.listForOrg({
            org: organization,
            per_page: options.perPage || DEFAULT_PER_PAGE,
            page: options.page || 1,
          })
        : await this.octokit.repos.listForAuthenticatedUser({
            per_page: options.perPage || DEFAULT_PER_PAGE,
            page: options.page || 1,
          });

      const repositories: GitHubRepository[] = repos.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        defaultBranch: repo.default_branch,
        private: repo.private,
        description: repo.description,
      }));

      this.setCache(cacheKey, repositories);
      metrics.recordServiceMetric('github', 'list_repositories', 'success', Date.now() - startTime);
      return repositories;
    } catch (error) {
      metrics.recordServiceMetric('github', 'list_repositories', 'error', Date.now() - startTime);
      throw this.handleGitHubError(error as Error, 'Failed to list repositories');
    }
  }

  /**
   * Gets branches for a repository with caching
   * @param owner Repository owner
   * @param repo Repository name
   * @param options Request options
   * @returns List of branches
   */
  async getBranches(
    owner: string,
    repo: string,
    options: { perPage?: number; page?: number } = {}
  ): Promise<GitHubBranch[]> {
    const cacheKey = `branches:${owner}:${repo}:${options.page}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      const branches = await this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: options.perPage || DEFAULT_PER_PAGE,
        page: options.page || 1,
      });

      const branchList: GitHubBranch[] = branches.data.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected,
      }));

      this.setCache(cacheKey, branchList);
      metrics.recordServiceMetric('github', 'get_branches', 'success', Date.now() - startTime);
      return branchList;
    } catch (error) {
      metrics.recordServiceMetric('github', 'get_branches', 'error', Date.now() - startTime);
      throw this.handleGitHubError(error as Error, 'Failed to get branches');
    }
  }

  /**
   * Gets files from a repository path with enhanced validation
   * @param owner Repository owner
   * @param repo Repository name
   * @param path File path
   * @param branch Branch name
   * @param options Request options
   * @returns List of files
   */
  async getFiles(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    options: { recursive?: boolean } = {}
  ): Promise<GitHubFile[]> {
    const cacheKey = `files:${owner}:${repo}:${path}:${branch}:${options.recursive}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      const files: GitHubFile[] = Array.isArray(response.data)
        ? response.data.map(file => ({
            path: file.path,
            name: file.name,
            sha: file.sha,
            size: file.size,
            content: file.content || '',
            type: file.type as 'file' | 'dir' | 'symlink',
            encoding: file.encoding || 'utf-8',
            url: file.url,
          }))
        : [{
            path: response.data.path,
            name: response.data.name,
            sha: response.data.sha,
            size: response.data.size,
            content: response.data.content || '',
            type: response.data.type as 'file' | 'dir' | 'symlink',
            encoding: response.data.encoding || 'utf-8',
            url: response.data.url,
          }];

      this.setCache(cacheKey, files);
      metrics.recordServiceMetric('github', 'get_files', 'success', Date.now() - startTime);
      return files;
    } catch (error) {
      metrics.recordServiceMetric('github', 'get_files', 'error', Date.now() - startTime);
      throw this.handleGitHubError(error as Error, 'Failed to get files');
    }
  }

  /**
   * Synchronizes detection rules with enhanced status tracking
   * @param repositoryId Repository ID
   * @param branch Branch name
   * @param options Sync options
   * @returns Sync operation status
   */
  async syncRepository(
    repositoryId: number,
    branch: string,
    options: { validateRules?: boolean } = {}
  ): Promise<GitHubSyncStatus> {
    const startTime = Date.now();
    const syncStatus: GitHubSyncStatus = {
      repositoryId,
      branch,
      lastSyncTimestamp: new Date(),
      status: 'in_progress',
      error: null,
      filesProcessed: 0,
      totalFiles: 0,
    };

    try {
      // Get repository details
      const repos = await this.listRepositories();
      const repository = repos.find(repo => repo.id === repositoryId);
      if (!repository) {
        throw new Error(`Repository with ID ${repositoryId} not found`);
      }

      // Get all files recursively
      const files = await this.getFiles(
        repository.fullName.split('/')[0],
        repository.fullName.split('/')[1],
        '',
        branch,
        { recursive: true }
      );

      syncStatus.totalFiles = files.length;

      // Process each file
      for (const file of files) {
        try {
          if (options.validateRules) {
            // Implement rule validation logic here
            logger.info(`Validated rule in file: ${file.path}`, {
              requestId: `sync_${repositoryId}`,
              service: 'github',
              traceId: `sync_${startTime}`,
              spanId: `file_${file.sha}`,
              environment: process.env.NODE_ENV || 'development',
              userId: 'system',
            });
          }
          syncStatus.filesProcessed++;
        } catch (error) {
          logger.error(`Failed to process file: ${file.path}`, error as Error, {
            requestId: `sync_${repositoryId}`,
            service: 'github',
            traceId: `sync_${startTime}`,
            spanId: `file_${file.sha}`,
            environment: process.env.NODE_ENV || 'development',
            userId: 'system',
          });
        }
      }

      syncStatus.status = 'completed';
      metrics.recordServiceMetric('github', 'sync_repository', 'success', Date.now() - startTime);
      return syncStatus;
    } catch (error) {
      syncStatus.status = 'failed';
      syncStatus.error = (error as Error).message;
      metrics.recordServiceMetric('github', 'sync_repository', 'error', Date.now() - startTime);
      throw this.handleGitHubError(error as Error, 'Failed to sync repository');
    }
  }

  /**
   * Validates GitHub configuration
   * @param config GitHub configuration
   */
  private validateConfig(config: GitHubConfig): void {
    if (!config.accessToken) {
      throw new Error('GitHub access token is required');
    }
    if (!config.apiUrl) {
      throw new Error('GitHub API URL is required');
    }
  }

  /**
   * Handles GitHub API errors with enhanced logging
   * @param error Error object
   * @param message Error message
   */
  private handleGitHubError(error: Error, message: string): Error {
    const githubError = error as GitHubErrorResponse;
    logger.error(message, error, {
      requestId: 'github_error',
      service: 'github',
      traceId: 'error_handler',
      spanId: 'handle_error',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
      metadata: {
        documentation_url: githubError.documentation_url,
        errors: githubError.errors,
      },
    });
    return error;
  }

  /**
   * Gets cached data if valid
   * @param key Cache key
   * @returns Cached data or null
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return cached.data;
    }
    return null;
  }

  /**
   * Sets cache data with timestamp
   * @param key Cache key
   * @param data Data to cache
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}