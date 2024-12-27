"""
Prometheus metrics collection and monitoring module for the Translation Service.

This module provides comprehensive metrics collection capabilities including:
- Translation accuracy and latency tracking
- System health monitoring
- Resource usage metrics
- Operational metrics with custom collectors
- Enhanced security and validation

Version: 1.0.0
"""

import time
from typing import Any, Dict, List, Callable, Optional
from functools import wraps
import psutil  # version: 5.9.5
from prometheus_client import (  # version: 0.17.1
    start_http_server,
    Counter,
    Gauge,
    Histogram,
    REGISTRY,
    generate_latest
)

from ..config.metrics import MetricsConfig
from .logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Define core metrics collectors
TRANSLATION_COUNTER = Counter(
    'translation_requests_total',
    'Total number of translation requests',
    ['source_format', 'target_format', 'status']
)

TRANSLATION_LATENCY = Histogram(
    'translation_duration_seconds',
    'Translation request duration in seconds',
    ['source_format', 'target_format'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

TRANSLATION_ACCURACY = Gauge(
    'translation_accuracy_percent',
    'Translation accuracy percentage',
    ['source_format', 'target_format']
)

SYSTEM_UPTIME = Gauge(
    'system_uptime_seconds',
    'Service uptime in seconds'
)

ERROR_COUNTER = Counter(
    'translation_errors_total',
    'Total number of translation errors',
    ['source_format', 'target_format', 'error_type']
)

MEMORY_USAGE = Gauge(
    'memory_usage_bytes',
    'Current memory usage in bytes',
    ['type']
)

QUEUE_SIZE = Gauge(
    'translation_queue_size',
    'Current size of translation queue',
    ['priority']
)

VALIDATION_LATENCY = Histogram(
    'validation_duration_seconds',
    'Validation check duration in seconds',
    ['format'],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0]
)

class MetricsManager:
    """Enhanced metrics manager with comprehensive monitoring capabilities."""

    def __init__(self, config: MetricsConfig):
        """
        Initialize metrics manager with configuration and health monitoring.

        Args:
            config: Metrics configuration instance
        """
        self._config = config
        self._initialized = False
        self._collectors = {}
        self._health_status = {
            'status': 'starting',
            'last_check': time.time(),
            'errors': []
        }
        
        # Register cleanup handler
        import atexit
        atexit.register(self._cleanup)

    def start(self) -> None:
        """
        Start metrics collection with enhanced monitoring and security.
        
        Raises:
            RuntimeError: If metrics server fails to start
        """
        if not self._config.enabled:
            logger.info("Metrics collection disabled by configuration")
            return

        try:
            # Start Prometheus HTTP server
            start_http_server(
                port=self._config.port,
                addr='0.0.0.0'
            )
            
            # Initialize system metrics collection
            self._init_system_metrics()
            
            self._initialized = True
            self._health_status['status'] = 'healthy'
            
            logger.info(
                f"Metrics server started on port {self._config.port} "
                f"at path {self._config.path}"
            )
        except Exception as e:
            self._health_status['status'] = 'error'
            self._health_status['errors'].append(str(e))
            logger.error(f"Failed to start metrics server: {str(e)}")
            raise RuntimeError(f"Metrics initialization failed: {str(e)}")

    def aggregate_metrics(self, dimensions: List[str]) -> Dict[str, Any]:
        """
        Aggregate metrics across multiple dimensions for analysis.
        
        Args:
            dimensions: List of dimensions to aggregate by
            
        Returns:
            Dict containing aggregated metrics
        """
        try:
            metrics_data = {}
            
            # Collect current metrics state
            for collector in REGISTRY.collect():
                for metric in collector.samples:
                    name = metric.name
                    labels = metric.labels
                    value = metric.value

                    # Filter and aggregate based on dimensions
                    if any(dim in labels for dim in dimensions):
                        if name not in metrics_data:
                            metrics_data[name] = []
                        metrics_data[name].append({
                            'labels': labels,
                            'value': value
                        })

            return metrics_data
        except Exception as e:
            logger.error(f"Metrics aggregation failed: {str(e)}")
            return {}

    def _init_system_metrics(self) -> None:
        """Initialize system-level metrics collection."""
        try:
            # Memory metrics
            MEMORY_USAGE.labels(type='virtual').set(
                psutil.Process().memory_info().vms
            )
            MEMORY_USAGE.labels(type='resident').set(
                psutil.Process().memory_info().rss
            )
            
            # System uptime
            start_time = time.time()
            SYSTEM_UPTIME.set(start_time)
            
        except Exception as e:
            logger.error(f"Failed to initialize system metrics: {str(e)}")

    def _cleanup(self) -> None:
        """Cleanup metrics collectors on shutdown."""
        try:
            if self._initialized:
                # Unregister custom collectors
                for collector in self._collectors.values():
                    REGISTRY.unregister(collector)
                logger.info("Metrics collectors cleaned up successfully")
        except Exception as e:
            logger.error(f"Metrics cleanup failed: {str(e)}")

def track_translation(func: Callable) -> Callable:
    """
    Decorator to track comprehensive translation metrics.
    
    Args:
        func: Function to be decorated
        
    Returns:
        Decorated function with metrics tracking
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        source_format = kwargs.get('source_format', 'unknown')
        target_format = kwargs.get('target_format', 'unknown')
        
        try:
            # Track pre-translation metrics
            MEMORY_USAGE.labels(type='pre_translation').set(
                psutil.Process().memory_info().rss
            )
            
            # Execute translation
            result = func(*args, **kwargs)
            
            # Record successful translation
            TRANSLATION_COUNTER.labels(
                source_format=source_format,
                target_format=target_format,
                status='success'
            ).inc()
            
            # Record latency
            duration = time.time() - start_time
            TRANSLATION_LATENCY.labels(
                source_format=source_format,
                target_format=target_format
            ).observe(duration)
            
            return result
            
        except Exception as e:
            # Record failed translation
            ERROR_COUNTER.labels(
                source_format=source_format,
                target_format=target_format,
                error_type=type(e).__name__
            ).inc()
            
            logger.error(
                f"Translation error: {str(e)}",
                extra={
                    'source_format': source_format,
                    'target_format': target_format
                }
            )
            raise
            
    return wrapper

def reset_metrics() -> bool:
    """
    Reset all metrics collectors to initial state.
    
    Returns:
        bool: Success status of reset operation
    """
    try:
        # Reset core metrics
        for collector in REGISTRY.collect():
            if hasattr(collector, 'clear'):
                collector.clear()
        
        logger.info("Metrics collectors reset successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to reset metrics: {str(e)}")
        return False

def export_metrics(format: str = 'prometheus') -> Dict[str, Any]:
    """
    Export current metrics in multiple formats.
    
    Args:
        format: Output format ('prometheus' or 'json')
        
    Returns:
        Formatted metrics data
    """
    try:
        if format == 'prometheus':
            return generate_latest().decode('utf-8')
        elif format == 'json':
            metrics_data = {}
            for collector in REGISTRY.collect():
                for metric in collector.samples:
                    metrics_data[metric.name] = {
                        'value': metric.value,
                        'labels': metric.labels
                    }
            return metrics_data
        else:
            raise ValueError(f"Unsupported metrics format: {format}")
    except Exception as e:
        logger.error(f"Metrics export failed: {str(e)}")
        return {}