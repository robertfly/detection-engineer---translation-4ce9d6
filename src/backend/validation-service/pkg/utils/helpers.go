// Package utils provides utility functions for validation operations
package utils

import (
    "strings"
    "unicode"
    "regexp"
    "unicode/utf8"
)

// MaxDetectionSize defines the maximum allowed size for detection content (5MB)
const MaxDetectionSize = 1024 * 1024 * 5

// SupportedFormats defines the list of supported detection formats
var SupportedFormats = []string{"splunk", "qradar", "sigma", "kql", "paloalto", "crowdstrike", "yara", "yaral"}

// formatSpecificPatterns contains regex patterns for format-specific validation
var formatSpecificPatterns = map[string]*regexp.Regexp{
    "splunk":      regexp.MustCompile(`^(?i)(search\s+)?index\s*=`),
    "sigma":       regexp.MustCompile(`^(?i)title:\s*[^\n]+`),
    "kql":        regexp.MustCompile(`^[A-Za-z]+\s*\|`),
    "yara":       regexp.MustCompile(`^(?i)rule\s+[a-z0-9_]+\s*{`),
    "yaral":      regexp.MustCompile(`^(?i)rule\s+[a-z0-9_]+\s*{`),
}

// IsValidFormat checks if the provided detection format is supported
func IsValidFormat(format string) bool {
    normalizedFormat := strings.ToLower(strings.TrimSpace(format))
    for _, supported := range SupportedFormats {
        if supported == normalizedFormat {
            return true
        }
    }
    return false
}

// ValidateDetectionSize validates that the detection content size is within acceptable limits
func ValidateDetectionSize(content string) error {
    if len(content) > MaxDetectionSize {
        return NewValidationError(
            "detection content exceeds maximum allowed size",
            1001,
        ).WithMetadata("size", len(content)).
            WithMetadata("maxSize", MaxDetectionSize)
    }
    return nil
}

// SanitizeInput sanitizes detection content by removing unsafe characters and normalizing whitespace
func SanitizeInput(content string) string {
    // Trim leading/trailing whitespace
    content = strings.TrimSpace(content)

    // Remove null bytes and control characters
    content = strings.Map(func(r rune) rune {
        if unicode.IsControl(r) && !unicode.IsSpace(r) {
            return -1
        }
        return r
    }, content)

    // Normalize line endings to Unix-style
    content = strings.ReplaceAll(content, "\r\n", "\n")
    content = strings.ReplaceAll(content, "\r", "\n")

    // Normalize whitespace
    spaceNormalizer := regexp.MustCompile(`\s+`)
    content = spaceNormalizer.ReplaceAllString(content, " ")

    // Ensure valid UTF-8
    if !utf8.ValidString(content) {
        content = strings.ToValidUTF8(content, "")
    }

    return content
}

// FormatDetectionContent formats detection content according to the specified format's requirements
func FormatDetectionContent(content string, format string) (string, error) {
    // Validate format
    if !IsValidFormat(format) {
        return "", ErrInvalidFormat
    }

    // Validate size
    if err := ValidateDetectionSize(content); err != nil {
        return "", err
    }

    // Sanitize input
    content = SanitizeInput(content)

    // Validate format-specific patterns
    if pattern, exists := formatSpecificPatterns[format]; exists {
        if !pattern.MatchString(content) {
            return "", NewValidationError(
                "content does not match required format pattern",
                1002,
            ).WithMetadata("format", format)
        }
    }

    // Format-specific processing
    switch format {
    case "splunk":
        return formatSplunkContent(content)
    case "sigma":
        return formatSigmaContent(content)
    case "kql":
        return formatKQLContent(content)
    case "yara", "yaral":
        return formatYaraContent(content)
    default:
        // For other formats, return sanitized content
        return content, nil
    }
}

// formatSplunkContent applies Splunk-specific formatting rules
func formatSplunkContent(content string) (string, error) {
    // Ensure search command is present
    if !strings.HasPrefix(strings.ToLower(content), "search") {
        content = "search " + content
    }

    // Normalize pipes
    content = regexp.MustCompile(`\s*\|\s*`).ReplaceAllString(content, " | ")

    return content, nil
}

// formatSigmaContent applies Sigma-specific formatting rules
func formatSigmaContent(content string) (string, error) {
    // Ensure YAML structure
    if !strings.Contains(content, "title:") {
        return "", NewValidationError("missing required field 'title' in Sigma rule", 1003)
    }

    // Normalize YAML indentation
    lines := strings.Split(content, "\n")
    for i, line := range lines {
        lines[i] = strings.TrimRight(line, " ")
    }
    content = strings.Join(lines, "\n")

    return content, nil
}

// formatKQLContent applies KQL-specific formatting rules
func formatKQLContent(content string) (string, error) {
    // Normalize operators
    content = regexp.MustCompile(`\s*(==|!=|>=|<=|\+|-|\*|/)\s*`).ReplaceAllString(content, " $1 ")

    // Ensure proper pipe formatting
    content = regexp.MustCompile(`\s*\|\s*`).ReplaceAllString(content, "\n| ")

    return content, nil
}

// formatYaraContent applies YARA/YARA-L specific formatting rules
func formatYaraContent(content string) (string, error) {
    // Validate rule structure
    if !strings.Contains(content, "rule") || !strings.Contains(content, "{") {
        return "", NewValidationError("invalid YARA rule structure", 1004)
    }

    // Normalize braces
    content = regexp.MustCompile(`\s*{\s*`).ReplaceAllString(content, " {\n    ")
    content = regexp.MustCompile(`\s*}\s*`).ReplaceAllString(content, "\n}")

    return content, nil
}