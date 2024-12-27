// Package main provides the entry point for the validation service with comprehensive
// configuration management, metrics collection, and graceful shutdown capabilities.
// Version: 1.0.0
package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "validation-service/internal/api/router"
    "validation-service/internal/api/handlers"
    "validation-service/internal/config"
    "validation-service/internal/services/validation"
    "validation-service/pkg/logger"
    "validation-service/pkg/metrics"
)

// Global constants for server configuration
const (
    // Default timeouts
    readTimeout     = 30 * time.Second
    writeTimeout    = 30 * time.Second
    idleTimeout     = 60 * time.Second
    shutdownTimeout = 30 * time.Second

    // Server defaults
    defaultPort = 8080
)

func main() {
    // Initialize structured logging
    if err := logger.InitLogger(); err != nil {
        log.Fatalf("Failed to initialize logger: %v", err)
    }
    log := logger.GetLogger()

    // Load service configuration
    cfg, err := config.LoadConfig()
    if err != nil {
        log.Fatal("Failed to load configuration",
            "error", err,
        )
    }

    // Initialize metrics collector
    if cfg.MetricsEnabled {
        if err := metrics.InitMetrics(); err != nil {
            log.Fatal("Failed to initialize metrics",
                "error", err,
            )
        }
        log.Info("Metrics collection enabled")
    }

    // Initialize validation service
    validationService := validation.NewValidationService(validation.ValidationConfig{
        EnableDetailedFeedback: true,
        ValidationTimeout:     cfg.Validation.ValidationTimeout,
        StrictMode:           cfg.Validation.StrictValidation,
        MetricsEnabled:       cfg.MetricsEnabled,
    })

    // Initialize validation handler
    validationHandler := handlers.NewValidationHandler(validationService)

    // Initialize router with middleware
    router := router.NewRouter(validationHandler)

    // Configure and create HTTP server
    server := setupServer(cfg, router)

    // Start server in a goroutine
    go func() {
        log.Info("Starting validation service",
            "address", server.Addr,
            "env", cfg.Environment,
        )

        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal("Server failed",
                "error", err,
            )
        }
    }()

    // Set up signal handling for graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT, syscall.SIGQUIT)

    // Wait for shutdown signal
    sig := <-quit
    log.Info("Received shutdown signal",
        "signal", sig,
    )

    // Create shutdown context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
    defer cancel()

    // Perform graceful shutdown
    if err := gracefulShutdown(ctx, server); err != nil {
        log.Error("Server shutdown failed",
            "error", err,
        )
        os.Exit(1)
    }

    log.Info("Server shutdown completed successfully")
}

// setupServer configures and creates the HTTP server with proper timeouts and settings
func setupServer(cfg *config.Config, handler http.Handler) *http.Server {
    return &http.Server{
        Addr:    fmt.Sprintf("%s:%d", cfg.ServerHost, cfg.ServerPort),
        Handler: handler,
        // Timeouts
        ReadTimeout:       readTimeout,
        WriteTimeout:      writeTimeout,
        IdleTimeout:       idleTimeout,
        ReadHeaderTimeout: 5 * time.Second,
        // Additional settings
        MaxHeaderBytes:    1 << 20, // 1MB
        ErrorLog:          log.New(os.Stderr, "HTTP: ", log.LstdFlags),
    }
}

// gracefulShutdown handles graceful server shutdown with connection draining
func gracefulShutdown(ctx context.Context, server *http.Server) error {
    // Get logger instance
    log := logger.GetLogger()

    log.Info("Initiating graceful shutdown")

    // Record shutdown initiation in metrics
    if err := metrics.RecordValidationRequest("shutdown"); err != nil {
        log.Error("Failed to record shutdown metric",
            "error", err,
        )
    }

    // Shutdown server with context timeout
    if err := server.Shutdown(ctx); err != nil {
        return fmt.Errorf("server shutdown failed: %w", err)
    }

    // Wait for context to be done
    select {
    case <-ctx.Done():
        return fmt.Errorf("shutdown context timeout: %w", ctx.Err())
    default:
        log.Info("Graceful shutdown completed")
        return nil
    }
}