// Package validation provides format-specific validation implementations
package validation

import (
    "context"
    "regexp"
    "strings"
    "fmt"
    "time"

    "internal/models" // v1.0.0
)

// Regular expressions for SPL syntax validation
var (
    splunkCommandRegex = regexp.MustCompile(`^\s*(\w+)\s*`)
    splunkPipelineRegex = regexp.MustCompile(`\|\s*(\w+)\s*`)
    splunkFieldRegex = regexp.MustCompile(`([\w\.]+)\s*=\s*["']?([^"'\s]+)["']?`)
    splunkFunctionRegex = regexp.MustCompile(`(\w+)\s*\(([^)]*)\)`)
    splunkTimeRangeRegex = regexp.MustCompile(`earliest\s*=\s*([^\s]+)\s+latest\s*=\s*([^\s]+)`)
)

// SplunkValidator implements format-specific validation for Splunk SPL
type SplunkValidator struct {
    supportedCommands map[string]bool
    supportedFunctions map[string]bool
    fieldMappings map[string]string
    commandDependencies map[string][]string
    config ValidationConfig
}

// ValidationConfig holds configuration for the validator
type ValidationConfig struct {
    Version string
    StrictMode bool
    MaxPipelineDepth int
    TimeRangeRequired bool
    CIMCompliance bool
}

// NewSplunkValidator creates a new validator instance with configuration
func NewSplunkValidator(config ValidationConfig) *SplunkValidator {
    v := &SplunkValidator{
        supportedCommands: make(map[string]bool),
        supportedFunctions: make(map[string]bool),
        fieldMappings: make(map[string]string),
        commandDependencies: make(map[string][]string),
        config: config,
    }

    // Initialize supported SPL commands
    for _, cmd := range []string{
        "search", "where", "stats", "eval", "rename",
        "table", "dedup", "sort", "head", "tail",
        "top", "rare", "fields", "transaction",
    } {
        v.supportedCommands[cmd] = true
    }

    // Initialize supported functions
    for _, fn := range []string{
        "count", "sum", "avg", "min", "max",
        "earliest", "latest", "list", "values",
        "upper", "lower", "len", "substr",
    } {
        v.supportedFunctions[fn] = true
    }

    // Initialize CIM field mappings
    v.fieldMappings = map[string]string{
        "src_ip": "source.ip.addr",
        "dest_ip": "destination.ip.addr",
        "src_port": "source.port",
        "dest_port": "destination.port",
        "user": "user.name",
        "process": "process.name",
    }

    // Initialize command dependencies
    v.commandDependencies = map[string][]string{
        "stats": {"by", "groupby"},
        "eval": {"as"},
        "rename": {"as"},
    }

    return v
}

// Validate performs comprehensive SPL validation
func (v *SplunkValidator) Validate(ctx context.Context, detection *models.Detection) (*models.ValidationResult, error) {
    // Create new validation result
    result, err := models.NewValidationResult(detection)
    if err != nil {
        return nil, fmt.Errorf("failed to create validation result: %w", err)
    }

    // Verify detection format
    format, err := detection.GetFormat()
    if err != nil || format != models.DetectionFormatSplunk {
        return nil, fmt.Errorf("invalid format for Splunk validation: %s", format)
    }

    // Get detection content
    content, err := detection.GetContent()
    if err != nil {
        return nil, fmt.Errorf("failed to get detection content: %w", err)
    }

    // Perform syntax validation
    syntaxIssues, err := v.validateSPLSyntax(content, detection.GetMetadata())
    if err != nil {
        return nil, fmt.Errorf("syntax validation failed: %w", err)
    }

    // Add syntax issues to result
    for _, issue := range syntaxIssues {
        result.AddIssue(&models.ValidationIssue{
            Message:     issue.Message,
            Severity:    issue.Severity,
            Location:    issue.Location,
            IssueCode:   "SPL_SYNTAX",
            Remediation: issue.Remediation,
        })
    }

    // Perform semantic validation
    semanticIssues, err := v.validateSPLSemantics(content, detection.GetMetadata())
    if err != nil {
        return nil, fmt.Errorf("semantic validation failed: %w", err)
    }

    // Add semantic issues to result
    for _, issue := range semanticIssues {
        result.AddIssue(&models.ValidationIssue{
            Message:     issue.Message,
            Severity:    issue.Severity,
            Location:    issue.Location,
            IssueCode:   "SPL_SEMANTIC",
            Remediation: issue.Remediation,
        })
    }

    // Add format-specific metadata
    result.FormatSpecificDetails["pipeline_depth"] = len(strings.Split(content, "|"))
    result.FormatSpecificDetails["command_count"] = len(splunkCommandRegex.FindAllString(content, -1))
    result.FormatSpecificDetails["field_mappings"] = v.fieldMappings

    // Update validation metadata
    result.Metadata.ValidatorVersion = v.config.Version
    result.Metadata.ValidatorConfig = map[string]interface{}{
        "strict_mode":         v.config.StrictMode,
        "max_pipeline_depth":  v.config.MaxPipelineDepth,
        "time_range_required": v.config.TimeRangeRequired,
        "cim_compliance":      v.config.CIMCompliance,
    }

    // Calculate final confidence score
    if result.ConfidenceScore > models.ValidationConfidenceThreshold {
        result.Status = models.ValidationStatusSuccess
    } else if result.ConfidenceScore > 70.0 {
        result.Status = models.ValidationStatusWarning
    } else {
        result.Status = models.ValidationStatusError
    }

    return result, nil
}

