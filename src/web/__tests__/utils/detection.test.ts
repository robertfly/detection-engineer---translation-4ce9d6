/**
 * @fileoverview Unit tests for detection utility functions with comprehensive coverage
 * of format-specific validation rules and error reporting.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise deployments
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.7.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal imports
import {
  createDetection,
  validateDetectionContent,
  validateBatchDetections,
  getValidationConfidence,
  ValidationSeverity,
  ValidationResult
} from '../../src/utils/detection';

import {
  Detection,
  DetectionFormat,
  DetectionSeverity
} from '../../src/interfaces/detection';

// Test data constants
const TEST_DETECTIONS = {
  SPLUNK: {
    VALID: 'index=main sourcetype=windows EventCode=4625 | stats count by src_ip',
    INVALID: 'invalid syntax | broken pipe stats',
  },
  SIGMA: {
    VALID: `
      title: Failed Windows Logon
      status: test
      logsource:
        product: windows
        service: security
      detection:
        selection:
          EventID: 4625
        condition: selection
    `,
    INVALID: 'invalid: yaml: syntax',
  },
  KQL: {
    VALID: 'SecurityEvent | where EventID == 4625 | summarize count() by SourceIP',
    INVALID: 'broken query where |',
  },
} as const;

describe('createDetection', () => {
  it('should create a valid detection with required properties', () => {
    const content = TEST_DETECTIONS.SPLUNK.VALID;
    const format = DetectionFormat.SPLUNK;
    
    const detection = createDetection(content, format);
    
    expect(detection).toMatchObject({
      content,
      format,
      is_active: true,
      metadata: expect.objectContaining({
        severity: DetectionSeverity.MEDIUM,
      }),
    });
    expect(detection.id).toBeDefined();
    expect(detection.created_at).toBeInstanceOf(Date);
  });

  it('should generate unique IDs for each detection', () => {
    const detection1 = createDetection(TEST_DETECTIONS.SPLUNK.VALID, DetectionFormat.SPLUNK);
    const detection2 = createDetection(TEST_DETECTIONS.SPLUNK.VALID, DetectionFormat.SPLUNK);
    
    expect(detection1.id).not.toBe(detection2.id);
  });

  it('should throw error for empty content', () => {
    expect(() => createDetection('', DetectionFormat.SPLUNK))
      .toThrow('Detection content cannot be empty');
  });

  it('should merge provided metadata with defaults', () => {
    const metadata = {
      name: 'Test Detection',
      description: 'Test Description',
      severity: DetectionSeverity.HIGH,
    };
    
    const detection = createDetection(TEST_DETECTIONS.SPLUNK.VALID, DetectionFormat.SPLUNK, metadata);
    
    expect(detection.metadata).toMatchObject(metadata);
    expect(detection.metadata.tags).toEqual([]);
    expect(detection.metadata.last_modified).toBeInstanceOf(Date);
  });
});

describe('validateDetectionContent', () => {
  // Test format-specific validation for each supported format
  describe('Splunk SPL Validation', () => {
    it('should validate correct SPL syntax', () => {
      const result = validateDetectionContent(
        TEST_DETECTIONS.SPLUNK.VALID,
        DetectionFormat.SPLUNK
      );
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify invalid SPL syntax', () => {
      const result = validateDetectionContent(
        TEST_DETECTIONS.SPLUNK.INVALID,
        DetectionFormat.SPLUNK
      );
      
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(ValidationSeverity.ERROR);
      expect(result.errors).toContain('Invalid syntax for specified format');
    });
  });

  describe('SIGMA Validation', () => {
    it('should validate correct SIGMA syntax', () => {
      const result = validateDetectionContent(
        TEST_DETECTIONS.SIGMA.VALID,
        DetectionFormat.SIGMA
      );
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: ValidationSeverity.INFO,
          })
        ])
      );
    });

    it('should identify invalid YAML syntax in SIGMA rules', () => {
      const result = validateDetectionContent(
        TEST_DETECTIONS.SIGMA.INVALID,
        DetectionFormat.SIGMA
      );
      
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(ValidationSeverity.ERROR);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('KQL Validation', () => {
    it('should validate correct KQL syntax', () => {
      const result = validateDetectionContent(
        TEST_DETECTIONS.KQL.VALID,
        DetectionFormat.KQL
      );
      
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should identify invalid KQL syntax', () => {
      const result = validateDetectionContent(
        TEST_DETECTIONS.KQL.INVALID,
        DetectionFormat.KQL
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});

describe('validateBatchDetections', () => {
  let testDetections: Detection[];

  beforeEach(() => {
    testDetections = [
      createDetection(TEST_DETECTIONS.SPLUNK.VALID, DetectionFormat.SPLUNK),
      createDetection(TEST_DETECTIONS.SIGMA.VALID, DetectionFormat.SIGMA),
      createDetection(TEST_DETECTIONS.KQL.VALID, DetectionFormat.KQL),
      createDetection(TEST_DETECTIONS.SPLUNK.INVALID, DetectionFormat.SPLUNK),
    ];
  });

  it('should process multiple detections and provide aggregated results', () => {
    const { results, summary } = validateBatchDetections(testDetections);
    
    expect(summary.total).toBe(4);
    expect(summary.valid).toBe(3);
    expect(summary.invalid).toBe(1);
    expect(results.size).toBe(4);
  });

  it('should handle mixed format batches correctly', () => {
    const { results } = validateBatchDetections(testDetections);
    
    const validationResults = Array.from(results.values());
    const formatSpecificResults = validationResults.filter(
      result => result.details.some(detail => 
        detail.message.includes('format-specific')
      )
    );
    
    expect(formatSpecificResults.length).toBeGreaterThan(0);
  });

  it('should maintain high performance with large batches', () => {
    const largeTestSet = Array(100).fill(null).map(() => 
      createDetection(TEST_DETECTIONS.SPLUNK.VALID, DetectionFormat.SPLUNK)
    );
    
    const startTime = Date.now();
    const { results } = validateBatchDetections(largeTestSet);
    const endTime = Date.now();
    
    expect(results.size).toBe(100);
    expect(endTime - startTime).toBeLessThan(5000); // 5 second timeout
  });
});

describe('getValidationConfidence', () => {
  it('should calculate confidence scores based on validation results', () => {
    const result = validateDetectionContent(
      TEST_DETECTIONS.SPLUNK.VALID,
      DetectionFormat.SPLUNK,
      { strictMode: true }
    );
    
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.confidence).toBe('number');
  });

  it('should reduce confidence for warnings in strict mode', () => {
    const result = validateDetectionContent(
      TEST_DETECTIONS.SPLUNK.VALID,
      DetectionFormat.SPLUNK,
      { strictMode: true, checkFields: true }
    );
    
    const relaxedResult = validateDetectionContent(
      TEST_DETECTIONS.SPLUNK.VALID,
      DetectionFormat.SPLUNK,
      { strictMode: false, checkFields: true }
    );
    
    expect(result.confidence).toBeLessThanOrEqual(relaxedResult.confidence);
  });

  it('should provide detailed confidence breakdown in validation details', () => {
    const result = validateDetectionContent(
      TEST_DETECTIONS.SIGMA.VALID,
      DetectionFormat.SIGMA,
      { strictMode: true }
    );
    
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.any(String),
          severity: expect.any(String),
          suggestion: expect.any(String),
        })
      ])
    );
  });
});