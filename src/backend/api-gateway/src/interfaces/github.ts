/**
 * GitHub Integration Interfaces
 * Version: 1.0.0
 * 
 * TypeScript interface definitions for GitHub integration functionality including
 * repository management, file operations, and synchronization status tracking.
 */

/**
 * Configuration interface for GitHub API authentication and settings
 */
export interface GitHubConfig {
    /** GitHub personal access token or OAuth token */
    accessToken: string;
    /** Base URL for GitHub API requests */
    apiUrl: string;
    /** Optional organization name for enterprise GitHub instances */
    organization: string | null;
    /** GitHub API version to use */
    apiVersion: string;
}

/**
 * Interface representing a GitHub repository
 */
export interface GitHubRepository {
    /** Unique repository identifier */
    id: number;
    /** Repository name */
    name: string;
    /** Full repository name including owner/organization */
    fullName: string;
    /** Repository URL */
    url: string;
    /** Default branch name (e.g., 'main' or 'master') */
    defaultBranch: string;
    /** Repository visibility status */
    private: boolean;
    /** Optional repository description */
    description: string | null;
}

/**
 * Interface representing a GitHub branch
 */
export interface GitHubBranch {
    /** Branch name */
    name: string;
    /** Latest commit information */
    commit: {
        sha: string;
        url: string;
    };
    /** Branch protection status */
    protected: boolean;
}

/**
 * Type definition for GitHub file types
 */
export type GitHubFileType = 'file' | 'dir' | 'symlink';

/**
 * Interface representing a GitHub file or directory
 */
export interface GitHubFile {
    /** File path relative to repository root */
    path: string;
    /** File name */
    name: string;
    /** File content hash */
    sha: string;
    /** File size in bytes */
    size: number;
    /** File content (base64 encoded for binary files) */
    content: string;
    /** Type of file (file, directory, or symlink) */
    type: GitHubFileType;
    /** Content encoding (e.g., 'base64', 'utf-8') */
    encoding: string;
    /** API URL for file operations */
    url: string;
}

/**
 * Type definition for synchronization operation status
 */
export type GitHubSyncStatusType = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Interface for tracking GitHub repository synchronization status
 */
export interface GitHubSyncStatus {
    /** Repository identifier */
    repositoryId: number;
    /** Branch being synchronized */
    branch: string;
    /** Timestamp of last synchronization attempt */
    lastSyncTimestamp: Date;
    /** Current synchronization status */
    status: GitHubSyncStatusType;
    /** Error message if synchronization failed */
    error: string | null;
    /** Number of files processed */
    filesProcessed: number;
    /** Total number of files to process */
    totalFiles: number;
}

/**
 * Interface for GitHub API error responses
 */
export interface GitHubErrorResponse {
    /** Error message */
    message: string;
    /** URL to relevant documentation */
    documentation_url?: string;
    /** Detailed error information */
    errors?: Array<{
        resource: string;
        field: string;
        code: string;
    }>;
}