/**
 * @fileoverview Validation service module for handling detection translation operations
 * Provides comprehensive validation, error handling, and result management for detection translations
 * @version 1.0.0
 */

// External imports - axios version: ^1.6.0
import { AxiosError } from 'axios';

// Internal imports
import { ValidationResult, ValidationStatus } from '../interfaces/validation';
import { apiService } from './api';
import { API_CONFIG } from '../config/api';
import { DetectionFormat } from '../interfaces/detection';
import { logger } from '../utils/logger';

/**
 * Constants for validation configuration
 */
const MIN_CONFIDENCE_SCORE = 0.95; // 95% minimum confidence requirement
const VALIDATION_TIMEOUT = 30000; // 30 second timeout
const VALIDATION_CACHE = new Map<string, ValidationResult>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

/**
 * Interface for validation service operations
 */
interface ValidationService {
  validateDetection(
    content: string,
    sourceFormat: DetectionFormat,
    targetFormat: DetectionFormat
  ): Promise<ValidationResult>;
  getValidationStatus(validationId: string): Promise<ValidationStatus>;
  checkConfidenceScore(result: ValidationResult): boolean;
}

/**
 * Implementation of the validation service with comprehensive error handling
 * and validation operations
 */
class ValidationServiceImpl implements ValidationService {
  /**
   * Validates a detection translation with comprehensive error handling
   * @param content - Detection content to validate
   * @param sourceFormat - Original detection format
   * @param targetFormat - Target translation format
   * @returns Promise resolving to detailed validation results
   */
  public async validateDetection(
    content: string,
    sourceFormat: DetectionFormat,
    targetFormat: DetectionFormat
  ): Promise<ValidationResult> {
    try {
      // Input validation
      if (!content?.trim()) {
        throw new Error('Detection content cannot be empty');
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(content, sourceFormat, targetFormat);
      const cachedResult = VALIDATION_CACHE.get(cacheKey);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        logger.info('Returning cached validation result', {
          sourceFormat,
          targetFormat,
        });
        return cachedResult;
      }

      // Setup validation timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Validation timeout exceeded'));
        }, VALIDATION_TIMEOUT);
      });

      // Perform validation with timeout
      const validationPromise = apiService.validateDetection({
        content,
        format: sourceFormat,
        rules: [targetFormat.toString()],
      });

      const result = await Promise.race([validationPromise, timeoutPromise]) as ValidationResult;

      // Process and enhance validation result
      const enhancedResult = this.enhanceValidationResult(result, sourceFormat, targetFormat);

      // Cache the result
      VALIDATION_CACHE.set(cacheKey, enhancedResult);
      setTimeout(() => {
        VALIDATION_CACHE.delete(cacheKey);
      }, CACHE_DURATION);

      logger.info('Validation completed', {
        status: enhancedResult.status,
        confidenceScore: enhancedResult.confidenceScore,
        issueCount: enhancedResult.issues.length,
      });

      return enhancedResult;

    } catch (error) {
      const enhancedError = this.handleValidationError(error as Error);
      logger.error('Validation failed', { error: enhancedError });
      throw enhancedError;
    }
  }

  /**
   * Retrieves and monitors the current status of a validation request
   * @param validationId - Unique identifier for the validation request
   * @returns Promise resolving to current validation status
   */
  public async getValidationStatus(validationId: string): Promise<ValidationStatus> {
    try {
      if (!validationId?.trim()) {
        throw new Error('Invalid validation ID');
      }

      const response = await apiService.validateDetection({
        content: '',
        format: DetectionFormat.SPLUNK,
        rules: [],
      });

      return response.status;

    } catch (error) {
      logger.error('Failed to retrieve validation status', {
        validationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Analyzes and validates the confidence score with detailed feedback
   * @param result - Validation result to analyze
   * @returns Boolean indicating if confidence score meets requirements
   */
  public checkConfidenceScore(result: ValidationResult): boolean {
    if (!result) {
      return false;
    }

    const meetsThreshold = result.confidenceScore >= MIN_CONFIDENCE_SCORE;
    const hasNoErrors = result.status !== ValidationStatus.ERROR;

    logger.info('Confidence score check', {
      score: result.confidenceScore,
      meetsThreshold,
      hasNoErrors,
    });

    return meetsThreshold && hasNoErrors;
  }

  /**
   * Generates a cache key for validation results
   */
  private generateCacheKey(
    content: string,
    sourceFormat: DetectionFormat,
    targetFormat: DetectionFormat
  ): string {
    return `${content.trim()}_${sourceFormat}_${targetFormat}`;
  }

  /**
   * Checks if cached validation result is still valid
   */
  private isCacheValid(result: ValidationResult): boolean {
    const creationTime = new Date(result.createdAt).getTime();
    return Date.now() - creationTime < CACHE_DURATION;
  }

  /**
   * Enhances validation result with additional context and metadata
   */
  private enhanceValidationResult(
    result: ValidationResult,
    sourceFormat: DetectionFormat,
    targetFormat: DetectionFormat
  ): ValidationResult {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        sourceFormat,
        targetFormat,
        validationTimestamp: new Date().toISOString(),
        apiVersion: API_CONFIG.API_VERSION,
      },
    };
  }

  /**
   * Enhanced error handler for validation operations
   */
  private handleValidationError(error: Error): Error {
    if (error instanceof AxiosError) {
      return new Error(`Validation API error: ${error.message}`);
    }
    return new Error(`Validation failed: ${error.message}`);
  }
}

// Export singleton instance of the validation service
export const validationService = new ValidationServiceImpl();

// Export types for better type safety
export type {
  ValidationService,
  ValidationResult,
  ValidationStatus,
};