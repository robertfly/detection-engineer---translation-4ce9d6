// @package dotenv ^16.3.1
import { config } from 'dotenv';
config(); // Initialize environment variables

/**
 * Interface defining authentication configuration parameters
 */
interface AuthConfig {
  jwtPublicKey: string;
  jwtPrivateKey: string;
  jwtExpiryTime: number;
  jwtAlgorithm: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0ClientSecret: string;
  auth0Audience: string;
  enableMFA: boolean;
  tokenVersion: string;
  cacheConfig: {
    ttl: number;
    maxSize: number;
    checkPeriod: number;
  };
}

/**
 * Interface defining granular role-based permissions
 */
interface RolePermissions {
  admin: string[];
  engineer: string[];
  analyst: string[];
  reader: string[];
  customRoles: Record<string, string[]>;
}

/**
 * Default JWT expiration time in seconds
 */
const DEFAULT_JWT_EXPIRY: number = 3600;

/**
 * Predefined role-based permissions matrix
 */
const ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    'create:detection',
    'edit:detection',
    'delete:detection',
    'manage:users',
    'manage:system',
    'manage:security',
    'view:audit-logs'
  ],
  engineer: [
    'create:detection',
    'edit:detection',
    'translate:detection',
    'manage:github',
    'view:validation-reports'
  ],
  analyst: [
    'translate:detection',
    'view:detection',
    'create:validation-report'
  ],
  reader: [
    'view:detection',
    'view:public-reports'
  ],
  customRoles: {}
};

/**
 * Security settings with secure defaults
 */
const SECURITY_SETTINGS = {
  minPasswordLength: 12,
  requireMFA: true,
  jwtRefreshInterval: 3600,
  maxLoginAttempts: 5,
  sessionTimeout: 1800,
  passwordPolicies: {
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuseCount: 5
  }
};

/**
 * Loads and validates authentication configuration from environment variables
 * @returns {AuthConfig} Validated authentication configuration object
 * @throws {Error} If configuration validation fails
 */
const loadAuthConfig = (): AuthConfig => {
  // Load required environment variables with validation
  const config: AuthConfig = {
    jwtPublicKey: process.env.JWT_PUBLIC_KEY || '',
    jwtPrivateKey: process.env.JWT_PRIVATE_KEY || '',
    jwtExpiryTime: parseInt(process.env.JWT_EXPIRY_TIME || DEFAULT_JWT_EXPIRY.toString(), 10),
    jwtAlgorithm: process.env.JWT_ALGORITHM || 'RS256',
    auth0Domain: process.env.AUTH0_DOMAIN || '',
    auth0ClientId: process.env.AUTH0_CLIENT_ID || '',
    auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    auth0Audience: process.env.AUTH0_AUDIENCE || '',
    enableMFA: process.env.ENABLE_MFA === 'true',
    tokenVersion: process.env.TOKEN_VERSION || 'v1',
    cacheConfig: {
      ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
      checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10)
    }
  };

  // Validate the loaded configuration
  const validationResult = validateAuthConfig(config);
  if (!validationResult.isValid) {
    throw new Error(`Invalid authentication configuration: ${validationResult.errors.join(', ')}`);
  }

  return config;
};

/**
 * Validates the authentication configuration
 * @param {AuthConfig} config - Configuration to validate
 * @returns {ValidationResult} Validation result with detailed error information
 */
const validateAuthConfig = (config: AuthConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate JWT configuration
  if (!config.jwtPublicKey || !config.jwtPrivateKey) {
    errors.push('JWT key pair is required');
  }

  if (!['RS256', 'RS384', 'RS512'].includes(config.jwtAlgorithm)) {
    errors.push('Invalid JWT algorithm');
  }

  // Validate Auth0 configuration
  if (!config.auth0Domain || !config.auth0ClientId || !config.auth0ClientSecret) {
    errors.push('Complete Auth0 configuration is required');
  }

  // Validate cache configuration
  if (config.cacheConfig.ttl < 0 || config.cacheConfig.maxSize < 0) {
    errors.push('Invalid cache configuration values');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates role permissions structure and integrity
 * @param {RolePermissions} permissions - Permissions to validate
 * @returns {boolean} Validation result
 */
const validatePermissions = (permissions: RolePermissions): boolean => {
  const allPermissions = new Set<string>();
  
  // Collect all unique permissions
  Object.values(permissions).forEach(rolePerms => {
    if (Array.isArray(rolePerms)) {
      rolePerms.forEach(perm => allPermissions.add(perm));
    }
  });

  // Validate permission format and structure
  for (const [role, perms] of Object.entries(permissions)) {
    if (!Array.isArray(perms)) {
      if (role !== 'customRoles') {
        return false;
      }
      continue;
    }

    // Validate each permission format
    if (!perms.every(perm => typeof perm === 'string' && perm.includes(':'))) {
      return false;
    }
  }

  return true;
};

// Export the authentication configuration
export const authConfig = {
  ...loadAuthConfig(),
  securitySettings: SECURITY_SETTINGS
};

// Export role-based permissions configuration
export const rolePermissions = {
  rolePermissions: ROLE_PERMISSIONS,
  validatePermissions
};

// Export validation functions for external use
export {
  validateAuthConfig,
  validatePermissions
};