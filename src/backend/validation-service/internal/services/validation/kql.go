// Package validation provides validation services for various detection formats
package validation

import (
    "regexp"
    "strings"
    "time"

    "internal/models"
    "pkg/utils"
    "pkg/logger"
)

// Regular expression patterns for KQL syntax validation
var (
    // Core KQL operator pattern
    kqlOperatorPattern = regexp.MustCompile(`(where|project|extend|summarize|join|union|parse|datatable|let|take|top|sort|order by|count|distinct|evaluate|make-series|mv-expand|parse-where|project-away|project-rename|project-reorder|scan|serialize|as|consume)`)

    // KQL function pattern for built-in functions
    kqlFunctionPattern = regexp.MustCompile(`(ago|now|startofday|endofday|between|contains|countof|strcat|datetime_diff|format_datetime|parse_json|tostring|toint|todecimal|tolower|toupper|trim|extract|extract_all|indexof|isempty|isnotempty|replace|split|substring|array_length|bag_keys|pack|pack_array|set_difference|set_intersect|set_union|array_concat|array_iif|array_index_of|array_slice|array_sort_asc|array_sort_desc|array_sum|bin|bin_auto|bin_at|floor|ceiling|round|exp|exp2|exp10|log|log2|log10|pow|sqrt|sign|abs|acos|asin|atan|atan2|cos|cosh|sin|sinh|tan|tanh)`)

    // KQL table name pattern
    kqlTablePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*$`)

    // KQL time window pattern
    kqlTimeWindowPattern = regexp.MustCompile(`(ago\([0-9]+[hdm]\)|between\(ago\([0-9]+[hdm]\)..now\)|startofday\(ago\([0-9]+d]\)\))`)

    // KQL field reference pattern
    kqlFieldPattern = regexp.MustCompile(`[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*`)
)

// ValidateKQLDetection performs comprehensive validation of KQL detection rules
func ValidateKQLDetection(detection *models.Detection) (*models.ValidationResult, error) {
    log := logger.GetLogger()
    log.Info("Starting KQL detection validation")

    // Initialize validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, utils.WrapError(err, "failed to create validation result")
    }

    content, err := detection.GetContent()
    if err != nil {
        return nil, utils.WrapError(err, "failed to get detection content")
    }

    // Validate basic KQL syntax
    if err := validateKQLSyntax(content); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     "KQL syntax validation failed",
            Severity:    models.ValidationSeverityHigh,
            Location:    "syntax",
            IssueCode:   "KQL001",
            Remediation: "Review and correct KQL syntax according to Azure KQL documentation",
        })
    }

    // Validate KQL operators
    if warnings, err := validateKQLOperators(content); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Invalid KQL operator usage",
            Severity:    models.ValidationSeverityHigh,
            Location:    "operators",
            IssueCode:   "KQL002",
            Remediation: "Ensure proper KQL operator usage and ordering",
        })
    } else {
        for _, warning := range warnings {
            result.AddIssue(&models.ValidationIssue{
                Message:     warning,
                Severity:    models.ValidationSeverityMedium,
                Location:    "operators",
                IssueCode:   "KQL003",
                Remediation: "Review operator usage for optimization opportunities",
            })
        }
    }

    // Validate time window specifications
    if warnings, err := validateKQLTimeWindow(content); err != nil {
        result.AddIssue(&models.ValidationIssue{
            Message:     "Invalid time window specification",
            Severity:    models.ValidationSeverityHigh,
            Location:    "time_window",
            IssueCode:   "KQL004",
            Remediation: "Specify a valid time window using KQL time operators",
        })
    } else {
        for _, warning := range warnings {
            result.AddIssue(&models.ValidationIssue{
                Message:     warning,
                Severity:    models.ValidationSeverityLow,
                Location:    "time_window",
                IssueCode:   "KQL005",
                Remediation: "Consider optimizing time window specification",
            })
        }
    }

    // Add KQL-specific metadata
    result.FormatSpecificDetails["kql_version"] = "2.0"
    result.FormatSpecificDetails["validated_operators"] = extractKQLOperators(content)
    result.FormatSpecificDetails["validated_functions"] = extractKQLFunctions(content)

    log.Info("Completed KQL detection validation",
        "confidence_score", result.ConfidenceScore,
        "issues_count", len(result.Issues))

    return result, nil
}

// validateKQLSyntax performs detailed syntax validation of KQL queries
func validateKQLSyntax(content string) error {
    // Check for empty or invalid content
    if strings.TrimSpace(content) == "" {
        return utils.NewValidationError("empty KQL query", 1001)
    }

    // Check for balanced parentheses and brackets
    if !hasBalancedDelimiters(content) {
        return utils.NewValidationError("unbalanced parentheses or brackets", 1002)
    }

    // Validate basic query structure
    lines := strings.Split(content, "\n")
    for i, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" || strings.HasPrefix(line, "//") {
            continue
        }

        // Check for invalid characters
        if strings.ContainsAny(line, "`;") {
            return utils.NewValidationError("invalid characters in query", 1003)
        }

        // Validate table references
        if i == 0 && !kqlTablePattern.MatchString(strings.Split(line, " ")[0]) {
            return utils.NewValidationError("invalid table reference", 1004)
        }
    }

    return nil
}

