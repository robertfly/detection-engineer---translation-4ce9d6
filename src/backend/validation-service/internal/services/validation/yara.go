// Package validation provides validation services for various detection formats
package validation

import (
    "regexp"
    "strings"
    "fmt"

    "internal/models"
    "pkg/utils"
)

// Regular expression patterns for YARA rule validation
var (
    // Validates overall YARA rule structure
    yaraRulePattern = regexp.MustCompile(`^(?:(?:global|private)\s+)?rule\s+[a-zA-Z0-9_]+\s*(?::\s*[a-zA-Z0-9_]+)?\s*{[\s\S]*}`)

    // Validates YARA rule identifier naming
    yaraIdentifierPattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]{0,127}$`)

    // Validates string definitions in YARA rules
    yaraStringPattern = regexp.MustCompile(`\$[a-zA-Z0-9_]*\s*=\s*(?:"[^"]*"|{[^}]*}|/[^/]*/|/[^/]*/[ismx]*)`)

    // Validates condition section syntax
    yaraConditionPattern = regexp.MustCompile(`condition:\s*(?:[\s\S]*?)(?:(?=meta:)|(?=strings:)|$)`)

    // Validates meta section format
    yaraMetaPattern = regexp.MustCompile(`meta:\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*(?:"[^"]*"|\d+|true|false)\s*)*`)
)

// Reserved keywords that cannot be used as rule identifiers
var yaraReservedKeywords = map[string]bool{
    "all": true, "and": true, "any": true, "ascii": true, "at": true,
    "condition": true, "contains": true, "entrypoint": true, "false": true,
    "filesize": true, "fullword": true, "for": true, "global": true,
    "in": true, "import": true, "include": true, "int8": true, "int16": true,
    "int32": true, "int8be": true, "int16be": true, "int32be": true,
    "matches": true, "meta": true, "nocase": true, "not": true, "or": true,
    "of": true, "private": true, "rule": true, "strings": true, "them": true,
    "true": true, "uint8": true, "uint16": true, "uint32": true,
    "uint8be": true, "uint16be": true, "uint32be": true, "wide": true,
}

// ValidateYARARule performs comprehensive validation of a YARA rule
func ValidateYARARule(detection *models.Detection) (*models.ValidationResult, error) {
    // Create new validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, utils.WrapError(err, "failed to create validation result")
    }

    // Get and sanitize content
    content, err := detection.GetContent()
    if err != nil {
        return nil, utils.WrapError(err, "failed to get detection content")
    }
    content = utils.SanitizeInput(content)

    // Validate content size
    if err := utils.ValidateDetectionSize(content); err != nil {
        return nil, utils.WrapError(err, "content size validation failed")
    }

    // Validate overall rule structure
    if !yaraRulePattern.MatchString(content) {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Invalid YARA rule structure",
            Severity:    models.ValidationSeverityHigh,
            Location:    "rule",
            IssueCode:   "YARA001",
            Remediation: "Ensure rule follows the format: [private|global] rule name [: tag] { ... }",
        })
    }

    // Extract and validate rule identifier
    identifier := extractRuleIdentifier(content)
    if err := validateRuleIdentifier(identifier); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     fmt.Sprintf("Invalid rule identifier: %s", err.Error()),
            Severity:    models.ValidationSeverityHigh,
            Location:    "identifier",
            IssueCode:   "YARA002",
            Remediation: "Use alphanumeric characters and underscores, start with letter/underscore",
        })
    }

    // Validate meta section if present
    if strings.Contains(content, "meta:") {
        if !yaraMetaPattern.MatchString(content) {
            result.AddIssue(&models.ValidationIssue{
                Message:     "Invalid meta section format",
                Severity:    models.ValidationSeverityMedium,
                Location:    "meta",
                IssueCode:   "YARA003",
                Remediation: "Ensure meta entries follow format: identifier = value",
            })
        }
    }

    // Validate string definitions
    stringIssues, err := validateStringDefinitions(content)
    if err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     fmt.Sprintf("String validation error: %s", err.Error()),
            Severity:    models.ValidationSeverityHigh,
            Location:    "strings",
            IssueCode:   "YARA004",
            Remediation: "Check string syntax and ensure unique identifiers",
        })
    }
    for _, issue := range stringIssues {
        result.AddIssue(&models.ValidationIssue{
            Message:     issue,
            Severity:    models.ValidationSeverityMedium,
            Location:    "strings",
            IssueCode:   "YARA005",
            Remediation: "Review string definition syntax and modifiers",
        })
    }

    // Validate condition section
    conditionIssues, err := validateCondition(content)
    if err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     fmt.Sprintf("Condition validation error: %s", err.Error()),
            Severity:    models.ValidationSeverityHigh,
            Location:    "condition",
            IssueCode:   "YARA006",
            Remediation: "Check condition syntax and referenced string variables",
        })
    }
    for _, issue := range conditionIssues {
        result.AddIssue(&models.ValidationIssue{
            Message:     issue,
            Severity:    models.ValidationSeverityMedium,
            Location:    "condition",
            IssueCode:   "YARA007",
            Remediation: "Review condition logic and operators",
        })
    }

    // Calculate final confidence score based on validation results
    calculateConfidenceScore(result)

    return result, nil
}

