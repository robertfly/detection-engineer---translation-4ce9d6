// Package models provides the core data models for the validation service
package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid" // v1.4.0
)

// Detection format constants define supported SIEM and detection rule formats
const (
	DetectionFormatSplunk      = "splunk"
	DetectionFormatQRadar      = "qradar"
	DetectionFormatSigma       = "sigma"
	DetectionFormatKQL         = "kql"
	DetectionFormatPaloAlto    = "paloalto"
	DetectionFormatCrowdstrike = "crowdstrike"
	DetectionFormatYara        = "yara"
	DetectionFormatYaraL       = "yaral"
)

// Common validation errors
var (
	ErrInvalidFormat  = errors.New("invalid detection format")
	ErrEmptyContent   = errors.New("detection content cannot be empty")
	ErrInvalidUserID  = errors.New("invalid user ID")
)

// Detection represents a security detection rule with comprehensive metadata
type Detection struct {
	ID        uuid.UUID       `json:"id"`
	Content   string         `json:"content"`
	Format    string         `json:"format"`
	CreatedAt time.Time      `json:"created_at"`
	UserID    uuid.UUID      `json:"user_id"`
	IsActive  bool           `json:"is_active"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// NewDetection creates a new Detection instance with validation
func NewDetection(content string, format string) (*Detection, error) {
	if content == "" {
		return nil, ErrEmptyContent
	}

	if !isValidFormat(format) {
		return nil, fmt.Errorf("%w: %s", ErrInvalidFormat, format)
	}

	detection := &Detection{
		ID:        uuid.New(),
		Content:   content,
		Format:    format,
		CreatedAt: time.Now().UTC(),
		IsActive:  true,
	}

	// Perform initial format-specific validation
	if err := detection.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	return detection, nil
}

// Validate performs comprehensive validation of the detection
func (d *Detection) Validate() error {
	if d.Content == "" {
		return ErrEmptyContent
	}

	if !isValidFormat(d.Format) {
		return fmt.Errorf("%w: %s", ErrInvalidFormat, d.Format)
	}

	if err := d.validateFormatSpecific(); err != nil {
		return fmt.Errorf("format-specific validation failed: %w", err)
	}

	if d.Metadata != nil {
		if !json.Valid(d.Metadata) {
			return errors.New("invalid metadata JSON format")
		}
	}

	return nil
}

// GetFormat returns the detection format with validation
func (d *Detection) GetFormat() (string, error) {
	if !isValidFormat(d.Format) {
		return "", fmt.Errorf("%w: %s", ErrInvalidFormat, d.Format)
	}
	return d.Format, nil
}

// GetContent returns the detection content with validation
func (d *Detection) GetContent() (string, error) {
	if d.Content == "" {
		return "", ErrEmptyContent
	}
	return d.Content, nil
}

// SetUserID sets and validates the user ID
func (d *Detection) SetUserID(userID uuid.UUID) error {
	if userID == uuid.Nil {
		return ErrInvalidUserID
	}
	d.UserID = userID
	return nil
}

// MarshalJSON implements custom JSON marshaling with metadata handling
func (d *Detection) MarshalJSON() ([]byte, error) {
	type Alias Detection
	return json.Marshal(&struct {
		*Alias
		ID        string `json:"id"`
		UserID    string `json:"user_id"`
		CreatedAt string `json:"created_at"`
	}{
		Alias:     (*Alias)(d),
		ID:        d.ID.String(),
		UserID:    d.UserID.String(),
		CreatedAt: d.CreatedAt.Format(time.RFC3339),
	})
}

// isValidFormat checks if the provided format is supported
func isValidFormat(format string) bool {
	switch format {
	case DetectionFormatSplunk,
		DetectionFormatQRadar,
		DetectionFormatSigma,
		DetectionFormatKQL,
		DetectionFormatPaloAlto,
		DetectionFormatCrowdstrike,
		DetectionFormatYara,
		DetectionFormatYaraL:
		return true
	default:
		return false
	}
}

// validateFormatSpecific performs format-specific validation rules
func (d *Detection) validateFormatSpecific() error {
	switch d.Format {
	case DetectionFormatSplunk:
		return validateSplunkDetection(d.Content)
	case DetectionFormatQRadar:
		return validateQRadarDetection(d.Content)
	case DetectionFormatSigma:
		return validateSigmaDetection(d.Content)
	case DetectionFormatKQL:
		return validateKQLDetection(d.Content)
	case DetectionFormatPaloAlto:
		return validatePaloAltoDetection(d.Content)
	case DetectionFormatCrowdstrike:
		return validateCrowdstrikeDetection(d.Content)
	case DetectionFormatYara:
		return validateYaraDetection(d.Content)
	case DetectionFormatYaraL:
		return validateYaraLDetection(d.Content)
	default:
		return ErrInvalidFormat
	}
}

// Format-specific validation functions
func validateSplunkDetection(content string) error {
	// Basic Splunk SPL validation - check for required components
	if len(content) < 5 || !containsBasicSPLComponents(content) {
		return errors.New("invalid Splunk SPL format")
	}
	return nil
}

func validateQRadarDetection(content string) error {
	// Basic QRadar AQL validation
	if len(content) < 5 || !containsBasicAQLComponents(content) {
		return errors.New("invalid QRadar AQL format")
	}
	return nil
}

func validateSigmaDetection(content string) error {
	// Basic SIGMA validation - check for YAML structure
	if len(content) < 5 || !containsBasicSigmaComponents(content) {
		return errors.New("invalid SIGMA format")
	}
	return nil
}

func validateKQLDetection(content string) error {
	// Basic KQL validation
	if len(content) < 5 || !containsBasicKQLComponents(content) {
		return errors.New("invalid KQL format")
	}
	return nil
}

func validatePaloAltoDetection(content string) error {
	// Basic Palo Alto validation
	if len(content) < 5 || !containsBasicPaloAltoComponents(content) {
		return errors.New("invalid Palo Alto format")
	}
	return nil
}

func validateCrowdstrikeDetection(content string) error {
	// Basic Crowdstrike validation
	if len(content) < 5 || !containsBasicCrowdstrikeComponents(content) {
		return errors.New("invalid Crowdstrike format")
	}
	return nil
}

func validateYaraDetection(content string) error {
	// Basic YARA validation
	if len(content) < 5 || !containsBasicYaraComponents(content) {
		return errors.New("invalid YARA format")
	}
	return nil
}

func validateYaraLDetection(content string) error {
	// Basic YARA-L validation
	if len(content) < 5 || !containsBasicYaraLComponents(content) {
		return errors.New("invalid YARA-L format")
	}
	return nil
}

// Helper functions for basic format validation
func containsBasicSPLComponents(content string) bool {
	return true // Implement actual SPL validation logic
}

func containsBasicAQLComponents(content string) bool {
	return true // Implement actual AQL validation logic
}

func containsBasicSigmaComponents(content string) bool {
	return true // Implement actual SIGMA validation logic
}

func containsBasicKQLComponents(content string) bool {
	return true // Implement actual KQL validation logic
}

func containsBasicPaloAltoComponents(content string) bool {
	return true // Implement actual Palo Alto validation logic
}

func containsBasicCrowdstrikeComponents(content string) bool {
	return true // Implement actual Crowdstrike validation logic
}

func containsBasicYaraComponents(content string) bool {
	return true // Implement actual YARA validation logic
}

func containsBasicYaraLComponents(content string) bool {
	return true // Implement actual YARA-L validation logic
}