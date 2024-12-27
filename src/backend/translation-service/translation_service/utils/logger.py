"""
Structured logging module for the Translation Service with ELK Stack integration.

This module provides comprehensive logging functionality with support for:
- JSON formatted logs
- Trace ID correlation
- Environment-specific configuration
- ELK Stack integration
- Advanced error handling and validation

Version: 1.0.0
"""

import logging
import json_logging  # version: 1.5.0
from typing import Optional, Dict, Any, Tuple
from contextvars import ContextVar
import uuid
import json
from ..config.logging import LogConfig

# Global context variable for trace ID tracking
TRACE_ID_CTX_VAR: ContextVar[str] = ContextVar('trace_id', default='')

# Default log format for non-JSON logging
DEFAULT_FORMAT: str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Performance optimization constants
LOG_BUFFER_SIZE: int = 8192
MAX_FIELD_LENGTH: int = 32768

class JsonFormatter(logging.Formatter):
    """Custom JSON formatter with enhanced validation and error handling."""

    def __init__(
        self,
        default_fields: Optional[Dict[str, Any]] = None,
        max_field_length: Optional[int] = None
    ) -> None:
        """
        Initialize the JSON formatter with validation rules and defaults.

        Args:
            default_fields: Dictionary of default fields to include in every log
            max_field_length: Maximum length for any field value
        """
        super().__init__()
        self._default_fields = default_fields or {}
        self._max_field_length = max_field_length or MAX_FIELD_LENGTH
        self._field_validators = {
            'level': lambda x: x in logging._nameToLevel,
            'timestamp': lambda x: isinstance(x, (int, float, str)),
            'trace_id': lambda x: isinstance(x, str) and len(x) <= 36
        }

    def format(self, record: logging.LogRecord) -> str:
        """
        Format the log record as JSON with comprehensive error handling.

        Args:
            record: The log record to format

        Returns:
            JSON formatted log string
        """
        try:
            # Create base log dictionary
            log_dict = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'name': record.name,
                'message': record.getMessage()
            }

            # Add trace ID if present
            trace_id = get_trace_id()
            if trace_id:
                log_dict['trace_id'] = trace_id

            # Add default fields
            log_dict.update(self._default_fields)

            # Add extra fields from record
            if hasattr(record, 'extra_fields'):
                for key, value in record.extra_fields.items():
                    valid, error = self.validate_field(key, value)
                    if valid:
                        log_dict[key] = value
                    else:
                        log_dict[f'invalid_{key}'] = error

            # Handle exception info if present
            if record.exc_info:
                log_dict['exception'] = self.formatException(record.exc_info)

            # Validate and truncate all fields
            for key, value in list(log_dict.items()):
                if isinstance(value, str) and len(value) > self._max_field_length:
                    log_dict[key] = value[:self._max_field_length] + '...[truncated]'

            return json.dumps(log_dict)
        except Exception as e:
            # Fallback formatting in case of errors
            return json.dumps({
                'timestamp': self.formatTime(record),
                'level': 'ERROR',
                'name': 'logger',
                'message': f'Error formatting log: {str(e)}',
                'original_message': str(record.msg)
            })

    def validate_field(self, field_name: str, field_value: Any) -> Tuple[bool, str]:
        """
        Validate a log field value against defined rules.

        Args:
            field_name: Name of the field to validate
            field_value: Value to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check field name validity
            if not isinstance(field_name, str) or not field_name.isidentifier():
                return False, "Invalid field name"

            # Apply field-specific validation
            if field_name in self._field_validators:
                if not self._field_validators[field_name](field_value):
                    return False, f"Invalid value for {field_name}"

            # Check field length
            if isinstance(field_value, str) and len(field_value) > self._max_field_length:
                return False, "Field value exceeds maximum length"

            return True, ""
        except Exception as e:
            return False, f"Validation error: {str(e)}"

def get_logger(name: str, config_override: Optional[Dict[str, Any]] = None) -> logging.Logger:
    """
    Create and configure a logger instance with environment-specific settings.

    Args:
        name: Name for the logger instance
        config_override: Optional configuration overrides

    Returns:
        Configured logger instance
    """
    # Get base logger instance
    logger = logging.getLogger(name)

    try:
        # Load environment configuration
        config = LogConfig()
        if config_override:
            for key, value in config_override.items():
                setattr(config, key, value)

        # Validate configuration
        if not config.validate():
            raise ValueError("Invalid logger configuration")

        # Configure log level
        logger.setLevel(config.level)

        # Clear existing handlers
        logger.handlers.clear()

        # Configure formatter based on environment
        if config.format == 'json' or config.environment in ('production', 'staging'):
            formatter = JsonFormatter(
                default_fields={'service': 'translation-service', 'environment': config.environment}
            )
        else:
            formatter = logging.Formatter(DEFAULT_FORMAT)

        # Configure console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        # Configure file handler if enabled
        if config.file_enabled:
            from logging.handlers import RotatingFileHandler
            file_handler = RotatingFileHandler(
                config.file_path,
                maxBytes=config.rotation_size,
                backupCount=config.retention_days,
                encoding='utf-8'
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

        return logger
    except Exception as e:
        # Fallback to basic logger in case of configuration errors
        basic_logger = logging.getLogger(f"{name}_fallback")
        basic_logger.setLevel(logging.INFO)
        basic_logger.addHandler(logging.StreamHandler())
        basic_logger.error(f"Error configuring logger: {str(e)}")
        return basic_logger

def set_trace_id(trace_id: str) -> None:
    """
    Set the trace ID for the current execution context.

    Args:
        trace_id: Trace ID to set
    """
    try:
        # Validate trace ID format
        uuid.UUID(trace_id)
        TRACE_ID_CTX_VAR.set(trace_id)
    except ValueError as e:
        logger = get_logger('trace_id_validator')
        logger.warning(f"Invalid trace ID format: {str(e)}")
        TRACE_ID_CTX_VAR.set('')

def get_trace_id() -> str:
    """
    Get the current trace ID from the execution context.

    Returns:
        Current trace ID or empty string if not set
    """
    return TRACE_ID_CTX_VAR.get()