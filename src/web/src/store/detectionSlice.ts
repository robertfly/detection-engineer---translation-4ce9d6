/**
 * @fileoverview Redux slice for managing security detection state in the web frontend.
 * Handles detection CRUD operations, loading states, error handling, validation results,
 * and format-specific filtering using Redux Toolkit.
 * @version 1.0.0
 */

// External imports - @reduxjs/toolkit version: ^1.9.0
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UUID } from 'crypto';

// Internal imports
import { Detection, DetectionFormat } from '../interfaces/detection';
import { DetectionService } from '../services/detection';
import { ValidationResult, ValidationStatus } from '../interfaces/validation';
import { logger } from '../utils/logger';

/**
 * Interface for batch operation state tracking
 */
interface BatchState {
  inProgress: boolean;
  total: number;
  completed: number;
  failed: number;
  status: 'idle' | 'processing' | 'completed' | 'failed';
}

/**
 * Interface for error state tracking with enhanced details
 */
interface ErrorState {
  message: string | null;
  code: string | null;
  details: any;
  timestamp: string | null;
}

/**
 * Interface defining the detection slice state shape
 */
interface DetectionState {
  items: Detection[];
  loading: boolean;
  error: ErrorState;
  total: number;
  currentPage: number;
  pageSize: number;
  selectedDetection: Detection | null;
  validationResults: Record<string, ValidationResult>;
  activeFilter: DetectionFormat | null;
  batchOperations: BatchState;
}

/**
 * Initial state for the detection slice
 */
const initialState: DetectionState = {
  items: [],
  loading: false,
  error: {
    message: null,
    code: null,
    details: null,
    timestamp: null
  },
  total: 0,
  currentPage: 1,
  pageSize: 10,
  selectedDetection: null,
  validationResults: {},
  activeFilter: null,
  batchOperations: {
    inProgress: false,
    total: 0,
    completed: 0,
    failed: 0,
    status: 'idle'
  }
};

/**
 * Async thunk for fetching paginated detections with format filtering
 */
export const fetchDetections = createAsyncThunk(
  'detection/fetchDetections',
  async (params: { 
    page: number; 
    limit: number; 
    format?: DetectionFormat;
  }) => {
    try {
      logger.info('Fetching detections', { params });
      const response = await DetectionService.getDetections(
        params.page,
        params.limit,
        params.format
      );
      return response;
    } catch (error) {
      logger.error('Failed to fetch detections', { error });
      throw error;
    }
  }
);

/**
 * Async thunk for batch translation operations
 */
export const batchTranslate = createAsyncThunk(
  'detection/batchTranslate',
  async (params: {
    detectionIds: UUID[];
    targetFormat: DetectionFormat;
  }, { dispatch }) => {
    try {
      logger.info('Starting batch translation', { params });
      
      dispatch(detectionSlice.actions.setBatchStatus({
        inProgress: true,
        total: params.detectionIds.length,
        completed: 0,
        failed: 0,
        status: 'processing'
      }));

      const results = await DetectionService.batchTranslate(
        params.detectionIds,
        params.targetFormat
      );

      return results;
    } catch (error) {
      logger.error('Batch translation failed', { error });
      throw error;
    }
  }
);

/**
 * Detection slice with comprehensive state management
 */
export const detectionSlice = createSlice({
  name: 'detection',
  initialState,
  reducers: {
    setSelectedDetection: (state, action: PayloadAction<Detection | null>) => {
      state.selectedDetection = action.payload;
    },
    
    clearError: (state) => {
      state.error = initialState.error;
    },
    
    resetState: (state) => {
      return initialState;
    },
    
    setValidationResult: (state, action: PayloadAction<{
      detectionId: string;
      result: ValidationResult;
    }>) => {
      state.validationResults[action.payload.detectionId] = action.payload.result;
    },
    
    setActiveFilter: (state, action: PayloadAction<DetectionFormat | null>) => {
      state.activeFilter = action.payload;
    },
    
    setBatchStatus: (state, action: PayloadAction<BatchState>) => {
      state.batchOperations = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Fetch detections reducers
    builder.addCase(fetchDetections.pending, (state) => {
      state.loading = true;
      state.error = initialState.error;
    });
    
    builder.addCase(fetchDetections.fulfilled, (state, action) => {
      state.loading = false;
      state.items = action.payload.detections;
      state.total = action.payload.total;
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.limit;
    });
    
    builder.addCase(fetchDetections.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.error.message || 'Failed to fetch detections',
        code: action.error.code || 'FETCH_ERROR',
        details: action.error,
        timestamp: new Date().toISOString()
      };
    });

    // Batch translation reducers
    builder.addCase(batchTranslate.pending, (state) => {
      state.batchOperations.status = 'processing';
      state.error = initialState.error;
    });
    
    builder.addCase(batchTranslate.fulfilled, (state, action) => {
      state.batchOperations = {
        ...state.batchOperations,
        inProgress: false,
        completed: action.payload.successful.length,
        failed: action.payload.failed.length,
        status: 'completed'
      };
      
      // Update validation results for translated detections
      action.payload.successful.forEach(result => {
        if (result.validationResult) {
          state.validationResults[result.detectionId] = result.validationResult;
        }
      });
    });
    
    builder.addCase(batchTranslate.rejected, (state, action) => {
      state.batchOperations = {
        ...state.batchOperations,
        inProgress: false,
        status: 'failed'
      };
      state.error = {
        message: action.error.message || 'Batch translation failed',
        code: action.error.code || 'BATCH_ERROR',
        details: action.error,
        timestamp: new Date().toISOString()
      };
    });
  }
});

// Export actions and reducer
export const detectionActions = detectionSlice.actions;
export default detectionSlice.reducer;

// Export type definitions for better type safety
export type { DetectionState, BatchState, ErrorState };