// validateSPLSyntax performs detailed syntax validation
func (v *SplunkValidator) validateSPLSyntax(content string, metadata map[string]interface{}) ([]models.ValidationIssue, error) {
    var issues []models.ValidationIssue

    // Validate initial search command
    if !splunkCommandRegex.MatchString(content) {
        issues = append(issues, models.ValidationIssue{
            Message:     "Missing or invalid initial search command",
            Severity:    models.ValidationSeverityHigh,
            Location:    "line:1",
            Remediation: "Add 'search' command at the beginning of the SPL query",
        })
    }

    // Validate pipeline operators
    pipelines := splunkPipelineRegex.FindAllString(content, -1)
    if len(pipelines) > v.config.MaxPipelineDepth {
        issues = append(issues, models.ValidationIssue{
            Message:     fmt.Sprintf("Pipeline depth exceeds maximum allowed (%d)", v.config.MaxPipelineDepth),
            Severity:    models.ValidationSeverityMedium,
            Location:    fmt.Sprintf("pipeline:%d", len(pipelines)),
            Remediation: "Simplify the search by reducing the number of pipeline stages",
        })
    }

    // Validate field extractions
    fields := splunkFieldRegex.FindAllStringSubmatch(content, -1)
    for _, field := range fields {
        if len(field) >= 3 {
            fieldName := field[1]
            if _, exists := v.fieldMappings[fieldName]; !exists && v.config.CIMCompliance {
                issues = append(issues, models.ValidationIssue{
                    Message:     fmt.Sprintf("Non-CIM compliant field name: %s", fieldName),
                    Severity:    models.ValidationSeverityMedium,
                    Location:    fmt.Sprintf("field:%s", fieldName),
                    Remediation: "Use CIM-compliant field names for better compatibility",
                })
            }
        }
    }

    // Validate time range if required
    if v.config.TimeRangeRequired && !splunkTimeRangeRegex.MatchString(content) {
        issues = append(issues, models.ValidationIssue{
            Message:     "Missing time range specification",
            Severity:    models.ValidationSeverityHigh,
            Location:    "timerange",
            Remediation: "Add 'earliest' and 'latest' time range parameters",
        })
    }

    return issues, nil
}

// validateSPLSemantics performs semantic validation
func (v *SplunkValidator) validateSPLSemantics(content string, metadata map[string]interface{}) ([]models.ValidationIssue, error) {
    var issues []models.ValidationIssue

    // Validate command dependencies
    commands := splunkCommandRegex.FindAllString(content, -1)
    for _, cmd := range commands {
        cmd = strings.TrimSpace(cmd)
        if deps, exists := v.commandDependencies[cmd]; exists {
            for _, dep := range deps {
                if !strings.Contains(content, dep) {
                    issues = append(issues, models.ValidationIssue{
                        Message:     fmt.Sprintf("Missing required dependency '%s' for command '%s'", dep, cmd),
                        Severity:    models.ValidationSeverityHigh,
                        Location:    fmt.Sprintf("command:%s", cmd),
                        Remediation: fmt.Sprintf("Add required '%s' clause with '%s' command", dep, cmd),
                    })
                }
            }
        }
    }

    // Validate function calls
    functions := splunkFunctionRegex.FindAllStringSubmatch(content, -1)
    for _, fn := range functions {
        if len(fn) >= 2 {
            funcName := fn[1]
            if !v.supportedFunctions[funcName] {
                issues = append(issues, models.ValidationIssue{
                    Message:     fmt.Sprintf("Unsupported function: %s", funcName),
                    Severity:    models.ValidationSeverityMedium,
                    Location:    fmt.Sprintf("function:%s", funcName),
                    Remediation: "Use only supported SPL functions",
                })
            }
        }
    }

    return issues, nil
}