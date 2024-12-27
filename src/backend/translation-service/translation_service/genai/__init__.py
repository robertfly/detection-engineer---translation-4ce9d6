"""
GenAI Module for Security Detection Translation

This module provides a unified interface for AI-powered detection rule translation capabilities,
implementing comprehensive format validation, type safety, and performance monitoring.

Version: 1.0.0
"""

from typing import Dict, List, Optional, Any  # version: 3.11

# Import internal components with explicit version tracking
from .model import TranslationModel  # version: 1.0.0
from .embeddings import DetectionEmbedding as EmbeddingsManager  # version: 1.0.0
from .prompts import PromptManager  # version: 1.0.0

# Module version
__version__ = '1.0.0'

# Dictionary of supported detection formats with descriptions
SUPPORTED_FORMATS: Dict[str, str] = {
    'splunk': 'Splunk SPL',
    'qradar': 'QRadar AQL',
    'sigma': 'SIGMA',
    'kql': 'Azure KQL',
    'palo_alto': 'Palo Alto XQL',
    'crowdstrike': 'Crowdstrike NGQL',
    'yara': 'YARA',
    'yara_l': 'YARA-L'
}

class FormatValidationError(Exception):
    """
    Custom exception for format validation errors in detection translation.
    
    Attributes:
        message: Detailed error message
    """
    
    def __init__(self, message: str) -> None:
        """
        Initialize format validation error with detailed message.
        
        Args:
            message: Error description
        """
        super().__init__(message)


class TranslationError(Exception):
    """
    Custom exception for translation process errors with detailed context.
    
    Attributes:
        message: Error description
        details: Dictionary containing error context and metadata
    """
    
    def __init__(self, message: str, details: Dict[str, Any]) -> None:
        """
        Initialize translation error with message and detailed context.
        
        Args:
            message: Error description
            details: Dictionary containing error context
        """
        super().__init__(message)
        self._details = details

    @property
    def details(self) -> Dict[str, Any]:
        """Get error details dictionary."""
        return self._details


def validate_format(format_name: str) -> bool:
    """
    Validate if a detection format is supported by the translation service.
    
    Args:
        format_name: Name of the format to validate
        
    Returns:
        bool: True if format is supported
        
    Raises:
        FormatValidationError: If format is not supported
    """
    if not isinstance(format_name, str):
        raise FormatValidationError("Format name must be a string")
        
    if format_name not in SUPPORTED_FORMATS:
        supported = ', '.join(SUPPORTED_FORMATS.keys())
        raise FormatValidationError(
            f"Unsupported format: '{format_name}'. "
            f"Supported formats are: {supported}"
        )
        
    return True


# Module exports
__all__: List[str] = [
    'TranslationModel',
    'EmbeddingsManager',
    'PromptManager',
    'SUPPORTED_FORMATS',
    'FormatValidationError',
    'TranslationError',
    'validate_format'
]