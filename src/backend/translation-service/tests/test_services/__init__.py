"""
Test package initializer for the translation service's services test module.

Provides comprehensive test fixtures, mocks, and utilities for testing translation
and validation services, including support for async operations, batch processing,
and performance metrics validation.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import asyncio  # version: 3.11+
from typing import Dict, List, Optional, Any  # version: 3.11+
from unittest.mock import Mock, AsyncMock  # version: 3.11+

from ...translation_service.services.translation import TranslationService
from ...translation_service.services.validation import ValidationService

# Comprehensive sample detections for testing
SAMPLE_DETECTIONS: Dict[str, Dict[str, str]] = {
    'splunk': {
        'basic': 'search index=* sourcetype=windows EventCode=4688 | stats count by CommandLine',
        'complex': '''search index=* sourcetype=windows EventCode=4688 
            | eval process_path=lower(NewProcessName)
            | where match(process_path, ".*\\\\powershell\.exe$")
            | stats count by CommandLine, ParentProcessName''',
        'invalid': 'search index=* | invalid_command'
    },
    'sigma': {
        'basic': '''title: Suspicious PowerShell Execution
            description: Detects suspicious PowerShell execution
            logsource:
                product: windows
                service: security
            detection:
                selection:
                    EventID: 4688
                    CommandLine: '*powershell*'
                condition: selection''',
        'complex': '''title: Advanced PowerShell Detection
            description: Detects advanced PowerShell techniques
            logsource:
                product: windows
                service: security
            detection:
                selection:
                    EventID: 4688
                    CommandLine|contains:
                        - '-enc'
                        - '-encodedcommand'
                condition: selection''',
        'invalid': '''title: Invalid Rule
            invalid_field: test'''
    }
}

# Supported test formats
TEST_FORMATS: List[str] = [
    'splunk', 'qradar', 'sigma', 'kql', 'paloalto', 
    'crowdstrike', 'yara', 'yaral'
]

# Performance test thresholds
PERFORMANCE_THRESHOLDS: Dict[str, float] = {
    'translation_latency': 2.0,  # seconds
    'validation_latency': 1.0,   # seconds
    'batch_processing': 5.0,     # seconds per batch
    'memory_usage': 512,         # MB
    'accuracy_threshold': 0.95   # 95% accuracy required
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest environment with comprehensive test setup.

    Args:
        config: Pytest configuration object
    """
    # Register custom markers
    config.addinivalue_line(
        "markers",
        "translation: mark test as translation service test"
    )
    config.addinivalue_line(
        "markers",
        "validation: mark test as validation service test"
    )
    config.addinivalue_line(
        "markers",
        "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers",
        "batch: mark test as batch processing test"
    )

class ServiceTestBase:
    """
    Enhanced base test class providing comprehensive utilities for service tests.
    Includes async support, mocking, and validation helpers.
    """

    def __init__(self):
        """Initialize the test base with comprehensive setup."""
        self.sample_detections = SAMPLE_DETECTIONS
        self.supported_formats = TEST_FORMATS
        self.performance_thresholds = PERFORMANCE_THRESHOLDS
        self.service_mocks = {}
        
        # Initialize event loop for async tests
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    async def setup_method(self, method: Any) -> None:
        """
        Enhanced setup method called before each test.

        Args:
            method: Test method being executed
        """
        # Initialize service mocks
        self.translation_service = AsyncMock(spec=TranslationService)
        self.validation_service = AsyncMock(spec=ValidationService)
        
        # Configure mock responses
        self.translation_service.translate.return_value = {
            'translated_text': 'test detection',
            'confidence_score': 0.98,
            'metadata': {'model_version': 'test'}
        }
        
        self.validation_service.validate_detection.return_value = {
            'is_valid': True,
            'confidence_score': 0.97,
            'errors': {},
            'warnings': {}
        }

        # Initialize test metrics
        self.test_metrics = {
            'start_time': asyncio.get_event_loop().time(),
            'memory_start': 0,
            'error_count': 0,
            'success_count': 0
        }

    async def teardown_method(self, method: Any) -> None:
        """
        Enhanced cleanup method called after each test.

        Args:
            method: Test method being executed
        """
        # Clean up mocks
        self.translation_service.reset_mock()
        self.validation_service.reset_mock()
        
        # Calculate test metrics
        end_time = asyncio.get_event_loop().time()
        duration = end_time - self.test_metrics['start_time']
        
        # Log test results
        print(f"\nTest Metrics:")
        print(f"Duration: {duration:.2f}s")
        print(f"Success Rate: {self.test_metrics['success_count']}/{self.test_metrics['success_count'] + self.test_metrics['error_count']}")
        
        # Clean up any remaining resources
        await asyncio.sleep(0)  # Allow pending tasks to complete
        self.loop.stop()
        self.loop.close()

    def create_test_detection(
        self,
        format_type: str,
        complexity: str = 'basic'
    ) -> str:
        """
        Create a test detection for the specified format and complexity.

        Args:
            format_type: Detection format to create
            complexity: Complexity level ('basic', 'complex', 'invalid')

        Returns:
            str: Test detection content
        """
        if format_type not in self.sample_detections:
            raise ValueError(f"Unsupported format: {format_type}")
        if complexity not in self.sample_detections[format_type]:
            raise ValueError(f"Unsupported complexity: {complexity}")
            
        return self.sample_detections[format_type][complexity]

    async def validate_performance(
        self,
        operation: str,
        duration: float,
        success: bool = True
    ) -> None:
        """
        Validate operation performance against thresholds.

        Args:
            operation: Operation being validated
            duration: Operation duration in seconds
            success: Whether operation succeeded
        """
        threshold = self.performance_thresholds.get(operation)
        if threshold and duration > threshold:
            print(f"Warning: {operation} exceeded threshold: {duration:.2f}s > {threshold}s")
            
        if success:
            self.test_metrics['success_count'] += 1
        else:
            self.test_metrics['error_count'] += 1