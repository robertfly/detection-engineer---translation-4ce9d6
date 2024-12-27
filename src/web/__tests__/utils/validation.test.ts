/**
 * @fileoverview Comprehensive test suite for validation utility functions
 * Tests validation result processing, confidence scoring, and issue formatting
 * @version 1.0.0
 */

// External imports - jest version: ^29.7.0
import { describe, it, expect, jest } from '@jest/globals';

// Internal imports
import {
  processValidationResult,
  calculateConfidenceScore,
  formatValidationIssue
} from '../../src/utils/validation';
import {
  ValidationResult,
  ValidationIssue,
  ValidationStatus,
  ValidationSeverity
} from '../../src/interfaces/validation';

// Mock validation result with various scenarios
const mockValidationResult: ValidationResult = {
  id: crypto.randomUUID(),
  createdAt: new Date(),
  status: ValidationStatus.WARNING,
  confidenceScore: 85,
  issues: [
    {
      message: 'Non-standard field name detected',
      severity: ValidationSeverity.LOW,
      location: 'line 15',
      code: 'SYNTAX_FIELD_NAME',
      suggestions: ['Use standard field naming convention']
    },
    {
      message: 'Potential performance impact in query',
      severity: ValidationSeverity.MEDIUM,
      location: 'line 23',
      code: 'PERFORMANCE_QUERY',
      suggestions: ['Consider index optimization']
    }
  ],
  sourceFormat: 'SPLUNK',
  targetFormat: 'SIGMA',
  metadata: {}
};

describe('processValidationResult', () => {
  it('should process successful validation result with no issues', () => {
    const successResult: ValidationResult = {
      ...mockValidationResult,
      status: ValidationStatus.SUCCESS,
      issues: [],
      confidenceScore: 100
    };

    const processed = processValidationResult(successResult);
    expect(processed.status).toBe(ValidationStatus.SUCCESS);
    expect(processed.confidenceScore).toBe(100);
    expect(processed.issues).toHaveLength(0);
  });

  it('should handle validation result with warning-level issues', () => {
    const processed = processValidationResult(mockValidationResult);
    expect(processed.status).toBe(ValidationStatus.WARNING);
    expect(processed.confidenceScore).toBeLessThan(100);
    expect(processed.metadata?.summary.criticalIssues).toBe(0);
  });

  it('should handle validation result with error-level issues', () => {
    const errorResult: ValidationResult = {
      ...mockValidationResult,
      status: ValidationStatus.ERROR,
      issues: [
        {
          message: 'Critical syntax error',
          severity: ValidationSeverity.HIGH,
          location: 'line 10',
          code: 'SYNTAX_ERROR',
          suggestions: ['Fix syntax error']
        }
      ]
    };

    const processed = processValidationResult(errorResult);
    expect(processed.status).toBe(ValidationStatus.ERROR);
    expect(processed.confidenceScore).toBeLessThan(70);
    expect(processed.metadata?.summary.criticalIssues).toBe(1);
  });

  it('should process empty validation result correctly', () => {
    const emptyResult: ValidationResult = {
      ...mockValidationResult,
      issues: [],
      status: ValidationStatus.SUCCESS
    };

    const processed = processValidationResult(emptyResult);
    expect(processed.status).toBe(ValidationStatus.SUCCESS);
    expect(processed.confidenceScore).toBe(100);
    expect(processed.metadata?.summary.totalIssues).toBe(0);
  });

  it('should handle mixed severity issues appropriately', () => {
    const mixedResult: ValidationResult = {
      ...mockValidationResult,
      issues: [
        {
          message: 'Minor style issue',
          severity: ValidationSeverity.LOW,
          location: 'line 5',
          code: 'STYLE_WARNING',
          suggestions: ['Review style guide']
        },
        {
          message: 'Critical security issue',
          severity: ValidationSeverity.HIGH,
          location: 'line 8',
          code: 'SECURITY_ERROR',
          suggestions: ['Fix security vulnerability']
        }
      ]
    };

    const processed = processValidationResult(mixedResult);
    expect(processed.status).toBe(ValidationStatus.ERROR);
    expect(processed.metadata?.summary.criticalIssues).toBe(1);
    expect(processed.confidenceScore).toBeLessThan(80);
  });
});