// validateKQLOperators checks for proper operator usage and ordering
func validateKQLOperators(content string) ([]string, error) {
    warnings := []string{}
    operators := kqlOperatorPattern.FindAllString(content, -1)

    if len(operators) == 0 {
        return nil, utils.NewValidationError("no KQL operators found", 1005)
    }

    // Check operator ordering
    hasWhere := false
    hasProject := false
    for i, op := range operators {
        switch op {
        case "where":
            hasWhere = true
            if hasProject {
                warnings = append(warnings, "consider moving 'where' before 'project' for better performance")
            }
        case "project":
            hasProject = true
        case "summarize":
            if !hasWhere {
                warnings = append(warnings, "consider adding 'where' before 'summarize' to reduce data volume")
            }
        }

        // Check for redundant operators
        if i > 0 && operators[i] == operators[i-1] {
            warnings = append(warnings, "detected consecutive usage of operator '"+op+"'")
        }
    }

    return warnings, nil
}

// validateKQLTimeWindow validates time window specifications
func validateKQLTimeWindow(content string) ([]string, error) {
    warnings := []string{}
    timeSpecs := kqlTimeWindowPattern.FindAllString(content, -1)

    if len(timeSpecs) == 0 {
        return nil, utils.NewValidationError("no time window specification found", 1006)
    }

    for _, spec := range timeSpecs {
        // Extract time duration
        if strings.Contains(spec, "ago(") {
            duration := extractDuration(spec)
            if duration > 24*time.Hour {
                warnings = append(warnings, "time window exceeds 24 hours, consider performance impact")
            }
        }
    }

    return warnings, nil
}

// Helper functions

// hasBalancedDelimiters checks for balanced parentheses and brackets
func hasBalancedDelimiters(content string) bool {
    stack := []rune{}
    pairs := map[rune]rune{
        '(': ')',
        '[': ']',
        '{': '}',
    }

    for _, char := range content {
        switch char {
        case '(', '[', '{':
            stack = append(stack, char)
        case ')', ']', '}':
            if len(stack) == 0 {
                return false
            }
            if pairs[stack[len(stack)-1]] != char {
                return false
            }
            stack = stack[:len(stack)-1]
        }
    }

    return len(stack) == 0
}

// extractDuration extracts time duration from KQL time window specification
func extractDuration(spec string) time.Duration {
    // Extract numeric value and unit
    re := regexp.MustCompile(`([0-9]+)([hdm])`)
    matches := re.FindStringSubmatch(spec)
    if len(matches) != 3 {
        return 0
    }

    value := matches[1]
    unit := matches[2]
    
    // Convert to duration
    switch unit {
    case "h":
        return time.Hour * time.Duration(parseInt(value))
    case "d":
        return 24 * time.Hour * time.Duration(parseInt(value))
    case "m":
        return time.Minute * time.Duration(parseInt(value))
    default:
        return 0
    }
}

// parseInt safely converts string to int
func parseInt(s string) int {
    val := 0
    for _, ch := range s {
        if ch >= '0' && ch <= '9' {
            val = val*10 + int(ch-'0')
        }
    }
    return val
}

// extractKQLOperators extracts all KQL operators from content
func extractKQLOperators(content string) []string {
    return kqlOperatorPattern.FindAllString(content, -1)
}

// extractKQLFunctions extracts all KQL functions from content
func extractKQLFunctions(content string) []string {
    return kqlFunctionPattern.FindAllString(content, -1)
}