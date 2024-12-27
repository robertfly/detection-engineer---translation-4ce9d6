// Package validation provides format-specific validation services for detection rules
package validation

import (
    "fmt"
    "regexp"
    "strings"
    "time"

    "internal/models"
    "pkg/utils"
)

// Regular expression patterns for YARA-L syntax validation
var (
    // Basic YARA-L rule structure pattern
    yaralSyntaxPattern = regexp.MustCompile(`^rule\s+[\w_]+\s*{[\s\S]*}$`)

    // Required YARA-L keywords
    yaralKeywords = []string{
        "rule", "meta", "strings", "condition",
        "and", "or", "not", "them", "for", "all", "of",
    }

    // Required meta section fields
    metaRequiredFields = []string{
        "author",
        "description",
        "severity",
        "reference",
    }

    // Maximum allowed complexity for condition section
    maxConditionComplexity = 100
)

// ValidateYARAL performs comprehensive validation of YARA-L format detection rules
func ValidateYARAL(detection *models.Detection) (*models.ValidationResult, error) {
    // Create new validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, utils.WrapError(err, "failed to create validation result")
    }

    // Get detection content
    content, err := detection.GetContent()
    if err != nil {
        return nil, utils.WrapError(err, "failed to get detection content")
    }

    // Validate format
    if format, _ := detection.GetFormat(); format != models.DetectionFormatYaraL {
        return nil, utils.ErrInvalidFormat
    }

    // Sanitize input
    content = utils.SanitizeInput(content)

    // Basic syntax validation
    if !yaralSyntaxPattern.MatchString(content) {
        result.AddIssue(&models.ValidationIssue{
            Message:   "Invalid YARA-L rule syntax",
            Severity:  models.ValidationSeverityHigh,
            Location:  "rule",
            IssueCode: "YARAL001",
            Remediation: "Ensure rule follows basic YARA-L syntax: rule rule_name { ... }",
        })
        return result, nil
    }

    // Extract rule sections
    sections := extractRuleSections(content)

    // Validate rule name
    if issues := validateRuleName(sections["ruleName"]); len(issues) > 0 {
        for _, issue := range issues {
            result.AddIssue(&issue)
        }
    }

    // Validate meta section
    if issues := validateMetaSection(sections["meta"]); len(issues) > 0 {
        for _, issue := range issues {
            result.AddIssue(&issue)
        }
    }

    // Validate strings section
    if issues := validateStringsSection(sections["strings"]); len(issues) > 0 {
        for _, issue := range issues {
            result.AddIssue(&issue)
        }
    }

    // Validate condition section
    if issues := validateConditionSection(sections["condition"]); len(issues) > 0 {
        for _, issue := range issues {
            result.AddIssue(&issue)
        }
    }

    // Cross-reference validation between sections
    if issues := validateCrossReferences(sections); len(issues) > 0 {
        for _, issue := range issues {
            result.AddIssue(&issue)
        }
    }

    // Add format-specific details to result
    result.FormatSpecificDetails["rule_name"] = sections["ruleName"]
    result.FormatSpecificDetails["has_strings"] = len(sections["strings"]) > 0
    result.FormatSpecificDetails["condition_complexity"] = calculateConditionComplexity(sections["condition"])

    return result, nil
}

// validateMetaSection validates the meta section of a YARA-L rule
func validateMetaSection(metaSection string) []models.ValidationIssue {
    issues := make([]models.ValidationIssue, 0)

    if metaSection == "" {
        issues = append(issues, models.ValidationIssue{
            Message:     "Missing meta section",
            Severity:    models.ValidationSeverityHigh,
            Location:    "meta",
            IssueCode:   "YARAL002",
            Remediation: "Add meta section with required fields: author, description, severity, reference",
            Timestamp:   time.Now(),
        })
        return issues
    }

    // Check for required fields
    for _, field := range metaRequiredFields {
        if !strings.Contains(metaSection, field+":") {
            issues = append(issues, models.ValidationIssue{
                Message:     fmt.Sprintf("Missing required meta field: %s", field),
                Severity:    models.ValidationSeverityHigh,
                Location:    "meta." + field,
                IssueCode:   "YARAL003",
                Remediation: fmt.Sprintf("Add required field '%s' to meta section", field),
                Timestamp:   time.Now(),
            })
        }
    }

    // Validate severity values
    if strings.Contains(metaSection, "severity:") {
        severity := extractMetaValue(metaSection, "severity")
        if !isValidSeverity(severity) {
            issues = append(issues, models.ValidationIssue{
                Message:     "Invalid severity value",
                Severity:    models.ValidationSeverityMedium,
                Location:    "meta.severity",
                IssueCode:   "YARAL004",
                Remediation: "Use valid severity values: low, medium, high, critical",
                Timestamp:   time.Now(),
            })
        }
    }

    return issues
}

