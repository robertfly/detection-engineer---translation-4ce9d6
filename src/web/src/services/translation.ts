/**
 * @fileoverview Translation service module that handles secure translation operations between detection formats.
 * Provides comprehensive validation, monitoring, and error handling for single and batch translations.
 * @version 1.0.0
 */

// Internal imports
import { 
  TranslationRequest, 
  TranslationResult, 
  TranslationJobStatus,
  BatchTranslationStatus,
  TranslationMetrics
} from '../interfaces/translation';
import { DetectionFormat, isValidDetectionFormat } from '../interfaces/detection';
import { ValidationStatus, ValidationResult } from '../interfaces/validation';
import { metrics } from '../utils/metrics';
import { logger } from '../utils/logger';
import { API_REQUEST_LIMITS } from '../config/constants';

// External imports
import axios, { AxiosInstance, AxiosError } from 'axios'; // ^1.6.0
import CircuitBreaker from 'opossum'; // ^7.1.0

/**
 * Configuration for the translation service circuit breaker
 */
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
} as const;

/**
 * Enhanced translation service class with security and monitoring features
 */
export class TranslationService {
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiters: Map<string, { count: number; resetTime: number }>;

  constructor() {
    // Initialize secure axios instance
    this.axiosInstance = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': process.env.REACT_APP_VERSION,
      },
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      this.executeTranslation.bind(this),
      CIRCUIT_BREAKER_CONFIG
    );

    // Initialize rate limiters
    this.rateLimiters = new Map();

    this.setupCircuitBreakerEvents();
    this.setupRequestInterceptors();
  }

  /**
   * Set up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      logger.warn('Translation circuit breaker opened', {
        service: 'TranslationService',
        event: 'circuit_breaker_open',
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Translation circuit breaker half-open', {
        service: 'TranslationService',
        event: 'circuit_breaker_half_open',
      });
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Translation circuit breaker closed', {
        service: 'TranslationService',
        event: 'circuit_breaker_closed',
      });
    });
  }

  /**
   * Set up request interceptors for security and monitoring
   */
  private setupRequestInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const endpoint = config.url || '';
        if (!this.checkRateLimit(endpoint)) {
          throw new Error('Rate limit exceeded');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Check rate limits for endpoints
   */
  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(endpoint) || { count: 0, resetTime: now + 60000 };

    if (now > limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + 60000;
    }

    const limit = endpoint.includes('batch') 
      ? API_REQUEST_LIMITS.BATCH_TRANSLATION.REQUESTS_PER_MINUTE
      : API_REQUEST_LIMITS.SINGLE_TRANSLATION.REQUESTS_PER_MINUTE;

    if (limiter.count >= limit) {
      return false;
    }

    limiter.count++;
    this.rateLimiters.set(endpoint, limiter);
    return true;
  }

  /**
   * Execute translation request with error handling and metrics
   */
  private async executeTranslation(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    try {
      const response = await this.axiosInstance.post<TranslationResult>(
        '/api/v1/translate',
        request
      );

      const duration = Date.now() - startTime;
      metrics.trackUserActivity('translation_success', {
        sourceFormat: request.sourceFormat,
        targetFormat: request.targetFormat,
        duration,
      }, {
        userId: sessionStorage.getItem('userId') || '',
        sessionId: sessionStorage.getItem('sessionId') || '',
        userRole: sessionStorage.getItem('userRole') || '',
        ipAddress: '',
        timestamp: Date.now(),
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleTranslationError(error as AxiosError, request, duration);
      throw error;
    }
  }

  /**
   * Handle translation errors with detailed logging and metrics
   */
  private handleTranslationError(
    error: AxiosError,
    request: TranslationRequest,
    duration: number
  ): void {
    const errorDetails = {
      status: error.response?.status,
      message: error.message,
      request: {
        sourceFormat: request.sourceFormat,
        targetFormat: request.targetFormat,
      },
      duration,
    };

    logger.error('Translation request failed', errorDetails);
    metrics.trackSecurityMetric(
      {
        type: 'translation_error',
        severity: error.response?.status === 401 ? 'high' : 'medium',
        details: errorDetails,
        source: 'translation_service',
      },
      {
        userId: sessionStorage.getItem('userId') || '',
        sessionId: sessionStorage.getItem('sessionId') || '',
        userRole: sessionStorage.getItem('userRole') || '',
        ipAddress: '',
        timestamp: Date.now(),
      }
    );
  }

  /**
   * Translate a single detection with validation and monitoring
   */
  public async translateDetection(request: TranslationRequest): Promise<TranslationResult> {
    // Validate request
    if (!isValidDetectionFormat(request.sourceFormat) || 
        !isValidDetectionFormat(request.targetFormat)) {
      throw new Error('Invalid detection format specified');
    }

    try {
      const result = await this.circuitBreaker.fire(request);
      return this.validateTranslationResult(result);
    } catch (error) {
      throw this.enhanceError(error as Error);
    }
  }

  /**
   * Process batch translation with progress tracking and validation
   */
  public async translateBatch(
    detections: TranslationRequest[],
    onProgress?: (status: BatchTranslationStatus) => void
  ): Promise<BatchTranslationStatus> {
    if (!detections.length || 
        detections.length > API_REQUEST_LIMITS.BATCH_TRANSLATION.MAX_BATCH_SIZE) {
      throw new Error('Invalid batch size');
    }

    const batchStatus: BatchTranslationStatus = {
      jobId: crypto.randomUUID(),
      totalDetections: detections.length,
      processedDetections: 0,
      successfulTranslations: 0,
      failedTranslations: 0,
      status: TranslationJobStatus.PROCESSING,
      errorSummary: {},
      averageConfidence: 0,
      duration: 0,
      createdAt: new Date(),
      completedAt: null,
    };

    const startTime = Date.now();
    let totalConfidence = 0;

    try {
      for (const detection of detections) {
        try {
          const result = await this.translateDetection(detection);
          batchStatus.successfulTranslations++;
          totalConfidence += result.confidenceScore;
        } catch (error) {
          batchStatus.failedTranslations++;
          batchStatus.errorSummary[detection.content.substring(0, 50)] = 
            (error as Error).message;
        }

        batchStatus.processedDetections++;
        batchStatus.averageConfidence = 
          totalConfidence / batchStatus.successfulTranslations;
        
        if (onProgress) {
          onProgress({ ...batchStatus });
        }
      }

      batchStatus.duration = Date.now() - startTime;
      batchStatus.status = TranslationJobStatus.COMPLETED;
      batchStatus.completedAt = new Date();

      return batchStatus;
    } catch (error) {
      batchStatus.status = TranslationJobStatus.FAILED;
      batchStatus.completedAt = new Date();
      throw error;
    }
  }

  /**
   * Validate translation result with enhanced error checking
   */
  private validateTranslationResult(result: TranslationResult): TranslationResult {
    if (!result.translatedContent || result.confidenceScore < 95) {
      throw new Error('Translation failed quality validation');
    }

    if (result.validationResult?.status === ValidationStatus.ERROR) {
      throw new Error('Translation failed validation checks');
    }

    return result;
  }

  /**
   * Enhance error with additional context
   */
  private enhanceError(error: Error): Error {
    error.message = `Translation service error: ${error.message}`;
    return error;
  }

  /**
   * Get translation service metrics
   */
  public getTranslationMetrics(): TranslationMetrics {
    return {
      processingTime: this.circuitBreaker.stats.mean,
      confidenceScore: this.circuitBreaker.stats.successful / 
        (this.circuitBreaker.stats.successful + this.circuitBreaker.stats.failed) * 100,
      validationDuration: this.circuitBreaker.stats.mean,
      totalDuration: this.circuitBreaker.stats.mean,
    };
  }
}

// Export singleton instance
export const translationService = new TranslationService();