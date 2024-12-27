"""
Metrics Configuration Module

This module provides secure and validated configuration settings for Prometheus metrics
collection in the translation service. It includes configuration for metrics server,
collection endpoints, and operational parameters with security constraints.

Version: 1.0.0
"""

import os
import re
from dataclasses import dataclass
from typing import Optional

# Constants for metrics configuration with secure defaults
METRICS_PORT = int(os.getenv('METRICS_PORT', '9090'))
METRICS_PATH = os.getenv('METRICS_PATH', '/metrics')
METRICS_ENABLED = os.getenv('METRICS_ENABLED', 'true').lower() == 'true'

# Security constraints for port range
MIN_PORT = 1024  # Minimum non-privileged port
MAX_PORT = 65535  # Maximum valid port number

@dataclass
class MetricsConfig:
    """
    Configuration class for Prometheus metrics settings with validation and security constraints.
    
    Attributes:
        port (int): Port number for metrics server (1024-65535)
        path (str): HTTP path for metrics endpoint
        enabled (bool): Flag to enable/disable metrics collection
    """
    
    port: int
    path: str
    enabled: bool
    
    def __init__(
        self,
        port: Optional[int] = None,
        path: Optional[str] = None,
        enabled: Optional[bool] = None
    ) -> None:
        """
        Initialize metrics configuration with validated default values.
        
        Args:
            port: Optional port number for metrics server
            path: Optional HTTP path for metrics endpoint
            enabled: Optional flag to enable/disable metrics
            
        Raises:
            ValueError: If any configuration value is invalid
        """
        self.port = port if port is not None else METRICS_PORT
        self.path = path if path is not None else METRICS_PATH
        self.enabled = enabled if enabled is not None else METRICS_ENABLED
        
        # Validate initial configuration
        self.validate()
    
    def validate(self) -> bool:
        """
        Validates the complete metrics configuration against security and operational constraints.
        
        Returns:
            bool: True if configuration is valid
            
        Raises:
            ValueError: If any configuration value is invalid
        """
        # Validate individual components
        self.validate_port()
        self.validate_path()
        
        # Validate enabled flag type
        if not isinstance(self.enabled, bool):
            raise ValueError("Metrics enabled flag must be a boolean value")
        
        return True
    
    def validate_port(self) -> bool:
        """
        Validates the metrics port against security constraints.
        
        Returns:
            bool: True if port is valid
            
        Raises:
            ValueError: If port is invalid
        """
        if not isinstance(self.port, int):
            raise ValueError("Metrics port must be an integer")
            
        if not MIN_PORT <= self.port <= MAX_PORT:
            raise ValueError(
                f"Metrics port must be between {MIN_PORT} and {MAX_PORT}"
            )
        
        return True
    
    def validate_path(self) -> bool:
        """
        Validates the metrics path format and security.
        
        Returns:
            bool: True if path is valid
            
        Raises:
            ValueError: If path is invalid
        """
        if not isinstance(self.path, str):
            raise ValueError("Metrics path must be a string")
            
        if not self.path.startswith('/'):
            raise ValueError("Metrics path must start with '/'")
            
        # Check for unsafe characters in path
        unsafe_pattern = r'[^a-zA-Z0-9/\-_]'
        if re.search(unsafe_pattern, self.path):
            raise ValueError(
                "Metrics path contains unsafe characters. "
                "Only alphanumeric, hyphen, and underscore are allowed."
            )
        
        return True

def get_metrics_config() -> MetricsConfig:
    """
    Returns the current metrics configuration settings with validation.
    
    Returns:
        MetricsConfig: Validated metrics configuration instance
        
    Raises:
        ValueError: If configuration validation fails
    """
    try:
        config = MetricsConfig(
            port=METRICS_PORT,
            path=METRICS_PATH,
            enabled=METRICS_ENABLED
        )
        # Validate complete configuration
        config.validate()
        return config
    except ValueError as e:
        # Re-raise with additional context
        raise ValueError(f"Invalid metrics configuration: {str(e)}") from e