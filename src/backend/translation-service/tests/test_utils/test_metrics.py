"""
Test suite for metrics collection and monitoring functionality.

This module provides comprehensive test coverage for:
- Metrics initialization and configuration
- Translation metrics tracking
- Validation metrics recording
- Performance metrics validation
- Prometheus integration testing

Version: 1.0.0
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from prometheus_client import REGISTRY, Counter, Gauge, Histogram  # version: 0.17.1
import asyncio
import time

from ...translation_service.utils.metrics import (
    MetricsManager,
    track_translation,
    track_validation,
    get_metrics,
    reset_metrics
)
from ...translation_service.config.metrics import MetricsConfig

class TestMetrics:
    """Comprehensive test suite for metrics functionality."""

    def setup_method(self):
        """Setup test environment before each test."""
        # Initialize test configuration
        self._config = MetricsConfig(
            port=9090,
            path='/metrics',
            enabled=True
        )
        
        # Initialize metrics manager
        self._manager = MetricsManager(self._config)
        
        # Reset all metrics before each test
        reset_metrics()
        
        # Setup test data
        self._test_data = {
            'source_formats': ['splunk', 'qradar', 'sigma'],
            'target_formats': ['sigma', 'kql', 'yara'],
            'error_types': ['ValidationError', 'TranslationError', 'FormatError']
        }
        
        # Track collectors for cleanup
        self._collectors = []

    def teardown_method(self):
        """Cleanup test environment after each test."""
        # Stop metrics collection
        if hasattr(self._manager, '_initialized') and self._manager._initialized:
            self._manager._cleanup()
        
        # Reset all metrics
        reset_metrics()
        
        # Unregister test collectors
        for collector in self._collectors:
            try:
                REGISTRY.unregister(collector)
            except KeyError:
                pass

    @pytest.mark.parametrize('enabled,port,path', [
        (True, 8000, '/metrics'),
        (False, 9090, '/prometheus'),
        (True, 8080, '/custom')
    ])
    def test_metrics_manager_initialization(self, enabled, port, path):
        """Test MetricsManager initialization with various configurations."""
        # Create test configuration
        config = MetricsConfig(
            enabled=enabled,
            port=port,
            path=path
        )
        
        # Initialize manager
        manager = MetricsManager(config)
        
        # Verify configuration
        assert manager._config.enabled == enabled
        assert manager._config.port == port
        assert manager._config.path == path
        
        # Verify initialization state
        assert hasattr(manager, '_initialized')
        assert hasattr(manager, '_health_status')
        
        if enabled:
            # Start metrics collection
            with patch('prometheus_client.start_http_server') as mock_server:
                manager.start()
                mock_server.assert_called_once_with(port=port, addr='0.0.0.0')
                assert manager._initialized is True
                assert manager._health_status['status'] == 'healthy'

    def test_metrics_manager_lifecycle(self):
        """Test complete metrics manager lifecycle."""
        # Start metrics collection
        with patch('prometheus_client.start_http_server'):
            self._manager.start()
            assert self._manager._initialized is True
            
            # Record test metrics
            test_counter = Counter('test_counter', 'Test counter')
            test_counter.inc()
            
            # Verify metrics collection
            metrics = list(REGISTRY.collect())
            assert any(m.name == 'test_counter' for m in metrics)
            
            # Stop metrics collection
            self._manager._cleanup()
            assert not any(m.name == 'test_counter' for m in list(REGISTRY.collect()))

    @pytest.mark.asyncio
    async def test_track_translation_metrics(self):
        """Test translation metrics tracking."""
        # Mock translation function
        @track_translation
        async def mock_translate(**kwargs):
            await asyncio.sleep(0.1)
            return {'success': True}

        # Test successful translation
        for source in self._test_data['source_formats']:
            for target in self._test_data['target_formats']:
                await mock_translate(
                    source_format=source,
                    target_format=target
                )
        
        # Verify metrics
        metrics = list(REGISTRY.collect())
        
        # Check translation counter
        translation_counter = next(
            m for m in metrics if m.name == 'translation_requests_total'
        )
        assert sum(s.value for s in translation_counter.samples) == (
            len(self._test_data['source_formats']) * 
            len(self._test_data['target_formats'])
        )
        
        # Check latency metrics
        latency_hist = next(
            m for m in metrics if m.name == 'translation_duration_seconds'
        )
        assert all(s.value > 0 for s in latency_hist.samples)

    def test_track_validation_metrics(self):
        """Test validation metrics recording."""
        # Record validation metrics
        for format in self._test_data['source_formats']:
            # Successful validation
            track_validation(
                format=format,
                duration=0.05,
                success=True
            )
            
            # Failed validation
            track_validation(
                format=format,
                duration=0.1,
                success=False,
                error_type='ValidationError'
            )
        
        # Verify metrics
        metrics = list(REGISTRY.collect())
        
        # Check validation latency
        validation_hist = next(
            m for m in metrics if m.name == 'validation_duration_seconds'
        )
        assert len(validation_hist.samples) > 0
        
        # Verify error tracking
        error_counter = next(
            m for m in metrics if m.name == 'translation_errors_total'
        )
        assert sum(s.value for s in error_counter.samples) == len(
            self._test_data['source_formats']
        )

    def test_get_metrics(self):
        """Test metrics retrieval functionality."""
        # Record test metrics
        test_counter = Counter('test_metric_counter', 'Test counter')
        test_gauge = Gauge('test_metric_gauge', 'Test gauge')
        test_hist = Histogram('test_metric_hist', 'Test histogram')
        
        self._collectors.extend([test_counter, test_gauge, test_hist])
        
        # Record values
        test_counter.inc(5)
        test_gauge.set(10)
        test_hist.observe(0.5)
        
        # Get metrics
        metrics = get_metrics()
        
        # Verify metrics presence
        assert 'test_metric_counter' in str(metrics)
        assert 'test_metric_gauge' in str(metrics)
        assert 'test_metric_hist' in str(metrics)
        
        # Verify values
        assert '5.0' in str(metrics)  # Counter value
        assert '10.0' in str(metrics)  # Gauge value
        assert '0.5' in str(metrics)  # Histogram observation