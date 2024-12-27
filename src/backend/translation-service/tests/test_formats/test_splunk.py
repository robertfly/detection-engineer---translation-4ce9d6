"""
Unit test suite for the Splunk SPL format handler.

This module provides comprehensive test coverage for parsing, generation,
validation, error handling, and performance aspects of Splunk detection rule translation.

Version: 1.0.0
"""

import pytest
from typing import Dict, Any, List
import asyncio
from pytest_benchmark.fixture import BenchmarkFixture

from translation_service.formats.splunk import SplunkFormat, SplunkDetection

# Test data constants
VALID_SPL_SAMPLES = [
    # Basic search with stats
    'source="windows_logs" EventCode=4625 | stats count by src_ip, user | where count > 5',
    # Network traffic analysis
    'source="firewall_logs" action=blocked | stats count by src_ip, dest_port | where count > 100',
    # Malware detection
    'source="network_logs" category=malware | table timestamp, src_ip, dest_ip, signature',
    # Complex nested search
    'source="*" [search sourcetype=IDS alert=*] | stats count, values(alert) by src_ip | where count > 10',
    # Web traffic analysis
    'source="web_logs" uri="*.exe" OR uri="*.dll" | stats dc(src_ip) as unique_ips by uri | where unique_ips > 50'
]

INVALID_SPL_SAMPLES = [
    # Missing source
    '| stats count',
    # Incomplete pipe
    'source=logs |',
    # Invalid syntax
    'invalid syntax here',
    # Double pipes
    '| | double pipes',
    # Invalid command
    'source="logs" | invalidcommand',
    # Invalid stats
    'source="logs" | stats count by | stats count'
]

# Performance thresholds
PERFORMANCE_THRESHOLDS = {
    'parse_time_ms': 100,
    'generate_time_ms': 150,
    'validation_time_ms': 50,
    'memory_mb': 256
}

@pytest.fixture
def splunk_format() -> SplunkFormat:
    """Fixture providing configured SplunkFormat instance."""
    config = {
        'cache_size': 1000,
        'cache_ttl': 3600,
        'performance_mode': True
    }
    return SplunkFormat(config)

@pytest.fixture
def sample_detection() -> Dict[str, Any]:
    """Fixture providing sample detection in common model format."""
    return {
        'type': 'splunk',
        'search_terms': 'source="windows_logs" EventCode=4625',
        'field_extractions': {
            'src_ip': '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}'
        },
        'pipes': [
            'stats count by src_ip, user',
            'where count > 5'
        ]
    }

@pytest.mark.parametrize('config', [
    {'cache_size': 1000, 'cache_ttl': 3600},
    {'performance_mode': True},
    {'validation_strict': True},
    {}  # Default configuration
])
def test_splunk_format_initialization(config: Dict[str, Any]):
    """Test SplunkFormat initialization with various configurations."""
    try:
        handler = SplunkFormat(config)
        assert handler._parser_config == config
        assert handler._cached_grammar is not None
        assert handler._parse_cache is not None
    except Exception as e:
        pytest.fail(f"SplunkFormat initialization failed: {str(e)}")

@pytest.mark.parametrize('spl_input,expected_output', [
    (
        'source="windows_logs" EventCode=4625',
        {
            'type': 'splunk',
            'search_terms': 'source="windows_logs" EventCode=4625',
            'field_extractions': {},
            'pipes': [],
            'is_valid': True
        }
    ),
    (
        'source="*" | rex field=src_ip "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}"',
        {
            'type': 'splunk',
            'search_terms': 'source="*"',
            'field_extractions': {'src_ip': '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}'},
            'pipes': ['rex field=src_ip "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}"'],
            'is_valid': True
        }
    )
])
@pytest.mark.asyncio
async def test_parse_valid_splunk_detection(
    splunk_format: SplunkFormat,
    spl_input: str,
    expected_output: Dict[str, Any]
):
    """Test parsing of valid Splunk SPL detections."""
    result = splunk_format.parse(spl_input, trace_id='test-trace-id')
    
    assert result['type'] == 'splunk'
    assert result['is_valid'] is True
    assert result['search_terms'] == expected_output['search_terms']
    assert result['field_extractions'] == expected_output['field_extractions']
    assert len(result['validation_errors']) == 0
    assert result['confidence_score'] > 0.9

@pytest.mark.parametrize('common_model,expected_spl', [
    (
        {
            'type': 'splunk',
            'search_terms': 'source="windows_logs" EventCode=4625',
            'pipes': ['stats count by src_ip']
        },
        'search source="windows_logs" EventCode=4625 | stats count by src_ip'
    ),
    (
        {
            'type': 'splunk',
            'search_terms': 'source="*"',
            'field_extractions': {'src_ip': '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}'},
            'pipes': ['stats count by src_ip']
        },
        'search source="*" | rex field=src_ip "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" | stats count by src_ip'
    )
])
def test_generate_valid_splunk_detection(
    splunk_format: SplunkFormat,
    common_model: Dict[str, Any],
    expected_spl: str,
    benchmark: BenchmarkFixture
):
    """Test generation of valid Splunk SPL with performance benchmarking."""
    def generate_spl():
        return splunk_format.generate(common_model, trace_id='test-trace-id')
    
    # Benchmark generation performance
    result = benchmark(generate_spl)
    assert result == expected_spl
    
    # Validate generated SPL
    parsed = splunk_format.parse(result)
    assert parsed['is_valid'] is True
    assert parsed['confidence_score'] > 0.9

@pytest.mark.parametrize('invalid_spl,expected_error', [
    ('| stats count', 'Missing required search terms'),
    ('source=logs |', 'Incomplete pipe command'),
    ('invalid syntax here', 'Invalid search term syntax'),
    ('| | double pipes', 'Invalid pipe command'),
    ('source="logs" | invalidcommand', 'Invalid command: invalidcommand')
])
def test_invalid_splunk_detection(
    splunk_format: SplunkFormat,
    invalid_spl: str,
    expected_error: str
):
    """Test handling of invalid Splunk SPL detections."""
    result = splunk_format.parse(invalid_spl, trace_id='test-trace-id')
    
    assert result['is_valid'] is False
    assert result['confidence_score'] < 0.5
    assert any(expected_error.lower() in error.lower() 
              for error in result['validation_errors'])

@pytest.mark.parametrize('spl_input,is_valid,performance_threshold', [
    (VALID_SPL_SAMPLES[0], True, PERFORMANCE_THRESHOLDS['validation_time_ms']),
    (VALID_SPL_SAMPLES[1], True, PERFORMANCE_THRESHOLDS['validation_time_ms']),
    (INVALID_SPL_SAMPLES[0], False, PERFORMANCE_THRESHOLDS['validation_time_ms'])
])
def test_splunk_detection_validation(
    benchmark: BenchmarkFixture,
    spl_input: str,
    is_valid: bool,
    performance_threshold: int
):
    """Test validation functionality with performance metrics."""
    detection = SplunkDetection(
        search_terms=spl_input,
        pipes=[],
        field_extractions={}
    )
    
    def validate_detection():
        return detection.validate_search()
    
    # Benchmark validation performance
    result = benchmark(validate_detection)
    assert result[0] == is_valid
    assert benchmark.stats['max'] < performance_threshold

    # Verify validation results
    if is_valid:
        assert len(result[1]) == 0
        assert detection.confidence_score > 0.9
    else:
        assert len(result[1]) > 0
        assert detection.confidence_score < 0.5