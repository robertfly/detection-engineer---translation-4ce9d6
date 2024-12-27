// Package models provides core validation models and types for the validation service
package models

import (
    "encoding/json" // builtin
    "time"         // builtin
    "github.com/google/uuid" // v1.4.0
)

// Validation status constants
const (
    ValidationStatusSuccess = "success"
    ValidationStatusWarning = "warning"
    ValidationStatusError   = "error"
)

// Validation severity levels
const (
    ValidationSeverityHigh   = "high"
    ValidationSeverityMedium = "medium"
    ValidationSeverityLow    = "low"
)

// Validation confidence and weight thresholds
const (
    ValidationConfidenceThreshold  = 95.0
    ValidationSeverityWeightHigh   = 10.0
    ValidationSeverityWeightMedium = 5.0
    ValidationSeverityWeightLow    = 2.0
)

// ValidationMetadata contains additional validation context and settings
type ValidationMetadata struct {
    ValidatorVersion string                 `json:"validator_version"`
    ValidatorConfig  map[string]interface{} `json:"validator_config"`
    ValidationTime   time.Duration          `json:"validation_time"`
    ValidatedFields  []string              `json:"validated_fields"`
}

// ValidationHistoryEntry tracks individual validation steps
type ValidationHistoryEntry struct {
    Timestamp time.Time              `json:"timestamp"`
    Action    string                 `json:"action"`
    Details   map[string]interface{} `json:"details"`
}

// ValidationIssue represents a detailed validation issue with enhanced tracking
type ValidationIssue struct {
    Message      string                 `json:"message"`
    Severity     string                 `json:"severity"`
    Location     string                 `json:"location"`
    Timestamp    time.Time              `json:"timestamp"`
    IssueCode    string                 `json:"issue_code"`
    Remediation  string                 `json:"remediation"`
    IssueMetadata map[string]interface{} `json:"issue_metadata"`
}

// GetSeverityWeight returns the numerical weight of the issue severity
func (i *ValidationIssue) GetSeverityWeight() float64 {
    switch i.Severity {
    case ValidationSeverityHigh:
        return ValidationSeverityWeightHigh
    case ValidationSeverityMedium:
        return ValidationSeverityWeightMedium
    case ValidationSeverityLow:
        return ValidationSeverityWeightLow
    default:
        return ValidationSeverityWeightLow
    }
}

// ValidationResult represents a comprehensive validation result
type ValidationResult struct {
    ID                   uuid.UUID               `json:"id"`
    CreatedAt            time.Time               `json:"created_at"`
    Status               string                  `json:"status"`
    ConfidenceScore      float64                 `json:"confidence_score"`
    Issues               []ValidationIssue        `json:"issues"`
    SourceFormat         string                  `json:"source_format"`
    TargetFormat         string                  `json:"target_format"`
    Metadata             ValidationMetadata       `json:"metadata"`
    FormatSpecificDetails map[string]interface{} `json:"format_specific_details"`
    ValidationHistory    []ValidationHistoryEntry `json:"validation_history"`
}

// ValidationReport provides a detailed summary of validation results
type ValidationReport struct {
    ValidationResult *ValidationResult     `json:"validation_result"`
    Summary         map[string]int        `json:"summary"`
    Recommendations []string              `json:"recommendations"`
    SuccessMetrics  map[string]float64    `json:"success_metrics"`
    FormatAnalysis  map[string]interface{} `json:"format_analysis"`
}