// validateRuleIdentifier validates the YARA rule identifier
func validateRuleIdentifier(identifier string) error {
    if identifier == "" {
        return fmt.Errorf("empty rule identifier")
    }

    if !yaraIdentifierPattern.MatchString(identifier) {
        return fmt.Errorf("invalid identifier format")
    }

    if len(identifier) > 128 {
        return fmt.Errorf("identifier exceeds maximum length of 128 characters")
    }

    if yaraReservedKeywords[strings.ToLower(identifier)] {
        return fmt.Errorf("identifier is a reserved keyword")
    }

    return nil
}

// validateStringDefinitions performs comprehensive validation of YARA string definitions
func validateStringDefinitions(content string) ([]string, error) {
    var issues []string
    
    // Extract string section
    stringSection := extractStringSection(content)
    if stringSection == "" {
        return nil, nil // No strings section, which is valid
    }

    // Track string identifiers for uniqueness
    stringIDs := make(map[string]bool)

    // Find all string definitions
    matches := yaraStringPattern.FindAllString(stringSection, -1)
    for _, match := range matches {
        // Extract string identifier
        parts := strings.SplitN(match, "=", 2)
        if len(parts) != 2 {
            issues = append(issues, "Invalid string definition format")
            continue
        }

        identifier := strings.TrimSpace(parts[0])
        if stringIDs[identifier] {
            issues = append(issues, fmt.Sprintf("Duplicate string identifier: %s", identifier))
        }
        stringIDs[identifier] = true

        // Validate string content
        content := strings.TrimSpace(parts[1])
        if err := validateStringContent(content); err != nil {
            issues = append(issues, err.Error())
        }
    }

    return issues, nil
}

// validateCondition validates the YARA rule condition section
func validateCondition(content string) ([]string, error) {
    var issues []string

    // Extract condition section
    match := yaraConditionPattern.FindString(content)
    if match == "" {
        return nil, fmt.Errorf("missing condition section")
    }

    // Remove 'condition:' prefix and trim
    condition := strings.TrimPrefix(match, "condition:")
    condition = strings.TrimSpace(condition)

    // Validate condition syntax
    if err := validateConditionSyntax(condition); err != nil {
        issues = append(issues, err.Error())
    }

    // Validate referenced strings exist
    stringRefs := extractStringReferences(condition)
    definedStrings := extractDefinedStrings(content)
    for _, ref := range stringRefs {
        if !definedStrings[ref] {
            issues = append(issues, fmt.Sprintf("Referenced string not defined: %s", ref))
        }
    }

    return issues, nil
}

// Helper functions

func extractRuleIdentifier(content string) string {
    // Extract identifier from rule declaration
    ruleDecl := regexp.MustCompile(`rule\s+([a-zA-Z0-9_]+)`).FindStringSubmatch(content)
    if len(ruleDecl) > 1 {
        return ruleDecl[1]
    }
    return ""
}

func extractStringSection(content string) string {
    // Extract strings section between 'strings:' and next section or end
    re := regexp.MustCompile(`strings:\s*([\s\S]*?)(?:(?=meta:)|(?=condition:)|$)`)
    match := re.FindStringSubmatch(content)
    if len(match) > 1 {
        return match[1]
    }
    return ""
}

func validateStringContent(content string) error {
    // Validate string content based on type (text, hex, regex)
    switch {
    case strings.HasPrefix(content, "\""):
        return validateTextString(content)
    case strings.HasPrefix(content, "{"):
        return validateHexString(content)
    case strings.HasPrefix(content, "/"):
        return validateRegexString(content)
    default:
        return fmt.Errorf("invalid string content format")
    }
}

func validateConditionSyntax(condition string) error {
    // Basic condition syntax validation
    if condition == "" {
        return fmt.Errorf("empty condition")
    }

    // Check for balanced parentheses
    if !hasBalancedParentheses(condition) {
        return fmt.Errorf("unbalanced parentheses in condition")
    }

    return nil
}

func hasBalancedParentheses(s string) bool {
    count := 0
    for _, c := range s {
        if c == '(' {
            count++
        } else if c == ')' {
            count--
            if count < 0 {
                return false
            }
        }
    }
    return count == 0
}

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
    result.SetConfidenceScore(confidence)
}