"""
Unit tests for the KQL (Kusto Query Language) format handler.

This module provides comprehensive test coverage for KQL translation capabilities,
validation, and monitoring functionality.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1
from typing import Dict, Any  # version: 3.11+
from unittest.mock import Mock, patch  # version: 3.11+

from ...translation_service.formats.kql import KQLFormat
from ...translation_service.utils.logger import get_logger

# Test data constants
SAMPLE_KQL_QUERIES: Dict[str, str] = {
    'basic': 'SecurityEvent | where EventID == 4625',
    'complex': '''SecurityEvent 
                 | where EventID == 4625 
                 | summarize count() by SourceIP, Account 
                 | where count_ > 5''',
    'invalid': 'SecurityEvent where EventID == 4625',  # Missing pipe
    'edge_case': '''SecurityEvent 
                   | where EventID in (4624, 4625) 
                   | extend IPAddress = case(isempty(SourceIP), DestinationIP, SourceIP)'''
}

EXPECTED_MODELS: Dict[str, Dict[str, Any]] = {
    'basic': {
        'table': 'SecurityEvent',
        'conditions': [{'field': 'EventID', 'operator': '==', 'value': '4625'}],
        'aggregations': []
    },
    'complex': {
        'table': 'SecurityEvent',
        'conditions': [{'field': 'EventID', 'operator': '==', 'value': '4625'}],
        'aggregations': [{'type': 'count', 'by': ['SourceIP', 'Account']}],
        'having': [{'field': 'count_', 'operator': '>', 'value': '5'}]
    }
}

@pytest.mark.asyncio
async def test_kql_format_initialization():
    """Test KQL format handler initialization with logging validation."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        # Initialize format handler
        kql_format = KQLFormat()
        
        # Verify operator patterns are compiled
        assert hasattr(kql_format, 'operator_pattern')
        assert hasattr(kql_format, 'table_pattern')
        assert hasattr(kql_format, 'field_pattern')
        
        # Verify logger configuration
        mock_logger.assert_called_once()
        mock_logger.return_value.debug.assert_not_called()  # No debug logs during init

@pytest.mark.asyncio
async def test_kql_parse_valid_detection():
    """Test parsing of valid KQL detection rules with performance monitoring."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        kql_format = KQLFormat()
        
        # Test basic query parsing
        result = kql_format.parse(SAMPLE_KQL_QUERIES['basic'])
        
        # Verify structure
        assert result['type'] == 'kql'
        assert result['source_table'] == 'SecurityEvent'
        assert len(result['conditions']) == 1
        assert result['conditions'][0]['expression'] == 'EventID == 4625'
        
        # Verify logging
        mock_logger.return_value.debug.assert_called_with(
            "Starting KQL detection parsing",
            extra={'content_length': len(SAMPLE_KQL_QUERIES['basic'])}
        )
        
        # Test complex query parsing
        result = kql_format.parse(SAMPLE_KQL_QUERIES['complex'])
        assert result['type'] == 'kql'
        assert 'count()' in str(result['pattern_matches'])
        assert len(result['fields']) > 0

@pytest.mark.asyncio
async def test_kql_parse_invalid_detection():
    """Test parsing of invalid KQL detection rules with error logging."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        kql_format = KQLFormat()
        
        # Test invalid query
        result = kql_format.parse(SAMPLE_KQL_QUERIES['invalid'])
        
        # Verify error handling
        assert 'error' in result
        assert result['type'] == 'kql'
        
        # Verify error logging
        mock_logger.return_value.error.assert_called_once()
        error_call = mock_logger.return_value.error.call_args
        assert 'Error parsing KQL detection' in str(error_call)

@pytest.mark.asyncio
async def test_kql_generate_detection():
    """Test generation of KQL detection rules with performance monitoring."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        kql_format = KQLFormat()
        
        # Test basic model generation
        detection_model = {
            'source_table': 'SecurityEvent',
            'conditions': [{
                'operator': 'where',
                'expression': 'EventID == 4625'
            }]
        }
        
        result = kql_format.generate(detection_model)
        
        # Verify generated query
        assert 'SecurityEvent' in result
        assert '| where EventID == 4625' in result
        
        # Verify logging
        mock_logger.return_value.info.assert_called_with(
            "Successfully generated KQL detection",
            extra={'query_length': len(result)}
        )
        
        # Test complex model generation
        detection_model['pattern_matches'] = [{
            'type': 'project',
            'fields': ['TimeGenerated', 'EventID', 'Account']
        }]
        
        result = kql_format.generate(detection_model)
        assert 'project' in result
        assert all(field in result for field in ['TimeGenerated', 'EventID', 'Account'])

@pytest.mark.asyncio
async def test_kql_syntax_validation():
    """Test KQL syntax validation with comprehensive edge cases."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        kql_format = KQLFormat()
        
        # Test valid syntax
        assert kql_format.validate_syntax(SAMPLE_KQL_QUERIES['basic']) is True
        assert kql_format.validate_syntax(SAMPLE_KQL_QUERIES['complex']) is True
        
        # Test invalid syntax
        assert kql_format.validate_syntax(SAMPLE_KQL_QUERIES['invalid']) is False
        assert kql_format.validate_syntax('') is False
        
        # Test edge cases
        assert kql_format.validate_syntax(SAMPLE_KQL_QUERIES['edge_case']) is True
        
        # Verify validation logging
        mock_logger.return_value.debug.assert_called_with("Starting KQL syntax validation")
        mock_logger.return_value.error.assert_called()  # For invalid syntax test

@pytest.mark.asyncio
async def test_kql_performance_metrics():
    """Test performance monitoring and metrics collection."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        kql_format = KQLFormat()
        
        # Test parsing performance
        result = kql_format.parse(SAMPLE_KQL_QUERIES['complex'])
        
        # Verify metrics logging
        mock_logger.return_value.info.assert_called()
        info_call = mock_logger.return_value.info.call_args
        assert 'Successfully parsed KQL detection' in str(info_call)
        assert 'field_count' in str(info_call)

@pytest.mark.asyncio
async def test_kql_error_handling():
    """Test comprehensive error handling and logging."""
    with patch('translation_service.utils.logger.get_logger') as mock_logger:
        kql_format = KQLFormat()
        
        # Test various error conditions
        result = kql_format.parse(None)  # None input
        assert 'error' in result
        
        result = kql_format.parse('')  # Empty input
        assert 'error' in result
        
        result = kql_format.generate({})  # Empty model
        assert 'Error' in result
        
        # Verify error logging
        assert mock_logger.return_value.error.call_count >= 3