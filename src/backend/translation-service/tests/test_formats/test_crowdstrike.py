"""
Unit tests for Crowdstrike detection format handler.

This module provides comprehensive test coverage for the Crowdstrike format handler,
validating parsing, generation, validation and field normalization capabilities.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
from unittest.mock import Mock, patch  # version: python3.11+

from ...translation_service.formats.crowdstrike import (
    CrowdstrikeFormat,
    validate_crowdstrike_syntax
)

# Sample detection rules for testing
SAMPLE_CROWDSTRIKE_DETECTION = '''metadata: {
    title: "Suspicious Process Creation",
    description: "Detects suspicious process creation patterns",
    author: "Security Team"
}

events: {
    EventType: ProcessRollup2,
    FileName: "malware.exe",
    CommandLine: "bypass",
    UserName: "SYSTEM"
}

condition: EventType = "ProcessRollup2" AND FileName = "malware.exe"
'''

INVALID_CROWDSTRIKE_DETECTION = '''invalid syntax
MissingOperator
'''

COMPLEX_CROWDSTRIKE_DETECTION = '''metadata: {
    title: "Advanced Process Detection",
    description: "Detects complex process patterns",
    author: "Security Team",
    severity: "high"
}

events: {
    EventType: ProcessRollup2,
    FileName: "*.exe",
    CommandLine: "bypass exploit",
    ParentProcess: "cmd.exe",
    UserName: "SYSTEM",
    HostName: "WORKSTATION1"
}

condition: EventType IN ("ProcessRollup2", "ProcessCreate") AND 
          (FileName MATCHES "*.exe" OR CommandLine CONTAINS_ANY ("bypass", "exploit"))
'''

@pytest.mark.unit
def test_crowdstrike_format_initialization(mock_translation_model):
    """Test initialization of CrowdstrikeFormat class with validation."""
    try:
        # Initialize format handler
        handler = CrowdstrikeFormat(mock_translation_model)
        
        # Verify translation model assignment
        assert handler._translation_model == mock_translation_model
        
        # Validate field mappings initialization
        assert isinstance(handler._field_mappings, dict)
        assert 'process_name' in handler._field_mappings
        assert handler._field_mappings['command_line'] == 'CommandLine'
        
        # Check validation rules
        assert 'required_sections' in handler._validation_rules
        assert 'metadata' in handler._validation_rules['required_sections']
        assert handler._validation_rules['max_condition_depth'] == 5
        
        # Verify cache initialization
        assert isinstance(handler._cache, dict)
        assert len(handler._cache) == 0
        
    except Exception as e:
        pytest.fail(f"Format handler initialization failed: {str(e)}")

@pytest.mark.unit
def test_parse_valid_crowdstrike_detection(mock_translation_model):
    """Test parsing of valid Crowdstrike detection rules."""
    handler = CrowdstrikeFormat(mock_translation_model)
    
    # Test parsing simple detection
    result = handler.parse(SAMPLE_CROWDSTRIKE_DETECTION)
    assert isinstance(result, dict)
    assert 'metadata' in result
    assert 'detection' in result
    assert 'validation' in result
    
    # Verify metadata parsing
    assert result['metadata']['title'] == "Suspicious Process Creation"
    assert result['metadata']['author'] == "Security Team"
    
    # Verify detection fields
    assert 'fields' in result['detection']
    assert result['detection']['fields']['file_name'] == '"malware.exe"'
    assert result['detection']['fields']['command_line'] == '"bypass"'
    
    # Test parsing complex detection
    complex_result = handler.parse(COMPLEX_CROWDSTRIKE_DETECTION)
    assert isinstance(complex_result, dict)
    assert complex_result['metadata']['severity'] == "high"
    assert 'CONTAINS_ANY' in complex_result['detection']['condition']
    
    # Verify field normalization
    assert 'process_name' in complex_result['detection']['fields']
    assert 'parent_process' in complex_result['detection']['fields']

@pytest.mark.unit
def test_generate_crowdstrike_detection(mock_translation_model):
    """Test generation of Crowdstrike detection rules."""
    handler = CrowdstrikeFormat(mock_translation_model)
    
    # Prepare test detection data
    detection_data = {
        'metadata': {
            'title': 'Test Detection',
            'description': 'Test description',
            'author': 'Test Author'
        },
        'detection': {
            'fields': {
                'process_name': 'suspicious.exe',
                'command_line': 'bypass security',
                'user_name': 'SYSTEM'
            },
            'condition': 'process_name = "suspicious.exe" AND command_line CONTAINS "bypass"'
        }
    }
    
    # Generate detection
    result = handler.generate(detection_data)
    assert isinstance(result, str)
    
    # Verify generated sections
    assert 'metadata:' in result
    assert 'events:' in result
    assert 'condition:' in result
    
    # Validate field name mapping
    assert 'ProcessName' in result
    assert 'CommandLine' in result
    assert 'UserName' in result
    
    # Verify metadata formatting
    assert 'title: "Test Detection"' in result
    assert 'description: "Test description"' in result
    
    # Test invalid data handling
    with pytest.raises(ValueError):
        handler.generate({'invalid': 'data'})

@pytest.mark.unit
def test_validate_crowdstrike_syntax():
    """Test validation of Crowdstrike detection syntax."""
    # Test valid simple detection
    is_valid, error_msg, report = validate_crowdstrike_syntax(SAMPLE_CROWDSTRIKE_DETECTION)
    assert is_valid
    assert not error_msg
    assert report['is_valid']
    assert len(report['errors']) == 0
    
    # Test valid complex detection
    is_valid, error_msg, report = validate_crowdstrike_syntax(COMPLEX_CROWDSTRIKE_DETECTION)
    assert is_valid
    assert not error_msg
    assert report['is_valid']
    assert len(report['errors']) == 0
    assert 'IN' in report['syntax_validation']
    assert 'MATCHES' in report['syntax_validation']
    
    # Test invalid detection
    is_valid, error_msg, report = validate_crowdstrike_syntax(INVALID_CROWDSTRIKE_DETECTION)
    assert not is_valid
    assert error_msg
    assert not report['is_valid']
    assert len(report['errors']) > 0
    assert 'Missing required section' in report['errors'][0]

@pytest.mark.unit
def test_field_name_normalization(mock_translation_model):
    """Test field name normalization capabilities."""
    handler = CrowdstrikeFormat(mock_translation_model)
    
    # Test standard field normalization
    assert handler._field_mappings['process_name'] == 'ProcessName'
    assert handler._field_mappings['command_line'] == 'CommandLine'
    
    # Test reverse mapping (Crowdstrike to common format)
    detection = {
        'metadata': {'title': 'Test'},
        'detection': {
            'fields': {
                'ProcessName': 'test.exe',
                'CommandLine': 'test args',
                'UserName': 'SYSTEM'
            },
            'condition': 'ProcessName = "test.exe"'
        }
    }
    
    parsed = handler.parse(SAMPLE_CROWDSTRIKE_DETECTION)
    assert 'process_name' in parsed['detection']['fields']
    assert 'command_line' in parsed['detection']['fields']
    assert 'user_name' in parsed['detection']['fields']
    
    # Test case sensitivity handling
    assert handler._field_mappings['process_name'].lower() == 'processname'
    assert handler._field_mappings['command_line'].lower() == 'commandline'
    
    # Test unknown field handling
    detection_with_custom = {
        'metadata': {'title': 'Test'},
        'detection': {
            'fields': {
                'CustomField': 'test value'
            },
            'condition': 'CustomField = "test value"'
        }
    }
    
    result = handler.generate(detection_with_custom)
    assert 'CustomField' in result