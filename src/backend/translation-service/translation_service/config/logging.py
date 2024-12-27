"""
Logging configuration module for the Translation Service.

This module provides comprehensive logging configuration with ELK Stack integration,
structured JSON logging, trace ID support, and environment-specific settings.

Version: 1.0.0
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any
import json_logging  # version: 1.5.0

# Global configuration defaults from environment variables
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = os.getenv('LOG_FORMAT', 'json')
ENABLE_FILE_LOGGING = os.getenv('ENABLE_FILE_LOGGING', 'false').lower() == 'true'
LOG_FILE_PATH = os.getenv('LOG_FILE_PATH', '/var/log/translation-service/app.log')
ENABLE_ELK = os.getenv('ENABLE_ELK', 'true').lower() == 'true'
ENABLE_TRACE_ID = os.getenv('ENABLE_TRACE_ID', 'true').lower() == 'true'
LOG_ROTATION_SIZE = int(os.getenv('LOG_ROTATION_SIZE', '10485760'))  # 10MB default
LOG_RETENTION_DAYS = int(os.getenv('LOG_RETENTION_DAYS', '30'))

@dataclass
class LogConfig:
    """Configuration class for comprehensive logging settings."""
    
    level: str
    format: str
    file_enabled: bool
    file_path: str
    elk_enabled: bool
    trace_id_enabled: bool
    rotation_size: int
    retention_days: int
    environment: str

    def __init__(
        self,
        level: Optional[str] = None,
        format: Optional[str] = None,
        file_enabled: Optional[bool] = None,
        file_path: Optional[str] = None,
        elk_enabled: Optional[bool] = None,
        trace_id_enabled: Optional[bool] = None,
        rotation_size: Optional[int] = None,
        retention_days: Optional[int] = None,
        environment: Optional[str] = None
    ):
        """Initialize logging configuration with comprehensive settings."""
        self.level = level or LOG_LEVEL
        self.format = format or LOG_FORMAT
        self.file_enabled = file_enabled if file_enabled is not None else ENABLE_FILE_LOGGING
        self.file_path = file_path or LOG_FILE_PATH
        self.elk_enabled = elk_enabled if elk_enabled is not None else ENABLE_ELK
        self.trace_id_enabled = trace_id_enabled if trace_id_enabled is not None else ENABLE_TRACE_ID
        self.rotation_size = rotation_size or LOG_ROTATION_SIZE
        self.retention_days = retention_days or LOG_RETENTION_DAYS
        self.environment = environment or os.getenv('ENV', 'development')

    def validate(self) -> bool:
        """Validate the comprehensive logging configuration settings."""
        try:
            # Validate log level
            if self.level not in logging._nameToLevel:
                raise ValueError(f"Invalid log level: {self.level}")

            # Validate log format
            if self.format not in ['json', 'text']:
                raise ValueError(f"Invalid log format: {self.format}")

            # Validate file logging settings
            if self.file_enabled:
                log_dir = os.path.dirname(self.file_path)
                if not os.path.exists(log_dir):
                    os.makedirs(log_dir, exist_ok=True)

            # Validate rotation and retention settings
            if self.rotation_size <= 0:
                raise ValueError("Rotation size must be positive")
            if self.retention_days <= 0:
                raise ValueError("Retention days must be positive")

            # Validate environment
            if self.environment not in ['development', 'staging', 'production']:
                raise ValueError(f"Invalid environment: {self.environment}")

            return True
        except Exception as e:
            logging.error(f"Log configuration validation failed: {str(e)}")
            return False

def setup_logging(
    app_name: str = 'translation-service',
    log_level: Optional[str] = None,
    env: Optional[str] = None
) -> None:
    """Initialize and configure the logging system with comprehensive settings."""
    
    # Create and validate config
    config = LogConfig(level=log_level, environment=env)
    if not config.validate():
        raise ValueError("Invalid logging configuration")

    # Initialize JSON logging for ELK Stack integration
    if config.elk_enabled:
        json_logging.init_non_web(enable_json=True)
        json_logging.init_request_instrument()

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(config.level)
    
    # Clear existing handlers
    root_logger.handlers.clear()

    # Configure console handler
    console_handler = logging.StreamHandler()
    if config.format == 'json':
        formatter = json_logging.JSONLogFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(trace_id)s - %(message)s'
        )
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Configure file handler if enabled
    if config.file_enabled:
        from logging.handlers import RotatingFileHandler
        file_handler = RotatingFileHandler(
            config.file_path,
            maxBytes=config.rotation_size,
            backupCount=config.retention_days
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    # Configure environment-specific settings
    if config.environment == 'development':
        logging.getLogger('translation_service').setLevel(logging.DEBUG)
    elif config.environment == 'production':
        # Add production-specific handlers (e.g., error notification)
        pass

    # Log initial configuration
    logging.info(
        f"Logging initialized for {app_name}",
        extra={
            "app_name": app_name,
            "environment": config.environment,
            "log_level": config.level,
            "elk_enabled": config.elk_enabled,
            "trace_id_enabled": config.trace_id_enabled
        }
    )

def get_log_config() -> Dict[str, Any]:
    """Return the current logging configuration settings."""
    config = LogConfig()
    return {
        "level": config.level,
        "format": config.format,
        "file_enabled": config.file_enabled,
        "file_path": config.file_path,
        "elk_enabled": config.elk_enabled,
        "trace_id_enabled": config.trace_id_enabled,
        "rotation_size": config.rotation_size,
        "retention_days": config.retention_days,
        "environment": config.environment
    }