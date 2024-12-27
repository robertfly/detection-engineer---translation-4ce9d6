"""
Test utilities package for configuring isolated test environments with enhanced logging and metrics.

This module provides test-specific configurations and utilities for:
- Isolated logging environment with memory buffers
- Mock metrics collection with test-specific collectors
- Test environment cleanup and resource management
- Enhanced test tracing and correlation

Version: 1.0.0
"""

import logging
import pytest  # version: 7.4.0
from typing import Optional, Dict, Any  # version: 3.11+
from unittest.mock import MagicMock, patch  # version: 3.11+

from ...translation_service.utils.logger import get_logger
from ...translation_service.utils.metrics import MetricsManager

# Default test logger configuration with memory buffer
TEST_LOGGER: logging.Logger = get_logger(
    'test',
    config_override={
        'level': 'DEBUG',
        'format': 'json',
        'file_enabled': False,
        'environment': 'test'
    }
)

# Default test metrics configuration with mock collectors
TEST_METRICS_CONFIG: Dict[str, Any] = {
    'port': 9999,
    'path': '/test-metrics',
    'enabled': True,
    'collectors': [],
    'endpoint': 'memory://',
    'batch_size': 1
}

def setup_test_logger(name: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> logging.Logger:
    """
    Configure an isolated logger instance for testing with memory buffer.

    Args:
        name: Optional logger name (defaults to 'test')
        config: Optional configuration overrides

    Returns:
        logging.Logger: Configured test logger instance
    """
    test_config = {
        'level': 'DEBUG',
        'format': 'json',
        'file_enabled': False,
        'environment': 'test',
        'trace_id_enabled': True
    }

    if config:
        test_config.update(config)

    # Create logger with memory buffer
    logger = get_logger(name or 'test', config_override=test_config)

    # Add memory buffer handler for test assertions
    memory_handler = logging.handlers.MemoryHandler(1000)
    memory_handler.setLevel(logging.DEBUG)
    logger.addHandler(memory_handler)

    return logger

def setup_test_metrics(config: Optional[Dict[str, Any]] = None) -> MetricsManager:
    """
    Initialize an isolated metrics manager for testing with mock collectors.

    Args:
        config: Optional configuration overrides

    Returns:
        MetricsManager: Configured test metrics manager
    """
    test_config = TEST_METRICS_CONFIG.copy()
    if config:
        test_config.update(config)

    # Create metrics manager with test configuration
    metrics_manager = MetricsManager(test_config)

    # Mock collectors to prevent actual metrics emission
    metrics_manager._collectors = {
        'counter': MagicMock(),
        'gauge': MagicMock(),
        'histogram': MagicMock()
    }

    # Start metrics collection in test mode
    with patch('prometheus_client.start_http_server'):
        metrics_manager.start()

    return metrics_manager

def cleanup_test_environment() -> None:
    """
    Clean up test environment by resetting loggers and metrics.
    
    This ensures test isolation by:
    - Removing memory handlers
    - Resetting logger configurations
    - Stopping metrics collection
    - Clearing metrics buffers
    """
    # Reset root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.WARNING)

    # Clean up test logger
    test_logger = logging.getLogger('test')
    for handler in test_logger.handlers[:]:
        if isinstance(handler, logging.handlers.MemoryHandler):
            handler.flush()
        test_logger.removeHandler(handler)

    # Reset metrics
    try:
        metrics_manager = MetricsManager(TEST_METRICS_CONFIG)
        metrics_manager._cleanup()
    except Exception:
        pass  # Ignore cleanup errors in test environment

@pytest.fixture(autouse=True)
def test_environment():
    """
    Pytest fixture to automatically set up and tear down test environment.
    
    This fixture:
    - Configures isolated logging
    - Sets up mock metrics
    - Cleans up resources after each test
    """
    # Setup
    setup_test_logger()
    setup_test_metrics()
    
    yield
    
    # Teardown
    cleanup_test_environment()