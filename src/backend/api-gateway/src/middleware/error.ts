// External dependencies
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal dependencies
import { error as logError } from '../utils/logger';
import { metrics } from '../utils/metrics';

// HTTP status codes for different error scenarios
const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INTERNAL_SERVER: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Application-specific error codes with categories
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTH_ERROR',
  AUTHORIZATION_ERROR: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_ERROR: 'RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  DATA_ERROR: 'DATA_ERROR',
} as const;

// Error categories for classification and monitoring
const ERROR_CATEGORIES = {
  SECURITY: 'SECURITY',
  VALIDATION: 'VALIDATION',
  SYSTEM: 'SYSTEM',
  BUSINESS: 'BUSINESS',
  EXTERNAL: 'EXTERNAL',
} as const;

// Enhanced custom API error interface
interface ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;
  errorId?: string;
  category?: string;
  isOperational?: boolean;
}

// Enhanced standardized error response format
interface ErrorResponse {
  success: boolean;
  message: string;
  code: string;
  details?: any;
  traceId: string;
  requestId: string;
  errorId: string;
}

/**
 * Sanitizes error messages to prevent sensitive data exposure
 * @param message The error message to sanitize
 * @returns Sanitized error message
 */
const sanitizeErrorMessage = (message: string): string => {
  return message
    .replace(/password=[\w\d]+/gi, 'password=[REDACTED]')
    .replace(/authorization:\s*bearer\s+[\w\d-.]+/gi, 'authorization: [REDACTED]')
    .replace(/token=[\w\d-.]+/gi, 'token=[REDACTED]')
    .replace(/api[_-]?key=[\w\d]+/gi, 'api_key=[REDACTED]')
    .replace(/(\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4})/g, 'XXXX-XXXX-XXXX-XXXX')
    .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '[EMAIL_REDACTED]');
};

/**
 * Creates a standardized error response object
 * @param error The error object
 * @param traceId The trace ID for request tracking
 * @returns Formatted error response
 */
const createErrorResponse = (error: Error | ApiError, traceId: string): ErrorResponse => {
  const errorId = (error as ApiError).errorId || uuidv4();
  const statusCode = (error as ApiError).statusCode || HTTP_STATUS_CODES.INTERNAL_SERVER;
  const code = (error as ApiError).code || ERROR_CODES.INTERNAL_ERROR;
  const sanitizedMessage = sanitizeErrorMessage(error.message);

  return {
    success: false,
    message: sanitizedMessage,
    code,
    details: (error as ApiError).details,
    traceId,
    requestId: traceId, // Using traceId as requestId for consistency
    errorId,
  };
};

/**
 * Enhanced Express error handling middleware
 * @param err Error object
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const traceId = req.headers['x-trace-id'] as string || uuidv4();
  const errorId = uuidv4();

  // Enhance error with additional context
  const enhancedError: ApiError = err as ApiError;
  enhancedError.errorId = errorId;
  enhancedError.category = enhancedError.category || ERROR_CATEGORIES.SYSTEM;
  enhancedError.isOperational = enhancedError.isOperational || false;

  // Determine status code and error category
  const statusCode = enhancedError.statusCode || HTTP_STATUS_CODES.INTERNAL_SERVER;
  const category = enhancedError.category;

  // Log error with enhanced context
  logError('API Error occurred', enhancedError, {
    requestId: traceId,
    userId: (req as any).userId || 'anonymous',
    service: 'api-gateway',
    traceId,
    spanId: errorId,
    environment: process.env.NODE_ENV || 'development',
    metadata: {
      path: req.path,
      method: req.method,
      statusCode,
      errorCategory: category,
      isOperational: enhancedError.isOperational,
    },
  });

  // Record error metrics
  metrics.recordRequestMetric(
    req.method,
    req.path,
    statusCode,
    Date.now() - (req.startTime || Date.now()),
    {
      errorType: enhancedError.code || ERROR_CODES.INTERNAL_ERROR,
      securityEvent: category === ERROR_CATEGORIES.SECURITY ? 'error' : 'none',
      rateLimitGroup: statusCode === HTTP_STATUS_CODES.RATE_LIMIT ? 'api' : 'none',
    }
  );

  // Create standardized error response
  const errorResponse = createErrorResponse(enhancedError, traceId);

  // Apply rate limiting headers if necessary
  if (statusCode === HTTP_STATUS_CODES.RATE_LIMIT) {
    const retryAfter = Math.ceil(Math.random() * 10) + 5; // Random retry delay between 5-15 seconds
    res.setHeader('Retry-After', retryAfter.toString());
  }

  // Send secure error response
  res.status(statusCode).json(errorResponse);
};

export default errorHandler;