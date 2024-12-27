/**
 * GitHub Integration Router Module
 * Version: 1.0.0
 * 
 * Implements secure routes for GitHub integration with comprehensive validation,
 * monitoring, and rate limiting for detection rule management.
 */

// External dependencies
import express, { Router } from 'express'; // v4.18.2
import rateLimit from 'express-rate-limit'; // v6.9.0
import { body } from 'express-validator'; // v7.0.0

// Internal dependencies
import { 
  listRepositories, 
  getBranches, 
  getFiles, 
  syncRepository 
} from '../controllers/github';
import { 
  authenticateRequest, 
  checkPermissions 
} from '../middleware/auth';
import validateRequest from '../middleware/validation';
import { 
  validateGitHubConfig, 
  validateRepositoryAccess, 
  validateFileOperation, 
  validateSyncOperation 
} from '../validation/github';

// Constants for rate limiting windows and maximums
const RATE_LIMIT_WINDOWS = {
  REPOSITORIES: '15m',
  BRANCHES: '15m',
  FILES: '5m',
  SYNC: '1h'
} as const;

const RATE_LIMIT_MAX = {
  REPOSITORIES: 100,
  BRANCHES: 200,
  FILES: 300,
  SYNC: 10
} as const;

// Required permissions for GitHub operations
const REQUIRED_PERMISSIONS = {
  GITHUB_READ: 'github:read',
  GITHUB_WRITE: 'github:write',
  GITHUB_ADMIN: 'github:admin'
} as const;

/**
 * Creates and configures the GitHub integration router with security middleware
 * @returns Configured Express router for GitHub operations
 */
function createGitHubRouter(): Router {
  const router = Router();

  // Apply global authentication middleware
  router.use(authenticateRequest);

  // Configure rate limiters for different endpoints
  const repoRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: RATE_LIMIT_MAX.REPOSITORIES,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many repository requests, please try again later'
  });

  const branchRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: RATE_LIMIT_MAX.BRANCHES,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many branch requests, please try again later'
  });

  const fileRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: RATE_LIMIT_MAX.FILES,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many file requests, please try again later'
  });

  const syncRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: RATE_LIMIT_MAX.SYNC,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many sync requests, please try again later'
  });

  // List repositories endpoint
  router.get('/repositories',
    repoRateLimiter,
    checkPermissions({ 
      requiredPermissions: [REQUIRED_PERMISSIONS.GITHUB_READ],
      enforceRateLimit: true 
    }),
    validateRequest,
    listRepositories
  );

  // Get repository branches endpoint
  router.get('/repositories/:id/branches',
    branchRateLimiter,
    checkPermissions({ 
      requiredPermissions: [REQUIRED_PERMISSIONS.GITHUB_READ],
      enforceRateLimit: true 
    }),
    validateRequest,
    getBranches
  );

  // Get repository files endpoint
  router.get('/repositories/:id/files',
    fileRateLimiter,
    checkPermissions({ 
      requiredPermissions: [REQUIRED_PERMISSIONS.GITHUB_READ],
      enforceRateLimit: true 
    }),
    validateRequest,
    getFiles
  );

  // Sync repository endpoint
  router.post('/repositories/:id/sync',
    syncRateLimiter,
    checkPermissions({ 
      requiredPermissions: [REQUIRED_PERMISSIONS.GITHUB_WRITE],
      enforceRateLimit: true,
      securityLevel: 'high'
    }),
    body('branch').optional().isString().trim(),
    body('validateRules').optional().isBoolean(),
    validateRequest,
    syncRepository
  );

  return router;
}

// Create and export the configured router
const router = createGitHubRouter();
export default router;