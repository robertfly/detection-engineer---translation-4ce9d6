// Package validation provides format-specific validation implementations
// Version: 1.0.0
package validation

import (
    "context"
    "fmt"
    "time"

    "gopkg.in/yaml.v3" // v3.0.1

    "validation-service/internal/models"
    "validation-service/pkg/logger"
    "validation-service/pkg/metrics"
)

// Default validation timeout and confidence score weights
const (
    defaultValidationTimeout = 30 * time.Second

    // Confidence score weights for different validation aspects
    weightYAMLStructure     = 30.0
    weightRequiredFields    = 25.0
    weightDetectionLogic    = 20.0
    weightLogsource        = 15.0
    weightFieldMappings    = 10.0
)

// Required SIGMA fields
var requiredSigmaFields = []string{
    "title",
    "description",
    "logsource",
    "detection",
}

// SigmaValidator implements enhanced FormatValidator interface for SIGMA detection rules
type SigmaValidator struct {
    logger           *logger.Logger
    confidenceWeights map[string]float64
    timeout          time.Duration
}

// init registers the SIGMA validator with confidence score weights
func init() {
    weights := map[string]float64{
        "yaml_structure":  weightYAMLStructure,
        "required_fields": weightRequiredFields,
        "detection_logic": weightDetectionLogic,
        "logsource":      weightLogsource,
        "field_mappings": weightFieldMappings,
    }

    validator := NewSigmaValidator(weights, defaultValidationTimeout)
    logger.GetLogger().Info("Registered SIGMA validator with confidence scoring")
}

// NewSigmaValidator creates a new SIGMA validator instance with configured weights
func NewSigmaValidator(weights map[string]float64, timeout time.Duration) *SigmaValidator {
    return &SigmaValidator{
        logger:           logger.GetLogger(),
        confidenceWeights: weights,
        timeout:          timeout,
    }
}

// Validate performs comprehensive validation of a SIGMA detection rule
func (v *SigmaValidator) Validate(ctx context.Context, detection *models.Detection) (*models.ValidationResult, error) {
    // Record validation request metric
    if err := metrics.RecordValidationRequest("sigma"); err != nil {
        v.logger.Error("Failed to record validation request", "error", err)
    }

    // Start validation timer
    startTime := time.Now()
    defer func() {
        duration := time.Since(startTime)
        if err := metrics.RecordValidationDuration("sigma", duration); err != nil {
            v.logger.Error("Failed to record validation duration", "error", err)
        }
    }()

    // Create validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, fmt.Errorf("failed to create validation result: %w", err)
    }

    // Get detection content
    content, err := detection.GetContent()
    if err != nil {
        return nil, fmt.Errorf("failed to get detection content: %w", err)
    }

    // Validate YAML structure
    parsedYAML, err := v.validateYAMLStructure(content)
    if err != nil {
        metrics.RecordValidationError("sigma", "syntax")
        result.AddIssue(&models.ValidationIssue{
            Message:   fmt.Sprintf("Invalid YAML structure: %v", err),
            Severity:  models.ValidationSeverityHigh,
            Location:  "yaml_structure",
            IssueCode: "SIGMA001",
            Remediation: "Ensure the detection follows valid YAML syntax",
        })
        return result, nil
    }

    // Validate SIGMA fields
    issues, confidenceScore, err := v.validateSigmaFields(parsedYAML)
    if err != nil {
        metrics.RecordValidationError("sigma", "validation")
        result.AddIssue(&models.ValidationIssue{
            Message:   fmt.Sprintf("Field validation failed: %v", err),
            Severity:  models.ValidationSeverityHigh,
            Location:  "field_validation",
            IssueCode: "SIGMA002",
            Remediation: "Review required SIGMA fields and their formats",
        })
        return result, nil
    }

    // Add field validation issues to result
    for _, issue := range issues {
        result.AddIssue(&issue)
    }

    // Set final confidence score
    result.SetConfidenceScore(confidenceScore)

    return result, nil
}

// validateYAMLStructure validates the YAML structure of a SIGMA rule
func (v *SigmaValidator) validateYAMLStructure(content string) (map[string]interface{}, error) {
    var parsedYAML map[string]interface{}
    
    decoder := yaml.NewDecoder(strings.NewReader(content))
    decoder.KnownFields(true) // Strict mode to catch unknown fields

    if err := decoder.Decode(&parsedYAML); err != nil {
        return nil, fmt.Errorf("YAML parsing error: %w", err)
    }

    return parsedYAML, nil
}

