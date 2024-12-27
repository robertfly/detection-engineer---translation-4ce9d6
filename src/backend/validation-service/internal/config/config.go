// Package config provides comprehensive configuration management for the validation service
// with support for multiple deployment environments and secure configuration handling.
// Version: 1.0.0
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"validation-service/pkg/logger"
	"validation-service/pkg/metrics"
)

// Global configuration instance with thread-safe access
var (
	config      *Config
	configOnce  sync.Once
	configMutex sync.RWMutex
)

// Environment constants
const (
	EnvDevelopment = "development"
	EnvStaging     = "staging"
	EnvProduction  = "production"
)

// Environment variable keys
const (
	envEnvironment      = "APP_ENV"
	envServerHost       = "SERVER_HOST"
	envServerPort       = "SERVER_PORT"
	envRequestTimeout   = "REQUEST_TIMEOUT"
	envShutdownTimeout  = "SHUTDOWN_TIMEOUT"
	envMetricsEnabled   = "METRICS_ENABLED"
	envLogLevel        = "LOG_LEVEL"
	envMaxRuleSize     = "MAX_RULE_SIZE"
	envEncryptionKey   = "ENCRYPTION_KEY"
	envConfigFile      = "CONFIG_FILE"
)

// Config represents the complete service configuration
type Config struct {
	Environment     string           `json:"environment"`
	ServerHost      string           `json:"server_host"`
	ServerPort      int             `json:"server_port"`
	RequestTimeout  time.Duration    `json:"request_timeout"`
	ShutdownTimeout time.Duration    `json:"shutdown_timeout"`
	MetricsEnabled  bool            `json:"metrics_enabled"`
	LogLevel        string          `json:"log_level"`
	Validation      ValidationConfig `json:"validation"`
	Security        SecurityConfig   `json:"security"`
	Monitoring      MonitoringConfig `json:"monitoring"`
}

// ValidationConfig contains validation-specific settings
type ValidationConfig struct {
	MaxRuleSize      int              `json:"max_rule_size"`
	ValidationTimeout time.Duration    `json:"validation_timeout"`
	SupportedFormats []string         `json:"supported_formats"`
	FormatMappings   map[string]string `json:"format_mappings"`
	StrictValidation bool             `json:"strict_validation"`
}

// SecurityConfig contains security-related settings
type SecurityConfig struct {
	EncryptionKey    string `json:"encryption_key"`
	EnableAuditLog   bool   `json:"enable_audit_log"`
	AuditLogPath     string `json:"audit_log_path"`
	MaskSensitiveData bool  `json:"mask_sensitive_data"`
}

// MonitoringConfig contains monitoring and observability settings
type MonitoringConfig struct {
	MetricsEndpoint  string        `json:"metrics_endpoint"`
	MetricsPort      int           `json:"metrics_port"`
	EnabledMetrics   []string      `json:"enabled_metrics"`
	MetricsInterval  time.Duration `json:"metrics_interval"`
}

// LoadConfig loads and validates service configuration from environment
// variables and optional configuration file.
func LoadConfig() (*Config, error) {
	var cfg Config
	var err error

	// Load configuration file if specified
	if configFile := os.Getenv(envConfigFile); configFile != "" {
		if err := loadConfigFile(configFile, &cfg); err != nil {
			return nil, fmt.Errorf("failed to load config file: %w", err)
		}
	}

	// Load environment variables with precedence over file config
	if err := loadEnvConfig(&cfg); err != nil {
		return nil, fmt.Errorf("failed to load environment config: %w", err)
	}

	// Set defaults for unspecified values
	setDefaults(&cfg)

	// Validate configuration
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	// Initialize logger with config settings
	if err := logger.InitLogger(); err != nil {
		return nil, fmt.Errorf("failed to initialize logger: %w", err)
	}

	// Initialize metrics if enabled
	if cfg.MetricsEnabled {
		if err := metrics.InitMetrics(); err != nil {
			return nil, fmt.Errorf("failed to initialize metrics: %w", err)
		}
	}

	// Store configuration globally
	configMutex.Lock()
	config = &cfg
	configMutex.Unlock()

	return &cfg, nil
}

// GetConfig returns the global configuration instance in a thread-safe manner
func GetConfig() *Config {
	configMutex.RLock()
	defer configMutex.RUnlock()

	if config == nil {
		panic("configuration not initialized")
	}
	return config
}

