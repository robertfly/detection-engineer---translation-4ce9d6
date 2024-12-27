// Package middleware provides HTTP middleware components for the validation service API
// with enhanced metrics collection and request tracking capabilities.
// Version: 1.0.0
package middleware

import (
    "net/http"
    "sync"
    "time"

    "validation-service/pkg/metrics" // v1.0.0 - Core metrics functionality
)

// responseWriterPool maintains a pool of response writer wrappers
// to minimize memory allocations during request handling
var responseWriterPool = sync.Pool{
    New: func() interface{} {
        return &statusResponseWriter{}
    },
}

// statusResponseWriter wraps http.ResponseWriter to capture response status code
type statusResponseWriter struct {
    http.ResponseWriter
    status      int
    wroteHeader bool
}

// WriteHeader captures the status code and delegates to the underlying ResponseWriter
func (w *statusResponseWriter) WriteHeader(status int) {
    if !w.wroteHeader {
        w.status = status
        w.wroteHeader = true
    }
    w.ResponseWriter.WriteHeader(status)
}

// Write implements http.ResponseWriter and sets default status if not already set
func (w *statusResponseWriter) Write(b []byte) (int, error) {
    if !w.wroteHeader {
        w.WriteHeader(http.StatusOK)
    }
    return w.ResponseWriter.Write(b)
}

// metricsHandler wraps the next handler with metrics collection capabilities
type metricsHandler struct {
    next http.Handler
}

// MetricsMiddleware creates a new middleware handler that records Prometheus metrics
// for all validation service API requests with enhanced error handling and request tracking.
func MetricsMiddleware(next http.Handler) http.Handler {
    return &metricsHandler{next: next}
}

// ServeHTTP implements the http.Handler interface with comprehensive metrics collection
func (h *metricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // Get response writer wrapper from pool
    sw := responseWriterPool.Get().(*statusResponseWriter)
    sw.ResponseWriter = w
    sw.wroteHeader = false
    sw.status = 0
    defer responseWriterPool.Put(sw)

    // Extract detection format from request
    // Default to "unknown" if format cannot be determined
    format := r.URL.Query().Get("format")
    if format == "" {
        format = "unknown"
    }

    // Record validation request metric
    if err := metrics.RecordValidationRequest(format); err != nil {
        // Log error but continue processing
        sw.WriteHeader(http.StatusInternalServerError)
        return
    }

    // Record start time with high precision
    start := time.Now()

    // Defer duration and error recording
    defer func() {
        // Record request duration
        duration := time.Since(start)
        if err := metrics.RecordValidationDuration(format, duration); err != nil {
            // Log error but continue
            sw.WriteHeader(http.StatusInternalServerError)
            return
        }

        // Record error metrics if status code indicates an error
        if sw.status >= http.StatusBadRequest {
            var errorType string
            switch {
            case sw.status >= http.StatusInternalServerError:
                errorType = "internal"
            case sw.status == http.StatusBadRequest:
                errorType = "validation"
            case sw.status == http.StatusUnprocessableEntity:
                errorType = "format"
            default:
                errorType = "configuration"
            }

            if err := metrics.RecordValidationError(format, errorType); err != nil {
                // Log error but continue
                sw.WriteHeader(http.StatusInternalServerError)
                return
            }
        }
    }()

    // Handle panics in next handler
    defer func() {
        if err := recover(); err != nil {
            sw.WriteHeader(http.StatusInternalServerError)
            // Record internal error metric
            _ = metrics.RecordValidationError(format, "internal")
            // Re-panic to allow global panic handler to deal with it
            panic(err)
        }
    }()

    // Call next handler with wrapped response writer
    h.next.ServeHTTP(sw, r)
}