/**
 * Advanced validation module for translation requests and responses
 * Implements comprehensive validation framework with high-fidelity error reporting
 * @version 1.0.0
 */

// External dependencies
import Joi from 'joi'; // v17.9.0
import * as grpc from '@grpc/grpc-js'; // v1.9.0
import * as prometheus from 'prom-client'; // v14.2.0

// Internal dependencies
import { 
  TranslationRequest, 
  BatchTranslationRequest,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ErrorSeverity,
  WarningSeverity
} from '../interfaces/translation';
import { DetectionFormat } from '../interfaces/detection';
import { servicesConfig } from '../config/services';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Validation metrics
const VALIDATION_METRICS = {
  validationDuration: new prometheus.Histogram({
    name: 'translation_validation_duration_seconds',
    help: 'Duration of validation operations in seconds',
    labelNames: ['type', 'format', 'result'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  }),
  validationErrors: new prometheus.Counter({
    name: 'translation_validation_errors_total',
    help: 'Total number of validation errors by type',
    labelNames: ['error_type', 'severity', 'format']
  }),
  validationConfidence: new prometheus.Gauge({
    name: 'translation_validation_confidence',
    help: 'Confidence score of validation results',
    labelNames: ['format', 'type']
  })
};

// Format compatibility matrix
const FORMAT_COMPATIBILITY_MATRIX: Record<DetectionFormat, Record<DetectionFormat, boolean>> = {
  [DetectionFormat.SPLUNK]: {
    [DetectionFormat.SIGMA]: true,
    [DetectionFormat.KQL]: true,
    [DetectionFormat.QRADAR]: true,
    [DetectionFormat.PALOALTO]: true,
    [DetectionFormat.CROWDSTRIKE]: true,
    [DetectionFormat.YARA]: false,
    [DetectionFormat.YARAL]: false
  },
  // ... similar entries for other formats
};

// Enhanced Joi validation schemas
const VALIDATION_SCHEMAS = {
  translationRequest: Joi.object<TranslationRequest>({
    sourceFormat: Joi.string()
      .valid(...Object.values(DetectionFormat))
      .required(),
    targetFormat: Joi.string()
      .valid(...Object.values(DetectionFormat))
      .required(),
    content: Joi.string()
      .required()
      .min(1)
      .max(1000000), // 1MB max content size
    validateResult: Joi.boolean()
      .default(true)
  }),
  batchTranslationRequest: Joi.object<BatchTranslationRequest>({
    detections: Joi.array()
      .items(Joi.object({
        content: Joi.string().required(),
        format: Joi.string().valid(...Object.values(DetectionFormat)).required()
      }))
      .min(1)
      .max(1000) // Maximum 1000 detections per batch
      .required(),
    targetFormat: Joi.string()
      .valid(...Object.values(DetectionFormat))
      .required()
  })
};

/**
 * Decorator for validation performance monitoring
 */
function MonitorValidation(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    const startTime = process.hrtime();
    
    try {
      const result = await originalMethod.apply(this, args);
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      VALIDATION_METRICS.validationDuration.observe(
        {
          type: propertyKey,
          format: args[0]?.sourceFormat || 'unknown',
          result: result.isValid ? 'success' : 'failure'
        },
        duration
      );

      return result;
    } catch (error) {
      logger.error('Validation error', error as Error, {
        requestId: 'validation_error',
        userId: 'system',
        service: 'validation',
        traceId: 'validation',
        spanId: propertyKey,
        environment: process.env.NODE_ENV || 'development'
      });
      throw error;
    }
  };

  return descriptor;
}

/**
 * Validates a single translation request with comprehensive error reporting
 * @param request Translation request to validate
 * @returns Validation result with detailed error information
 */
