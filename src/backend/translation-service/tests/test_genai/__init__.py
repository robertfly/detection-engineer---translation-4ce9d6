"""
GenAI Test Suite Initialization

This module initializes the comprehensive test suite for the GenAI translation service,
providing test utilities, fixtures, and configuration for testing AI-powered detection
translation capabilities across multiple SIEM platforms and detection formats.

Version: 1.0.0
"""

# version: pytest==7.4.3
import pytest
# version: pytest-asyncio==0.21.1
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any, List

from ...translation_service.genai.model import TranslationModel
from ...translation_service.genai.embeddings import DetectionEmbedding
from ...translation_service.genai.prompts import PromptManager

# Module version
__version__ = '1.0.0'

# Test configuration and sample data exports
__all__ = ['MOCK_GENAI_CONFIG', 'SAMPLE_DETECTIONS', 'pytest_plugins']

# Required pytest plugins for GenAI testing
pytest_plugins = ['translation_service.tests.fixtures.genai']

# Comprehensive mock configuration for GenAI service
MOCK_GENAI_CONFIG: Dict[str, Any] = {
    'model_name': 'gpt-4',
    'embedding_model': 'text-embedding-ada-002',
    'temperature': 0.2,
    'max_tokens': 4096,
    'supported_formats': [
        'splunk', 'qradar', 'sigma', 'kql', 
        'paloalto', 'crowdstrike', 'yara', 'yaral'
    ],
    'format_confidence_thresholds': {
        'splunk': 0.95,
        'qradar': 0.92,
        'sigma': 0.90,
        'kql': 0.93,
        'paloalto': 0.94,
        'crowdstrike': 0.91,
        'yara': 0.96,
        'yaral': 0.96
    },
    'format_specific_settings': {
        'splunk': {
            'field_mapping_confidence': 0.95,
            'syntax_validation_level': 'strict'
        },
        'sigma': {
            'yaml_validation': True,
            'condition_complexity_limit': 5
        },
        'kql': {
            'time_window_handling': 'preserve',
            'function_mapping_strict': True
        },
        'yara': {
            'string_extraction_confidence': 0.96,
            'rule_complexity_limit': 4
        }
    }
}

# Sample detections for different formats
SAMPLE_DETECTIONS: Dict[str, str] = {
    'splunk': '''
search sourcetype=windows EventCode=4688 
| where CommandLine="*mimikatz*" OR CommandLine="*sekurlsa*" 
| stats count by Computer, CommandLine, ParentProcessName
''',
    'sigma': '''
title: Mimikatz Detection
description: Detects Mimikatz execution through command line
status: experimental
author: Security Team
logsource:
    product: windows
    service: security
detection:
    selection:
        EventID: 4688
        CommandLine|contains:
            - 'mimikatz'
            - 'sekurlsa'
    condition: selection
''',
    'qradar': '''
SELECT UTF8(payload) as CommandLine, "Computer Name" as Computer,
PROCESSNAME(pid) as ParentProcessName
FROM events
WHERE QIDNAME(qid) = 'Process Creation' 
AND (CommandLine ILIKE '%mimikatz%' OR CommandLine ILIKE '%sekurlsa%')
''',
    'kql': '''
SecurityEvent
| where EventID == 4688
| where CommandLine contains "mimikatz" or CommandLine contains "sekurlsa"
| summarize count() by Computer, CommandLine, ParentProcessName
'''
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest environment for GenAI testing with comprehensive setup.

    This function sets up test markers, logging configuration, and environment
    for GenAI translation testing.
    """
    # Register custom test markers
    config.addinivalue_line(
        "markers",
        "genai_unit: mark test as a GenAI unit test"
    )
    config.addinivalue_line(
        "markers",
        "genai_integration: mark test as a GenAI integration test"
    )
    config.addinivalue_line(
        "markers",
        "genai_performance: mark test as a GenAI performance test"
    )
    
    # Configure test coverage settings
    config.option.cov_report = {
        'html': 'coverage/html',
        'xml': 'coverage/coverage.xml',
        'term-missing': True
    }
    config.option.cov_branch = True
    
    # Set up test environment variables
    import os
    os.environ.update({
        'GENAI_MODEL_NAME': 'gpt-4',
        'GENAI_EMBEDDING_MODEL': 'text-embedding-ada-002',
        'GENAI_TEMPERATURE': '0.2',
        'GENAI_MAX_TOKENS': '4096',
        'GENAI_CACHE_DIR': '/tmp/test_genai_cache',
        'LOG_LEVEL': 'DEBUG'
    })
    
    # Initialize test data directories
    import tempfile
    import shutil
    from pathlib import Path
    
    test_cache_dir = Path(tempfile.gettempdir()) / 'test_genai_cache'
    if test_cache_dir.exists():
        shutil.rmtree(test_cache_dir)
    test_cache_dir.mkdir(parents=True)
    
    # Configure logging for tests
    import logging
    logging.getLogger('translation_service').setLevel(logging.DEBUG)
    logging.getLogger('test_genai').setLevel(logging.DEBUG)