// validateSigmaFields performs comprehensive validation of SIGMA rule fields
func (v *SigmaValidator) validateSigmaFields(rule map[string]interface{}) ([]models.ValidationIssue, float64, error) {
    var issues []models.ValidationIssue
    confidenceScore := 100.0

    // Validate required fields
    for _, field := range requiredSigmaFields {
        if _, exists := rule[field]; !exists {
            issues = append(issues, models.ValidationIssue{
                Message:   fmt.Sprintf("Missing required field: %s", field),
                Severity:  models.ValidationSeverityHigh,
                Location:  field,
                IssueCode: "SIGMA003",
                Remediation: fmt.Sprintf("Add the required %s field to the detection", field),
            })
            confidenceScore -= v.confidenceWeights["required_fields"] / float64(len(requiredSigmaFields))
        }
    }

    // Validate logsource configuration
    if logsource, ok := rule["logsource"].(map[string]interface{}); ok {
        if err := v.validateLogsource(logsource, &issues, &confidenceScore); err != nil {
            return issues, confidenceScore, err
        }
    }

    // Validate detection section
    if detection, ok := rule["detection"].(map[string]interface{}); ok {
        if err := v.validateDetection(detection, &issues, &confidenceScore); err != nil {
            return issues, confidenceScore, err
        }
    }

    // Ensure confidence score doesn't go below 0
    if confidenceScore < 0 {
        confidenceScore = 0
    }

    return issues, confidenceScore, nil
}

// validateLogsource validates the logsource configuration
func (v *SigmaValidator) validateLogsource(logsource map[string]interface{}, issues *[]models.ValidationIssue, confidenceScore *float64) error {
    requiredLogsourceFields := []string{"product", "service"}
    
    for _, field := range requiredLogsourceFields {
        if _, exists := logsource[field]; !exists {
            *issues = append(*issues, models.ValidationIssue{
                Message:   fmt.Sprintf("Missing logsource %s field", field),
                Severity:  models.ValidationSeverityMedium,
                Location:  fmt.Sprintf("logsource.%s", field),
                IssueCode: "SIGMA004",
                Remediation: fmt.Sprintf("Specify the %s in the logsource configuration", field),
            })
            *confidenceScore -= v.confidenceWeights["logsource"] / float64(len(requiredLogsourceFields))
        }
    }

    return nil
}

// validateDetection validates the detection logic section
func (v *SigmaValidator) validateDetection(detection map[string]interface{}, issues *[]models.ValidationIssue, confidenceScore *float64) error {
    // Validate condition field
    if condition, exists := detection["condition"]; !exists || condition == "" {
        *issues = append(*issues, models.ValidationIssue{
            Message:   "Missing or empty detection condition",
            Severity:  models.ValidationSeverityHigh,
            Location:  "detection.condition",
            IssueCode: "SIGMA005",
            Remediation: "Add a valid detection condition",
        })
        *confidenceScore -= v.confidenceWeights["detection_logic"]
    }

    // Validate search identifiers
    hasSearchIdentifiers := false
    for key, value := range detection {
        if key != "condition" {
            hasSearchIdentifiers = true
            if err := v.validateSearchIdentifier(key, value, issues, confidenceScore); err != nil {
                return err
            }
        }
    }

    if !hasSearchIdentifiers {
        *issues = append(*issues, models.ValidationIssue{
            Message:   "No search identifiers found in detection",
            Severity:  models.ValidationSeverityHigh,
            Location:  "detection",
            IssueCode: "SIGMA006",
            Remediation: "Add at least one search identifier with detection criteria",
        })
        *confidenceScore -= v.confidenceWeights["detection_logic"]
    }

    return nil
}

// validateSearchIdentifier validates individual search identifier sections
func (v *SigmaValidator) validateSearchIdentifier(key string, value interface{}, issues *[]models.ValidationIssue, confidenceScore *float64) error {
    searchCriteria, ok := value.(map[string]interface{})
    if !ok {
        *issues = append(*issues, models.ValidationIssue{
            Message:   fmt.Sprintf("Invalid search identifier format: %s", key),
            Severity:  models.ValidationSeverityMedium,
            Location:  fmt.Sprintf("detection.%s", key),
            IssueCode: "SIGMA007",
            Remediation: "Ensure search identifier contains valid field mappings",
        })
        *confidenceScore -= v.confidenceWeights["field_mappings"] / 2
        return nil
    }

    if len(searchCriteria) == 0 {
        *issues = append(*issues, models.ValidationIssue{
            Message:   fmt.Sprintf("Empty search criteria in identifier: %s", key),
            Severity:  models.ValidationSeverityMedium,
            Location:  fmt.Sprintf("detection.%s", key),
            IssueCode: "SIGMA008",
            Remediation: "Add search criteria to the identifier",
        })
        *confidenceScore -= v.confidenceWeights["field_mappings"] / 2
    }

    return nil
}