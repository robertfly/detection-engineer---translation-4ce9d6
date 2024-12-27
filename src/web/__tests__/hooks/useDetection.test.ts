/**
 * @fileoverview Comprehensive test suite for useDetection hook
 * Tests hook functionality, Redux interactions, error handling, batch operations,
 * GitHub integration, and validation scenarios.
 * @version 1.0.0
 */

// External imports
import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

// Internal imports
import { useDetection } from '../../src/hooks/useDetection';
import { Detection, DetectionFormat } from '../../src/interfaces/detection';
import detectionReducer, { detectionActions } from '../../src/store/detectionSlice';
import { ValidationStatus, ValidationSeverity } from '../../src/interfaces/validation';

// Test constants
const TEST_TIMEOUT = 10000;

// Mock data
const mockDetection: Detection = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  content: 'index=main sourcetype=security action=failed',
  format: DetectionFormat.SPLUNK,
  created_at: new Date(),
  user_id: '123e4567-e89b-12d3-a456-426614174001',
  is_active: true,
  metadata: {
    name: 'Test Detection',
    description: 'Test detection for failed security actions',
    tags: ['security', 'test'],
    severity: 'HIGH',
    last_modified: new Date()
  }
};

const mockValidationResult = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  status: ValidationStatus.SUCCESS,
  confidenceScore: 95,
  issues: [],
  createdAt: new Date(),
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  metadata: {}
};

const mockGitHubConfig = {
  repository: 'org/security-detections',
  branch: 'main',
  path: 'detections/splunk',
  autoValidate: true
};

describe('useDetection hook', () => {
  let mockStore: any;
  let wrapper: any;

  beforeEach(() => {
    // Create fresh Redux store for each test
    mockStore = configureStore({
      reducer: {
        detection: detectionReducer
      }
    });

    // Wrap hook with Redux Provider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    expect(result.current.detections).toEqual([]);
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
    expect(result.current.selectedDetection).toBeNull();
  });

  it('should fetch detections successfully', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    await act(async () => {
      await result.current.fetchDetections();
    });

    await waitFor(() => {
      expect(result.current.loading).toBeFalsy();
      expect(result.current.detections.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });
  }, TEST_TIMEOUT);

  it('should handle fetch detections error', async () => {
    const errorMessage = 'Failed to fetch detections';
    mockStore.dispatch(detectionActions.setError({ message: errorMessage }));

    const { result } = renderHook(() => useDetection(), { wrapper });

    await act(async () => {
      await result.current.fetchDetections();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error.message).toBe(errorMessage);
  });

  it('should handle batch translations', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });
    const detections = [mockDetection];
    const targetFormat = DetectionFormat.SIGMA;

    await act(async () => {
      await result.current.processBatchDetections(detections, {
        targetFormat,
        validateOnly: false,
        continueOnError: true,
        maxConcurrent: 5
      });
    });

    await waitFor(() => {
      expect(result.current.batchStatus.inProgress).toBeFalsy();
      expect(result.current.batchStatus.completed).toBe(1);
      expect(result.current.batchStatus.failed).toBe(0);
    });
  }, TEST_TIMEOUT);

  it('should handle batch translation errors', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });
    const detections = [mockDetection];
    const targetFormat = DetectionFormat.SIGMA;

    // Simulate batch translation error
    mockStore.dispatch(detectionActions.setBatchStatus({
      inProgress: false,
      total: 1,
      completed: 0,
      failed: 1,
      status: 'failed'
    }));

    await act(async () => {
      try {
        await result.current.processBatchDetections(detections, {
          targetFormat,
          continueOnError: false
        });
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    expect(result.current.batchStatus.status).toBe('failed');
  });

  it('should handle GitHub integration', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    await act(async () => {
      await result.current.syncWithGitHub(mockGitHubConfig);
    });

    await waitFor(() => {
      expect(result.current.gitHubSyncStatus.inProgress).toBeFalsy();
      expect(result.current.gitHubSyncStatus.status).toBe('completed');
    });
  }, TEST_TIMEOUT);

  it('should handle GitHub sync errors', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    // Simulate GitHub sync error
    mockStore.dispatch(detectionActions.setGitHubSyncStatus({
      inProgress: false,
      status: 'failed',
      repository: mockGitHubConfig.repository,
      error: 'Failed to sync with GitHub'
    }));

    await act(async () => {
      try {
        await result.current.syncWithGitHub(mockGitHubConfig);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    expect(result.current.gitHubSyncStatus.status).toBe('failed');
  });

  it('should validate translations', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    await act(async () => {
      await result.current.validateDetection(mockDetection);
    });

    await waitFor(() => {
      const validationResult = result.current.validationResults[mockDetection.id];
      expect(validationResult).toBeTruthy();
      expect(validationResult.status).toBe(ValidationStatus.SUCCESS);
      expect(validationResult.confidenceScore).toBeGreaterThanOrEqual(95);
    });
  }, TEST_TIMEOUT);

  it('should handle validation errors', async () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    // Simulate validation error
    const errorValidation = {
      ...mockValidationResult,
      status: ValidationStatus.ERROR,
      confidenceScore: 60,
      issues: [{
        message: 'Invalid syntax',
        severity: ValidationSeverity.HIGH,
        location: 'line 1',
        code: 'SYNTAX_ERROR',
        suggestions: ['Check syntax documentation']
      }]
    };

    mockStore.dispatch(detectionActions.setValidationResult({
      detectionId: mockDetection.id,
      result: errorValidation
    }));

    await act(async () => {
      try {
        await result.current.validateDetection(mockDetection);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    const validationResult = result.current.validationResults[mockDetection.id];
    expect(validationResult.status).toBe(ValidationStatus.ERROR);
    expect(validationResult.issues.length).toBeGreaterThan(0);
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useDetection(), { wrapper });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});