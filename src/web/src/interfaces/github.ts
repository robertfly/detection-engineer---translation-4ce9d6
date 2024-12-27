// @octokit/rest version: ^19.0.0
import { Octokit } from '@octokit/rest';
import { AuthToken } from '../interfaces/auth';

/**
 * Interface defining GitHub API configuration settings with rate limiting
 * @interface
 */
export interface GitHubConfig {
    readonly accessToken: string;
    readonly apiUrl: string;
    readonly organization: string | null;
    readonly rateLimitConfig: {
        readonly maxRequests: number;
        readonly windowMs: number;
    };
}

/**
 * Interface defining GitHub repository information with enhanced permissions
 * @interface
 */
export interface GitHubRepository {
    readonly id: number;
    readonly name: string;
    readonly fullName: string;
    readonly url: string;
    readonly defaultBranch: string;
    readonly permissions: {
        readonly admin: boolean;
        readonly push: boolean;
        readonly pull: boolean;
    };
}

/**
 * Type definition for GitHub file types
 * @type
 */
export type GitHubFileType = 'file' | 'dir' | 'symlink';

/**
 * Interface defining GitHub file information with content handling
 * @interface
 */
export interface GitHubFile {
    readonly path: string;
    readonly name: string;
    readonly sha: string;
    readonly size: number;
    readonly content: string;
    readonly encoding: 'base64' | 'utf8';
    readonly type: GitHubFileType;
    readonly lastModified: Date;
}

/**
 * Type definition for sync operation status with cancellation support
 * @type
 */
export type GitHubSyncStatusType = 
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'cancelled';

/**
 * Interface defining GitHub sync status with detailed progress tracking
 * @interface
 */
export interface GitHubSyncStatus {
    readonly repositoryId: number;
    readonly branch: string;
    readonly lastSyncTimestamp: Date;
    readonly status: GitHubSyncStatusType;
    readonly error?: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
    };
    readonly progress: {
        readonly current: number;
        readonly total: number;
        readonly percentage: number;
    };
}

// Type guards for runtime type checking

/**
 * Type guard to check if a value is a valid GitHubFile
 * @param value - Value to check
 */
export const isGitHubFile = (value: unknown): value is GitHubFile => {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as GitHubFile).path === 'string' &&
        typeof (value as GitHubFile).name === 'string' &&
        typeof (value as GitHubFile).sha === 'string' &&
        typeof (value as GitHubFile).size === 'number' &&
        typeof (value as GitHubFile).content === 'string' &&
        ['base64', 'utf8'].includes((value as GitHubFile).encoding) &&
        ['file', 'dir', 'symlink'].includes((value as GitHubFile).type) &&
        (value as GitHubFile).lastModified instanceof Date
    );
};

/**
 * Type guard to check if a value is a valid GitHubRepository
 * @param value - Value to check
 */
export const isGitHubRepository = (value: unknown): value is GitHubRepository => {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as GitHubRepository).id === 'number' &&
        typeof (value as GitHubRepository).name === 'string' &&
        typeof (value as GitHubRepository).fullName === 'string' &&
        typeof (value as GitHubRepository).url === 'string' &&
        typeof (value as GitHubRepository).defaultBranch === 'string' &&
        typeof (value as GitHubRepository).permissions === 'object' &&
        typeof (value as GitHubRepository).permissions.admin === 'boolean' &&
        typeof (value as GitHubRepository).permissions.push === 'boolean' &&
        typeof (value as GitHubRepository).permissions.pull === 'boolean'
    );
};

/**
 * Type guard to check if a value is a valid GitHubSyncStatus
 * @param value - Value to check
 */
export const isGitHubSyncStatus = (value: unknown): value is GitHubSyncStatus => {
    const validStatuses: GitHubSyncStatusType[] = [
        'pending',
        'in_progress',
        'completed',
        'failed',
        'cancelled'
    ];
    
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as GitHubSyncStatus).repositoryId === 'number' &&
        typeof (value as GitHubSyncStatus).branch === 'string' &&
        (value as GitHubSyncStatus).lastSyncTimestamp instanceof Date &&
        validStatuses.includes((value as GitHubSyncStatus).status) &&
        typeof (value as GitHubSyncStatus).progress === 'object' &&
        typeof (value as GitHubSyncStatus).progress.current === 'number' &&
        typeof (value as GitHubSyncStatus).progress.total === 'number' &&
        typeof (value as GitHubSyncStatus).progress.percentage === 'number'
    );
};

/**
 * Type guard to check if a value is a valid GitHubConfig
 * @param value - Value to check
 */
export const isGitHubConfig = (value: unknown): value is GitHubConfig => {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as GitHubConfig).accessToken === 'string' &&
        typeof (value as GitHubConfig).apiUrl === 'string' &&
        (typeof (value as GitHubConfig).organization === 'string' || 
         (value as GitHubConfig).organization === null) &&
        typeof (value as GitHubConfig).rateLimitConfig === 'object' &&
        typeof (value as GitHubConfig).rateLimitConfig.maxRequests === 'number' &&
        typeof (value as GitHubConfig).rateLimitConfig.windowMs === 'number'
    );
};