/**
 * @fileoverview Redux slice for managing translation state in the web frontend.
 * Implements comprehensive state management for single and batch translation operations,
 * including validation, metrics tracking, and circuit breaker functionality.
 * @version 1.0.0
 */

// External imports - versions specified as per technical requirements
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.7
import CircuitBreaker from 'opossum'; // v6.0.0

// Internal imports
import { 
  TranslationRequest, 
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationStatus,
  TranslationJobStatus,
  TranslationMetrics
} from '../interfaces/translation';
import { ValidationResult, ValidationStatus } from '../interfaces/validation';

/**
 * Circuit breaker configuration for translation API calls
 */
const circuitBreakerConfig = {
  timeout: 30000, // 30 second timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

/**
 * Translation state interface with comprehensive tracking
 */
interface TranslationState {
  singleTranslation: {
    loading: boolean;
    error: string | null;
    result: TranslationResult | null;
    validation: ValidationResult | null;
    metrics: TranslationMetrics | null;
  };
  batchTranslation: {
    loading: boolean;
    error: string | null;
    currentJobId: string | null;
    status: BatchTranslationStatus | null;
    progress: number;
    metrics: BatchMetrics | null;
  };
  circuitBreaker: {
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailure: Date | null;
  };
}

/**
 * Initial state with null values and default settings
 */
const initialState: TranslationState = {
  singleTranslation: {
    loading: false,
    error: null,
    result: null,
    validation: null,
    metrics: null
  },
  batchTranslation: {
    loading: false,
    error: null,
    currentJobId: null,
    status: null,
    progress: 0,
    metrics: null
  },
  circuitBreaker: {
    status: 'CLOSED',
    failureCount: 0,
    lastFailure: null
  }
};

/**
 * Circuit breaker instance for translation API calls
 */
const translationCircuitBreaker = new CircuitBreaker(
  async (request: TranslationRequest) => {
    const response = await fetch('/api/v1/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw new Error('Translation request failed');
    return response.json();
  },
  circuitBreakerConfig
);

/**
 * Async thunk for single detection translation with validation and metrics
 */
export const translateDetectionThunk = createAsyncThunk(
  'translation/translateDetection',
  async (request: TranslationRequest, { rejectWithValue }) => {
    const startTime = performance.now();
    try {
      const result = await translationCircuitBreaker.fire(request);
      const endTime = performance.now();
      
      // Calculate metrics
      const metrics: TranslationMetrics = {
        processingTime: endTime - startTime,
        confidenceScore: result.confidenceScore,
        validationDuration: result.validationResult?.duration || 0,
        totalDuration: endTime - startTime
      };

      return {
        ...result,
        metrics
      };
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Translation failed',
        timestamp: new Date()
      });
    }
  }
);

/**
 * Async thunk for batch translation with progress tracking
 */
export const translateBatchThunk = createAsyncThunk(
  'translation/translateBatch',
  async (request: BatchTranslationRequest, { dispatch, rejectWithValue }) => {
    const startTime = performance.now();
    try {
      // Initialize batch job
      const batchResponse = await fetch('/api/v1/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!batchResponse.ok) throw new Error('Batch translation initialization failed');
      const { jobId } = await batchResponse.json();

      // Start progress polling
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(`/api/v1/translate/batch/${jobId}/status`);
        const status: BatchTranslationStatus = await statusResponse.json();
        
        dispatch(updateBatchProgress(status));

        if (status.status === TranslationJobStatus.COMPLETED || 
            status.status === TranslationJobStatus.FAILED) {
          clearInterval(pollInterval);
        }
      }, 2000);

      return { jobId };
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Batch translation failed',
        timestamp: new Date()
      });
    }
  }
);

/**
 * Translation slice with reducers and actions
 */
const translationSlice = createSlice({
  name: 'translation',
  initialState,
  reducers: {
    resetTranslationState: (state) => {
      state.singleTranslation = initialState.singleTranslation;
    },
    resetBatchState: (state) => {
      state.batchTranslation = initialState.batchTranslation;
    },
    updateBatchProgress: (state, action: PayloadAction<BatchTranslationStatus>) => {
      state.batchTranslation.status = action.payload;
      state.batchTranslation.progress = 
        (action.payload.processedDetections / action.payload.totalDetections) * 100;
    },
    updateCircuitBreakerStatus: (state, action: PayloadAction<CircuitBreaker.Status>) => {
      state.circuitBreaker.status = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Single translation reducers
      .addCase(translateDetectionThunk.pending, (state) => {
        state.singleTranslation.loading = true;
        state.singleTranslation.error = null;
      })
      .addCase(translateDetectionThunk.fulfilled, (state, action) => {
        state.singleTranslation.loading = false;
        state.singleTranslation.result = action.payload;
        state.singleTranslation.metrics = action.payload.metrics;
      })
      .addCase(translateDetectionThunk.rejected, (state, action) => {
        state.singleTranslation.loading = false;
        state.singleTranslation.error = action.payload as string;
      })
      // Batch translation reducers
      .addCase(translateBatchThunk.pending, (state) => {
        state.batchTranslation.loading = true;
        state.batchTranslation.error = null;
      })
      .addCase(translateBatchThunk.fulfilled, (state, action) => {
        state.batchTranslation.loading = false;
        state.batchTranslation.currentJobId = action.payload.jobId;
      })
      .addCase(translateBatchThunk.rejected, (state, action) => {
        state.batchTranslation.loading = false;
        state.batchTranslation.error = action.payload as string;
      });
  }
});

// Export actions
export const {
  resetTranslationState,
  resetBatchState,
  updateBatchProgress,
  updateCircuitBreakerStatus
} = translationSlice.actions;

// Export selectors
export const selectTranslationState = (state: { translation: TranslationState }) => 
  state.translation.singleTranslation;
export const selectBatchState = (state: { translation: TranslationState }) => 
  state.translation.batchTranslation;
export const selectCircuitBreakerStatus = (state: { translation: TranslationState }) => 
  state.translation.circuitBreaker;

// Export reducer
export default translationSlice.reducer;