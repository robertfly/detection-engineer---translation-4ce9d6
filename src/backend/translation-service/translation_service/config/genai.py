"""
GenAI Configuration Module for Translation Service

This module provides comprehensive configuration management for the GenAI translation model,
including model parameters, embeddings, format-specific settings, and validation.

Version: 1.0.0
"""

from pydantic import BaseSettings, Field, validator  # version: 2.4.0
from typing import Dict, List, Optional, Union  # version: 3.11
from pathlib import Path  # version: 3.11
from os import getenv  # version: 3.11
from ..utils.logger import get_logger  # Internal import

# Initialize logger
logger = get_logger(__name__)

# Supported detection formats
SUPPORTED_FORMATS = [
    'splunk', 'qradar', 'sigma', 'kql', 'paloalto', 
    'crowdstrike', 'yara', 'yaral'
]

# Default confidence thresholds for each format
DEFAULT_CONFIDENCE_THRESHOLDS = {
    'splunk': 0.95,
    'qradar': 0.92,
    'sigma': 0.90,
    'kql': 0.93,
    'paloalto': 0.94,
    'crowdstrike': 0.91,
    'yara': 0.96,
    'yaral': 0.96
}

class GenAIConfig(BaseSettings):
    """
    Comprehensive configuration class for GenAI translation model settings.
    Provides secure defaults and comprehensive validation for all settings.
    """
    
    # Model Configuration
    model_name: str = Field(
        default="gpt-4",
        description="Base GenAI model identifier"
    )
    
    embedding_model: str = Field(
        default="text-embedding-ada-002",
        description="Model for detection embeddings"
    )
    
    temperature: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Model temperature for generation"
    )
    
    max_tokens: int = Field(
        default=4096,
        gt=0,
        le=8192,
        description="Maximum tokens for model output"
    )
    
    embeddings_cache_dir: Path = Field(
        default=Path("/tmp/translation-service/embeddings"),
        description="Cache directory for embeddings"
    )
    
    supported_formats: List[str] = Field(
        default_factory=lambda: SUPPORTED_FORMATS,
        description="List of supported detection formats"
    )
    
    format_confidence_thresholds: Dict[str, float] = Field(
        default_factory=lambda: DEFAULT_CONFIDENCE_THRESHOLDS.copy(),
        description="Confidence thresholds per format"
    )
    
    version: str = Field(
        default="1.0.0",
        description="Configuration version"
    )
    
    format_specific_settings: Dict[str, Dict] = Field(
        default_factory=lambda: {
            "splunk": {
                "field_mapping_confidence": 0.95,
                "syntax_validation_level": "strict"
            },
            "sigma": {
                "yaml_validation": True,
                "condition_complexity_limit": 5
            },
            "kql": {
                "time_window_handling": "preserve",
                "function_mapping_strict": True
            },
            "yara": {
                "string_extraction_confidence": 0.96,
                "rule_complexity_limit": 4
            }
        },
        description="Format-specific configuration settings"
    )

    class Config:
        """Pydantic configuration settings"""
        env_prefix = "GENAI_"
        case_sensitive = True
        validate_assignment = True
        
    @validator("embeddings_cache_dir")
    def validate_cache_dir(cls, v: Path) -> Path:
        """Validate and create embeddings cache directory if needed."""
        try:
            v.mkdir(parents=True, exist_ok=True)
            logger.info(f"Validated embeddings cache directory: {v}")
            return v
        except Exception as e:
            logger.error(f"Failed to create embeddings cache directory: {e}")
            raise ValueError(f"Invalid cache directory configuration: {e}")

    def validate_format(self, format_name: str) -> bool:
        """
        Validate if a given format is supported.
        
        Args:
            format_name: Name of the format to validate
            
        Returns:
            bool: True if format is supported
            
        Raises:
            ValueError: If format is not supported
        """
        if format_name not in self.supported_formats:
            logger.error(f"Unsupported format requested: {format_name}")
            raise ValueError(
                f"Format '{format_name}' is not supported. "
                f"Supported formats: {', '.join(self.supported_formats)}"
            )
        logger.debug(f"Format validation successful: {format_name}")
        return True

    def get_format_settings(self, format_name: str) -> Dict:
        """
        Retrieve format-specific configuration settings.
        
        Args:
            format_name: Name of the format
            
        Returns:
            Dict: Format-specific configuration dictionary
        """
        self.validate_format(format_name)
        settings = self.format_specific_settings.get(format_name, {})
        logger.debug(f"Retrieved settings for format {format_name}: {settings}")
        return settings

    def update_confidence_threshold(self, format_name: str, threshold: float) -> None:
        """
        Update confidence threshold for a specific format.
        
        Args:
            format_name: Name of the format
            threshold: New confidence threshold value
            
        Raises:
            ValueError: If threshold is invalid or format not supported
        """
        self.validate_format(format_name)
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("Confidence threshold must be between 0.0 and 1.0")
            
        self.format_confidence_thresholds[format_name] = threshold
        logger.info(
            f"Updated confidence threshold for {format_name}: {threshold}"
        )

def load_config(env_prefix: str = "GENAI_") -> GenAIConfig:
    """
    Load and initialize GenAI configuration from environment variables.
    
    Args:
        env_prefix: Prefix for environment variables
        
    Returns:
        GenAIConfig: Initialized and validated configuration object
    """
    try:
        logger.info("Initializing GenAI configuration")
        config = GenAIConfig(_env_prefix=env_prefix)
        
        # Ensure cache directory exists
        config.embeddings_cache_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(
            "GenAI configuration initialized successfully",
            extra={
                "model_name": config.model_name,
                "embedding_model": config.embedding_model,
                "supported_formats": len(config.supported_formats)
            }
        )
        return config
        
    except Exception as e:
        logger.error(f"Failed to initialize GenAI configuration: {e}")
        raise RuntimeError(f"Configuration initialization failed: {e}")