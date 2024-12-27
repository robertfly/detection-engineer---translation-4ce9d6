/**
 * API Gateway Validation Middleware
 * Provides centralized request validation with enhanced security and performance monitoring
 * @version 1.0.0
 */

// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import createError from 'http-errors'; // v2.0.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1

// Internal dependencies
import { error, debug } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { validateDetectionFormat } from '../validation/detection';
import { validateTranslationRequest } from '../validation/translation';
import { validateGitHubConfig } from '../validation/github';

// Validation metrics constants
export const VALIDATION_METRICS = {
  VALIDATION_SUCCESS: 'validation_success_total',
  VALIDATION_FAILURE: 'validation_failure_total',
  VALIDATION_DURATION: 'validation_duration_seconds',
  VALIDATION_BATCH_SIZE: 'validation_batch_size',
  VALIDATION_ERROR_TYPE: 'validation_error_type'
} as const;

// Request type constants
export const REQUEST_TYPES = {
  DETECTION: 'detection',
  TRANSLATION: 'translation',
  GITHUB: 'github',
  BATCH: 'batch'
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  MAX_REQUEST_SIZE: '5MB',
  MAX_BATCH_SIZE: 100,
  RATE_LIMIT_WINDOW: '1m',
  RATE_LIMIT_MAX: 100
} as const;

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  points: VALIDATION_LIMITS.RATE_LIMIT_MAX,
  duration: 60, // 1 minute
});

/**
 * Main validation middleware function
 * Validates incoming requests based on type with enhanced security and monitoring
 */
export async function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    // Rate limiting check
    await rateLimiter.consume(req.ip);

    // Request size validation
    if (req.headers['content-length'] && 
        parseInt(req.headers['content-length']) > parseInt(VALIDATION_LIMITS.MAX_REQUEST_SIZE)) {
      throw createError(413, 'Request entity too large');
    }

    // Determine request type and validate accordingly
    const validationResult = await validateRequestByType(req);

    // Record validation metrics
    metrics.recordRequestMetric(
      req.method,
      req.path,
      validationResult.isValid ? 200 : 400,
      Date.now() - startTime,
      {
        errorType: validationResult.isValid ? 'none' : 'validation_error',
        securityEvent: validationResult.isValid ? 'none' : 'validation_failure'
      }
    );

    // Log validation result
    if (!validationResult.isValid) {
      error('Validation failed', new Error(validationResult.errors[0]?.message || 'Unknown validation error'), {
        requestId,
        userId: req.user?.id || 'anonymous',
        service: 'api_gateway',
        traceId: req.headers['x-trace-id'] as string,
        spanId: 'validate_request',
        environment: process.env.NODE_ENV || 'development'
      });

      throw createError(400, {
        message: 'Validation failed',
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
    }

    debug('Validation successful', {
      requestId,
      userId: req.user?.id || 'anonymous',
      service: 'api_gateway',
      traceId: req.headers['x-trace-id'] as string,
      spanId: 'validate_request',
      environment: process.env.NODE_ENV || 'development'
    });

    next();
  } catch (err) {
    if (err.name === 'RateLimiterError') {
      next(createError(429, 'Too many requests'));
    } else {
      next(err);
    }
  }
}

/**
 * Validates request based on its type
 * Implements specific validation logic for each request type
 */
async function validateRequestByType(req: Request): Promise<ValidationResult> {
  const path = req.path.toLowerCase();

  if (path.includes('/detection')) {
    return validateDetectionRequest(req);
  } else if (path.includes('/translate')) {
    return validateTranslationRequest(req);
  } else if (path.includes('/github')) {
    return validateGitHubRequest(req);
  }

  throw createError(400, 'Invalid request type');
}

/**
 * Validates detection-related requests
 * Implements format and content validation for detections
 */
async function validateDetectionRequest(req: Request): Promise<ValidationResult> {
  const { content, format } = req.body;

  if (!content || !format) {
    return {
      isValid: false,
      errors: [{ 
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Content and format are required',
        line: null,
        column: null,
        severity: 'high',
        ruleId: 'required_fields',
        timestamp: new Date()
      }],
      warnings: [],
      validatedAt: new Date()
    };
  }

  return await validateDetectionFormat(content, format);
}

/**
 * Validates GitHub integration requests
 * Implements security and access validation for GitHub operations
 */
async function validateGitHubRequest(req: Request): Promise<ValidationResult> {
  try {
    const config = validateGitHubConfig(req.body);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validatedAt: new Date()
    };
  } catch (err) {
    return {
      isValid: false,
      errors: [{
        code: 'GITHUB_CONFIG_ERROR',
        message: err.message,
        line: null,
        column: null,
        severity: 'high',
        ruleId: 'github_config',
        timestamp: new Date()
      }],
      warnings: [],
      validatedAt: new Date()
    };
  }
}

export default validateRequest;