// Package validation provides validation services for different detection formats
package validation

import (
    "encoding/json" // builtin
    "regexp"        // builtin
    "strings"       // builtin
    "time"         // builtin

    "github.com/your-org/detection-translator/internal/models"
    "github.com/your-org/detection-translator/pkg/utils"
    "github.com/your-org/detection-translator/pkg/logger"
)

// Constants for Crowdstrike detection validation
const (
    // Version of the Crowdstrike detection format supported
    crowdstrikeFormatVersion = "1.0"

    // Maximum validation timeout duration
    validationTimeout = 30 * time.Second
)

// Validation constants for Crowdstrike detections
var (
    // Valid event types supported by Crowdstrike
    validEventTypes = []string{
        "Process", "Network", "File", "Registry", 
        "DNS", "Authentication", "Behavioral",
    }

    // Required fields in a Crowdstrike detection
    requiredFields = []string{
        "event_type", "detection_name", "severity",
        "description", "mitre_attack",
    }

    // Pattern for valid field names
    fieldNamePattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{0,63}$`)

    // Valid severity levels
    validSeverityLevels = []string{
        "Low", "Medium", "High", "Critical",
    }
)

// ValidateCrowdstrikeDetection performs comprehensive validation of Crowdstrike detection rules
func ValidateCrowdstrikeDetection(detection *models.Detection) (*models.ValidationResult, error) {
    log := logger.GetLogger().With(
        "function", "ValidateCrowdstrikeDetection",
        "detection_id", detection.ID,
    )

    // Initialize validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, utils.WrapError(err, "failed to create validation result")
    }

    // Set up validation timeout
    timeoutChan := time.After(validationTimeout)
    doneChan := make(chan struct{})

    // Run validation in goroutine
    go func() {
        defer close(doneChan)

        // Parse detection content
        var content map[string]interface{}
        if err := json.Unmarshal([]byte(detection.Content), &content); err != nil {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Invalid JSON format in detection content",
                Severity:    models.ValidationSeverityHigh,
                Location:    "content",
                IssueCode:   "CS001",
                Remediation: "Ensure detection content is valid JSON",
            })
            return
        }

        // Validate format version
        if err := validateFormatVersion(content); err != nil {
            result.AddIssue(&models.ValidationIssue{
                Message:     err.Error(),
                Severity:    models.ValidationSeverityHigh,
                Location:    "format_version",
                IssueCode:   "CS002",
                Remediation: "Update detection to use format version " + crowdstrikeFormatVersion,
            })
        }

        // Validate required fields
        if err := validateRequiredFields(content, result); err != nil {
            log.Error("Required fields validation failed", "error", err)
        }

        // Validate event type
        if eventType, ok := content["event_type"].(string); ok {
            if !isValidEventType(eventType) {
                result.AddIssue(&models.ValidationIssue{
                    Message:     "Invalid event type: " + eventType,
                    Severity:    models.ValidationSeverityHigh,
                    Location:    "event_type",
                    IssueCode:   "CS003",
                    Remediation: "Use one of the valid event types: " + strings.Join(validEventTypes, ", "),
                })
            }
        }

        // Validate field mappings
        if err := validateFieldMappings(content, result); err != nil {
            log.Error("Field mappings validation failed", "error", err)
        }

        // Validate severity level
        if severity, ok := content["severity"].(string); ok {
            if !isValidSeverityLevel(severity) {
                result.AddIssue(&models.ValidationIssue{
                    Message:     "Invalid severity level: " + severity,
                    Severity:    models.ValidationSeverityHigh,
                    Location:    "severity",
                    IssueCode:   "CS004",
                    Remediation: "Use one of the valid severity levels: " + strings.Join(validSeverityLevels, ", "),
                })
            }
        }

        // Validate MITRE ATT&CK mapping
        if mitre, ok := content["mitre_attack"].([]interface{}); ok {
            validateMitreMapping(mitre, result)
        }

        // Calculate final confidence score based on validation results
        calculateConfidenceScore(result)
    }()

    // Wait for validation completion or timeout
    select {
    case <-timeoutChan:
        return nil, utils.NewValidationError("validation timeout exceeded", 1001)
    case <-doneChan:
        return result, nil
    }
}

// validateFormatVersion checks if the detection uses a supported format version
func validateFormatVersion(content map[string]interface{}) error {
    version, ok := content["format_version"].(string)
    if !ok {
        return utils.NewValidationError("missing format version", 1002)
    }
    if version != crowdstrikeFormatVersion {
        return utils.NewValidationError("unsupported format version: "+version, 1003)
    }
    return nil
}

// validateRequiredFields checks for presence and validity of required fields
func validateRequiredFields(content map[string]interface{}, result *models.ValidationResult) error {
    for _, field := range requiredFields {
        if value, exists := content[field]; !exists || value == nil {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Missing required field: " + field,
                Severity:    models.ValidationSeverityHigh,
                Location:    field,
                IssueCode:   "CS005",
                Remediation: "Add the required field: " + field,
            })
        }
    }
    return nil
}

// validateFieldMappings validates field names and their data types
func validateFieldMappings(content map[string]interface{}, result *models.ValidationResult) error {
    fields, ok := content["fields"].(map[string]interface{})
    if !ok {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Missing or invalid fields section",
            Severity:    models.ValidationSeverityHigh,
            Location:    "fields",
            IssueCode:   "CS006",
            Remediation: "Add a valid fields section with field mappings",
        })
        return nil
    }

    for fieldName, fieldValue := range fields {
        // Validate field name format
        if !fieldNamePattern.MatchString(fieldName) {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Invalid field name format: " + fieldName,
                Severity:    models.ValidationSeverityMedium,
                Location:    "fields." + fieldName,
                IssueCode:   "CS007",
                Remediation: "Field names must start with a letter and contain only letters, numbers, and underscores",
            })
        }

        // Validate field value type
        validateFieldValueType(fieldName, fieldValue, result)
    }

    return nil
}

// validateFieldValueType checks if field values have valid types
func validateFieldValueType(fieldName string, fieldValue interface{}, result *models.ValidationResult) {
    switch v := fieldValue.(type) {
    case string, float64, bool:
        // Valid primitive types
        return
    case []interface{}:
        // Validate array elements
        for i, elem := range v {
            validateFieldValueType(fmt.Sprintf("%s[%d]", fieldName, i), elem, result)
        }
    case map[string]interface{}:
        // Validate nested object fields
        for key, val := range v {
            validateFieldValueType(fmt.Sprintf("%s.%s", fieldName, key), val, result)
        }
    default:
        result.AddIssue(&models.ValidationIssue{
            Message:     fmt.Sprintf("Invalid field value type for %s", fieldName),
            Severity:    models.ValidationSeverityMedium,
            Location:    "fields." + fieldName,
            IssueCode:   "CS008",
            Remediation: "Use only supported data types: string, number, boolean, array, or object",
        })
    }
}

// isValidEventType checks if the event type is supported
func isValidEventType(eventType string) bool {
    for _, valid := range validEventTypes {
        if eventType == valid {
            return true
        }
    }
    return false
}

// isValidSeverityLevel checks if the severity level is valid
func isValidSeverityLevel(severity string) bool {
    for _, valid := range validSeverityLevels {
        if severity == valid {
            return true
        }
    }
    return false
}

// validateMitreMapping validates MITRE ATT&CK technique references
func validateMitreMapping(mitre []interface{}, result *models.ValidationResult) {
    for i, technique := range mitre {
        if t, ok := technique.(map[string]interface{}); ok {
            if id, exists := t["technique_id"].(string); exists {
                if !isMitreTechniqueValid(id) {
                    result.AddIssue(&models.ValidationIssue{
                        Message:     "Invalid MITRE ATT&CK technique ID: " + id,
                        Severity:    models.ValidationSeverityMedium,
                        Location:    fmt.Sprintf("mitre_attack[%d].technique_id", i),
                        IssueCode:   "CS009",
                        Remediation: "Use a valid MITRE ATT&CK technique ID",
                    })
                }
            }
        }
    }
}

// isMitreTechniqueValid validates MITRE ATT&CK technique ID format
func isMitreTechniqueValid(id string) bool {
    // Basic format validation for MITRE technique IDs (e.g., T1234)
    return regexp.MustCompile(`^T\d{4}(\.\d{3})?$`).MatchString(id)
}

// calculateConfidenceScore computes the final confidence score
func calculateConfidenceScore(result *models.ValidationResult) {
    // Start with maximum confidence
    confidence := 100.0

    // Reduce confidence based on issue severity
    for _, issue := range result.Issues {
        switch issue.Severity {
        case models.ValidationSeverityHigh:
            confidence -= 20.0
        case models.ValidationSeverityMedium:
            confidence -= 10.0
        case models.ValidationSeverityLow:
            confidence -= 5.0
        }
    }

    // Ensure confidence stays within bounds
    if confidence < 0 {
        confidence = 0
    }

    result.SetConfidence(confidence)
}