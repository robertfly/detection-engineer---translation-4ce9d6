"""
Pytest Configuration and Fixtures for Translation Service Tests

This module provides comprehensive test fixtures and configuration for the translation service,
supporting unit tests, integration tests, and validation scenarios with detailed logging
and mock data.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1
from unittest.mock import AsyncMock, MagicMock, patch  # version: python3.11+
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, AsyncGenerator

from translation_service.genai.model import TranslationModel

# Sample detection rules for different formats
SAMPLE_DETECTIONS = {
    'splunk': '''
search source="windows_logs" EventCode=4625 
| stats count by src_ip, user 
| where count > 5
''',
    'sigma': '''
title: Failed Login Attempts
status: test
logsource:
    product: windows
    service: security
detection:
    selection:
        EventCode: 4625
    condition: selection
''',
    'qradar': '''
SELECT sourceip, username, COUNT(*) 
FROM events 
WHERE eventname='Authentication Failed' 
GROUP BY sourceip, username 
HAVING COUNT(*) > 5
''',
    'kql': '''
SecurityEvent
| where EventID == 4625
| summarize count() by SourceIP, Account
| where count_ > 5
'''
}

# Mock GenAI configuration for testing
MOCK_GENAI_CONFIG = {
    'model': 'gpt-4',
    'temperature': 0.1,
    'max_tokens': 2000,
    'api_version': '2023-12-01'
}

def pytest_configure(config):
    """
    Configure pytest with custom markers and settings.
    """
    # Register custom markers
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "async_test: mark test as requiring async testing"
    )
    config.addinivalue_line(
        "markers", "format_specific: mark test as format-specific validation"
    )

    # Configure test logging
    import logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

@pytest.fixture
def mock_genai_config():
    """
    Fixture providing mock GenAI configuration for testing.
    """
    return MOCK_GENAI_CONFIG.copy()

@pytest.fixture
def sample_detection(request):
    """
    Fixture providing sample detection data with format-specific validation rules.
    
    Args:
        request: Pytest request object with optional format parameter
        
    Returns:
        Dict containing detection content and validation rules
    """
    format_name = getattr(request, 'param', 'splunk')
    
    validation_rules = {
        'splunk': {
            'required_fields': ['source', 'stats'],
            'syntax_check': lambda x: 'search' in x or '|' in x
        },
        'sigma': {
            'required_fields': ['title', 'logsource', 'detection'],
            'syntax_check': lambda x: 'title:' in x and 'detection:' in x
        },
        'qradar': {
            'required_fields': ['SELECT', 'FROM'],
            'syntax_check': lambda x: x.upper().startswith('SELECT')
        },
        'kql': {
            'required_fields': ['where', 'summarize'],
            'syntax_check': lambda x: '|' in x
        }
    }

    return {
        'content': SAMPLE_DETECTIONS.get(format_name, ''),
        'format': format_name,
        'validation_rules': validation_rules.get(format_name, {})
    }

@pytest_asyncio.fixture
async def mock_translation_model():
    """
    Fixture providing a mocked translation model with enhanced validation.
    
    Returns:
        AsyncMock: Mocked translation model instance
    """
    mock_model = AsyncMock(spec=TranslationModel)
    
    # Configure mock translation responses
    async def mock_translate(*args, **kwargs):
        source_format = kwargs.get('source_format', 'unknown')
        target_format = kwargs.get('target_format', 'unknown')
        return {
            'translated_text': SAMPLE_DETECTIONS.get(target_format, ''),
            'confidence_score': 0.95,
            'validation_result': {
                'is_valid': True,
                'errors': [],
                'warnings': []
            },
            'metadata': {
                'model': 'gpt-4',
                'source_format': source_format,
                'target_format': target_format,
                'timestamp': 1234567890
            }
        }
    
    # Configure mock confidence calculation
    async def mock_confidence(*args, **kwargs):
        return 0.95
    
    # Configure mock format validation
    async def mock_validate(*args, **kwargs):
        return {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'suggestions': []
        }
    
    # Configure error simulation
    async def mock_error_simulation(*args, **kwargs):
        raise RuntimeError("Simulated translation error")
    
    mock_model.translate_detection.side_effect = mock_translate
    mock_model.calculate_confidence.side_effect = mock_confidence
    mock_model.validate_translation.side_effect = mock_validate
    mock_model.error_simulation = mock_error_simulation
    
    return mock_model

@pytest_asyncio.fixture
async def async_context():
    """
    Fixture providing async context management for test cases.
    
    Yields:
        Dict containing async context setup and cleanup methods
    """
    # Setup async test environment
    async def setup():
        return {'test_id': 'async_test_123'}
    
    # Cleanup async resources
    async def cleanup():
        pass
    
    context = await setup()
    yield {
        'setup': setup,
        'cleanup': cleanup,
        'context': context
    }
    await cleanup()

@pytest.fixture
def test_data_dir(tmp_path):
    """
    Fixture providing a temporary directory for test data.
    """
    test_dir = tmp_path / "test_data"
    test_dir.mkdir()
    return test_dir

@pytest.fixture
def mock_logger():
    """
    Fixture providing a mock logger for testing logging functionality.
    """
    with patch('translation_service.utils.logger.get_logger') as mock:
        yield mock

@pytest.fixture
def validation_context():
    """
    Fixture providing validation context with format-specific rules.
    """
    return {
        'max_length': 10000,
        'required_fields': {
            'splunk': ['source', 'search'],
            'sigma': ['title', 'logsource', 'detection'],
            'qradar': ['SELECT', 'FROM', 'WHERE'],
            'kql': ['where', 'project']
        },
        'format_validators': {
            'splunk': lambda x: x.startswith('search'),
            'sigma': lambda x: 'title:' in x and 'detection:' in x,
            'qradar': lambda x: x.upper().startswith('SELECT'),
            'kql': lambda x: '|' in x
        }
    }