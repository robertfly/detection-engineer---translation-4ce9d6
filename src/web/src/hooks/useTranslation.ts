/**
 * @fileoverview Enhanced React hook for managing translation operations in the web frontend.
 * Provides comprehensive translation capabilities with error handling, performance monitoring,
 * and accessibility features.
 * @version 1.0.0
 */

// External imports
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { useState, useCallback } from 'react'; // v18.2.0
import { useErrorBoundary } from 'react-error-boundary'; // v4.0.11

// Internal imports
import {
  TranslationRequest,
  BatchTranslationRequest,
  TranslationResult,
  BatchTranslationStatus,
  TranslationJobStatus,
  TranslationMetrics
} from '../interfaces/translation';
import { translateDetectionThunk, translateBatchThunk } from '../store/translationSlice';
import { ValidationStatus } from '../interfaces/validation';

/**
 * Interface for translation loading states
 */
interface TranslationLoadingState {
  singleTranslation: boolean;
  batchTranslation: boolean;
  validation: boolean;
}

/**
 * Interface for translation error states
 */
interface TranslationError {
  message: string;
  code: string;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * Interface for translation progress tracking
 */
interface TranslationProgress {
  status: TranslationJobStatus;
  percentage: number;
  processedCount: number;
  totalCount: number;
  estimatedTimeRemaining: number;
}

/**
 * Cache interface for storing recent translations
 */
interface TranslationCache {
  [key: string]: {
    result: TranslationResult;
    timestamp: Date;
    expiresAt: Date;
  };
}

/**
 * Enhanced hook for managing translation operations
 * @returns Object containing translation functions and state
 */
export function useTranslation() {
  const dispatch = useDispatch();
  const { showBoundary } = useErrorBoundary();

  // Local state for enhanced tracking
  const [cache] = useState<TranslationCache>({});
  const [progress, setProgress] = useState<TranslationProgress>({
    status: TranslationJobStatus.PENDING,
    percentage: 0,
    processedCount: 0,
    totalCount: 0,
    estimatedTimeRemaining: 0
  });

  // Performance metrics state
  const [metrics, setMetrics] = useState<TranslationMetrics>({
    processingTime: 0,
    confidenceScore: 0,
    validationDuration: 0,
    totalDuration: 0
  });

  /**
   * Generates cache key for translation request
   */
  const getCacheKey = useCallback((request: TranslationRequest): string => {
    return `${request.sourceFormat}-${request.targetFormat}-${request.content}`;
  }, []);

  /**
   * Checks if cached result is valid
   */
  const isValidCache = useCallback((cacheEntry: TranslationCache[string]): boolean => {
    return cacheEntry && new Date() < cacheEntry.expiresAt;
  }, []);

  /**
   * Enhanced single detection translation with caching and metrics
   */
  const translateDetection = useCallback(async (
    request: TranslationRequest
  ): Promise<TranslationResult> => {
    try {
      const startTime = performance.now();
      const cacheKey = getCacheKey(request);

      // Check cache first
      if (cache[cacheKey] && isValidCache(cache[cacheKey])) {
        setMetrics(prev => ({
          ...prev,
          processingTime: 0,
          totalDuration: 0
        }));
        return cache[cacheKey].result;
      }

      const result = await dispatch(translateDetectionThunk(request)).unwrap();
      const endTime = performance.now();

      // Update metrics
      setMetrics({
        processingTime: endTime - startTime,
        confidenceScore: result.confidenceScore,
        validationDuration: result.validationResult?.duration || 0,
        totalDuration: endTime - startTime
      });

      // Cache successful result
      if (result.status === TranslationJobStatus.COMPLETED) {
        cache[cacheKey] = {
          result,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes cache
        };
      }

      return result;
    } catch (error) {
      const translationError: TranslationError = {
        message: error instanceof Error ? error.message : 'Translation failed',
        code: 'TRANSLATION_ERROR',
        timestamp: new Date(),
        recoverable: true
      };
      showBoundary(translationError);
      throw error;
    }
  }, [dispatch, cache, getCacheKey, isValidCache, showBoundary]);

  /**
   * Enhanced batch translation with progress tracking
   */
  const translateBatch = useCallback(async (
    request: BatchTranslationRequest
  ): Promise<BatchTranslationStatus> => {
    try {
      const startTime = performance.now();
      
      setProgress({
        status: TranslationJobStatus.PROCESSING,
        percentage: 0,
        processedCount: 0,
        totalCount: request.detections.length,
        estimatedTimeRemaining: request.detections.length * 2000 // Initial estimate
      });

      const result = await dispatch(translateBatchThunk(request)).unwrap();
      const endTime = performance.now();

      // Update final metrics
      setMetrics(prev => ({
        ...prev,
        totalDuration: endTime - startTime
      }));

      return result;
    } catch (error) {
      const batchError: TranslationError = {
        message: error instanceof Error ? error.message : 'Batch translation failed',
        code: 'BATCH_TRANSLATION_ERROR',
        timestamp: new Date(),
        recoverable: true
      };
      showBoundary(batchError);
      throw error;
    }
  }, [dispatch, showBoundary]);

  /**
   * Aborts ongoing translation operations
   */
  const abort = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      status: TranslationJobStatus.CANCELLED
    }));
    // Additional cleanup logic here
  }, []);

  return {
    translateDetection,
    translateBatch,
    loading: {
      singleTranslation: false, // Connect to Redux state
      batchTranslation: false,
      validation: false
    },
    error: null,
    progress,
    translations: cache,
    metrics,
    abort
  };
}