"""
Central Configuration Module for Translation Service

This module provides comprehensive configuration management for all service components
including GenAI settings, logging, metrics, and message queue configuration.

Version: 1.0.0

External Dependencies:
- os (3.11+): Environment variable management
- typing (3.11+): Type hints
- dataclasses (3.11+): Configuration class structure
"""

import os
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

# Internal imports with comprehensive configuration components
from .genai import GenAIConfig
from .logging import setup_logging
from .metrics import MetricsConfig
from .queue import QueueConfig

# Global configuration settings with secure defaults
ENV: str = os.getenv('ENV', 'development')
DEBUG: bool = os.getenv('DEBUG', 'false').lower() == 'true'
CONFIG_VERSION: str = '1.0.0'

# Environment validation constants
VALID_ENVIRONMENTS = ['development', 'staging', 'production']

@dataclass
class ServiceConfig:
    """
    Main configuration class that aggregates all service configuration components
    with comprehensive validation and environment awareness.
    """
    
    env: str
    debug: bool
    version: str
    genai_config: GenAIConfig
    metrics_config: MetricsConfig
    queue_config: QueueConfig

    def __init__(self) -> None:
        """
        Initialize service configuration with all components and environment-specific settings.
        
        Raises:
            ValueError: If environment validation fails
            RuntimeError: If component initialization fails
        """
        # Validate and set environment
        if ENV not in VALID_ENVIRONMENTS:
            raise ValueError(f"Invalid environment: {ENV}. Must be one of {VALID_ENVIRONMENTS}")
        
        self.env = ENV
        self.debug = DEBUG
        self.version = CONFIG_VERSION

        try:
            # Initialize logging first for proper error tracking
            setup_logging(
                app_name='translation-service',
                log_level='DEBUG' if self.debug else 'INFO',
                env=self.env
            )

            # Initialize component configurations
            self.genai_config = GenAIConfig()
            self.metrics_config = MetricsConfig()
            self.queue_config = QueueConfig()

            # Validate complete configuration
            self.validate()

        except Exception as e:
            raise RuntimeError(f"Failed to initialize service configuration: {str(e)}")

    def validate(self) -> Tuple[bool, List[str]]:
        """
        Validates all configuration components with comprehensive error reporting.
        
        Returns:
            Tuple[bool, List[str]]: Validation result and list of validation errors
        """
        errors = []

        # Environment validation
        if self.env not in VALID_ENVIRONMENTS:
            errors.append(f"Invalid environment: {self.env}")

        # Version validation
        if not self.version or not isinstance(self.version, str):
            errors.append("Invalid configuration version")

        try:
            # Validate GenAI configuration
            self.genai_config.validate_format('splunk')  # Test with a default format
        except ValueError as e:
            errors.append(f"GenAI configuration error: {str(e)}")

        # Validate metrics configuration
        try:
            self.metrics_config.validate()
        except ValueError as e:
            errors.append(f"Metrics configuration error: {str(e)}")

        # Validate queue configuration
        valid, queue_errors = self.queue_config.validate()
        if not valid:
            errors.extend([f"Queue configuration error: {err}" for err in queue_errors])

        # Cross-component validation
        if self.env == 'production':
            # Ensure secure settings in production
            if not self.queue_config.ssl_enabled:
                errors.append("SSL must be enabled for queue in production")
            if not self.metrics_config.port >= 1024:
                errors.append("Metrics port must be non-privileged in production")

        return len(errors) == 0, errors

def init_config() -> ServiceConfig:
    """
    Initializes all configuration components for the translation service
    with validation and secure defaults.
    
    Returns:
        ServiceConfig: Initialized and validated service configuration object
        
    Raises:
        RuntimeError: If configuration initialization fails
    """
    try:
        config = ServiceConfig()
        valid, errors = config.validate()
        
        if not valid:
            raise ValueError(f"Configuration validation failed: {', '.join(errors)}")
            
        return config
        
    except Exception as e:
        raise RuntimeError(f"Failed to initialize configuration: {str(e)}")

def validate_config(config: ServiceConfig) -> Tuple[bool, List[str]]:
    """
    Validates all configuration components with detailed error reporting.
    
    Args:
        config: ServiceConfig instance to validate
        
    Returns:
        Tuple[bool, List[str]]: Validation result and list of validation errors
    """
    return config.validate()

# Export configuration components
__all__ = [
    'ServiceConfig',
    'init_config',
    'validate_config',
    'ENV',
    'DEBUG',
    'CONFIG_VERSION'
]