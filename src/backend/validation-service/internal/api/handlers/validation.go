// Package handlers provides HTTP handlers for the validation service API endpoints
// with comprehensive validation, security, and monitoring capabilities.
package handlers

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "net/http"
    "time"

    "github.com/go-chi/chi/v5"      // v5.0.8
    "github.com/go-chi/compress"    // v5.0.0
    
    "internal/models"
    "internal/services/validation"
    "pkg/logger"
)

// Global constants for request handling
const (
    maxRequestSize    = 10 * 1024 * 1024 // 10MB max request size
    requestTimeout    = 30 * time.Second
    maxRetries       = 3
    compressionLevel = 5
)

// ValidationRequest represents the incoming validation request structure
type ValidationRequest struct {
    SourceDetection *models.Detection `json:"source_detection"`
    TargetDetection *models.Detection `json:"target_detection"`
    Options         map[string]interface{} `json:"options,omitempty"`
}

// ValidationResponse represents the API response structure
type ValidationResponse struct {
    Status    string                 `json:"status"`
    Result    *models.ValidationResult `json:"result,omitempty"`
    Report    *models.ValidationReport `json:"report,omitempty"`
    Error     string                 `json:"error,omitempty"`
    RequestID string                 `json:"request_id"`
    Timestamp time.Time             `json:"timestamp"`
}

// ValidationHandler handles validation API requests with enhanced security and monitoring
type ValidationHandler struct {
    service    *validation.ValidationService
    compressor *compress.Compressor
    log        *logger.Logger
}

// NewValidationHandler creates a new validation handler instance with all required dependencies
func NewValidationHandler(service *validation.ValidationService) *ValidationHandler {
    return &ValidationHandler{
        service: service,
        compressor: compress.New(compress.Config{
            Level: compressionLevel,
            Types: []string{
                "application/json",
                "text/plain",
            },
        }),
        log: logger.GetLogger(),
    }
}

// RegisterRoutes registers all validation endpoints with the router
func (h *ValidationHandler) RegisterRoutes(r chi.Router) {
    r.Post("/validate", h.compressor.Handler(http.HandlerFunc(h.ValidateHandler)).ServeHTTP)
    r.Post("/validate/batch", h.compressor.Handler(http.HandlerFunc(h.ValidateBatchHandler)).ServeHTTP)
}

// ValidateHandler handles single detection validation requests
func (h *ValidationHandler) ValidateHandler(w http.ResponseWriter, r *http.Request) {
    // Create context with timeout
    ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
    defer cancel()

    // Validate request size
    if r.ContentLength > maxRequestSize {
        h.sendErrorResponse(w, http.StatusRequestEntityTooLarge, "request body too large")
        return
    }

    // Parse request body
    var req ValidationRequest
    if err := h.parseJSONBody(r, &req); err != nil {
        h.sendErrorResponse(w, http.StatusBadRequest, fmt.Sprintf("invalid request: %v", err))
        return
    }

    // Validate request content
    if err := h.validateRequest(&req); err != nil {
        h.sendErrorResponse(w, http.StatusBadRequest, fmt.Sprintf("validation failed: %v", err))
        return
    }

    // Perform validation with retries
    var result *models.ValidationResult
    var err error
    for i := 0; i < maxRetries; i++ {
        result, err = h.service.ValidateDetection(ctx, req.SourceDetection, req.TargetDetection)
        if err == nil || !isRetryableError(err) {
            break
        }
        time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
    }

    if err != nil {
        h.log.Error("Validation failed",
            "error", err,
            "source_format", req.SourceDetection.Format,
            "target_format", req.TargetDetection.Format,
        )
        h.sendErrorResponse(w, http.StatusInternalServerError, fmt.Sprintf("validation error: %v", err))
        return
    }

    // Generate detailed report
    report := result.GetDetailedReport()

    // Send success response
    h.sendSuccessResponse(w, &ValidationResponse{
        Status:    result.Status,
        Result:    result,
        Report:    &report,
        RequestID: r.Context().Value("request_id").(string),
        Timestamp: time.Now().UTC(),
    })
}

// ValidateBatchHandler handles batch validation requests
func (h *ValidationHandler) ValidateBatchHandler(w http.ResponseWriter, r *http.Request) {
    // Implementation for batch validation
    // Similar to ValidateHandler but processes multiple detections
    // Consider implementing streaming response for large batches
    http.Error(w, "Batch validation not implemented", http.StatusNotImplemented)
}

// Helper functions

func (h *ValidationHandler) parseJSONBody(r *http.Request, v interface{}) error {
    body, err := io.ReadAll(io.LimitReader(r.Body, maxRequestSize))
    if err != nil {
        return fmt.Errorf("reading request body: %w", err)
    }
    defer r.Body.Close()

    if err := json.Unmarshal(body, v); err != nil {
        return fmt.Errorf("parsing JSON: %w", err)
    }

    return nil
}

func (h *ValidationHandler) validateRequest(req *ValidationRequest) error {
    if req.SourceDetection == nil {
        return errors.New("source detection is required")
    }
    if req.TargetDetection == nil {
        return errors.New("target detection is required")
    }
    
    if err := req.SourceDetection.Validate(); err != nil {
        return fmt.Errorf("invalid source detection: %w", err)
    }
    if err := req.TargetDetection.Validate(); err != nil {
        return fmt.Errorf("invalid target detection: %w", err)
    }

    return nil
}

func (h *ValidationHandler) sendSuccessResponse(w http.ResponseWriter, resp *ValidationResponse) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    if err := json.NewEncoder(w).Encode(resp); err != nil {
        h.log.Error("Failed to encode response",
            "error", err,
            "request_id", resp.RequestID,
        )
    }
}

func (h *ValidationHandler) sendErrorResponse(w http.ResponseWriter, status int, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    resp := ValidationResponse{
        Status:    "error",
        Error:     message,
        RequestID: w.Header().Get("X-Request-ID"),
        Timestamp: time.Now().UTC(),
    }
    if err := json.NewEncoder(w).Encode(resp); err != nil {
        h.log.Error("Failed to encode error response",
            "error", err,
            "status", status,
            "message", message,
        )
    }
}

func isRetryableError(err error) bool {
    // Add logic to determine if error is retryable
    // For example, timeout errors or temporary network issues
    return false
}