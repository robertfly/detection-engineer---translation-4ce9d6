/**
 * @fileoverview TypeScript interface definitions for validation results and issues in the detection translation platform.
 * Provides comprehensive type safety and structure for validation feedback, confidence scoring, and detailed issue reporting.
 * @version 1.0.0
 */

// Internal imports
import { DetectionFormat } from './detection'; // Imported for format type safety

// External imports
import { UUID } from 'crypto'; // v18.0.0+

/**
 * Type-safe enumeration of possible validation result statuses.
 * Used to indicate the overall outcome of a detection translation validation.
 */
export const enum ValidationStatus {
    SUCCESS = 'SUCCESS',  // Validation passed with no issues
    WARNING = 'WARNING',  // Validation passed with non-critical issues
    ERROR = 'ERROR'      // Validation failed with critical issues
}

/**
 * Type-safe enumeration of validation issue severity levels.
 * Used to categorize the impact and importance of validation issues.
 */
export const enum ValidationSeverity {
    HIGH = 'HIGH',       // Critical issues that must be addressed
    MEDIUM = 'MEDIUM',   // Important issues that should be reviewed
    LOW = 'LOW'         // Minor issues that can be optionally addressed
}

/**
 * Interface representing a single validation issue with detailed feedback.
 * Provides comprehensive information about detected problems during validation.
 */
export interface ValidationIssue {
    /** Human-readable description of the validation issue */
    message: string;

    /** Severity level indicating the importance of the issue */
    severity: ValidationSeverity;

    /** Location in the detection where the issue was found */
    location: string;

    /** Unique identifier code for the type of issue */
    code: string;

    /** Array of potential solutions or improvements */
    suggestions: string[];
}

/**
 * Comprehensive interface representing the complete validation result.
 * Contains all validation context, issues, and metadata for a detection translation.
 */
export interface ValidationResult {
    /** Unique identifier for the validation result */
    readonly id: UUID;

    /** Timestamp when the validation was performed */
    readonly createdAt: Date;

    /** Overall status of the validation */
    status: ValidationStatus;

    /** Confidence score (0-100) indicating translation quality */
    confidenceScore: number;

    /** Array of validation issues found */
    issues: ValidationIssue[];

    /** Original format of the detection */
    readonly sourceFormat: DetectionFormat;

    /** Target format for the translation */
    readonly targetFormat: DetectionFormat;

    /** Additional context and metadata for the validation */
    metadata: Record<string, unknown>;
}

/**
 * Type guard to check if a string is a valid ValidationStatus
 * @param status - String to check
 * @returns Boolean indicating if the string is a valid ValidationStatus
 */
export function isValidValidationStatus(status: string): status is ValidationStatus {
    return Object.values(ValidationStatus).includes(status as ValidationStatus);
}

/**
 * Type guard to check if a string is a valid ValidationSeverity
 * @param severity - String to check
 * @returns Boolean indicating if the string is a valid ValidationSeverity
 */
export function isValidValidationSeverity(severity: string): severity is ValidationSeverity {
    return Object.values(ValidationSeverity).includes(severity as ValidationSeverity);
}

/**
 * Type guard to check if a validation result meets minimum quality standards
 * @param result - ValidationResult to check
 * @returns Boolean indicating if the validation result meets quality standards
 */
export function isQualityValidationResult(result: ValidationResult): boolean {
    return (
        result.confidenceScore >= 95 && // Minimum 95% confidence score
        result.status !== ValidationStatus.ERROR && // No critical errors
        !result.issues.some(issue => issue.severity === ValidationSeverity.HIGH) // No high severity issues
    );
}