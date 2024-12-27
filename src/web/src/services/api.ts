// axios version: ^1.6.0
// opossum version: ^6.0.0
// axios-rate-limit version: ^1.3.0

import { AxiosResponse } from 'axios';
import CircuitBreaker from 'opossum';
import rateLimit from 'axios-rate-limit';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { apiClient, ApiError, handleApiError } from '../utils/api';
import { Detection, DetectionFormat } from '../interfaces/detection';
import { logger } from '../utils/logger';

/**
 * Interface for translation request parameters
 */
interface TranslationRequest {
  content: string;
  sourceFormat: DetectionFormat;
  targetFormat: DetectionFormat;
  metadata?: Record<string, any>;
}

/**
 * Interface for batch translation request
 */
interface BatchTranslationRequest {
  detections: Array<{
    content: string;
    sourceFormat: DetectionFormat;
  }>;
  targetFormat: DetectionFormat;
  metadata?: Record<string, any>;
}

/**
 * Interface for validation request parameters
 */
interface ValidationRequest {
  content: string;
  format: DetectionFormat;
  rules?: string[];
}

/**
 * Enhanced API service class with comprehensive security and monitoring
 */
class ApiService {
  private circuitBreaker: CircuitBreaker;
  private rateLimitedClient: any;

  constructor() {
    // Initialize circuit breaker for API resilience
    this.circuitBreaker = new CircuitBreaker(async (fn: Function) => await fn(), {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });

    // Initialize rate-limited API client
    this.rateLimitedClient = rateLimit(apiClient, {
      maxRequests: API_CONFIG.rateLimit.requestsPerMinute,
      perMilliseconds: 60000,
    });

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring and error tracking
   */
  private initializeMonitoring(): void {
    this.circuitBreaker.on('success', () => {
      logger.info('Circuit breaker: successful operation');
    });

    this.circuitBreaker.on('failure', (error: Error) => {
      logger.error('Circuit breaker: operation failed', { error });
    });

    this.circuitBreaker.on('timeout', () => {
      logger.warn('Circuit breaker: operation timeout');
    });

    this.circuitBreaker.on('reject', () => {
      logger.warn('Circuit breaker: operation rejected');
    });
  }

  /**
   * Retrieve a detection by ID with enhanced error handling
   */
  public async getDetection(id: string): Promise<Detection> {
    try {
      const response = await this.circuitBreaker.fire(async () => {
        return this.rateLimitedClient.get(
          API_ENDPOINTS.detection.get.replace(':id', id)
        );
      });

      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Failed to retrieve detection', { error: enhancedError, id });
      throw enhancedError;
    }
  }

  /**
   * Create a new detection with security validation
   */
  public async createDetection(data: Partial<Detection>): Promise<Detection> {
    try {
      const response = await this.circuitBreaker.fire(async () => {
        return this.rateLimitedClient.post(API_ENDPOINTS.detection.create, data);
      });

      logger.info('Detection created successfully', {
        id: response.data.id,
        format: response.data.format,
      });

      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Failed to create detection', { error: enhancedError });
      throw enhancedError;
    }
  }

  /**
   * Translate a detection with comprehensive error handling
   */
  public async translateDetection(request: TranslationRequest): Promise<Detection> {
    try {
      const response = await this.circuitBreaker.fire(async () => {
        return this.rateLimitedClient.post(
          API_ENDPOINTS.translation.single,
          request
        );
      });

      logger.info('Detection translated successfully', {
        sourceFormat: request.sourceFormat,
        targetFormat: request.targetFormat,
      });

      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Translation failed', {
        error: enhancedError,
        request,
      });
      throw enhancedError;
    }
  }

  /**
   * Validate a detection with enhanced error reporting
   */
  public async validateDetection(request: ValidationRequest): Promise<{
    isValid: boolean;
    errors: Array<string>;
    warnings: Array<string>;
  }> {
    try {
      const response = await this.circuitBreaker.fire(async () => {
        return this.rateLimitedClient.post(
          API_ENDPOINTS.validation.check,
          request
        );
      });

      logger.info('Detection validation completed', {
        format: request.format,
        isValid: response.data.isValid,
      });

      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Validation failed', {
        error: enhancedError,
        request,
      });
      throw enhancedError;
    }
  }

  /**
   * Perform batch translation with progress tracking
   */
  public async batchTranslate(request: BatchTranslationRequest): Promise<{
    id: string;
    status: string;
    progress: number;
  }> {
    try {
      const response = await this.circuitBreaker.fire(async () => {
        return this.rateLimitedClient.post(
          API_ENDPOINTS.translation.batch,
          request
        );
      });

      logger.info('Batch translation initiated', {
        batchId: response.data.id,
        detectionCount: request.detections.length,
      });

      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Batch translation failed', {
        error: enhancedError,
        request,
      });
      throw enhancedError;
    }
  }

  /**
   * Check API health status with metrics
   */
  public async healthCheck(): Promise<{
    status: string;
    version: string;
    metrics: Record<string, any>;
  }> {
    try {
      const response = await this.rateLimitedClient.get(
        API_ENDPOINTS.health.status
      );
      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Health check failed', { error: enhancedError });
      throw enhancedError;
    }
  }

  /**
   * Retrieve API metrics for monitoring
   */
  public async getMetrics(): Promise<Record<string, any>> {
    try {
      const response = await this.rateLimitedClient.get(
        API_ENDPOINTS.health.metrics
      );
      return response.data;
    } catch (error) {
      const enhancedError = handleApiError(error as Error);
      logger.error('Failed to retrieve metrics', { error: enhancedError });
      throw enhancedError;
    }
  }
}

// Export singleton instance of the API service
export const apiService = new ApiService();

// Export types for better type safety
export type {
  TranslationRequest,
  BatchTranslationRequest,
  ValidationRequest,
  ApiError,
};