@MonitorValidation
export async function validateTranslationRequest(
  request: TranslationRequest
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const startTime = Date.now();

  try {
    // Schema validation
    const schemaValidation = VALIDATION_SCHEMAS.translationRequest.validate(request, {
      abortEarly: false
    });

    if (schemaValidation.error) {
      schemaValidation.error.details.forEach(detail => {
        errors.push({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: detail.message,
          line: null,
          column: null,
          severity: 'high' as ErrorSeverity,
          ruleId: detail.type,
          timestamp: new Date()
        });
      });
    }

    // Format compatibility check
    if (!FORMAT_COMPATIBILITY_MATRIX[request.sourceFormat]?.[request.targetFormat]) {
      errors.push({
        code: 'FORMAT_COMPATIBILITY_ERROR',
        message: `Translation from ${request.sourceFormat} to ${request.targetFormat} is not supported`,
        line: null,
        column: null,
        severity: 'critical' as ErrorSeverity,
        ruleId: 'FORMAT_COMPATIBILITY',
        timestamp: new Date()
      });
    }

    // Content validation via gRPC validation service
    const validationClient = await createValidationServiceClient();
    const validationResponse = await new Promise((resolve, reject) => {
      validationClient.validateContent(
        {
          content: request.content,
          format: request.sourceFormat
        },
        (error: Error | null, response: any) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });

    // Process validation service response
    if (validationResponse) {
      const { syntaxErrors, formatWarnings } = validationResponse;
      
      syntaxErrors?.forEach((error: any) => {
        errors.push({
          code: 'SYNTAX_ERROR',
          message: error.message,
          line: error.line,
          column: error.column,
          severity: error.severity as ErrorSeverity,
          ruleId: error.rule,
          timestamp: new Date()
        });
      });

      formatWarnings?.forEach((warning: any) => {
        warnings.push({
          code: 'FORMAT_WARNING',
          message: warning.message,
          line: warning.line,
          column: warning.column,
          severity: warning.severity as WarningSeverity,
          ruleId: warning.rule,
          timestamp: new Date()
        });
      });
    }

    // Record validation metrics
    VALIDATION_METRICS.validationErrors.inc({
      error_type: 'syntax',
      severity: 'high',
      format: request.sourceFormat
    }, errors.length);

    const confidenceScore = calculateConfidenceScore(errors, warnings);
    VALIDATION_METRICS.validationConfidence.set(
      {
        format: request.sourceFormat,
        type: 'single'
      },
      confidenceScore
    );

    return {
      errors,
      warnings,
      isValid: errors.length === 0,
      validatedAt: new Date()
    };

  } catch (error) {
    logger.error('Validation processing error', error as Error, {
      requestId: 'validation_error',
      userId: 'system',
      service: 'validation',
      traceId: 'validation',
      spanId: 'validateTranslationRequest',
      environment: process.env.NODE_ENV || 'development'
    });

    throw error;
  }
}

/**
 * Validates a batch translation request with parallel processing
 * @param request Batch translation request to validate
 * @returns Aggregated validation results
 */
@MonitorValidation
export async function validateBatchTranslationRequest(
  request: BatchTranslationRequest
): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Schema validation
    const schemaValidation = VALIDATION_SCHEMAS.batchTranslationRequest.validate(request, {
      abortEarly: false
    });

    if (schemaValidation.error) {
      schemaValidation.error.details.forEach(detail => {
        errors.push({
          code: 'BATCH_SCHEMA_ERROR',
          message: detail.message,
          line: null,
          column: null,
          severity: 'high' as ErrorSeverity,
          ruleId: detail.type,
          timestamp: new Date()
        });
      });
      
      return {
        errors,
        warnings,
        isValid: false,
        validatedAt: new Date()
      };
    }

    // Parallel validation of individual detections
    const validationPromises = request.detections.map(async (detection, index) => {
      try {
        const validationResult = await validateTranslationRequest({
          sourceFormat: detection.format,
          targetFormat: request.targetFormat,
          content: detection.content,
          validateResult: true
        });

        // Add batch context to errors and warnings
        validationResult.errors.forEach(error => {
          errors.push({
            ...error,
            message: `Detection ${index + 1}: ${error.message}`
          });
        });

        validationResult.warnings.forEach(warning => {
          warnings.push({
            ...warning,
            message: `Detection ${index + 1}: ${warning.message}`
          });
        });

      } catch (error) {
        errors.push({
          code: 'BATCH_PROCESSING_ERROR',
          message: `Failed to validate detection ${index + 1}: ${(error as Error).message}`,
          line: null,
          column: null,
          severity: 'high' as ErrorSeverity,
          ruleId: 'BATCH_PROCESSING',
          timestamp: new Date()
        });
      }
    });

    await Promise.all(validationPromises);

    // Record batch validation metrics
    VALIDATION_METRICS.validationErrors.inc({
      error_type: 'batch',
      severity: 'high',
      format: request.targetFormat
    }, errors.length);

    const confidenceScore = calculateConfidenceScore(errors, warnings);
    VALIDATION_METRICS.validationConfidence.set(
      {
        format: request.targetFormat,
        type: 'batch'
      },
      confidenceScore
    );

    return {
      errors,
      warnings,
      isValid: errors.length === 0,
      validatedAt: new Date()
    };

  } catch (error) {
    logger.error('Batch validation error', error as Error, {
      requestId: 'batch_validation_error',
      userId: 'system',
      service: 'validation',
      traceId: 'validation',
      spanId: 'validateBatchTranslationRequest',
      environment: process.env.NODE_ENV || 'development'
    });

    throw error;
  }
}

/**
 * Creates a gRPC client for the validation service
 */
async function createValidationServiceClient(): Promise<grpc.Client> {
  try {
    return await grpc.loadPackageDefinition(servicesConfig.validationService);
  } catch (error) {
    logger.error('Failed to create validation service client', error as Error, {
      requestId: 'validation_client_error',
      userId: 'system',
      service: 'validation',
      traceId: 'validation',
      spanId: 'createValidationServiceClient',
      environment: process.env.NODE_ENV || 'development'
    });
    throw error;
  }
}

/**
 * Calculates confidence score based on validation results
 */
function calculateConfidenceScore(
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  const errorWeights = {
    critical: 1.0,
    high: 0.7,
    medium: 0.4,
    low: 0.2
  };

  const warningWeights = {
    high: 0.3,
    medium: 0.2,
    low: 0.1
  };

  let totalPenalty = 0;

  errors.forEach(error => {
    totalPenalty += errorWeights[error.severity] || 0;
  });

  warnings.forEach(warning => {
    totalPenalty += warningWeights[warning.severity] || 0;
  });

  return Math.max(0, Math.min(1, 1 - totalPenalty));
}

export const ValidationMetrics = VALIDATION_METRICS;