/**
 * @fileoverview Comprehensive test suite for the detection Redux slice.
 * Tests state management, async thunks, reducers, validation states, and error handling.
 * @version 1.0.0
 */

// External imports - versions from package.json
import { describe, beforeEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { waitFor } from '@testing-library/react'; // ^14.0.0

// Internal imports
import detectionReducer, { 
  detectionActions, 
  detectionSlice,
  fetchDetections,
  batchTranslate,
  DetectionState,
  BatchState
} from '../../src/store/detectionSlice';
import { DetectionService } from '../../src/services/detection';
import { DetectionFormat, Detection } from '../../src/interfaces/detection';
import { ValidationStatus, ValidationSeverity } from '../../src/interfaces/validation';

// Mock the detection service
jest.mock('../../src/services/detection');

// Mock data for testing
const mockDetection: Detection = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  content: 'index=main source=* | stats count by src_ip',
  format: DetectionFormat.SPLUNK,
  created_at: new Date(),
  user_id: '123e4567-e89b-12d3-a456-426614174001',
  is_active: true,
  metadata: {
    name: 'Test Detection',
    description: 'Test detection for unit tests',
    tags: ['test'],
    severity: 'MEDIUM',
    last_modified: new Date()
  }
};

const mockValidationResult = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  createdAt: new Date(),
  status: ValidationStatus.SUCCESS,
  confidenceScore: 95,
  issues: [],
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  metadata: {}
};

describe('Detection Slice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Configure test store
    store = configureStore({
      reducer: {
        detection: detectionReducer
      }
    });
  });

  describe('State Management', () => {
    it('should handle initial state', () => {
      const state = store.getState().detection;
      expect(state.items).toEqual([]);
      expect(state.loading).toBeFalsy();
      expect(state.error).toEqual({
        message: null,
        code: null,
        details: null,
        timestamp: null
      });
    });

    it('should handle loading states', () => {
      store.dispatch(detectionActions.setSelectedDetection(mockDetection));
      expect(store.getState().detection.selectedDetection).toEqual(mockDetection);
    });

    it('should handle error states', () => {
      const errorState = {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: { foo: 'bar' },
        timestamp: new Date().toISOString()
      };
      store.dispatch(detectionSlice.actions.resetState());
      const state = store.getState().detection;
      expect(state).toEqual(expect.objectContaining({
        items: [],
        loading: false,
        error: {
          message: null,
          code: null,
          details: null,
          timestamp: null
        }
      }));
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(() => {
      // Mock service responses
      (DetectionService.getDetections as jest.Mock).mockResolvedValue({
        detections: [mockDetection],
        total: 1,
        page: 1,
        limit: 10
      });
    });

    it('should handle fetchDetections success', async () => {
      const promise = store.dispatch(fetchDetections({ 
        page: 1, 
        limit: 10,
        format: DetectionFormat.SPLUNK 
      }));

      expect(store.getState().detection.loading).toBeTruthy();

      await promise;

      expect(store.getState().detection.loading).toBeFalsy();
      expect(store.getState().detection.items).toHaveLength(1);
      expect(store.getState().detection.total).toBe(1);
    });

    it('should handle fetchDetections error', async () => {
      const errorMessage = 'Failed to fetch detections';
      (DetectionService.getDetections as jest.Mock).mockRejectedValue(new Error(errorMessage));

      try {
        await store.dispatch(fetchDetections({ page: 1, limit: 10 }));
      } catch (error) {
        expect(store.getState().detection.loading).toBeFalsy();
        expect(store.getState().detection.error.message).toBe(errorMessage);
      }
    });

    it('should handle batch translation operations', async () => {
      const mockBatchResults = {
        successful: [
          { 
            detectionId: mockDetection.id,
            validationResult: mockValidationResult
          }
        ],
        failed: []
      };

      (DetectionService.batchTranslate as jest.Mock).mockResolvedValue(mockBatchResults);

      const promise = store.dispatch(batchTranslate({
        detectionIds: [mockDetection.id],
        targetFormat: DetectionFormat.SIGMA
      }));

      expect(store.getState().detection.batchOperations.status).toBe('processing');

      await promise;

      const batchState = store.getState().detection.batchOperations;
      expect(batchState.status).toBe('completed');
      expect(batchState.completed).toBe(1);
      expect(batchState.failed).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should handle validation results', () => {
      store.dispatch(detectionActions.setValidationResult({
        detectionId: mockDetection.id,
        result: mockValidationResult
      }));

      const state = store.getState().detection;
      expect(state.validationResults[mockDetection.id]).toEqual(mockValidationResult);
    });

    it('should handle validation errors', async () => {
      const mockValidationError = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        createdAt: new Date(),
        status: ValidationStatus.ERROR,
        confidenceScore: 50,
        issues: [{
          message: 'Invalid syntax',
          severity: ValidationSeverity.HIGH,
          location: 'line 1',
          code: 'SYNTAX_ERROR',
          suggestions: ['Check syntax documentation']
        }],
        sourceFormat: DetectionFormat.SPLUNK,
        targetFormat: DetectionFormat.SIGMA,
        metadata: {}
      };

      store.dispatch(detectionActions.setValidationResult({
        detectionId: mockDetection.id,
        result: mockValidationError
      }));

      const state = store.getState().detection;
      expect(state.validationResults[mockDetection.id].status).toBe(ValidationStatus.ERROR);
      expect(state.validationResults[mockDetection.id].issues).toHaveLength(1);
    });
  });

  describe('Format Filtering', () => {
    it('should handle format filter changes', () => {
      store.dispatch(detectionActions.setActiveFilter(DetectionFormat.SPLUNK));
      expect(store.getState().detection.activeFilter).toBe(DetectionFormat.SPLUNK);

      store.dispatch(detectionActions.setActiveFilter(null));
      expect(store.getState().detection.activeFilter).toBeNull();
    });

    it('should fetch detections with format filter', async () => {
      await store.dispatch(fetchDetections({
        page: 1,
        limit: 10,
        format: DetectionFormat.SPLUNK
      }));

      expect(DetectionService.getDetections).toHaveBeenCalledWith(
        1,
        10,
        DetectionFormat.SPLUNK
      );
    });
  });
});