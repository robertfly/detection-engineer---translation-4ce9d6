"""
Comprehensive test suite for the YARA format handler.

This module provides extensive testing coverage for YARA rule parsing,
generation, translation and validation with robust error handling and
edge case coverage.

Version: 1.0.0
"""

# External imports
import pytest  # version: 7.4.3
from unittest.mock import Mock, patch  # python3.11+

# Internal imports
from translation_service.formats.yara import (
    YARAFormat,
    parse_yara_rule,
    generate_yara_rule,
    validate_yara_rule
)

# Test fixtures and sample data
SAMPLE_YARA_RULE = '''
rule suspicious_behavior {
    meta:
        description = "Detects suspicious process behavior"
        author = "Security Team"
        created = "2023-11-01"
        modified = "2023-11-01"
    strings:
        $process = "rundll32.exe"
        $command = "javascript:" wide
    condition:
        $process and $command
}
'''

INVALID_YARA_RULE = '''
rule invalid_rule {
    meta:
        description = "Invalid rule format"
    strings:
        invalid_string
    condition:
        true
}
'''

SAMPLE_SIGMA_RULE = '''
title: Suspicious Process Behavior
status: experimental
description: Detects suspicious process behavior
author: Security Team
date: 2023/11/01
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        Image: 'rundll32.exe'
        CommandLine|contains: 'javascript:'
    condition: selection
'''

@pytest.fixture
def yara_format():
    """Fixture providing configured YARA format handler instance."""
    config = {
        'validation_rules': {
            'min_strings': 1,
            'max_strings': 10000,
            'max_rule_size': 1048576
        }
    }
    return YARAFormat(config)

@pytest.mark.unit
def test_yara_format_initialization():
    """Test YARA format handler initialization with various configurations."""
    # Test default initialization
    handler = YARAFormat()
    assert handler.format_name == 'yara'
    assert handler.config == {}
    
    # Test custom configuration
    custom_config = {
        'validation_rules': {
            'min_strings': 2,
            'max_rule_size': 512000
        }
    }
    handler = YARAFormat(custom_config)
    assert handler.config == custom_config
    
    # Test compiler options
    assert handler.compiler_options['includes'] is False
    assert handler.compiler_options['error_on_warning'] is True
    assert handler.compiler_options['stack_size'] == 32768

@pytest.mark.unit
def test_parse_valid_yara_rule(yara_format):
    """Test parsing of valid YARA rules with comprehensive validation."""
    # Test basic rule parsing
    detection_model = parse_yara_rule(SAMPLE_YARA_RULE)
    
    # Validate core components
    assert detection_model['name'] == 'suspicious_behavior'
    assert detection_model['type'] == 'yara'
    
    # Validate metadata
    assert detection_model['meta']['description'] == 'Detects suspicious process behavior'
    assert detection_model['meta']['author'] == 'Security Team'
    assert detection_model['meta']['created'] == '2023-11-01'
    
    # Validate strings section
    assert '$process' in detection_model['strings']
    assert detection_model['strings']['$process'] == '"rundll32.exe"'
    assert '$command' in detection_model['strings']
    assert 'wide' in detection_model['strings']['$command']
    
    # Validate condition
    assert '$process and $command' in detection_model['condition']

@pytest.mark.unit
def test_parse_invalid_yara_rule(yara_format):
    """Test error handling for invalid YARA rule parsing."""
    with pytest.raises(ValueError) as exc_info:
        parse_yara_rule(INVALID_YARA_RULE)
    assert "Failed to parse YARA rule" in str(exc_info.value)
    
    # Test empty rule
    with pytest.raises(ValueError) as exc_info:
        parse_yara_rule("")
    assert "Invalid YARA rule structure" in str(exc_info.value)
    
    # Test malformed rule
    with pytest.raises(ValueError) as exc_info:
        parse_yara_rule("rule malformed { invalid }")
    assert "Failed to parse YARA rule" in str(exc_info.value)

@pytest.mark.unit
def test_generate_yara_rule(yara_format):
    """Test YARA rule generation with various detection models."""
    detection_model = {
        'name': 'test_rule',
        'meta': {
            'description': 'Test detection rule',
            'author': 'Test Author',
            'created': '2023-11-01',
            'modified': '2023-11-01'
        },
        'strings': {
            '$test_string': '"test pattern"',
            '$wide_string': '"wide pattern" wide'
        },
        'condition': '$test_string and $wide_string'
    }
    
    # Generate rule and validate
    rule_content = generate_yara_rule(detection_model)
    assert 'rule test_rule' in rule_content
    assert 'description = "Test detection rule"' in rule_content
    assert '$test_string = "test pattern"' in rule_content
    assert '$wide_string = "wide pattern" wide' in rule_content
    assert '$test_string and $wide_string' in rule_content
    
    # Test missing required fields
    invalid_model = {'name': 'invalid'}
    with pytest.raises(ValueError) as exc_info:
        generate_yara_rule(invalid_model)
    assert "Missing required field" in str(exc_info.value)

@pytest.mark.integration
def test_translate_to_sigma(yara_format):
    """Test translation from YARA to SIGMA format with validation."""
    with patch('translation_service.formats.yara.parse_yara_rule') as mock_parse:
        # Setup mock parsed model
        mock_parse.return_value = {
            'name': 'suspicious_behavior',
            'meta': {
                'description': 'Detects suspicious process behavior',
                'author': 'Security Team'
            },
            'strings': {
                '$process': '"rundll32.exe"',
                '$command': '"javascript:" wide'
            },
            'condition': '$process and $command'
        }
        
        # Test translation
        result = yara_format.translate_to(SAMPLE_YARA_RULE, 'sigma')
        mock_parse.assert_called_once_with(SAMPLE_YARA_RULE)
        
        # Validate translation was attempted
        assert result is not None

@pytest.mark.integration
def test_translate_from_sigma(yara_format):
    """Test translation from SIGMA to YARA format with validation."""
    with patch('translation_service.formats.yara.generate_yara_rule') as mock_generate:
        # Setup mock generated rule
        mock_generate.return_value = SAMPLE_YARA_RULE
        
        # Test translation
        result = yara_format.translate_from(SAMPLE_SIGMA_RULE, 'sigma')
        mock_generate.assert_called_once()
        
        # Validate translation result
        assert result == SAMPLE_YARA_RULE
        
        # Test validation is performed
        valid, _ = validate_yara_rule(result)
        assert valid is True

@pytest.mark.unit
def test_validate_yara_rule(yara_format):
    """Test YARA rule validation with various rule formats."""
    # Test valid rule
    valid, error = validate_yara_rule(SAMPLE_YARA_RULE)
    assert valid is True
    assert error is None
    
    # Test invalid rule
    valid, error = validate_yara_rule(INVALID_YARA_RULE)
    assert valid is False
    assert error is not None
    
    # Test size limit
    large_rule = "rule test { meta: description = 'x' * 2000000 }"
    valid, error = validate_yara_rule(large_rule)
    assert valid is False
    assert "exceeds maximum size limit" in error