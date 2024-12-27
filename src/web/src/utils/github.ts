// js-base64 version: ^3.7.5
import { Base64 } from 'js-base64';
// xss version: ^1.0.14
import sanitize from 'xss';
import { GitHubRepository, GitHubFile } from '../interfaces/github';
import { logger } from './logger';

// Constants for GitHub operations with security controls
const ALLOWED_EXTENSIONS = ['.spl', '.yml', '.sigma', '.kql', '.yara', '.yaral'] as const;
const GITHUB_CONTENT_WRAPPER_REGEX = /^data:\s*[^;]+;base64,/;
const MAX_FILE_SIZE_MB = 10;
const API_REQUEST_LIMITS = {
    perMinute: 100,
    perHour: 1000
} as const;
const VALIDATION_CACHE_TTL = 300000; // 5 minutes in milliseconds

// Cache for validation results
const validationCache = new Map<string, { result: boolean; timestamp: number }>();

/**
 * Enhanced validation of GitHub repository information with security checks
 * @param repository - Repository object to validate
 * @returns Promise resolving to validation result
 */
export async function validateRepository(repository: GitHubRepository): Promise<boolean> {
    try {
        // Validate repository object existence
        if (!repository) {
            logger.error('Invalid repository: Repository object is null or undefined');
            return false;
        }

        // Sanitize repository input data
        const sanitizedName = sanitize(repository.name);
        const sanitizedFullName = sanitize(repository.fullName);

        // Check cache for existing validation
        const cacheKey = `repo_${repository.id}`;
        const cachedValidation = validationCache.get(cacheKey);
        if (cachedValidation && (Date.now() - cachedValidation.timestamp) < VALIDATION_CACHE_TTL) {
            return cachedValidation.result;
        }

        // Validate repository id
        if (!repository.id || typeof repository.id !== 'number') {
            logger.error('Invalid repository: Missing or invalid repository ID');
            return false;
        }

        // Validate repository name format
        const namePattern = /^[a-zA-Z0-9-_.]+$/;
        if (!namePattern.test(sanitizedName)) {
            logger.security('Invalid repository: Repository name contains invalid characters', {
                repositoryId: repository.id,
                name: sanitizedName
            });
            return false;
        }

        // Validate repository full name format
        const fullNamePattern = /^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/;
        if (!fullNamePattern.test(sanitizedFullName)) {
            logger.security('Invalid repository: Invalid repository full name format', {
                repositoryId: repository.id,
                fullName: sanitizedFullName
            });
            return false;
        }

        // Cache successful validation result
        validationCache.set(cacheKey, {
            result: true,
            timestamp: Date.now()
        });

        logger.info('Repository validation successful', {
            repositoryId: repository.id,
            name: sanitizedName
        });

        return true;
    } catch (error) {
        logger.error('Repository validation error', { error, repositoryId: repository?.id });
        return false;
    }
}

/**
 * Enhanced validation of detection files with security and size checks
 * @param file - File object to validate
 * @returns Boolean indicating if file is valid
 */
export function isDetectionFile(file: GitHubFile): boolean {
    try {
        // Validate file object and required properties
        if (!file || !file.path || !file.content || !file.type || typeof file.size !== 'number') {
            logger.error('Invalid file: Missing required properties');
            return false;
        }

        // Validate file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
            logger.security('Invalid file: File size exceeds maximum limit', {
                path: file.path,
                size: fileSizeMB
            });
            return false;
        }

        // Validate file extension
        const fileExtension = file.path.toLowerCase().slice(file.path.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(fileExtension as typeof ALLOWED_EXTENSIONS[number])) {
            logger.security('Invalid file: Unsupported file extension', {
                path: file.path,
                extension: fileExtension
            });
            return false;
        }

        // Validate file type
        if (file.type !== 'file') {
            logger.error('Invalid file: Not a regular file', {
                path: file.path,
                type: file.type
            });
            return false;
        }

        // Scan file path for security issues
        const sanitizedPath = sanitize(file.path);
        if (sanitizedPath !== file.path) {
            logger.security('Invalid file: File path contains potentially malicious content', {
                path: file.path
            });
            return false;
        }

        return true;
    } catch (error) {
        logger.error('File validation error', { error, path: file?.path });
        return false;
    }
}

/**
 * Secure decoding of base64 encoded file content with validation
 * @param content - Base64 encoded content to decode
 * @returns Promise resolving to decoded content
 */
export async function decodeFileContent(content: string): Promise<string> {
    try {
        // Validate input content
        if (!content) {
            throw new Error('Invalid content: Content is empty or undefined');
        }

        // Remove GitHub content wrapper if present
        let cleanContent = content;
        if (GITHUB_CONTENT_WRAPPER_REGEX.test(content)) {
            cleanContent = content.replace(GITHUB_CONTENT_WRAPPER_REGEX, '');
        }

        // Validate content format
        if (!/^[A-Za-z0-9+/=]+$/.test(cleanContent)) {
            throw new Error('Invalid content: Content contains invalid base64 characters');
        }

        // Attempt base64 decoding with error handling
        const decodedContent = Base64.decode(cleanContent);

        // Validate decoded content
        if (!decodedContent) {
            throw new Error('Invalid content: Decoded content is empty');
        }

        logger.info('File content decoded successfully');
        return decodedContent;
    } catch (error) {
        logger.error('Content decoding error', { error });
        throw error;
    }
}

/**
 * Secure formatting of repository names with validation
 * @param fullName - Full repository name to format
 * @returns Formatted repository name
 */
export function formatRepositoryName(fullName: string): string {
    try {
        // Validate input
        if (!fullName || typeof fullName !== 'string') {
            throw new Error('Invalid repository name: Name is empty or invalid');
        }

        // Sanitize input
        const sanitizedName = sanitize(fullName);

        // Split and validate components
        const [owner, repo] = sanitizedName.split('/');
        if (!owner || !repo) {
            throw new Error('Invalid repository name format');
        }

        // Format name according to display requirements
        const formattedName = `${owner}/${repo}`.trim();

        logger.info('Repository name formatted successfully', { fullName: formattedName });
        return formattedName;
    } catch (error) {
        logger.error('Repository name formatting error', { error, fullName });
        throw error;
    }
}