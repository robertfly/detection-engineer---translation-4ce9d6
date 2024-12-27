// Package router provides the main HTTP router configuration for the validation service
// with comprehensive security, monitoring, and health check capabilities.
// Version: 1.0.0
package router

import (
    "net/http"
    "time"

    "github.com/go-chi/chi/v5" // v5.0.8
    "github.com/go-chi/chi/v5/middleware" // v5.0.8
    "github.com/go-chi/cors" // v5.0.8

    "validation-service/internal/api/handlers"
    "validation-service/internal/api/middleware/auth"
    "validation-service/internal/api/middleware/logging"
    "validation-service/internal/api/middleware/metrics"
    "validation-service/pkg/logger"
)

const (
    // Request timeouts
    readTimeout     = 30 * time.Second
    writeTimeout    = 30 * time.Second
    requestTimeout  = 30 * time.Second
    
    // API versioning
    apiVersion = "v1"
)

// NewRouter creates and configures a new HTTP router with comprehensive middleware
// stack, security controls, and API endpoints.
func NewRouter(validationHandler *handlers.ValidationHandler) *chi.Mux {
    // Initialize logger
    log := logger.GetLogger()
    
    // Create new router instance
    router := chi.NewRouter()

    // Set up global middleware stack
    setupMiddleware(router)

    // Configure health check endpoints
    setupHealthRoutes(router)

    // Configure API routes
    setupAPIRoutes(router, validationHandler)

    log.Info("Router configured successfully",
        "api_version", apiVersion,
        "timeouts_configured", true,
        "security_enabled", true,
    )

    return router
}

// setupMiddleware configures the global middleware stack with security,
// monitoring, and performance optimization.
func setupMiddleware(router *chi.Mux) {
    // Basic middleware
    router.Use(middleware.RequestID)
    router.Use(middleware.RealIP)
    router.Use(middleware.Recoverer)

    // Timeout control
    router.Use(middleware.Timeout(requestTimeout))

    // Compression middleware
    router.Use(middleware.Compress(5))

    // Custom logging middleware
    router.Use(logging.LoggingMiddleware)

    // Metrics collection middleware
    router.Use(metrics.MetricsMiddleware)

    // Security middleware
    router.Use(middleware.StripSlashes)
    router.Use(middleware.NoCache)
    router.Use(middleware.GetHead)

    // CORS configuration
    router.Use(cors.Handler(cors.Options{
        AllowedOrigins:   []string{"https://*"},
        AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
        AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
        ExposedHeaders:   []string{"Link"},
        AllowCredentials: true,
        MaxAge:          300,
    }))

    // Authentication middleware
    router.Use(auth.AuthMiddleware())
}

// setupHealthRoutes configures kubernetes-compatible health check endpoints
// with detailed status reporting.
func setupHealthRoutes(router *chi.Mux) {
    router.Get("/health/live", handlers.LivenessHandler)
    router.Get("/health/ready", handlers.ReadinessHandler)
    router.Get("/metrics", handlers.MetricsHandler)
}

// setupAPIRoutes configures versioned API routes with proper middleware
// and handler bindings.
func setupAPIRoutes(router *chi.Mux, validationHandler *handlers.ValidationHandler) {
    // API version group
    router.Route("/api/v1", func(r chi.Router) {
        // Validation endpoints
        r.Post("/validate", validationHandler.ValidateHandler)
        r.Post("/validate/batch", validationHandler.ValidateBatchHandler)

        // Additional API endpoints can be added here
        r.Get("/formats", validationHandler.GetSupportedFormatsHandler)
        r.Get("/status", validationHandler.GetServiceStatusHandler)
    })
}

// Additional helper functions can be added below as needed