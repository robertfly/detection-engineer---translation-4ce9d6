/**
 * GitHub Integration Validation Module
 * Version: 1.0.0
 * 
 * Provides comprehensive validation for GitHub integration requests including
 * configuration, repository access, file operations, and sync operations.
 * Implements strict schema validation with enhanced security controls.
 */

import { z } from 'zod'; // v3.22.0
import { GitHubConfig, GitHubRepository } from '../interfaces/github';

// Constants for validation rules
const GITHUB_ACCESS_TOKEN_REGEX = /^gh[ps]_[a-zA-Z0-9]{36}$/;
const GITHUB_REPO_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const MAX_FILE_PATH_LENGTH = 256;
const ALLOWED_FILE_TYPES = ['spl', 'sigma', 'qradar', 'kql', 'yara', 'yara-l'] as const;

/**
 * Schema for GitHub configuration validation
 */
const githubConfigSchema = z.object({
  accessToken: z.string()
    .regex(
      GITHUB_ACCESS_TOKEN_REGEX,
      'Invalid GitHub access token format. Must be a valid GitHub personal access token.'
    ),
  organization: z.string()
    .regex(/^[a-zA-Z0-9-]+$/, 'Organization name must contain only alphanumeric characters and hyphens')
    .min(1, 'Organization name cannot be empty')
    .max(39, 'Organization name cannot exceed 39 characters')
    .nullable()
    .optional(),
  apiUrl: z.string().url('Invalid GitHub API URL').optional(),
  apiVersion: z.string().optional()
});

/**
 * Schema for repository access validation
 */
const repositoryAccessSchema = z.object({
  id: z.number().int().positive('Repository ID must be a positive integer'),
  name: z.string()
    .regex(
      GITHUB_REPO_NAME_REGEX,
      'Repository name must contain only alphanumeric characters, dots, hyphens, and underscores'
    )
    .min(1, 'Repository name cannot be empty')
    .max(100, 'Repository name cannot exceed 100 characters'),
  branch: z.string()
    .regex(
      /^[a-zA-Z0-9-_/.]+$/,
      'Branch name must contain only alphanumeric characters, hyphens, underscores, dots, and forward slashes'
    )
    .max(255, 'Branch name cannot exceed 255 characters')
    .optional()
});

/**
 * Schema for file operation validation
 */
const fileOperationSchema = z.object({
  path: z.string()
    .max(MAX_FILE_PATH_LENGTH, `File path cannot exceed ${MAX_FILE_PATH_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9-_/.]+$/, 'Invalid file path format')
    .refine(path => !path.includes('..'), 'Path traversal is not allowed'),
  type: z.enum(ALLOWED_FILE_TYPES).optional(),
  content: z.string()
    .max(1048576, 'File content cannot exceed 1MB')
    .optional()
});

/**
 * Schema for sync operation validation
 */
const syncOperationSchema = z.object({
  repoId: z.number().int().positive('Repository ID must be a positive integer'),
  branch: z.string()
    .regex(
      /^[a-zA-Z0-9-_/.]+$/,
      'Branch name must contain only alphanumeric characters, hyphens, underscores, dots, and forward slashes'
    ),
  options: z.object({
    includePrivate: z.boolean().optional(),
    maxDepth: z.number().int().min(1).max(10).optional(),
    fileTypes: z.array(z.enum(ALLOWED_FILE_TYPES)).optional(),
    concurrency: z.number().int().min(1).max(5).optional()
  }).optional()
});

/**
 * Validates GitHub configuration parameters
 * @param config - GitHub configuration object
 * @returns Validated GitHub configuration
 * @throws ZodError if validation fails
 */
export function validateGitHubConfig(config: Partial<GitHubConfig>): GitHubConfig {
  try {
    return githubConfigSchema.parse(config) as GitHubConfig;
  } catch (error) {
    throw new Error(`GitHub configuration validation failed: ${error.message}`);
  }
}

/**
 * Validates repository access parameters
 * @param params - Repository access parameters
 * @returns Validated repository access parameters
 * @throws ZodError if validation fails
 */
export function validateRepositoryAccess(params: Partial<GitHubRepository>): GitHubRepository {
  try {
    return repositoryAccessSchema.parse(params) as GitHubRepository;
  } catch (error) {
    throw new Error(`Repository access validation failed: ${error.message}`);
  }
}

/**
 * Validates file operation parameters
 * @param params - File operation parameters
 * @returns Validated file operation parameters
 * @throws ZodError if validation fails
 */
export function validateFileOperation(params: {
  path: string;
  type?: string;
  content?: string;
}): {
  path: string;
  type?: string;
  content?: string;
} {
  try {
    return fileOperationSchema.parse(params);
  } catch (error) {
    throw new Error(`File operation validation failed: ${error.message}`);
  }
}

/**
 * Validates sync operation parameters
 * @param params - Sync operation parameters
 * @returns Validated sync operation parameters
 * @throws ZodError if validation fails
 */
export function validateSyncOperation(params: {
  repoId: number;
  branch: string;
  options?: {
    includePrivate?: boolean;
    maxDepth?: number;
    fileTypes?: string[];
    concurrency?: number;
  };
}): {
  repoId: number;
  branch: string;
  options?: {
    includePrivate?: boolean;
    maxDepth?: number;
    fileTypes?: string[];
    concurrency?: number;
  };
} {
  try {
    return syncOperationSchema.parse(params);
  } catch (error) {
    throw new Error(`Sync operation validation failed: ${error.message}`);
  }
}

// Export type definitions for external use
export type { GitHubConfig, GitHubRepository };