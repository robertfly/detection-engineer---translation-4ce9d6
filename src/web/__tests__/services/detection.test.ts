// jest version: ^29.7.0
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { DetectionService } from '../../src/services/detection';
import { apiClient } from '../../src/utils/api';
import { Detection, DetectionFormat } from '../../src/interfaces/detection';

// Mock API client
jest.mock('../../src/utils/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

describe('DetectionService', () => {
  // Test data setup
  const mockDetectionData = {
    splunk: 'index=main source=firewall action=blocked',
    sigma: 'title: Suspicious Network Connection\nstatus: testing\nlogsource:\n  product: windows\n  service: security',
    qradar: "SELECT sourceip, destinationip FROM events WHERE eventtype='NetworkConnection'",
    kql: "SecurityEvent | where EventID == 4624 | where AccountType == 'User'",
    yara: 'rule suspicious_file { strings: $a = "malicious" condition: $a }'
  };

  const mockDetection: Detection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    content: mockDetectionData.splunk,
    format: DetectionFormat.SPLUNK,
    created_at: new Date(),
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    is_active: true,
    metadata: {
      name: 'Test Detection',
      description: 'Test detection for unit tests',
      tags: ['test', 'firewall'],
      severity: 'HIGH',
      last_modified: new Date()
    }
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDetections', () => {
    it('should fetch detections with correct pagination parameters', async () => {
      const mockResponse = {
        data: {
          detections: [mockDetection],
          total: 1,
          page: 1,
          limit: 10
        }
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await DetectionService.getDetections(1, 10);

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('page=1&limit=10'));
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle format filtering correctly', async () => {
      const mockResponse = {
        data: {
          detections: [mockDetection],
          total: 1,
          page: 1,
          limit: 10
        }
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await DetectionService.getDetections(1, 10, DetectionFormat.SPLUNK);

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('format=SPLUNK'));
    });

    it('should throw error for invalid pagination parameters', async () => {
      await expect(DetectionService.getDetections(0, 0)).rejects.toThrow('Invalid pagination parameters');
    });
  });

  describe('getDetectionById', () => {
    it('should fetch a single detection by ID', async () => {
      const mockResponse = { data: mockDetection };
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await DetectionService.getDetectionById(mockDetection.id);

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining(mockDetection.id));
      expect(result).toEqual(mockDetection);
    });

    it('should handle non-existent detection ID', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Detection not found'));

      await expect(DetectionService.getDetectionById('non-existent-id'))
        .rejects.toThrow('Failed to fetch detection');
    });
  });

  describe('createDetection', () => {
    it('should create a new detection with valid data', async () => {
      const mockResponse = { data: mockDetection };
      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const createData = {
        content: mockDetectionData.splunk,
        format: DetectionFormat.SPLUNK,
        metadata: mockDetection.metadata
      };

      const result = await DetectionService.createDetection(createData);

      expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), createData);
      expect(result).toEqual(mockDetection);
    });

    it('should validate detection format before creation', async () => {
      const invalidData = {
        content: 'invalid content',
        format: 'INVALID_FORMAT' as DetectionFormat,
        metadata: mockDetection.metadata
      };

      await expect(DetectionService.createDetection(invalidData))
        .rejects.toThrow('Invalid detection format');
    });

    it('should handle validation errors during creation', async () => {
      const invalidContent = {
        content: 'invalid syntax',
        format: DetectionFormat.SPLUNK,
        metadata: mockDetection.metadata
      };

      (apiClient.post as jest.Mock).mockRejectedValue(new Error('Validation failed'));

      await expect(DetectionService.createDetection(invalidContent))
        .rejects.toThrow('Failed to create detection');
    });
  });

  describe('updateDetection', () => {
    it('should update an existing detection', async () => {
      const mockResponse = { data: { ...mockDetection, content: 'updated content' } };
      (apiClient.put as jest.Mock).mockResolvedValue(mockResponse);

      const updateData = {
        content: 'updated content'
      };

      const result = await DetectionService.updateDetection(mockDetection.id, updateData);

      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining(mockDetection.id),
        updateData
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should validate updated content if format is provided', async () => {
      const updateData = {
        content: mockDetectionData.sigma,
        format: DetectionFormat.SIGMA
      };

      const mockResponse = { data: { ...mockDetection, ...updateData } };
      (apiClient.put as jest.Mock).mockResolvedValue(mockResponse);

      const result = await DetectionService.updateDetection(mockDetection.id, updateData);

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('deleteDetection', () => {
    it('should delete an existing detection', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      await DetectionService.deleteDetection(mockDetection.id);

      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining(mockDetection.id)
      );
    });

    it('should handle deletion of non-existent detection', async () => {
      (apiClient.delete as jest.Mock).mockRejectedValue(new Error('Detection not found'));

      await expect(DetectionService.deleteDetection('non-existent-id'))
        .rejects.toThrow('Failed to delete detection');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await expect(DetectionService.getDetections())
        .rejects.toThrow('Failed to fetch detections');
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.name = 'RateLimitError';
      (apiClient.post as jest.Mock).mockRejectedValue(rateLimitError);

      await expect(DetectionService.createDetection({
        content: mockDetectionData.splunk,
        format: DetectionFormat.SPLUNK,
        metadata: mockDetection.metadata
      })).rejects.toThrow('Failed to create detection');
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Unauthorized');
      authError.name = 'AuthenticationError';
      (apiClient.get as jest.Mock).mockRejectedValue(authError);

      await expect(DetectionService.getDetections())
        .rejects.toThrow('Failed to fetch detections');
    });
  });

  describe('Format Validation', () => {
    const testFormatValidation = async (format: DetectionFormat, content: string) => {
      const createData = {
        content,
        format,
        metadata: mockDetection.metadata
      };

      const mockResponse = { data: { ...mockDetection, content, format } };
      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await DetectionService.createDetection(createData);
      expect(result.format).toBe(format);
      expect(result.content).toBe(content);
    };

    it('should validate Splunk SPL format', async () => {
      await testFormatValidation(DetectionFormat.SPLUNK, mockDetectionData.splunk);
    });

    it('should validate SIGMA format', async () => {
      await testFormatValidation(DetectionFormat.SIGMA, mockDetectionData.sigma);
    });

    it('should validate QRadar format', async () => {
      await testFormatValidation(DetectionFormat.QRADAR, mockDetectionData.qradar);
    });

    it('should validate KQL format', async () => {
      await testFormatValidation(DetectionFormat.KQL, mockDetectionData.kql);
    });

    it('should validate YARA format', async () => {
      await testFormatValidation(DetectionFormat.YARA, mockDetectionData.yara);
    });
  });
});