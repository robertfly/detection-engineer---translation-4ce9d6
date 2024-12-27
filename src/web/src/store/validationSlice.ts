/**
 * @fileoverview Redux Toolkit slice for managing validation state in the detection translation platform.
 * Implements secure validation state management with comprehensive monitoring, metrics tracking, and audit capabilities.
 * @version 1.0.0
 */

// External imports - version: ^1.9.7
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Internal imports
import { ValidationResult, ValidationStatus } from '../interfaces/validation';
import { validationService } from '../services/validation';
import { DetectionFormat } from '../interfaces/detection';
import { logger } from '../utils/logger';

/**
 * Interface for validation metrics tracking
 */
interface ValidationMetrics {
  totalValidations: number;
  successRate: number;
  averageConfidence: number;
  performanceMetrics: {
    averageResponseTime?: number;
    lastResponseTime?: number;
    failureCount?: number;
  };
}

/**
 * Interface for validation security context
 */
interface SecurityContext {
  lastAccess: Date | null;
  accessCount: number;
  securityEvents: Array<{
    timestamp: Date;
    event: string;
    details: Record<string, any>;
  }>;
}

/**
 * Interface for validation audit trail
 */
interface ValidationAudit {
  id: string;
  timestamp: Date;
  action: string;
  result: ValidationResult | null;
  metadata: Record<string, any>;
}

/**
 * Interface for validation cache
 */
interface ValidationCache {
  [key: string]: {
    result: ValidationResult;
    timestamp: Date;
    expiresAt: Date;
  };
}

/**
 * Interface for validation state
 */
interface ValidationState {
  currentValidation: ValidationResult | null;
  validationHistory: ValidationResult[];
  isValidating: boolean;
  error: string | null;
  metrics: ValidationMetrics;
  securityContext: SecurityContext;
  auditTrail: ValidationAudit[];
  resultCache: ValidationCache;
}

/**
 * Initial state with comprehensive tracking and security
 */
const initialState: ValidationState = {
  currentValidation: null,
  validationHistory: [],
  isValidating: false,
  error: null,
  metrics: {
    totalValidations: 0,
    successRate: 0,
    averageConfidence: 0,
    performanceMetrics: {},
  },
  securityContext: {
    lastAccess: null,
    accessCount: 0,
    securityEvents: [],
  },
  auditTrail: [],
  resultCache: {},
};

/**
 * Enhanced async thunk for secure validation with metrics
 */
export const validateDetection = createAsyncThunk(
  'validation/validateDetection',
  async (
    {
      content,
      sourceFormat,
      targetFormat,
      securityContext,
    }: {
      content: string;
      sourceFormat: DetectionFormat;
      targetFormat: DetectionFormat;
      securityContext: Record<string, any>;
    },
    { rejectWithValue }
  ) => {
    try {
      const startTime = Date.now();
      const correlationId = crypto.randomUUID();

      logger.info('Starting validation', {
        correlationId,
        sourceFormat,
        targetFormat,
      });

      const result = await validationService.validateDetection(
        content,
        sourceFormat,
        targetFormat
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('Validation completed', {
        correlationId,
        status: result.status,
        responseTime,
      });

      return {
        result,
        metrics: {
          responseTime,
          timestamp: new Date(),
          correlationId,
        },
      };
    } catch (error) {
      logger.error('Validation failed', { error });
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Enhanced validation slice with comprehensive state management
 */
const validationSlice = createSlice({
  name: 'validation',
  initialState,
  reducers: {
    clearValidationWithAudit: (
      state,
      action: PayloadAction<{ securityContext: Record<string, any> }>
    ) => {
      const auditEntry: ValidationAudit = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'CLEAR_VALIDATION',
        result: state.currentValidation,
        metadata: {
          securityContext: action.payload.securityContext,
          clearedAt: new Date().toISOString(),
        },
      };

      state.currentValidation = null;
      state.auditTrail.push(auditEntry);
      state.securityContext.lastAccess = new Date();
      state.securityContext.accessCount += 1;
    },
    updateMetrics: (state, action: PayloadAction<Partial<ValidationMetrics>>) => {
      state.metrics = {
        ...state.metrics,
        ...action.payload,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(validateDetection.pending, (state) => {
        state.isValidating = true;
        state.error = null;
        state.securityContext.lastAccess = new Date();
        state.securityContext.accessCount += 1;
      })
      .addCase(validateDetection.fulfilled, (state, action) => {
        const { result, metrics } = action.payload;
        
        // Update current validation
        state.currentValidation = result;
        state.validationHistory.push(result);
        state.isValidating = false;

        // Update metrics
        state.metrics.totalValidations += 1;
        state.metrics.averageConfidence = calculateAverageConfidence(
          state.validationHistory
        );
        state.metrics.successRate = calculateSuccessRate(state.validationHistory);
        state.metrics.performanceMetrics = {
          ...state.metrics.performanceMetrics,
          lastResponseTime: metrics.responseTime,
          averageResponseTime: calculateAverageResponseTime(
            state.metrics.performanceMetrics.averageResponseTime,
            metrics.responseTime
          ),
        };

        // Add audit entry
        const auditEntry: ValidationAudit = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'VALIDATION_COMPLETED',
          result,
          metadata: {
            metrics,
            correlationId: metrics.correlationId,
          },
        };
        state.auditTrail.push(auditEntry);

        // Update cache
        const cacheKey = generateCacheKey(result);
        state.resultCache[cacheKey] = {
          result,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes cache
        };
      })
      .addCase(validateDetection.rejected, (state, action) => {
        state.isValidating = false;
        state.error = action.payload as string;
        
        // Update metrics for failure
        state.metrics.performanceMetrics.failureCount =
          (state.metrics.performanceMetrics.failureCount || 0) + 1;

        // Add security event
        state.securityContext.securityEvents.push({
          timestamp: new Date(),
          event: 'VALIDATION_FAILED',
          details: {
            error: action.payload,
            timestamp: new Date().toISOString(),
          },
        });
      });
  },
});

/**
 * Helper function to calculate average confidence score
 */
const calculateAverageConfidence = (history: ValidationResult[]): number => {
  if (history.length === 0) return 0;
  const sum = history.reduce((acc, result) => acc + result.confidenceScore, 0);
  return sum / history.length;
};

/**
 * Helper function to calculate success rate
 */
const calculateSuccessRate = (history: ValidationResult[]): number => {
  if (history.length === 0) return 0;
  const successCount = history.filter(
    (result) => result.status === ValidationStatus.SUCCESS
  ).length;
  return (successCount / history.length) * 100;
};

/**
 * Helper function to calculate average response time
 */
const calculateAverageResponseTime = (
  currentAverage: number | undefined,
  newTime: number
): number => {
  if (!currentAverage) return newTime;
  return (currentAverage + newTime) / 2;
};

/**
 * Helper function to generate cache key
 */
const generateCacheKey = (result: ValidationResult): string => {
  return `${result.sourceFormat}_${result.targetFormat}_${result.id}`;
};

// Export actions and selectors
export const { clearValidationWithAudit, updateMetrics } = validationSlice.actions;

// Export selectors
export const selectCurrentValidation = (state: { validation: ValidationState }) =>
  state.validation.currentValidation;
export const selectValidationMetrics = (state: { validation: ValidationState }) =>
  state.validation.metrics;
export const selectValidationAudit = (state: { validation: ValidationState }) =>
  state.validation.auditTrail;

// Export reducer
export default validationSlice.reducer;