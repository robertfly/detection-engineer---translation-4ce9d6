"""
Translation Service Core Services Package

This package provides enterprise-grade translation and validation services for security detection
translations between different formats. It includes comprehensive validation, confidence scoring,
and detailed error reporting capabilities.

Version: 1.0.0
"""

# version: 3.11+
from typing import List, Dict, Optional, Any

# Internal imports with version tracking
from .translation import TranslationService  # Internal service class
from .validation import (  # Internal validation components
    ValidationService,
    ValidationStatus,
    ValidationResult
)

# Global constants for supported formats and thresholds
SUPPORTED_FORMATS: List[str] = [
    'splunk',    # Splunk SPL
    'qradar',    # QRadar AQL
    'sigma',     # SIGMA Rules
    'kql',       # Azure KQL
    'paloalto',  # Palo Alto Networks
    'crowdstrike',  # Crowdstrike NG-SIEM
    'yara',      # YARA Rules
    'yaral'      # YARA-L Rules
]

# Minimum confidence threshold for valid translations
MIN_CONFIDENCE_THRESHOLD: float = 0.95

# Format version mapping for compatibility tracking
FORMAT_VERSION_MAP: Dict[str, str] = {
    'splunk': 'v1',      # Splunk SPL format version
    'qradar': 'v2',      # QRadar AQL format version
    'sigma': 'v2',       # SIGMA specification version
    'kql': 'v1',         # KQL format version
    'paloalto': 'v1',    # Palo Alto format version
    'crowdstrike': 'v1', # Crowdstrike format version
    'yara': 'v4',        # YARA rules version
    'yaral': 'v1'        # YARA-L format version
}

# Export core service components
__all__ = [
    # Core services
    'TranslationService',
    'ValidationService',
    
    # Validation components
    'ValidationStatus',
    'ValidationResult',
    
    # Configuration constants
    'SUPPORTED_FORMATS',
    'MIN_CONFIDENCE_THRESHOLD',
    'FORMAT_VERSION_MAP'
]

# Module version
__version__ = '1.0.0'

def get_supported_formats() -> List[str]:
    """
    Returns the list of supported detection formats.
    
    Returns:
        List[str]: List of supported format identifiers
    """
    return SUPPORTED_FORMATS.copy()

def get_format_version(format_name: str) -> Optional[str]:
    """
    Get the supported version for a specific format.
    
    Args:
        format_name: Name of the detection format
        
    Returns:
        Optional[str]: Format version if supported, None otherwise
    """
    return FORMAT_VERSION_MAP.get(format_name)

def validate_format_support(format_name: str) -> bool:
    """
    Validates if a given format is supported.
    
    Args:
        format_name: Name of the format to validate
        
    Returns:
        bool: True if format is supported
        
    Raises:
        ValueError: If format is not supported
    """
    if format_name not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Format '{format_name}' is not supported. "
            f"Supported formats: {', '.join(SUPPORTED_FORMATS)}"
        )
    return True