// NewValidationResult creates a new enhanced validation result instance
func NewValidationResult(detection *Detection) (*ValidationResult, error) {
    sourceFormat, err := detection.GetFormat()
    if err != nil {
        return nil, err
    }

    result := &ValidationResult{
        ID:                   uuid.New(),
        CreatedAt:            time.Now().UTC(),
        Status:               ValidationStatusSuccess,
        ConfidenceScore:      100.0,
        Issues:               make([]ValidationIssue, 0),
        SourceFormat:         sourceFormat,
        FormatSpecificDetails: make(map[string]interface{}),
        ValidationHistory:    make([]ValidationHistoryEntry, 0),
        Metadata: ValidationMetadata{
            ValidatorVersion: "1.0.0",
            ValidatorConfig:  make(map[string]interface{}),
            ValidatedFields:  make([]string, 0),
        },
    }

    // Add initial validation history entry
    result.ValidationHistory = append(result.ValidationHistory, ValidationHistoryEntry{
        Timestamp: time.Now().UTC(),
        Action:    "validation_started",
        Details: map[string]interface{}{
            "source_format": sourceFormat,
        },
    })

    return result, nil
}

// AddIssue adds a validation issue with weighted impact on confidence score
func (r *ValidationResult) AddIssue(issue *ValidationIssue) {
    // Set timestamp if not already set
    if issue.Timestamp.IsZero() {
        issue.Timestamp = time.Now().UTC()
    }

    // Add issue to collection
    r.Issues = append(r.Issues, *issue)

    // Calculate confidence impact
    severityWeight := issue.GetSeverityWeight()
    r.ConfidenceScore -= severityWeight

    // Update validation status based on confidence score
    if r.ConfidenceScore < ValidationConfidenceThreshold {
        if r.Status != ValidationStatusError {
            r.Status = ValidationStatusWarning
        }
    }

    // Add to validation history
    r.ValidationHistory = append(r.ValidationHistory, ValidationHistoryEntry{
        Timestamp: issue.Timestamp,
        Action:    "issue_added",
        Details: map[string]interface{}{
            "issue_code":    issue.IssueCode,
            "severity":      issue.Severity,
            "confidence_impact": severityWeight,
        },
    })
}

// GetDetailedReport generates a comprehensive validation report
func (r *ValidationResult) GetDetailedReport() ValidationReport {
    report := ValidationReport{
        ValidationResult: r,
        Summary:         make(map[string]int),
        Recommendations: make([]string, 0),
        SuccessMetrics:  make(map[string]float64),
        FormatAnalysis:  make(map[string]interface{}),
    }

    // Calculate issue summaries
    severityCounts := map[string]int{
        ValidationSeverityHigh:   0,
        ValidationSeverityMedium: 0,
        ValidationSeverityLow:    0,
    }

    for _, issue := range r.Issues {
        severityCounts[issue.Severity]++
    }

    report.Summary = severityCounts

    // Calculate success metrics
    report.SuccessMetrics = map[string]float64{
        "confidence_score": r.ConfidenceScore,
        "validation_coverage": calculateValidationCoverage(r),
        "issue_density": float64(len(r.Issues)) / 100.0,
    }

    // Generate format-specific analysis
    report.FormatAnalysis = map[string]interface{}{
        "source_format": r.SourceFormat,
        "target_format": r.TargetFormat,
        "format_specific_details": r.FormatSpecificDetails,
    }

    // Generate recommendations
    report.Recommendations = generateRecommendations(r)

    return report
}

// Helper function to calculate validation coverage
func calculateValidationCoverage(r *ValidationResult) float64 {
    if len(r.Metadata.ValidatedFields) == 0 {
        return 0.0
    }
    return 100.0 // Implement actual coverage calculation
}

// Helper function to generate recommendations based on validation results
func generateRecommendations(r *ValidationResult) []string {
    recommendations := make([]string, 0)
    
    if r.ConfidenceScore < ValidationConfidenceThreshold {
        recommendations = append(recommendations, 
            "Review high severity issues to improve confidence score",
            "Consider manual validation of critical detection components")
    }

    // Add format-specific recommendations
    switch r.SourceFormat {
    case DetectionFormatSplunk:
        recommendations = append(recommendations, "Verify SPL syntax and field mappings")
    case DetectionFormatSigma:
        recommendations = append(recommendations, "Ensure SIGMA rule structure follows best practices")
    }

    return recommendations
}