// validateStringsSection validates the strings section with pattern complexity analysis
func validateStringsSection(stringsSection string) []models.ValidationIssue {
    issues := make([]models.ValidationIssue, 0)

    if stringsSection == "" {
        return issues // Strings section is optional
    }

    // Validate string identifiers
    stringDefs := extractStringDefinitions(stringsSection)
    identifiers := make(map[string]bool)

    for _, def := range stringDefs {
        identifier := extractStringIdentifier(def)
        
        // Check for duplicate identifiers
        if identifiers[identifier] {
            issues = append(issues, models.ValidationIssue{
                Message:     fmt.Sprintf("Duplicate string identifier: %s", identifier),
                Severity:    models.ValidationSeverityHigh,
                Location:    "strings." + identifier,
                IssueCode:   "YARAL005",
                Remediation: "Use unique identifiers for string definitions",
                Timestamp:   time.Now(),
            })
        }
        identifiers[identifier] = true

        // Validate pattern complexity
        if complexity := calculatePatternComplexity(def); complexity > maxConditionComplexity {
            issues = append(issues, models.ValidationIssue{
                Message:     fmt.Sprintf("String pattern too complex: %s", identifier),
                Severity:    models.ValidationSeverityMedium,
                Location:    "strings." + identifier,
                IssueCode:   "YARAL006",
                Remediation: "Simplify pattern or split into multiple strings",
                Timestamp:   time.Now(),
            })
        }
    }

    return issues
}

// validateConditionSection validates the condition section with logic analysis
func validateConditionSection(conditionSection string) []models.ValidationIssue {
    issues := make([]models.ValidationIssue, 0)

    if conditionSection == "" {
        issues = append(issues, models.ValidationIssue{
            Message:     "Missing condition section",
            Severity:    models.ValidationSeverityHigh,
            Location:    "condition",
            IssueCode:   "YARAL007",
            Remediation: "Add condition section with detection logic",
            Timestamp:   time.Now(),
        })
        return issues
    }

    // Validate boolean operators
    if !hasValidBooleanOperators(conditionSection) {
        issues = append(issues, models.ValidationIssue{
            Message:     "Invalid boolean operators in condition",
            Severity:    models.ValidationSeverityHigh,
            Location:    "condition",
            IssueCode:   "YARAL008",
            Remediation: "Use valid operators: and, or, not",
            Timestamp:   time.Now(),
        })
    }

    // Check condition complexity
    if complexity := calculateConditionComplexity(conditionSection); complexity > maxConditionComplexity {
        issues = append(issues, models.ValidationIssue{
            Message:     "Condition logic too complex",
            Severity:    models.ValidationSeverityMedium,
            Location:    "condition",
            IssueCode:   "YARAL009",
            Remediation: "Simplify condition logic or split into multiple rules",
            Timestamp:   time.Now(),
        })
    }

    return issues
}

// Helper functions

func extractRuleSections(content string) map[string]string {
    sections := make(map[string]string)
    
    // Extract rule name
    if match := regexp.MustCompile(`rule\s+([\w_]+)`).FindStringSubmatch(content); len(match) > 1 {
        sections["ruleName"] = match[1]
    }

    // Extract meta section
    if match := regexp.MustCompile(`meta:\s*{([^}]+)}`).FindStringSubmatch(content); len(match) > 1 {
        sections["meta"] = match[1]
    }

    // Extract strings section
    if match := regexp.MustCompile(`strings:\s*{([^}]+)}`).FindStringSubmatch(content); len(match) > 1 {
        sections["strings"] = match[1]
    }

    // Extract condition section
    if match := regexp.MustCompile(`condition:\s*{([^}]+)}`).FindStringSubmatch(content); len(match) > 1 {
        sections["condition"] = match[1]
    }

    return sections
}

func isValidSeverity(severity string) bool {
    validSeverities := map[string]bool{
        "low":      true,
        "medium":   true,
        "high":     true,
        "critical": true,
    }
    return validSeverities[strings.ToLower(strings.TrimSpace(severity))]
}

func calculatePatternComplexity(pattern string) int {
    // Implement pattern complexity calculation
    return len(strings.Split(pattern, " "))
}

func calculateConditionComplexity(condition string) int {
    // Count operators and function calls
    operators := len(regexp.MustCompile(`(and|or|not)`).FindAllString(condition, -1))
    functions := len(regexp.MustCompile(`\w+\(`).FindAllString(condition, -1))
    return operators + functions
}

func hasValidBooleanOperators(condition string) bool {
    validOperators := regexp.MustCompile(`\b(and|or|not)\b`)
    return validOperators.MatchString(condition)
}

func extractMetaValue(metaSection, field string) string {
    re := regexp.MustCompile(field + `:\s*"([^"]+)"`)
    if match := re.FindStringSubmatch(metaSection); len(match) > 1 {
        return match[1]
    }
    return ""
}

func extractStringDefinitions(stringsSection string) []string {
    return strings.Split(stringsSection, "\n")
}

func extractStringIdentifier(stringDef string) string {
    if match := regexp.MustCompile(`^\s*(\$\w+)\s*=`).FindStringSubmatch(stringDef); len(match) > 1 {
        return match[1]
    }
    return ""
}