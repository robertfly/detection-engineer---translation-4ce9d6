// Package validation provides a high-fidelity validation service for security detection translations
// with comprehensive validation logic, confidence scoring, and detailed feedback generation.
package validation

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "time"

    "internal/models"
    "pkg/logger"
)

// Global error definitions
var (
    ErrUnsupportedFormat = errors.New("unsupported detection format")
    ErrValidationFailed  = errors.New("validation failed with detailed feedback")
    ErrInvalidValidator  = errors.New("invalid validator implementation")
)

// Constants for validation configuration
const (
    MinConfidenceScore = 95.0 // Minimum required confidence score for validation success
)

// Validator defines the interface for format-specific validation implementations
type Validator interface {
    // Validate performs comprehensive validation of detection translation
    Validate(ctx context.Context, sourceDetection *models.Detection, targetDetection *models.Detection, result *models.ValidationResult) error
}

// ValidationConfig holds configuration for the validation service
type ValidationConfig struct {
    EnableDetailedFeedback bool
    ValidationTimeout     time.Duration
    StrictMode           bool
    MetricsEnabled       bool
}

// ValidationService provides thread-safe validation orchestration
type ValidationService struct {
    mu         sync.RWMutex
    validators map[string]Validator
    config     ValidationConfig
    log        *logger.Logger
}

// NewValidationService creates a new validation service instance
func NewValidationService(config ValidationConfig) *ValidationService {
    return &ValidationService{
        validators: make(map[string]Validator),
        config:     config,
        log:        logger.GetLogger(),
    }
}

// RegisterValidator registers a format-specific validator implementation
func (s *ValidationService) RegisterValidator(format string, validator Validator) error {
    if format == "" {
        return fmt.Errorf("format cannot be empty")
    }
    if validator == nil {
        return ErrInvalidValidator
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    // Check for existing validator
    if _, exists := s.validators[format]; exists {
        return fmt.Errorf("validator already registered for format: %s", format)
    }

    s.validators[format] = validator
    s.log.Info("Validator registered successfully",
        "format", format,
        "strict_mode", s.config.StrictMode,
    )

    return nil
}

// GetValidator retrieves a registered validator for the specified format
func (s *ValidationService) GetValidator(format string) (Validator, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    validator, exists := s.validators[format]
    if !exists {
        return nil, fmt.Errorf("%w: %s", ErrUnsupportedFormat, format)
    }

    return validator, nil
}

// ValidateDetection performs comprehensive validation of a detection translation
func (s *ValidationService) ValidateDetection(ctx context.Context, sourceDetection, targetDetection *models.Detection) (*models.ValidationResult, error) {
    if sourceDetection == nil || targetDetection == nil {
        return nil, errors.New("source and target detections cannot be nil")
    }

    // Create validation context with timeout
    if s.config.ValidationTimeout > 0 {
        var cancel context.CancelFunc
        ctx, cancel = context.WithTimeout(ctx, s.config.ValidationTimeout)
        defer cancel()
    }

    // Get target format validator
    targetFormat, err := targetDetection.GetFormat()
    if err != nil {
        return nil, fmt.Errorf("invalid target format: %w", err)
    }

    validator, err := s.GetValidator(targetFormat)
    if err != nil {
        return nil, err
    }

    // Initialize validation result
    result, err := models.NewValidationResult(sourceDetection)
    if err != nil {
        return nil, fmt.Errorf("failed to create validation result: %w", err)
    }
    result.TargetFormat = targetFormat

    // Start validation timer
    startTime := time.Now()

    // Perform format-specific validation
    if err := validator.Validate(ctx, sourceDetection, targetDetection, result); err != nil {
        result.Status = models.ValidationStatusError
        result.AddIssue(&models.ValidationIssue{
            Message:   fmt.Sprintf("Validation failed: %v", err),
            Severity:  models.ValidationSeverityHigh,
            Location:  "validation_service",
            IssueCode: "VALIDATION_FAILED",
        })
        return result, fmt.Errorf("%w: %v", ErrValidationFailed, err)
    }

    // Update validation metadata
    result.Metadata.ValidationTime = time.Since(startTime)

    // Check confidence threshold
    if result.ConfidenceScore < MinConfidenceScore {
        result.Status = models.ValidationStatusWarning
        result.AddIssue(&models.ValidationIssue{
            Message:   fmt.Sprintf("Confidence score %.2f below minimum threshold %.2f", result.ConfidenceScore, MinConfidenceScore),
            Severity:  models.ValidationSeverityMedium,
            Location:  "confidence_check",
            IssueCode: "LOW_CONFIDENCE",
        })
    }

    // Log validation completion
    s.log.Info("Detection validation completed",
        "source_format", result.SourceFormat,
        "target_format", result.TargetFormat,
        "status", result.Status,
        "confidence_score", result.ConfidenceScore,
        "validation_time_ms", result.Metadata.ValidationTime.Milliseconds(),
    )

    return result, nil
}

// ValidateDetectionBatch performs batch validation of multiple detections
func (s *ValidationService) ValidateDetectionBatch(ctx context.Context, batch []struct {
    Source *models.Detection
    Target *models.Detection
}) ([]*models.ValidationResult, error) {
    results := make([]*models.ValidationResult, len(batch))
    var wg sync.WaitGroup
    errChan := make(chan error, len(batch))

    for i, pair := range batch {
        wg.Add(1)
        go func(idx int, src, tgt *models.Detection) {
            defer wg.Done()

            result, err := s.ValidateDetection(ctx, src, tgt)
            if err != nil {
                errChan <- fmt.Errorf("batch validation failed at index %d: %w", idx, err)
                return
            }
            results[idx] = result
        }(i, pair.Source, pair.Target)
    }

    wg.Wait()
    close(errChan)

    // Check for any validation errors
    if err := <-errChan; err != nil {
        return results, err
    }

    return results, nil
}