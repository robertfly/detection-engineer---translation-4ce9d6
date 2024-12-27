"""
Translation Service Utils Package

This package provides centralized access to logging, metrics collection, and utility functions
with comprehensive observability features and performance tracking capabilities.

Version: 1.0.0
"""

# Import logging utilities
from .logger import (
    get_logger,
    set_trace_id,
    get_trace_id,
    TraceIDFilter
)

# Import metrics utilities
from .metrics import (
    MetricsManager,
    track_translation as track_translation_request,
    reset_metrics as track_translation_error,
    export_metrics as track_translation_duration,
    aggregate_metrics as record_validation_score
)

# Package version
__version__ = "1.0.0"

# Define public exports
__all__ = [
    # Logging utilities
    "get_logger",
    "set_trace_id", 
    "get_trace_id",
    "TraceIDFilter",
    
    # Metrics utilities
    "MetricsManager",
    "track_translation_request",
    "track_translation_error", 
    "track_translation_duration",
    "record_validation_score"
]

# Initialize default logger for the package
logger = get_logger(__name__)

# Log package initialization
logger.info(
    "Translation Service Utils package initialized",
    extra={
        "version": __version__,
        "features": [
            "Structured logging",
            "Trace ID support",
            "Metrics collection",
            "Performance tracking"
        ]
    }
)