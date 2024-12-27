// Package utils provides utility functions and types for the validation service
package utils

import (
	"errors"
	"fmt"
	"time"
)

// Standard error definitions for common validation scenarios
var (
	ErrInvalidFormat     = errors.New("invalid detection format: the provided detection format is not recognized or malformed")
	ErrInvalidDetection  = errors.New("invalid detection content: the detection rule content is invalid or incomplete")
	ErrValidationTimeout = errors.New("validation operation timed out: the validation process exceeded the maximum allowed time")
	ErrUnsupportedFormat = errors.New("unsupported detection format: the specified detection format is not supported for validation")
)

// ValidationError represents a custom error type for validation operations
// with enhanced context and metadata support
type ValidationError struct {
	message   string
	code      int
	timestamp time.Time
	metadata  map[string]interface{}
}

// Error implements the error interface and returns a formatted error message
func (e *ValidationError) Error() string {
	base := fmt.Sprintf("[%d] %s", e.code, e.message)
	if !e.timestamp.IsZero() {
		base = fmt.Sprintf("%s (occurred at: %s)", base, e.timestamp.Format(time.RFC3339))
	}
	return base
}

// Code returns the numeric error code associated with this validation error
func (e *ValidationError) Code() int {
	return e.code
}

// WithMetadata adds metadata to the validation error and returns the error for chaining
func (e *ValidationError) WithMetadata(key string, value interface{}) *ValidationError {
	if e.metadata == nil {
		e.metadata = make(map[string]interface{})
	}
	e.metadata[key] = value
	return e
}

// NewValidationError creates a new ValidationError instance with the provided message and code
func NewValidationError(message string, code int) *ValidationError {
	if message == "" {
		message = "unknown validation error"
	}
	if code < 1000 || code > 9999 {
		code = 1000 // Default error code for invalid codes
	}
	return &ValidationError{
		message:   message,
		code:      code,
		timestamp: time.Now(),
		metadata:  make(map[string]interface{}),
	}
}

// WrapError wraps an existing error with additional context while preserving the error chain
func WrapError(err error, message string) error {
	if err == nil {
		return nil
	}
	if message == "" {
		return err
	}
	
	// If the original error is a ValidationError, preserve its type and add context
	if ve, ok := err.(*ValidationError); ok {
		return &ValidationError{
			message:   fmt.Sprintf("%s: %s", message, ve.message),
			code:      ve.code,
			timestamp: ve.timestamp,
			metadata:  ve.metadata,
		}
	}
	
	// Otherwise, wrap it with fmt.Errorf and %w to preserve the error chain
	return fmt.Errorf("%s: %w", message, err)
}

// IsValidationError checks if an error is a ValidationError and returns the typed error
// along with a boolean indicating success of the type assertion
func IsValidationError(err error) (bool, *ValidationError) {
	if err == nil {
		return false, nil
	}

	var validationErr *ValidationError
	
	// Check the error chain for ValidationError using errors.As
	if errors.As(err, &validationErr) {
		return true, validationErr
	}
	
	return false, nil
}