/**
 * @fileoverview TypeScript interface definitions for translation operations in the web frontend.
 * Provides comprehensive type definitions for single and batch translation requests, responses,
 * status tracking, and performance metrics with strict type safety.
 * @version 1.0.0
 */

// Internal imports
import { Detection, DetectionFormat } from './detection'; // v1.0.0
import { ValidationResult } from './validation'; // v1.0.0

// External imports
import { UUID } from 'crypto'; // v18.0.0+

/**
 * Enumeration of possible translation job statuses.
 * Used to track the state of translation operations.
 */
export enum TranslationJobStatus {
    PENDING = 'PENDING',       // Translation job queued
    PROCESSING = 'PROCESSING', // Translation in progress
    VALIDATING = 'VALIDATING', // Translation complete, validation in progress
    COMPLETED = 'COMPLETED',   // Translation and validation successful
    FAILED = 'FAILED',        // Translation or validation failed
    CANCELLED = 'CANCELLED'    // Translation job cancelled by user
}

/**
 * Interface for single detection translation request.
 * Contains all necessary parameters for translating a single detection.
 */
export interface TranslationRequest {
    /** Source detection format */
    sourceFormat: DetectionFormat;

    /** Target format for translation */
    targetFormat: DetectionFormat;

    /** Detection content to translate */
    content: string;

    /** Flag to enable validation of translation result */
    validateResult: boolean;
}

/**
 * Interface for translation operation result with enhanced error reporting and metrics.
 * Provides comprehensive information about the translation outcome.
 */
export interface TranslationResult {
    /** Unique identifier for the translation job */
    readonly id: UUID;

    /** Source detection format */
    readonly sourceFormat: DetectionFormat;

    /** Target format for translation */
    readonly targetFormat: DetectionFormat;

    /** Original detection content */
    readonly sourceContent: string;

    /** Translated detection content */
    translatedContent: string;

    /** Confidence score (0-100) indicating translation quality */
    confidenceScore: number;

    /** Validation results if validation was requested */
    validationResult?: ValidationResult;

    /** Current status of the translation job */
    status: TranslationJobStatus;

    /** Error details if translation failed */
    errorDetails?: string;

    /** Translation processing duration in milliseconds */
    duration: number;

    /** Timestamp when translation was initiated */
    readonly createdAt: Date;
}

/**
 * Enhanced interface for batch translation job status tracking with performance metrics.
 * Provides detailed progress and statistics for batch translation operations.
 */
export interface BatchTranslationStatus {
    /** Unique identifier for the batch job */
    readonly jobId: UUID;

    /** Total number of detections in batch */
    readonly totalDetections: number;

    /** Number of detections processed so far */
    processedDetections: number;

    /** Number of successful translations */
    successfulTranslations: number;

    /** Number of failed translations */
    failedTranslations: number;

    /** Current status of the batch job */
    status: TranslationJobStatus;

    /** Summary of errors encountered during translation */
    errorSummary: Record<string, string>;

    /** Average confidence score across all translations */
    averageConfidence: number;

    /** Total processing duration in milliseconds */
    duration: number;

    /** Timestamp when batch job was created */
    readonly createdAt: Date;

    /** Timestamp when batch job completed or null if not complete */
    completedAt: Date | null;
}

/**
 * Interface for detailed translation performance metrics tracking.
 * Used for monitoring and optimizing translation performance.
 */
export interface TranslationMetrics {
    /** Time spent on translation processing in milliseconds */
    processingTime: number;

    /** Confidence score of the translation (0-100) */
    confidenceScore: number;

    /** Time spent on validation in milliseconds */
    validationDuration: number;

    /** Total operation duration in milliseconds */
    totalDuration: number;
}

/**
 * Type guard to check if a string is a valid TranslationJobStatus
 * @param status - String to check
 * @returns Boolean indicating if the string is a valid TranslationJobStatus
 */
export function isValidTranslationJobStatus(status: string): status is TranslationJobStatus {
    return Object.values(TranslationJobStatus).includes(status as TranslationJobStatus);
}

/**
 * Type guard to check if a translation result meets quality standards
 * @param result - TranslationResult to check
 * @returns Boolean indicating if the translation meets quality standards
 */
export function isQualityTranslation(result: TranslationResult): boolean {
    return (
        result.confidenceScore >= 95 && // Minimum 95% confidence score
        result.status === TranslationJobStatus.COMPLETED && // Translation completed successfully
        (!result.validationResult || // No validation performed OR
            result.validationResult.confidenceScore >= 95) // Validation passed with high confidence
    );
}