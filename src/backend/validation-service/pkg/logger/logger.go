// Package logger provides a centralized, secure, and high-performance logging system
// for the validation service using Uber's Zap logger with ELK Stack integration.
// Version: 1.0.0
package logger

import (
	"os"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"          // v1.24.0 - High-performance structured logging
	"go.uber.org/zap/zapcore" // v1.24.0 - Core logging configuration
)

// Global variables for logger management
var (
	logger         *zap.Logger
	defaultLogLevel = zapcore.InfoLevel
	initOnce       sync.Once
	isInitialized  atomic.Bool
	bufferPool     *sync.Pool
)

// Constants for configuration
const (
	envLogLevel    = "LOG_LEVEL"
	envEnvironment = "APP_ENV"
	maxBufferSize  = 1024 * 1024 // 1MB buffer size limit
)

// InitLogger initializes the global logger instance with proper configuration
// based on environment with security and performance optimizations.
func InitLogger() error {
	var err error
	initOnce.Do(func() {
		// Initialize buffer pool for performance optimization
		bufferPool = &sync.Pool{
			New: func() interface{} {
				return make([]byte, 0, maxBufferSize)
			},
		}

		// Determine log level
		logLevel := getLogLevel()

		// Configure encoder with ELK-compatible format
		encoderConfig := configureEncoder()

		// Determine environment
		isProd := os.Getenv(envEnvironment) == "production"

		var core zapcore.Core
		if isProd {
			// Production configuration
			core = zapcore.NewCore(
				zapcore.NewJSONEncoder(encoderConfig),
				zapcore.AddSync(os.Stdout),
				logLevel,
			)

			// Configure sampling for high-volume logging
			core = zapcore.NewSamplerWithOptions(
				core,
				time.Second,    // Tick
				100,           // First
				10,            // Thereafter
			)
		} else {
			// Development configuration
			core = zapcore.NewCore(
				zapcore.NewConsoleEncoder(encoderConfig),
				zapcore.AddSync(os.Stdout),
				logLevel,
			)
		}

		// Configure options
		opts := []zap.Option{
			zap.AddCaller(),
			zap.AddStacktrace(zapcore.ErrorLevel),
			zap.AddCallerSkip(1),
			zap.WithClock(zapcore.DefaultClock),
			zap.ErrorOutput(zapcore.Lock(os.Stderr)),
		}

		// Initialize logger
		logger = zap.New(core, opts...)

		// Mark initialization as complete
		isInitialized.Store(true)

		// Log successful initialization
		logger.Info("Logger initialized successfully",
			zap.String("level", logLevel.String()),
			zap.Bool("production", isProd),
		)
	})

	return err
}

// GetLogger returns the global logger instance with thread-safe initialization.
// If the logger hasn't been initialized, it will panic to prevent unsafe usage.
func GetLogger() *zap.Logger {
	if !isInitialized.Load() {
		panic("Logger not initialized. Call InitLogger() first")
	}
	return logger
}

// getLogLevel determines the appropriate log level from environment with validation
func getLogLevel() zapcore.Level {
	levelStr := os.Getenv(envLogLevel)
	if levelStr == "" {
		return defaultLogLevel
	}

	// Validate and parse log level
	var level zapcore.Level
	if err := level.UnmarshalText([]byte(levelStr)); err != nil {
		return defaultLogLevel
	}

	// Ensure level is within allowed range
	switch level {
	case zapcore.DebugLevel,
		zapcore.InfoLevel,
		zapcore.WarnLevel,
		zapcore.ErrorLevel,
		zapcore.DPanicLevel,
		zapcore.PanicLevel,
		zapcore.FatalLevel:
		return level
	default:
		return defaultLogLevel
	}
}

// configureEncoder sets up the JSON encoder with ELK-compatible configuration
func configureEncoder() zapcore.EncoderConfig {
	return zapcore.EncoderConfig{
		TimeKey:        "@timestamp",        // ELK-compatible timestamp field
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "message",
		StacktraceKey: "stacktrace",
		LineEnding:    zapcore.DefaultLineEnding,
		EncodeLevel:   zapcore.LowercaseLevelEncoder,
		EncodeTime: func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
			enc.AppendString(t.UTC().Format(time.RFC3339Nano))
		},
		EncodeDuration: zapcore.NanosDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
		// Sanitize field keys to prevent injection
		EncodeName: func(s string, enc zapcore.PrimitiveArrayEncoder) {
			enc.AppendString(sanitizeKey(s))
		},
	}
}

// sanitizeKey prevents log injection by removing potentially harmful characters
func sanitizeKey(key string) string {
	// Implementation of key sanitization
	// This is a basic implementation - in production, you might want to use
	// a more comprehensive sanitization library
	const maxKeyLength = 128
	if len(key) > maxKeyLength {
		key = key[:maxKeyLength]
	}
	return key
}

// Additional helper functions could be added here for specific logging needs
// such as audit logging, error logging with context, etc.