describe('calculateConfidenceScore', () => {
  it('should return 100 for validation with no issues', () => {
    const score = calculateConfidenceScore([]);
    expect(score.overallScore).toBe(100);
    expect(score.severityDistribution[ValidationSeverity.HIGH]).toBe(0);
  });

  it('should calculate correct score reduction for severity levels', () => {
    const issues: ValidationIssue[] = [
      {
        message: 'High severity issue',
        severity: ValidationSeverity.HIGH,
        location: 'line 1',
        code: 'HIGH_SEVERITY',
        suggestions: []
      },
      {
        message: 'Medium severity issue',
        severity: ValidationSeverity.MEDIUM,
        location: 'line 2',
        code: 'MEDIUM_SEVERITY',
        suggestions: []
      },
      {
        message: 'Low severity issue',
        severity: ValidationSeverity.LOW,
        location: 'line 3',
        code: 'LOW_SEVERITY',
        suggestions: []
      }
    ];

    const score = calculateConfidenceScore(issues);
    expect(score.overallScore).toBeLessThan(100);
    expect(score.categoryScores).toBeDefined();
    expect(score.severityDistribution[ValidationSeverity.HIGH]).toBe(1);
  });

  it('should handle mixed severity issues correctly', () => {
    const score = calculateConfidenceScore(mockValidationResult.issues);
    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.overallScore).toBeLessThan(100);
    expect(score.categoryScores).toHaveProperty('SYNTAX_FIELD_NAME');
    expect(score.categoryScores).toHaveProperty('PERFORMANCE_QUERY');
  });

  it('should enforce minimum score threshold', () => {
    const criticalIssues: ValidationIssue[] = Array(10).fill({
      message: 'Critical issue',
      severity: ValidationSeverity.HIGH,
      location: 'multiple',
      code: 'CRITICAL_ERROR',
      suggestions: []
    });

    const score = calculateConfidenceScore(criticalIssues);
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
  });
});

describe('formatValidationIssue', () => {
  it('should format high severity issue with correct prefix', () => {
    const issue: ValidationIssue = {
      message: 'Critical security vulnerability',
      severity: ValidationSeverity.HIGH,
      location: 'line 42',
      code: 'SECURITY_CRITICAL',
      suggestions: ['Apply security patch']
    };

    const formatted = formatValidationIssue(issue);
    expect(formatted.message).toContain('Critical security vulnerability');
    expect(formatted.metadata?.impact.severity).toBe(ValidationSeverity.HIGH);
  });

  it('should include location information when available', () => {
    const issue: ValidationIssue = {
      message: 'Syntax warning',
      severity: ValidationSeverity.MEDIUM,
      location: 'line 15:10',
      code: 'SYNTAX_WARNING',
      suggestions: ['Review syntax']
    };

    const formatted = formatValidationIssue(issue);
    expect(formatted.metadata?.context.location).toBe('line 15:10');
  });

  it('should handle missing location gracefully', () => {
    const issue: ValidationIssue = {
      message: 'General warning',
      severity: ValidationSeverity.LOW,
      location: '',
      code: 'GENERAL_WARNING',
      suggestions: ['Review documentation']
    };

    const formatted = formatValidationIssue(issue);
    expect(formatted.metadata?.context.location).toBe('');
  });

  it('should generate appropriate suggestions', () => {
    const issue: ValidationIssue = {
      message: 'Performance optimization needed',
      severity: ValidationSeverity.MEDIUM,
      location: 'line 30',
      code: 'PERFORMANCE_WARNING',
      suggestions: ['Optimize query']
    };

    const formatted = formatValidationIssue(issue);
    expect(formatted.suggestions).toContain('Optimize query');
    expect(formatted.suggestions.length).toBeGreaterThan(0);
  });
});