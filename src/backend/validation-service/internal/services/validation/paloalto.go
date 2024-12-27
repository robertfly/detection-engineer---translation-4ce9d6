// Package validation provides format-specific validation implementations
// Version: 1.0.0
package validation

import (
    "context"
    "regexp"
    "strings"
    "sync"

    "validation-service/internal/models"
    "validation-service/pkg/logger"
    "validation-service/pkg/metrics"
)

// PaloAltoValidator implements format-specific validation for Palo Alto Networks rules
type PaloAltoValidator struct {
    requiredFieldPatterns map[string]*regexp.Regexp
    validLogTypes        map[string]struct{}
    fieldWeights         map[string]float64
    patternCache         *sync.RWMutex
}

// Global validator instance
var paloAltoValidator *PaloAltoValidator

// Required field patterns for Palo Alto Networks rules
var requiredFieldPatterns = map[string]string{
    "rule_name":      `^[a-zA-Z0-9-_]{1,64}$`,
    "log_type":       `^(traffic|threat|url|data|wildfire|tunnel|auth|sctp|hip|userid|gtp|iptag|decryption)$`,
    "description":    `.{1,1024}`,
    "severity":       `^(informational|low|medium|high|critical)$`,
    "source_zone":    `^[a-zA-Z0-9-_]{1,31}$`,
    "destination_zone": `^[a-zA-Z0-9-_]{1,31}$`,
    "source_address": `^(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?$|^any$`,
    "destination_address": `^(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?$|^any$`,
    "application":    `^[a-zA-Z0-9-_]{1,32}$`,
    "service":        `^(tcp|udp|icmp|application-default|any)$`,
}

// Valid log types for Palo Alto Networks rules
var validLogTypes = map[string]struct{}{
    "traffic":     {},
    "threat":      {},
    "url":         {},
    "data":        {},
    "wildfire":    {},
    "tunnel":      {},
    "auth":        {},
    "sctp":        {},
    "hip":         {},
    "userid":      {},
    "gtp":         {},
    "iptag":       {},
    "decryption":  {},
}

// Field weights for confidence score calculation
var fieldWeights = map[string]float64{
    "rule_name":      10.0,
    "log_type":       15.0,
    "description":    5.0,
    "severity":       10.0,
    "source_zone":    8.0,
    "destination_zone": 8.0,
    "source_address": 12.0,
    "destination_address": 12.0,
    "application":    10.0,
    "service":        10.0,
}

// init initializes the Palo Alto validator with enhanced validation patterns
func init() {
    paloAltoValidator = &PaloAltoValidator{
        requiredFieldPatterns: make(map[string]*regexp.Regexp),
        validLogTypes:        validLogTypes,
        fieldWeights:         fieldWeights,
        patternCache:         &sync.RWMutex{},
    }

    // Compile regex patterns
    for field, pattern := range requiredFieldPatterns {
        compiled, err := regexp.Compile(pattern)
        if err != nil {
            logger.GetLogger().Error("Failed to compile regex pattern",
                "field", field,
                "pattern", pattern,
                "error", err,
            )
            continue
        }
        paloAltoValidator.requiredFieldPatterns[field] = compiled
    }
}

// Validate performs comprehensive validation of Palo Alto Networks format detection rules
func (v *PaloAltoValidator) Validate(ctx context.Context, detection *models.Detection) (*models.ValidationResult, error) {
    // Record validation request metric
    if err := metrics.RecordValidationRequest("paloalto"); err != nil {
        logger.GetLogger().Error("Failed to record validation request metric", "error", err)
    }

    // Create validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, err
    }

    // Get detection content
    content, err := detection.GetContent()
    if err != nil {
        return nil, err
    }

    // Validate log type
    if logType, issue := v.validateLogType(content); !logType {
        result.AddIssue(&issue)
    }

    // Validate required fields
    issues := v.validateRequiredFields(content)
    for _, issue := range issues {
        result.AddIssue(&issue)
    }

    // Calculate confidence score
    result.ConfidenceScore = v.calculateConfidenceScore(issues)

    // Record validation metrics
    duration := result.Metadata.ValidationTime
    if err := metrics.RecordValidationDuration("paloalto", duration); err != nil {
        logger.GetLogger().Error("Failed to record validation duration metric", "error", err)
    }

    if len(issues) > 0 {
        if err := metrics.RecordValidationError("paloalto", "validation"); err != nil {
            logger.GetLogger().Error("Failed to record validation error metric", "error", err)
        }
    }

    return result, nil
}

// validateLogType validates if the log type specified in the rule is supported
func (v *PaloAltoValidator) validateLogType(content string) (bool, models.ValidationIssue) {
    logType := extractLogType(content)
    if logType == "" {
        return false, models.ValidationIssue{
            Message:     "Missing required log type",
            Severity:    models.ValidationSeverityHigh,
            Location:    "log_type",
            IssueCode:   "PA001",
            Remediation: "Specify a valid log type (traffic, threat, url, etc.)",
        }
    }

    if _, valid := v.validLogTypes[logType]; !valid {
        return false, models.ValidationIssue{
            Message:     "Invalid log type specified",
            Severity:    models.ValidationSeverityHigh,
            Location:    "log_type",
            IssueCode:   "PA002",
            Remediation: "Use one of the supported log types: traffic, threat, url, data, wildfire, tunnel, auth, sctp, hip, userid, gtp, iptag, decryption",
        }
    }

    return true, models.ValidationIssue{}
}

// validateRequiredFields validates presence and format of required fields
func (v *PaloAltoValidator) validateRequiredFields(content string) []models.ValidationIssue {
    var issues []models.ValidationIssue

    for field, pattern := range v.requiredFieldPatterns {
        value := extractFieldValue(content, field)
        if value == "" {
            issues = append(issues, models.ValidationIssue{
                Message:     "Missing required field: " + field,
                Severity:    models.ValidationSeverityHigh,
                Location:    field,
                IssueCode:   "PA003",
                Remediation: "Add the required field: " + field,
            })
            continue
        }

        if !pattern.MatchString(value) {
            issues = append(issues, models.ValidationIssue{
                Message:     "Invalid format for field: " + field,
                Severity:    models.ValidationSeverityMedium,
                Location:    field,
                IssueCode:   "PA004",
                Remediation: "Update field format to match required pattern: " + pattern.String(),
            })
        }
    }

    return issues
}

// calculateConfidenceScore calculates weighted confidence score based on validation results
func (v *PaloAltoValidator) calculateConfidenceScore(issues []models.ValidationIssue) float64 {
    baseScore := 100.0
    
    for _, issue := range issues {
        weight := v.fieldWeights[issue.Location]
        switch issue.Severity {
        case models.ValidationSeverityHigh:
            baseScore -= weight * 1.0
        case models.ValidationSeverityMedium:
            baseScore -= weight * 0.5
        case models.ValidationSeverityLow:
            baseScore -= weight * 0.2
        }
    }

    // Ensure score stays within bounds
    if baseScore < 0 {
        return 0
    }
    if baseScore > 100 {
        return 100
    }
    return baseScore
}

// Helper function to extract log type from content
func extractLogType(content string) string {
    // Implementation would parse the content to extract log type
    // This is a placeholder - actual implementation would depend on the rule format
    return ""
}

// Helper function to extract field value from content
func extractFieldValue(content string, field string) string {
    // Implementation would parse the content to extract field value
    // This is a placeholder - actual implementation would depend on the rule format
    return ""
}