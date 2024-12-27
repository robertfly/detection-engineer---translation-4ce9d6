// jest version: ^29.7.0
// axios-mock-adapter version: ^1.22.0
// nock version: ^13.3.8
// @testing-library/react version: ^14.0.0

import MockAdapter from 'axios-mock-adapter';
import { apiService } from '../../src/services/api';
import { apiClient } from '../../src/utils/api';
import { Detection, DetectionFormat } from '../../src/interfaces/detection';
import { API_ENDPOINTS } from '../../src/config/api';
import { logger } from '../../src/utils/logger';

// Mock the logger to prevent console output during tests
jest.mock('../../src/utils/logger');

describe('API Service Tests', () => {
  let mockAdapter: MockAdapter;
  
  // Test data constants
  const TEST_DETECTION: Detection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    content: 'index=security source=firewall action=blocked',
    format: DetectionFormat.SPLUNK,
    created_at: new Date(),
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    is_active: true,
    metadata: {
      name: 'Test Detection',
      description: 'Test detection for blocked firewall traffic',
      tags: ['firewall', 'security'],
      severity: 'HIGH',
      last_modified: new Date()
    }
  };

  const TEST_VALIDATION_RESULT = {
    isValid: true,
    errors: [],
    warnings: ['Consider adding additional context fields']
  };

  const TEST_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  const TEST_CORRELATION_ID = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(() => {
    // Initialize mock adapter with timeout and retry config
    mockAdapter = new MockAdapter(apiClient, { delayResponse: 100 });
    
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Configure default security headers
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${TEST_AUTH_TOKEN}`;
    apiClient.defaults.headers.common['X-Correlation-ID'] = TEST_CORRELATION_ID;
  });

  afterEach(() => {
    // Clean up mock adapter
    mockAdapter.reset();
    mockAdapter.restore();
  });

  describe('Detection Operations', () => {
    test('getDetection should retrieve detection with security headers', async () => {
      // Arrange
      const detectionId = TEST_DETECTION.id;
      mockAdapter.onGet(`${API_ENDPOINTS.detection.get.replace(':id', detectionId)}`)
        .reply(200, TEST_DETECTION);

      // Act
      const result = await apiService.getDetection(detectionId);

      // Assert
      expect(result).toEqual(TEST_DETECTION);
      expect(mockAdapter.history.get[0].headers['Authorization']).toBe(`Bearer ${TEST_AUTH_TOKEN}`);
      expect(mockAdapter.history.get[0].headers['X-Correlation-ID']).toBeDefined();
    });

    test('createDetection should handle rate limiting', async () => {
      // Arrange
      mockAdapter.onPost(API_ENDPOINTS.detection.create)
        .replyOnce(429, { message: 'Too Many Requests' }, { 'Retry-After': '10' })
        .onPost(API_ENDPOINTS.detection.create)
        .reply(201, TEST_DETECTION);

      // Act & Assert
      await expect(apiService.createDetection(TEST_DETECTION))
        .rejects
        .toThrow('Too Many Requests');
    });

    test('translateDetection should handle circuit breaker', async () => {
      // Arrange
      const translationRequest = {
        content: TEST_DETECTION.content,
        sourceFormat: DetectionFormat.SPLUNK,
        targetFormat: DetectionFormat.SIGMA
      };

      mockAdapter.onPost(API_ENDPOINTS.translation.single)
        .reply(500, { message: 'Internal Server Error' });

      // Act & Assert
      for (let i = 0; i < 6; i++) {
        await expect(apiService.translateDetection(translationRequest))
          .rejects
          .toThrow();
      }

      // Verify circuit breaker opened
      expect(logger.warn).toHaveBeenCalledWith('Circuit breaker: operation rejected');
    });
  });

  describe('Validation Operations', () => {
    test('validateDetection should process validation rules', async () => {
      // Arrange
      const validationRequest = {
        content: TEST_DETECTION.content,
        format: DetectionFormat.SPLUNK,
        rules: ['syntax', 'performance']
      };

      mockAdapter.onPost(API_ENDPOINTS.validation.check)
        .reply(200, TEST_VALIDATION_RESULT);

      // Act
      const result = await apiService.validateDetection(validationRequest);

      // Assert
      expect(result).toEqual(TEST_VALIDATION_RESULT);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('Batch Operations', () => {
    test('batchTranslate should handle large requests', async () => {
      // Arrange
      const batchRequest = {
        detections: Array(50).fill({
          content: TEST_DETECTION.content,
          sourceFormat: DetectionFormat.SPLUNK
        }),
        targetFormat: DetectionFormat.SIGMA
      };

      mockAdapter.onPost(API_ENDPOINTS.translation.batch)
        .reply(202, {
          id: '123e4567-e89b-12d3-a456-426614174003',
          status: 'processing',
          progress: 0
        });

      // Act
      const result = await apiService.batchTranslate(batchRequest);

      // Assert
      expect(result.status).toBe('processing');
      expect(result.progress).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Arrange
      mockAdapter.onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .networkError();

      // Act & Assert
      await expect(apiService.getDetection(TEST_DETECTION.id))
        .rejects
        .toThrow('Network Error');
    });

    test('should handle timeout errors', async () => {
      // Arrange
      mockAdapter.onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .timeout();

      // Act & Assert
      await expect(apiService.getDetection(TEST_DETECTION.id))
        .rejects
        .toThrow('timeout');
    });

    test('should handle authentication errors', async () => {
      // Arrange
      mockAdapter.onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .reply(401, { message: 'Unauthorized' });

      // Act & Assert
      await expect(apiService.getDetection(TEST_DETECTION.id))
        .rejects
        .toThrow('Unauthorized');
    });
  });

  describe('Security Features', () => {
    test('should include security headers in requests', async () => {
      // Arrange
      mockAdapter.onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .reply(200, TEST_DETECTION);

      // Act
      await apiService.getDetection(TEST_DETECTION.id);

      // Assert
      const request = mockAdapter.history.get[0];
      expect(request.headers['Authorization']).toBeDefined();
      expect(request.headers['X-Correlation-ID']).toBeDefined();
      expect(request.headers['X-Request-ID']).toBeDefined();
    });

    test('should handle token refresh', async () => {
      // Arrange
      mockAdapter.onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .replyOnce(401, { message: 'Token expired' })
        .onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .reply(200, TEST_DETECTION);

      // Act & Assert
      await expect(apiService.getDetection(TEST_DETECTION.id))
        .rejects
        .toThrow('Token expired');
    });
  });

  describe('Performance Monitoring', () => {
    test('should track request duration', async () => {
      // Arrange
      mockAdapter.onGet(API_ENDPOINTS.detection.get.replace(':id', TEST_DETECTION.id))
        .reply(200, TEST_DETECTION);

      // Act
      await apiService.getDetection(TEST_DETECTION.id);

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'API Response',
        expect.objectContaining({
          status: 200,
          duration: expect.any(Number)
        })
      );
    });
  });
});