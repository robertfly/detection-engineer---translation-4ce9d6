/**
 * @fileoverview Comprehensive test suite for the Redux translation slice.
 * Tests state management, async operations, validation, and metrics tracking.
 * @version 1.0.0
 */

// External imports - versions specified in comments
import { configureStore } from '@reduxjs/toolkit'; // v1.9.7
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.7.0

// Internal imports
import translationReducer, {
  translateDetectionThunk,
  translateBatchThunk,
  resetTranslationState,
  resetBatchState,
  updateBatchProgress,
  updateCircuitBreakerStatus,
  selectTranslationState,
  selectBatchState,
  selectCircuitBreakerStatus
} from '../../src/store/translationSlice';
import { ValidationStatus, ValidationSeverity } from '../../src/interfaces/validation';
import { TranslationJobStatus, DetectionFormat } from '../../src/interfaces/detection';

// Mock store setup
const createTestStore = () => configureStore({
  reducer: {
    translation: translationReducer
  }
});

// Mock data
const mockTranslationRequest = {
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  content: 'index=security src_ip=*',
  validateResult: true
};

const mockTranslationResponse = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  sourceContent: 'index=security src_ip=*',
  translatedContent: 'title: Security Event\nlogsource:\n  product: security\ndetection:\n  condition: src_ip exists',
  confidenceScore: 98,
  status: TranslationJobStatus.COMPLETED,
  duration: 1500,
  createdAt: new Date(),
  validationResult: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    status: ValidationStatus.SUCCESS,
    confidenceScore: 97,
    issues: [],
    createdAt: new Date(),
    sourceFormat: DetectionFormat.SPLUNK,
    targetFormat: DetectionFormat.SIGMA,
    metadata: {}
  }
};

describe('translationSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    // Reset fetch mocks
    global.fetch = jest.fn();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().translation;
      expect(state.singleTranslation.loading).toBeFalsy();
      expect(state.singleTranslation.error).toBeNull();
      expect(state.singleTranslation.result).toBeNull();
      expect(state.batchTranslation.loading).toBeFalsy();
      expect(state.batchTranslation.progress).toBe(0);
      expect(state.circuitBreaker.status).toBe('CLOSED');
    });
  });

  describe('single translation', () => {
    it('should handle successful translation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTranslationResponse)
      });

      await store.dispatch(translateDetectionThunk(mockTranslationRequest));
      const state = selectTranslationState(store.getState());

      expect(state.loading).toBeFalsy();
      expect(state.error).toBeNull();
      expect(state.result).toEqual(expect.objectContaining({
        confidenceScore: 98,
        status: TranslationJobStatus.COMPLETED
      }));
      expect(state.metrics).toBeTruthy();
    });

    it('should handle translation failure', async () => {
      const errorMessage = 'Translation service unavailable';
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(translateDetectionThunk(mockTranslationRequest));
      const state = selectTranslationState(store.getState());

      expect(state.loading).toBeFalsy();
      expect(state.error).toBe(errorMessage);
      expect(state.result).toBeNull();
    });

    it('should track performance metrics', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTranslationResponse)
      });

      await store.dispatch(translateDetectionThunk(mockTranslationRequest));
      const state = selectTranslationState(store.getState());

      expect(state.metrics).toEqual(expect.objectContaining({
        processingTime: expect.any(Number),
        confidenceScore: expect.any(Number),
        validationDuration: expect.any(Number),
        totalDuration: expect.any(Number)
      }));
    });
  });

  describe('batch translation', () => {
    const mockBatchRequest = {
      detections: [mockTranslationRequest],
      targetFormat: DetectionFormat.SIGMA
    };

    const mockBatchStatus = {
      jobId: '123e4567-e89b-12d3-a456-426614174002',
      totalDetections: 10,
      processedDetections: 5,
      successfulTranslations: 4,
      failedTranslations: 1,
      status: TranslationJobStatus.PROCESSING,
      errorSummary: {},
      averageConfidence: 96,
      duration: 5000,
      createdAt: new Date(),
      completedAt: null
    };

    it('should handle batch translation initialization', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: mockBatchStatus.jobId })
      });

      await store.dispatch(translateBatchThunk(mockBatchRequest));
      const state = selectBatchState(store.getState());

      expect(state.loading).toBeFalsy();
      expect(state.error).toBeNull();
      expect(state.currentJobId).toBe(mockBatchStatus.jobId);
    });

    it('should update batch progress', () => {
      store.dispatch(updateBatchProgress(mockBatchStatus));
      const state = selectBatchState(store.getState());

      expect(state.progress).toBe(50); // 5/10 * 100
      expect(state.status).toEqual(mockBatchStatus);
    });
  });

  describe('circuit breaker', () => {
    it('should update circuit breaker status', () => {
      store.dispatch(updateCircuitBreakerStatus('OPEN'));
      const state = selectCircuitBreakerStatus(store.getState());

      expect(state.status).toBe('OPEN');
    });

    it('should track failure count', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      await store.dispatch(translateDetectionThunk(mockTranslationRequest));
      const state = selectCircuitBreakerStatus(store.getState());

      expect(state.failureCount).toBeGreaterThan(0);
      expect(state.lastFailure).toBeInstanceOf(Date);
    });
  });

  describe('state reset', () => {
    it('should reset single translation state', () => {
      store.dispatch(resetTranslationState());
      const state = selectTranslationState(store.getState());

      expect(state).toEqual({
        loading: false,
        error: null,
        result: null,
        validation: null,
        metrics: null
      });
    });

    it('should reset batch translation state', () => {
      store.dispatch(resetBatchState());
      const state = selectBatchState(store.getState());

      expect(state).toEqual({
        loading: false,
        error: null,
        currentJobId: null,
        status: null,
        progress: 0,
        metrics: null
      });
    });
  });
});