// loadConfigFile loads configuration from a JSON file
func loadConfigFile(filepath string, cfg *Config) error {
	file, err := os.ReadFile(filepath)
	if err != nil {
		return fmt.Errorf("error reading config file: %w", err)
	}

	if err := json.Unmarshal(file, cfg); err != nil {
		return fmt.Errorf("error parsing config file: %w", err)
	}

	return nil
}

// loadEnvConfig loads configuration from environment variables
func loadEnvConfig(cfg *Config) error {
	// Core settings
	cfg.Environment = getEnvOrDefault(envEnvironment, EnvDevelopment)
	cfg.ServerHost = getEnvOrDefault(envServerHost, "0.0.0.0")
	cfg.ServerPort = getEnvAsIntOrDefault(envServerPort, 8080)
	cfg.RequestTimeout = getEnvAsDurationOrDefault(envRequestTimeout, 30*time.Second)
	cfg.ShutdownTimeout = getEnvAsDurationOrDefault(envShutdownTimeout, 10*time.Second)
	cfg.MetricsEnabled = getEnvAsBoolOrDefault(envMetricsEnabled, true)
	cfg.LogLevel = getEnvOrDefault(envLogLevel, "info")

	// Validation settings
	cfg.Validation.MaxRuleSize = getEnvAsIntOrDefault(envMaxRuleSize, 1024*1024) // 1MB
	cfg.Validation.ValidationTimeout = getEnvAsDurationOrDefault("VALIDATION_TIMEOUT", 5*time.Second)
	cfg.Validation.StrictValidation = getEnvAsBoolOrDefault("STRICT_VALIDATION", true)

	// Security settings
	cfg.Security.EncryptionKey = os.Getenv(envEncryptionKey)
	cfg.Security.EnableAuditLog = getEnvAsBoolOrDefault("ENABLE_AUDIT_LOG", true)
	cfg.Security.MaskSensitiveData = getEnvAsBoolOrDefault("MASK_SENSITIVE_DATA", true)

	return nil
}

// setDefaults sets default values for unspecified configuration
func setDefaults(cfg *Config) {
	// Set default supported formats if not specified
	if len(cfg.Validation.SupportedFormats) == 0 {
		cfg.Validation.SupportedFormats = []string{
			"splunk", "qradar", "sigma", "kql",
			"paloalto", "crowdstrike", "yara", "yara-l",
		}
	}

	// Set default monitoring configuration
	if cfg.Monitoring.MetricsEndpoint == "" {
		cfg.Monitoring.MetricsEndpoint = "/metrics"
	}
	if cfg.Monitoring.MetricsPort == 0 {
		cfg.Monitoring.MetricsPort = 9090
	}
	if cfg.Monitoring.MetricsInterval == 0 {
		cfg.Monitoring.MetricsInterval = 15 * time.Second
	}

	// Set default audit log path if enabled
	if cfg.Security.EnableAuditLog && cfg.Security.AuditLogPath == "" {
		cfg.Security.AuditLogPath = "/var/log/validation-service/audit.log"
	}
}

// validate performs comprehensive validation of all configuration settings
func (c *Config) validate() error {
	// Validate environment
	switch c.Environment {
	case EnvDevelopment, EnvStaging, EnvProduction:
		// Valid environment
	default:
		return fmt.Errorf("invalid environment: %s", c.Environment)
	}

	// Validate server configuration
	if c.ServerPort < 1 || c.ServerPort > 65535 {
		return fmt.Errorf("invalid server port: %d", c.ServerPort)
	}

	// Validate timeouts
	if c.RequestTimeout < time.Second {
		return fmt.Errorf("request timeout too short: %v", c.RequestTimeout)
	}
	if c.ShutdownTimeout < time.Second {
		return fmt.Errorf("shutdown timeout too short: %v", c.ShutdownTimeout)
	}

	// Validate validation configuration
	if c.Validation.MaxRuleSize < 1 {
		return fmt.Errorf("invalid max rule size: %d", c.Validation.MaxRuleSize)
	}
	if len(c.Validation.SupportedFormats) == 0 {
		return fmt.Errorf("no supported formats specified")
	}

	// Validate security configuration
	if c.Environment == EnvProduction && c.Security.EncryptionKey == "" {
		return fmt.Errorf("encryption key required in production")
	}

	return nil
}

// Helper functions for environment variable parsing
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvAsDurationOrDefault(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}