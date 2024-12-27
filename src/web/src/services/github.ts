// @octokit/rest version: ^19.0.0
// @octokit/plugin-rate-limit version: ^5.0.0
import { Octokit } from '@octokit/rest';
import { rateLimit } from '@octokit/plugin-rate-limit';
import { GitHubConfig, GitHubRepository, GitHubFile, GitHubSyncStatus, isGitHubRepository } from '../interfaces/github';
import { MetricsCollector } from '../utils/metrics';
import { logger } from '../utils/logger';
import { API_REQUEST_LIMITS } from '../config/constants';

// Extend Octokit with rate limiting plugin
const OctokitWithRateLimit = Octokit.plugin(rateLimit);

/**
 * Error types specific to GitHub operations
 */
export class GitHubError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/**
 * Enhanced service class implementing secure GitHub integration functionality
 */
export class GitHubService {
  private githubClient: Octokit;
  private metricsCollector: MetricsCollector;
  private rateLimitConfig: typeof API_REQUEST_LIMITS.GITHUB_OPERATIONS;

  constructor(private config: GitHubConfig) {
    this.initializeService();
  }

  /**
   * Initialize the GitHub service with security and monitoring
   */
  private initializeService(): void {
    try {
      this.rateLimitConfig = API_REQUEST_LIMITS.GITHUB_OPERATIONS;
      this.metricsCollector = new MetricsCollector();
      this.githubClient = this.initializeGitHubClient();
      
      logger.info('GitHub service initialized', {
        service: 'GitHubService',
        rateLimit: this.rateLimitConfig
      });
    } catch (error) {
      logger.error('Failed to initialize GitHub service', { error });
      throw new GitHubError(
        'GitHub service initialization failed',
        'INIT_FAILED',
        error
      );
    }
  }

  /**
   * Initialize and configure the GitHub API client with security
   */
  private initializeGitHubClient(): Octokit {
    return new OctokitWithRateLimit({
      auth: this.config.accessToken,
      baseUrl: this.config.apiUrl,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          logger.warn('Rate limit exceeded', { retryAfter, options });
          return retryAfter <= 60;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          logger.warn('Secondary rate limit hit', { retryAfter, options });
          return false;
        }
      }
    });
  }

  /**
   * Validate and process repository with security checks
   */
  public async validateAndProcessRepository(
    owner: string,
    repo: string
  ): Promise<GitHubRepository> {
    try {
      const startTime = Date.now();
      
      // Check rate limits before proceeding
      const rateLimit = await this.githubClient.rateLimit.get();
      if (rateLimit.data.rate.remaining < 1) {
        throw new GitHubError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          { resetTime: rateLimit.data.rate.reset }
        );
      }

      // Get repository details with security validation
      const response = await this.githubClient.repos.get({ owner, repo });
      
      if (!isGitHubRepository(response.data)) {
        throw new GitHubError(
          'Invalid repository data received',
          'INVALID_REPO_DATA'
        );
      }

      // Track metrics
      this.metricsCollector.trackApiCall({
        operation: 'validateRepository',
        duration: Date.now() - startTime,
        success: true
      });

      return response.data;
    } catch (error) {
      this.handleGitHubError(error);
      throw error;
    }
  }

  /**
   * List repository files with security validation
   */
  public async listFiles(
    owner: string,
    repo: string,
    path: string = '',
    ref: string = 'main'
  ): Promise<GitHubFile[]> {
    try {
      const response = await this.githubClient.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if (!Array.isArray(response.data)) {
        throw new GitHubError(
          'Invalid content response',
          'INVALID_CONTENT_RESPONSE'
        );
      }

      return response.data.map(file => ({
        path: file.path,
        name: file.name,
        sha: file.sha,
        size: file.size,
        type: file.type as GitHubFile['type'],
        content: file.content || '',
        encoding: file.encoding as 'base64' | 'utf8',
        lastModified: new Date(file.last_modified || '')
      }));
    } catch (error) {
      this.handleGitHubError(error);
      throw error;
    }
  }

  /**
   * Sync repository with progress tracking
   */
  public async syncRepository(
    owner: string,
    repo: string,
    ref: string = 'main'
  ): Promise<GitHubSyncStatus> {
    const syncStatus: GitHubSyncStatus = {
      repositoryId: 0,
      branch: ref,
      lastSyncTimestamp: new Date(),
      status: 'pending',
      progress: {
        current: 0,
        total: 0,
        percentage: 0
      }
    };

    try {
      const repository = await this.validateAndProcessRepository(owner, repo);
      syncStatus.repositoryId = repository.id;
      syncStatus.status = 'in_progress';

      const files = await this.listFiles(owner, repo, '', ref);
      syncStatus.progress.total = files.length;

      // Process files with progress tracking
      for (const file of files) {
        await this.processFile(file);
        syncStatus.progress.current++;
        syncStatus.progress.percentage = 
          (syncStatus.progress.current / syncStatus.progress.total) * 100;
      }

      syncStatus.status = 'completed';
      return syncStatus;
    } catch (error) {
      syncStatus.status = 'failed';
      syncStatus.error = {
        code: error instanceof GitHubError ? error.code : 'UNKNOWN_ERROR',
        message: error.message
      };
      throw error;
    }
  }

  /**
   * Process individual file with validation
   */
  private async processFile(file: GitHubFile): Promise<void> {
    // Implement file processing logic
    logger.debug('Processing file', { file: file.path });
  }

  /**
   * Handle GitHub errors with proper logging and metrics
   */
  private handleGitHubError(error: any): never {
    const errorCode = error.status || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'Unknown GitHub error occurred';

    logger.error('GitHub operation failed', {
      code: errorCode,
      message: errorMessage,
      details: error
    });

    this.metricsCollector.trackApiCall({
      operation: 'githubOperation',
      success: false,
      errorCode
    });

    throw new GitHubError(errorMessage, errorCode, error);
  }
}

export default GitHubService;