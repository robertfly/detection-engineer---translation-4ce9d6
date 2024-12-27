// Package handlers provides HTTP handlers for the validation service API endpoints.
// Version: 1.0.0
package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"validation-service/pkg/logger"
	"validation-service/pkg/metrics"
)

// Version information
const (
	serviceVersion = "1.0.0"
	serviceName    = "validation-service"
)

// healthResponse defines the structure for health check responses
type healthResponse struct {
	Status       string                 `json:"status"`
	Timestamp    time.Time             `json:"timestamp"`
	Details      map[string]interface{} `json:"details,omitempty"`
	Version      string                `json:"version"`
	Dependencies map[string]bool       `json:"dependencies,omitempty"`
}

// LivenessHandler handles liveness probe requests to check if service is alive
func LivenessHandler(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	log := logger.GetLogger()

	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Prepare health response
	response := healthResponse{
		Status:    "UP",
		Timestamp: time.Now().UTC(),
		Version:   serviceVersion,
		Details: map[string]interface{}{
			"service": serviceName,
		},
	}

	// Encode response
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Error("Failed to encode liveness response",
			"error", err,
			"handler", "LivenessHandler",
		)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Record metrics
	duration := time.Since(startTime)
	metrics.RecordHealthCheckLatency("liveness", duration)
	metrics.RecordHealthCheck("liveness", true)

	// Log success
	log.Info("Liveness check completed",
		"duration_ms", duration.Milliseconds(),
		"status", "UP",
		"handler", "LivenessHandler",
	)
}

// ReadinessHandler handles readiness probe requests with comprehensive dependency checks
func ReadinessHandler(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	log := logger.GetLogger()

	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Check dependencies
	dependencies := make(map[string]bool)
	details := make(map[string]interface{})
	isReady := true

	// Check logger availability
	dependencies["logger"] = true
	if logger.GetLogger() == nil {
		dependencies["logger"] = false
		isReady = false
		details["logger_error"] = "Logger not initialized"
	}

	// Check metrics system
	dependencies["metrics"] = true
	if err := metrics.RecordHealthCheck("readiness", true); err != nil {
		dependencies["metrics"] = false
		isReady = false
		details["metrics_error"] = "Metrics system not responding"
	}

	// Prepare response status
	status := "UP"
	httpStatus := http.StatusOK
	if !isReady {
		status = "DOWN"
		httpStatus = http.StatusServiceUnavailable
	}

	// Prepare health response
	response := healthResponse{
		Status:       status,
		Timestamp:    time.Now().UTC(),
		Version:      serviceVersion,
		Dependencies: dependencies,
		Details:      details,
	}

	// Set HTTP status code
	w.WriteHeader(httpStatus)

	// Encode response
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Error("Failed to encode readiness response",
			"error", err,
			"handler", "ReadinessHandler",
		)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Record metrics
	duration := time.Since(startTime)
	metrics.RecordHealthCheckLatency("readiness", duration)
	metrics.RecordHealthCheck("readiness", isReady)

	// Log completion with details
	log.Info("Readiness check completed",
		"duration_ms", duration.Milliseconds(),
		"status", status,
		"dependencies", dependencies,
		"handler", "ReadinessHandler",
	)
}