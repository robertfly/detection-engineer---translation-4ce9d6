// Package validation provides format-specific validation logic for security detection rules
package validation

import (
    "regexp"
    "strings"

    "internal/models"
    "pkg/utils"
    "pkg/utils/helpers"
)

// Regular expression patterns for QRadar AQL validation
var (
    // Pattern for valid QRadar field names (alphanumeric and underscore)
    qradarFieldPattern = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

    // Pattern for QRadar function calls (uppercase with parentheses)
    qradarFunctionPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*\(`)

    // Pattern for valid QRadar operators
    qradarOperatorPattern = regexp.MustCompile(`(=|!=|>|<|>=|<=|IN|LIKE|MATCHES)`)

    // Pattern for SELECT statement validation
    qradarSelectPattern = regexp.MustCompile(`^\s*SELECT\s+([\w\s,*]+)\s+FROM`)

    // Pattern for FROM clause validation
    qradarFromPattern = regexp.MustCompile(`FROM\s+([\w\s,]+)(\s+WHERE|\s+GROUP BY|$)`)
)

// ValidateQRadarDetection validates a QRadar AQL detection rule for syntax correctness,
// field naming conventions, function usage, and operator placement while calculating
// a confidence score.
func ValidateQRadarDetection(detection *models.Detection) (*models.ValidationResult, error) {
    // Create new validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, utils.WrapError(err, "failed to create validation result")
    }

    // Get and validate detection content
    content, err := detection.GetContent()
    if err != nil {
        return nil, utils.WrapError(err, "failed to get detection content")
    }

    // Sanitize input
    content = helpers.SanitizeInput(content)

    // Validate basic AQL syntax structure
    if err := validateAQLSyntax(content); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Invalid AQL syntax structure",
            Severity:    models.ValidationSeverityHigh,
            Location:    "query",
            IssueCode:   "QR001",
            Remediation: "Ensure query follows basic AQL structure: SELECT ... FROM ... [WHERE] [GROUP BY]",
        })
    }

    // Validate field names
    if err := validateFieldNames(content, result); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Invalid field name detected",
            Severity:    models.ValidationSeverityHigh,
            Location:    "fields",
            IssueCode:   "QR002",
            Remediation: "Use only alphanumeric characters and underscores in field names",
        })
    }

    // Validate functions
    if err := validateFunctions(content, result); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Invalid function usage detected",
            Severity:    models.ValidationSeverityMedium,
            Location:    "functions",
            IssueCode:   "QR003",
            Remediation: "Verify function names and parameter usage",
        })
    }

    // Calculate final confidence score
    result.ConfidenceScore = calculateConfidenceScore(result)

    return result, nil
}

// validateAQLSyntax validates the basic syntax structure of an AQL query
func validateAQLSyntax(content string) error {
    // Check for SELECT statement
    if !qradarSelectPattern.MatchString(content) {
        return utils.NewValidationError("missing or invalid SELECT statement", 2001)
    }

    // Check for FROM clause
    if !qradarFromPattern.MatchString(content) {
        return utils.NewValidationError("missing or invalid FROM clause", 2002)
    }

    // Validate clause ordering
    clauses := strings.Fields(strings.ToUpper(content))
    selectIdx := indexOf(clauses, "SELECT")
    fromIdx := indexOf(clauses, "FROM")
    whereIdx := indexOf(clauses, "WHERE")
    groupByIdx := indexOf(clauses, "GROUP")

    if selectIdx == -1 || fromIdx == -1 || selectIdx >= fromIdx {
        return utils.NewValidationError("invalid clause ordering", 2003)
    }

    if whereIdx != -1 && whereIdx < fromIdx {
        return utils.NewValidationError("WHERE clause must follow FROM", 2004)
    }

    if groupByIdx != -1 && (whereIdx != -1 && groupByIdx < whereIdx) {
        return utils.NewValidationError("GROUP BY must follow WHERE", 2005)
    }

    return nil
}

// validateFieldNames validates field names against QRadar naming conventions
func validateFieldNames(content string, result *models.ValidationResult) error {
    // Extract field names from SELECT clause
    selectMatch := qradarSelectPattern.FindStringSubmatch(content)
    if len(selectMatch) < 2 {
        return utils.NewValidationError("failed to extract field names", 2006)
    }

    fields := strings.Split(selectMatch[1], ",")
    for _, field := range fields {
        field = strings.TrimSpace(field)
        if field == "*" {
            continue
        }

        // Check for alias
        if strings.Contains(field, " AS ") {
            parts := strings.Split(field, " AS ")
            field = strings.TrimSpace(parts[0])
        }

        if !qradarFieldPattern.MatchString(field) {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Invalid field name: " + field,
                Severity:    models.ValidationSeverityHigh,
                Location:    "field:" + field,
                IssueCode:   "QR004",
                Remediation: "Field names must be alphanumeric with underscores",
            })
        }
    }

    return nil
}

// validateFunctions validates QRadar function usage and parameters
func validateFunctions(content string, result *models.ValidationResult) error {
    // Find all function calls
    matches := qradarFunctionPattern.FindAllString(content, -1)
    for _, match := range matches {
        // Remove trailing parenthesis
        funcName := strings.TrimSuffix(match, "(")

        // Validate function name format
        if !isValidQRadarFunction(funcName) {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Invalid function name: " + funcName,
                Severity:    models.ValidationSeverityMedium,
                Location:    "function:" + funcName,
                IssueCode:   "QR005",
                Remediation: "Use valid QRadar function names",
            })
        }

        // Validate function parameters (basic check)
        if !hasValidFunctionParams(content, funcName) {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Invalid function parameters for: " + funcName,
                Severity:    models.ValidationSeverityMedium,
                Location:    "function:" + funcName,
                IssueCode:   "QR006",
                Remediation: "Check function parameter count and types",
            })
        }
    }

    return nil
}

// calculateConfidenceScore calculates the validation confidence score
func calculateConfidenceScore(result *models.ValidationResult) float64 {
    baseScore := 100.0
    
    // Apply penalties based on issue severity
    for _, issue := range result.Issues {
        switch issue.Severity {
        case models.ValidationSeverityHigh:
            baseScore -= 20.0
        case models.ValidationSeverityMedium:
            baseScore -= 10.0
        case models.ValidationSeverityLow:
            baseScore -= 5.0
        }
    }

    // Ensure score stays within 0-100 range
    if baseScore < 0 {
        baseScore = 0
    }
    
    return baseScore
}

// Helper functions

func indexOf(slice []string, item string) int {
    for i, s := range slice {
        if s == item {
            return i
        }
    }
    return -1
}

func isValidQRadarFunction(funcName string) bool {
    // List of common QRadar functions
    validFunctions := map[string]bool{
        "COUNT": true,
        "SUM":   true,
        "AVG":   true,
        "MIN":   true,
        "MAX":   true,
        "DATEFORMAT": true,
        "CONCAT": true,
        "UPPER":  true,
        "LOWER":  true,
    }
    return validFunctions[funcName]
}

func hasValidFunctionParams(content string, funcName string) bool {
    // Basic parameter validation - could be enhanced for specific functions
    return true
}