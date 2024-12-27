// Package metrics provides enterprise-grade Prometheus metrics collection and recording
// functionality for the validation service with enhanced configuration and validation.
// Version: 1.0.0
package metrics

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus" // v1.16.0
	"github.com/prometheus/client_golang/prometheus/promauto" // v1.16.0
	
	"validation-service/pkg/logger"
)

// Global metrics collectors
var (
	validationRequests *prometheus.CounterVec
	validationDuration *prometheus.HistogramVec
	validationErrors   *prometheus.CounterVec
)

// Constants for metric labels and configuration
const (
	serviceLabel     = "validation"
	formatLabel      = "format"
	errorTypeLabel   = "error_type"
	serviceLabelName = "service"
)

// Validation maps for input validation
var (
	// validFormats contains supported detection formats
	validFormats = map[string]bool{
		"splunk":      true,
		"qradar":      true,
		"sigma":       true,
		"kql":         true,
		"paloalto":    true,
		"crowdstrike": true,
		"yara":        true,
		"yara-l":      true,
	}

	// validErrorTypes contains supported error classifications
	validErrorTypes = map[string]bool{
		"syntax":           true,
		"format":          true,
		"validation":      true,
		"transformation":  true,
		"internal":        true,
		"configuration":   true,
	}
)

// InitMetrics initializes and registers all Prometheus metrics collectors
// with enhanced configuration and validation.
func InitMetrics() error {
	log := logger.GetLogger()
	
	// Initialize validation requests counter
	validationRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "validation_requests_total",
			Help: "Total number of validation requests by format",
			ConstLabels: prometheus.Labels{
				serviceLabelName: serviceLabel,
			},
		},
		[]string{formatLabel},
	)

	// Initialize validation duration histogram with configured buckets
	validationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "validation_duration_seconds",
			Help: "Duration of validation operations by format",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
			ConstLabels: prometheus.Labels{
				serviceLabelName: serviceLabel,
			},
		},
		[]string{formatLabel},
	)

	// Initialize validation errors counter
	validationErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "validation_errors_total",
			Help: "Total number of validation errors by format and error type",
			ConstLabels: prometheus.Labels{
				serviceLabelName: serviceLabel,
			},
		},
		[]string{formatLabel, errorTypeLabel},
	)

	log.Info("Metrics collectors initialized successfully",
		"requests_metric", "validation_requests_total",
		"duration_metric", "validation_duration_seconds",
		"errors_metric", "validation_errors_total",
	)

	return nil
}

// RecordValidationRequest records a validation request for a specific detection format
// with input validation.
func RecordValidationRequest(format string) error {
	if err := validateFormat(format); err != nil {
		return err
	}

	validationRequests.WithLabelValues(format).Inc()
	
	logger.GetLogger().Debug("Recorded validation request",
		"format", format,
	)
	
	return nil
}

// RecordValidationDuration records the duration of a validation operation
// with input validation.
func RecordValidationDuration(format string, duration time.Duration) error {
	if err := validateFormat(format); err != nil {
		return err
	}

	if duration < 0 {
		return fmt.Errorf("invalid duration: %v (must be non-negative)", duration)
	}

	validationDuration.WithLabelValues(format).Observe(duration.Seconds())
	
	logger.GetLogger().Debug("Recorded validation duration",
		"format", format,
		"duration_seconds", duration.Seconds(),
	)
	
	return nil
}

// RecordValidationError records a validation error occurrence with enhanced
// error type validation.
func RecordValidationError(format string, errorType string) error {
	if err := validateFormat(format); err != nil {
		return err
	}

	if err := validateErrorType(errorType); err != nil {
		return err
	}

	validationErrors.WithLabelValues(format, errorType).Inc()
	
	logger.GetLogger().Error("Recorded validation error",
		"format", format,
		"error_type", errorType,
	)
	
	return nil
}

// validateFormat is an internal helper to validate detection format.
func validateFormat(format string) error {
	if !validFormats[format] {
		return fmt.Errorf("invalid format: %s (supported formats: %v)", 
			format, getMapKeys(validFormats))
	}
	return nil
}

// validateErrorType is an internal helper to validate error classification type.
func validateErrorType(errorType string) error {
	if !validErrorTypes[errorType] {
		return fmt.Errorf("invalid error type: %s (supported types: %v)", 
			errorType, getMapKeys(validErrorTypes))
	}
	return nil
}

// getMapKeys is a helper function to get sorted keys from a map.
func getMapKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}