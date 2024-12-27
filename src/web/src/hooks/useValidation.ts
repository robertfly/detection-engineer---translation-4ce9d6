/**
 * @fileoverview Enhanced React hook for managing detection validation state and operations.
 * Provides secure validation interface with comprehensive error handling and performance optimization.
 * @version 1.0.0
 */

// External imports
import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Internal imports
import { ValidationResult, ValidationStatus } from '../interfaces/validation';
import { validateDetectionThunk, selectValidationResult } from '../store/validationSlice';
import { logger } from '../utils/logger';

// Constants for validation configuration
const VALIDATION_POLL_INTERVAL = 2000; // 2 seconds
const VALIDATION_CACHE_DURATION = 300000; // 5 minutes
const MAX_VALIDATION_RETRIES = 3;
const VALIDATION_TIMEOUT = 30000; // 30 seconds

/**
 * Interface for validation metrics tracking
 */
interface ValidationMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  lastResponseTime: number;
}

/**
 * Interface for validation history tracking
 */
interface ValidationHistory {
  timestamp: Date;
  status: ValidationStatus;
  confidenceScore: number;
}

/**
 * Interface for validation error details
 */
interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}

/**
 * Interface for security context
 */
interface SecurityContext {
  userId: string;
  sessionId: string;
  permissions: string[];
}

/**
 * Interface for hook return value
 */
interface UseValidationResult {
  validateDetection: (targetFormat: string) => Promise<ValidationResult>;
  validationResult: ValidationResult | null;
  isValidating: boolean;
  error: ValidationError | null;
  metrics: ValidationMetrics;
  history: ValidationHistory[];
  securityContext: SecurityContext;
}

/**
 * Enhanced custom hook for managing detection validation with comprehensive monitoring
 * @param detectionId - Unique identifier for the detection
 * @param securityContext - Security context for validation operations
 * @returns Object containing validation methods and state
 */
export const useValidation = (
  detectionId: string,
  securityContext: SecurityContext
): UseValidationResult => {
  const dispatch = useDispatch();
  const validationResult = useSelector(selectValidationResult);

  // Initialize validation metrics
  const [metrics, setMetrics] = useState<ValidationMetrics>({
    totalAttempts: 0,
    successCount: 0,
    failureCount: 0,
    averageResponseTime: 0,
    lastResponseTime: 0,
  });

  // Initialize validation history
  const [history, setHistory] = useState<ValidationHistory[]>([]);

  // Initialize error state
  const [error, setError] = useState<ValidationError | null>(null);

  // Initialize validation state
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Memoized validation cache key generator
   */
  const getCacheKey = useMemo(() => {
    return `validation_${detectionId}_${JSON.stringify(securityContext)}`;
  }, [detectionId, securityContext]);

  /**
   * Enhanced validation function with security checks and monitoring
   */
  const validateDetection = useCallback(async (
    targetFormat: string
  ): Promise<ValidationResult> => {
    try {
      // Security validation
      if (!securityContext.permissions.includes('VALIDATE')) {
        throw new Error('Insufficient permissions for validation');
      }

      // Generate correlation ID for request tracking
      const correlationId = crypto.randomUUID();
      logger.setCorrelationId(correlationId);

      // Update metrics
      setMetrics(prev => ({
        ...prev,
        totalAttempts: prev.totalAttempts + 1,
      }));

      // Start validation
      setIsValidating(true);
      setError(null);

      const startTime = Date.now();

      // Dispatch validation thunk
      const result = await dispatch(validateDetectionThunk({
        detectionId,
        targetFormat,
        securityContext,
        correlationId,
      })).unwrap();

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Update metrics
      setMetrics(prev => ({
        ...prev,
        successCount: prev.successCount + 1,
        lastResponseTime: responseTime,
        averageResponseTime: (prev.averageResponseTime * prev.totalAttempts + responseTime) / (prev.totalAttempts + 1),
      }));

      // Update history
      setHistory(prev => [
        {
          timestamp: new Date(),
          status: result.status,
          confidenceScore: result.confidenceScore,
        },
        ...prev,
      ]);

      logger.info('Validation completed successfully', {
        detectionId,
        targetFormat,
        correlationId,
        responseTime,
      });

      return result;

    } catch (error) {
      // Enhanced error handling
      const validationError: ValidationError = {
        code: error.code || 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
        retryable: error.status >= 500 || error.status === 429,
      };

      setError(validationError);
      setMetrics(prev => ({
        ...prev,
        failureCount: prev.failureCount + 1,
      }));

      logger.error('Validation failed', {
        error: validationError,
        detectionId,
        targetFormat,
      });

      throw validationError;

    } finally {
      setIsValidating(false);
    }
  }, [detectionId, securityContext, dispatch]);

  /**
   * Cleanup effect for validation resources
   */
  useEffect(() => {
    return () => {
      logger.info('Cleaning up validation resources', {
        detectionId,
      });
    };
  }, [detectionId]);

  return {
    validateDetection,
    validationResult,
    isValidating,
    error,
    metrics,
    history,
    securityContext,
  };
};

export type {
  UseValidationResult,
  ValidationMetrics,
  ValidationHistory,
  ValidationError,
  SecurityContext,
};