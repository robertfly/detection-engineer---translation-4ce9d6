/**
 * Translation interface definitions for the API Gateway service
 * Defines data structures for handling detection translations between SIEM platforms
 * @version 1.0.0
 * @module interfaces/translation
 */

import { UUID } from 'crypto'; // version: latest
import { DetectionFormat, Detection } from './detection';

/**
 * Severity levels for validation errors
 * Used to categorize the criticality of translation validation errors
 */
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Severity levels for validation warnings
 * Used to categorize the importance of translation validation warnings
 */
export type WarningSeverity = 'high' | 'medium' | 'low';

/**
 * Status types for translation job processing
 * Tracks the state of translation operations
 */
export type TranslationJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';

/**
 * Interface for validation error details with enhanced severity tracking
 */
export interface ValidationError {
    /** Error code for categorization */
    code: string;
    /** Detailed error message */
    message: string;
    /** Line number where error occurred */
    line: number | null;
    /** Column number where error occurred */
    column: number | null;
    /** Error severity level */
    severity: ErrorSeverity;
    /** Identifier of the validation rule that triggered the error */
    ruleId: string;
    /** Timestamp when the error was detected */
    timestamp: Date;
}

/**
 * Interface for validation warning details with enhanced tracking
 */
export interface ValidationWarning {
    /** Warning code for categorization */
    code: string;
    /** Detailed warning message */
    message: string;
    /** Line number where warning occurred */
    line: number | null;
    /** Column number where warning occurred */
    column: number | null;
    /** Warning severity level */
    severity: WarningSeverity;
    /** Identifier of the validation rule that triggered the warning */
    ruleId: string;
    /** Timestamp when the warning was detected */
    timestamp: Date;
}

/**
 * Interface for detailed translation performance metrics
 */
export interface TranslationPerformanceMetrics {
    /** Total processing time in milliseconds */
    processingTimeMs: number;
    /** Memory usage in megabytes */
    memoryUsageMb: number;
    /** Time spent on validation in milliseconds */
    validationTimeMs: number;
    /** Number of tokens processed */
    tokenCount: number;
    /** Optimization level applied */
    optimizationLevel: string;
}

/**
 * Interface for batch translation job status with performance metrics
 */
export interface BatchTranslationStatus {
    /** Unique identifier for the batch job */
    jobId: UUID;
    /** Total number of detections in batch */
    totalDetections: number;
    /** Number of detections processed */
    processedDetections: number;
    /** Number of successful translations */
    successfulTranslations: number;
    /** Number of failed translations */
    failedTranslations: number;
    /** Current status of the batch job */
    status: TranslationJobStatus;
    /** Job creation timestamp */
    createdAt: Date;
    /** Job completion timestamp */
    completedAt: Date | null;
    /** Average processing time per detection */
    averageProcessingTime: number;
    /** Average confidence score across translations */
    averageConfidenceScore: number;
    /** Version of the translation engine used */
    engineVersion: string;
    /** Detailed performance metrics for the batch */
    performanceMetrics: TranslationPerformanceMetrics;
}

/**
 * Interface for single detection translation request
 */
export interface TranslationRequest {
    /** Source detection format */
    sourceFormat: DetectionFormat;
    /** Target detection format */
    targetFormat: DetectionFormat;
    /** Detection content to translate */
    content: string;
    /** Flag to enable validation of translation result */
    validateResult: boolean;
}

/**
 * Interface for validation results
 */
export interface ValidationResult {
    /** Array of validation errors */
    errors: ValidationError[];
    /** Array of validation warnings */
    warnings: ValidationWarning[];
    /** Overall validation success status */
    isValid: boolean;
    /** Validation timestamp */
    validatedAt: Date;
}

/**
 * Enhanced interface for translation operation result with performance metrics
 */
export interface TranslationResult {
    /** Unique identifier for the translation */
    id: UUID;
    /** Original detection format */
    sourceFormat: DetectionFormat;
    /** Target detection format */
    targetFormat: DetectionFormat;
    /** Original detection content */
    sourceContent: string;
    /** Translated detection content */
    translatedContent: string;
    /** Confidence score of the translation (0-1) */
    confidenceScore: number;
    /** Validation results if validation was requested */
    validationResults: ValidationResult;
    /** Translation timestamp */
    createdAt: Date;
    /** Detailed performance metrics */
    performanceMetrics: TranslationPerformanceMetrics;
    /** Version of the translation engine used */
    engineVersion: string;
    /** Mapping of source fields to target fields */
    fieldMappings: Record<string, string>;
}