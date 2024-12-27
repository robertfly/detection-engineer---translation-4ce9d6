/**
 * @fileoverview Utility functions for managing, validating, and transforming security detection rules.
 * Provides enterprise-grade helper functions with caching support and detailed error reporting.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise deployments
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { isEqual, memoize } from 'lodash'; // v4.17.21

// Internal imports
import { 
  Detection, 
  DetectionFormat, 
  DetectionMetadata,
  DetectionSeverity 
} from '../interfaces/detection';
import { 
  formatDetectionContent, 
  getFormatSyntax 
} from './format';

/**
 * Severity levels for validation issues with strict typing
 */
export enum ValidationSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

/**
 * Interface for detailed validation information
 */
export interface ValidationDetails {
  message: string;
  location: string;
  suggestion: string;
  severity: ValidationSeverity;
}

/**
 * Enhanced interface for validation results with comprehensive reporting
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  severity: ValidationSeverity;
  details: ValidationDetails[];
  confidence: number;
}

/**
 * Options for customizing validation behavior
 */
interface ValidationOptions {
  strictMode?: boolean;
  checkFields?: boolean;
  minConfidence?: number;
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  strictMode: true,
  checkFields: true,
  minConfidence: 0.95
};

/**
 * Creates a new detection object with required properties and metadata
 * 
 * @param content - The detection rule content
 * @param format - The detection format
 * @param metadata - Optional metadata for the detection
 * @returns Complete detection object with generated ID and metadata
 */
export function createDetection(
  content: string,
  format: DetectionFormat,
  metadata?: Partial<DetectionMetadata>
): Detection {
  if (!content?.trim()) {
    throw new Error('Detection content cannot be empty');
  }

  const defaultMetadata: DetectionMetadata = {
    name: 'Untitled Detection',
    description: '',
    tags: [],
    severity: DetectionSeverity.MEDIUM,
    last_modified: new Date()
  };

  return {
    id: uuidv4(),
    content: content.trim(),
    format,
    created_at: new Date(),
    user_id: uuidv4(), // Should be replaced with actual user ID in production
    is_active: true,
    metadata: { ...defaultMetadata, ...metadata }
  };
}

/**
 * Enhanced validation function with detailed error reporting and caching
 * Memoized for performance optimization with complex validations
 */
export const validateDetectionContent = memoize(
  (
    content: string,
    format: DetectionFormat,
    options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
  ): ValidationResult => {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      severity: ValidationSeverity.INFO,
      details: [],
      confidence: 1.0
    };

    try {
      // Basic content validation
      if (!content?.trim()) {
        throw new Error('Detection content cannot be empty');
      }

      // Format-specific syntax validation
      const syntax = getFormatSyntax(format);
      const formattedContent = formatDetectionContent(content, format);
      
      if (!formattedContent) {
        result.errors.push('Invalid syntax for specified format');
        result.severity = ValidationSeverity.ERROR;
        result.isValid = false;
        result.confidence = 0;
      }

      // Field validation if enabled
      if (options.checkFields) {
        const fieldValidation = validateFields(content, format);
        result.details.push(...fieldValidation.details);
        
        if (fieldValidation.errors.length > 0) {
          result.errors.push(...fieldValidation.errors);
          result.severity = ValidationSeverity.WARNING;
          result.confidence *= 0.9;
        }
      }

      // Strict mode validation
      if (options.strictMode) {
        const strictValidation = validateStrictMode(content, format);
        result.details.push(...strictValidation.details);
        
        if (strictValidation.errors.length > 0) {
          result.errors.push(...strictValidation.errors);
          result.severity = ValidationSeverity.ERROR;
          result.confidence *= 0.8;
        }
      }

      // Check against minimum confidence threshold
      if (result.confidence < (options.minConfidence ?? DEFAULT_VALIDATION_OPTIONS.minConfidence)) {
        result.isValid = false;
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(error.message);
      result.severity = ValidationSeverity.ERROR;
      result.confidence = 0;
    }

    return result;
  },
  // Custom resolver for memoization cache key
  (content: string, format: DetectionFormat, options: ValidationOptions) => 
    `${format}:${content}:${JSON.stringify(options)}`
);

/**
 * Validates multiple detections with optimized performance
 * 
 * @param detections - Array of detections to validate
 * @param options - Validation options
 * @returns Batch validation results with aggregated statistics
 */
export function validateBatchDetections(
  detections: Detection[],
  options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
): { results: Map<string, ValidationResult>; summary: { total: number; valid: number; invalid: number } } {
  const results = new Map<string, ValidationResult>();
  let validCount = 0;

  // Process detections in parallel for better performance
  const validations = detections.map(detection => {
    const result = validateDetectionContent(detection.content, detection.format, options);
    results.set(detection.id, result);
    if (result.isValid) validCount++;
    return result;
  });

  return {
    results,
    summary: {
      total: detections.length,
      valid: validCount,
      invalid: detections.length - validCount
    }
  };
}

/**
 * Helper function to validate detection fields
 * @private
 */
function validateFields(content: string, format: DetectionFormat): Partial<ValidationResult> {
  const result: Partial<ValidationResult> = { errors: [], details: [] };
  
  // Format-specific field validation logic
  switch (format) {
    case DetectionFormat.SIGMA:
      validateSigmaFields(content, result);
      break;
    case DetectionFormat.SPLUNK:
      validateSplunkFields(content, result);
      break;
    // Add other format validations as needed
  }

  return result;
}

/**
 * Helper function for strict mode validation
 * @private
 */
function validateStrictMode(content: string, format: DetectionFormat): Partial<ValidationResult> {
  const result: Partial<ValidationResult> = { errors: [], details: [] };
  
  // Implement strict validation rules
  // Add format-specific strict validation logic

  return result;
}

// Format-specific validation helpers
function validateSigmaFields(content: string, result: Partial<ValidationResult>): void {
  // Implement SIGMA-specific field validation
}

function validateSplunkFields(content: string, result: Partial<ValidationResult>): void {
  // Implement Splunk-specific field validation
}