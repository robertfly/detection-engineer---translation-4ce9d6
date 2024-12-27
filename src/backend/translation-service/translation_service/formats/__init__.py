"""
Translation Service Format Module Entry Point

This module provides a unified interface for translating between different security detection formats
including Splunk SPL, SIGMA, KQL, QRadar, Palo Alto, Crowdstrike, YARA, and YARA-L.

Version: 1.0.0
"""

from typing import Dict, Type, Optional, List
import logging
from .splunk import SplunkFormat  # version: 1.0.0
from .sigma import SigmaFormatHandler  # version: 1.0.0 
from .kql import KQLFormat  # version: 1.0.0

# Initialize logger
from ..utils.logger import get_logger
logger = get_logger(__name__)

# Registry of supported format handlers
FORMAT_HANDLERS: Dict[str, Type] = {
    'splunk': SplunkFormat,
    'sigma': SigmaFormatHandler,
    'kql': KQLFormat
}

# List of all supported formats including those pending implementation
SUPPORTED_FORMATS: List[str] = [
    'splunk',
    'sigma', 
    'kql',
    'qradar',
    'paloalto',
    'crowdstrike',
    'yara',
    'yara-l'
]

def get_format_handler(format_name: str) -> object:
    """
    Factory function that creates and returns an instance of the appropriate format handler.
    
    Args:
        format_name: Name of the detection format to handle
        
    Returns:
        Initialized format handler instance
        
    Raises:
        ValueError: If format is not supported or handler initialization fails
    """
    try:
        # Validate format is supported
        if format_name not in SUPPORTED_FORMATS:
            raise ValueError(
                f"Unsupported format: {format_name}. "
                f"Supported formats: {', '.join(SUPPORTED_FORMATS)}"
            )
            
        # Get handler class
        handler_class = FORMAT_HANDLERS.get(format_name)
        if not handler_class:
            raise ValueError(f"Handler not implemented for format: {format_name}")
            
        # Initialize handler
        handler = handler_class()
        
        # Validate handler has required methods
        required_methods = ['parse', 'generate']
        missing_methods = [
            method for method in required_methods 
            if not hasattr(handler, method)
        ]
        if missing_methods:
            raise ValueError(
                f"Handler missing required methods: {', '.join(missing_methods)}"
            )
            
        logger.info(f"Initialized format handler for {format_name}")
        return handler
        
    except Exception as e:
        logger.error(f"Error initializing format handler: {str(e)}")
        raise ValueError(f"Failed to initialize format handler: {str(e)}")

def translate_detection(
    source_format: str,
    target_format: str,
    detection_content: str
) -> str:
    """
    High-level function that orchestrates the translation of a detection between formats.
    
    Args:
        source_format: Source detection format
        target_format: Target detection format
        detection_content: Detection content to translate
        
    Returns:
        Translated detection content
        
    Raises:
        ValueError: If formats are invalid or content is empty
        RuntimeError: If translation fails
    """
    try:
        # Input validation
        if not detection_content:
            raise ValueError("Empty detection content provided")
            
        logger.info(
            f"Starting detection translation",
            extra={
                'source_format': source_format,
                'target_format': target_format,
                'content_length': len(detection_content)
            }
        )
        
        # Get format handlers
        source_handler = get_format_handler(source_format)
        target_handler = get_format_handler(target_format)
        
        # Parse source detection to common model
        common_model = source_handler.parse(detection_content)
        if 'error' in common_model:
            raise ValueError(f"Source parsing failed: {common_model['error']}")
            
        # Validate parsed model
        if not common_model.get('is_valid', False):
            errors = common_model.get('validation_errors', ['Unknown validation error'])
            raise ValueError(f"Invalid source detection: {'; '.join(errors)}")
            
        # Generate target detection
        translated_content = target_handler.generate(common_model)
        if translated_content.startswith('// Error:'):
            raise ValueError(f"Target generation failed: {translated_content}")
            
        logger.info(
            f"Translation completed successfully",
            extra={
                'source_format': source_format,
                'target_format': target_format,
                'result_length': len(translated_content)
            }
        )
        
        return translated_content
        
    except Exception as e:
        logger.error(
            f"Translation failed",
            extra={
                'error': str(e),
                'source_format': source_format,
                'target_format': target_format
            }
        )
        raise RuntimeError(f"Translation failed: {str(e)}")

__all__ = [
    'get_format_handler',
    'translate_detection',
    'SUPPORTED_FORMATS'
]