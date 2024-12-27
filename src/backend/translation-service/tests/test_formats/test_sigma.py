"""
Unit tests for SIGMA format handler with comprehensive validation of translation,
parsing, and validation functionality.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1
import yaml  # version: 6.0.1
import time
from unittest.mock import Mock, patch

from ...translation_service.formats.sigma import (
    SigmaFormat,
    validate_sigma_rule,
    parse_sigma_rule,
    SigmaTranslationError
)

# Test Constants
VALID_SIGMA_RULE = """
title: Test Detection Rule
description: Test rule for validation
status: test
logsource:
    product: windows
    service: security
detection:
    selection:
        EventID: 4625
        FailureReason: '0xC000006D'
    condition: selection
falsepositives:
    - legitimate_login_attempts
level: medium
tags:
    - attack.credential_access
    - attack.t1110
"""

INVALID_SIGMA_RULE = """
title: Invalid Rule
status: test
detection:
    selection:
        EventID: 4625
    # Missing condition field
"""

TEST_VALIDATION_CASES = [
    (VALID_SIGMA_RULE, True, None),
    (INVALID_SIGMA_RULE, False, "Missing detection condition"),
    ("invalid_yaml: :", False, "Invalid YAML format"),
    ("", False, "Empty rule content")
]

TEST_PARSING_CASES = [
    (
        VALID_SIGMA_RULE,
        {
            'title': 'Test Detection Rule',
            'status': 'test',
            'logsource': {'product': 'windows', 'service': 'security'},
            'detection': {
                'selection': {'EventID': '4625', 'FailureReason': '0xC000006D'},
                'condition': 'selection'
            }
        }
    ),
    (INVALID_SIGMA_RULE, None),
    ("invalid: : yaml", None)
]

PERFORMANCE_THRESHOLD_MS = 500

@pytest.fixture
def mock_translation_model():
    """Fixture for mocked translation model."""
    model = Mock()
    model.translate_detection = Mock()
    return model

@pytest.fixture
def mock_config():
    """Fixture for mocked configuration."""
    config = Mock()
    config.get_format_settings.return_value = {
        'confidence_threshold': 0.95,
        'validation_level': 'strict'
    }
    return config

@pytest.mark.asyncio
async def test_sigma_format_initialization(mock_translation_model, mock_config):
    """Test SigmaFormat class initialization with configuration validation."""
    try:
        # Initialize SigmaFormat
        sigma_format = SigmaFormat(mock_translation_model)
        
        # Verify model assignment
        assert sigma_format._translation_model == mock_translation_model
        
        # Verify field mappings initialization
        assert hasattr(sigma_format, '_field_mappings')
        assert isinstance(sigma_format._field_mappings, dict)
        
        # Test error handling for invalid configuration
        with pytest.raises(ValueError):
            SigmaFormat(None)
            
    except Exception as e:
        pytest.fail(f"SigmaFormat initialization failed: {str(e)}")

@pytest.mark.asyncio
@pytest.mark.parametrize('source_format,expected_accuracy', [
    ('splunk', 0.95),
    ('qradar', 0.95),
    ('kql', 0.95)
])
async def test_to_sigma_translation(mock_translation_model, source_format, expected_accuracy):
    """Test translation to SIGMA format with accuracy validation."""
    # Setup
    detection_id = "test_detection_123"
    source_text = "search EventCode=4625"
    mock_translation_model.translate_detection.return_value = {
        'translated_text': VALID_SIGMA_RULE,
        'confidence_score': expected_accuracy
    }
    
    sigma_format = SigmaFormat(mock_translation_model)
    
    # Execute translation with timing
    start_time = time.time()
    result = await sigma_format.to_sigma(
        detection_id=detection_id,
        source_text=source_text,
        source_format=source_format
    )
    execution_time = (time.time() - start_time) * 1000
    
    # Verify performance
    assert execution_time < PERFORMANCE_THRESHOLD_MS, f"Translation took {execution_time}ms, exceeding {PERFORMANCE_THRESHOLD_MS}ms threshold"
    
    # Verify translation result
    assert result is not None
    assert 'sigma_rule' in result
    assert 'confidence_score' in result
    assert result['confidence_score'] >= expected_accuracy
    
    # Validate SIGMA rule structure
    sigma_rule = result['sigma_rule']
    assert 'title' in sigma_rule
    assert 'detection' in sigma_rule
    assert 'logsource' in sigma_rule
    
    # Verify error handling
    with pytest.raises(RuntimeError):
        await sigma_format.to_sigma(
            detection_id="invalid_detection",
            source_text="invalid detection",
            source_format=source_format
        )

@pytest.mark.asyncio
@pytest.mark.parametrize('target_format,expected_accuracy', [
    ('splunk', 0.95),
    ('qradar', 0.95),
    ('kql', 0.95)
])
async def test_from_sigma_translation(mock_translation_model, target_format, expected_accuracy):
    """Test translation from SIGMA to other formats."""
    # Setup
    detection_id = "test_detection_123"
    mock_translation_model.translate_detection.return_value = {
        'translated_text': 'search EventCode=4625',
        'confidence_score': expected_accuracy,
        'validation_result': {'is_valid': True}
    }
    
    sigma_format = SigmaFormat(mock_translation_model)
    
    # Execute translation with timing
    start_time = time.time()
    result = await sigma_format.from_sigma(
        detection_id=detection_id,
        sigma_text=VALID_SIGMA_RULE,
        target_format=target_format
    )
    execution_time = (time.time() - start_time) * 1000
    
    # Verify performance
    assert execution_time < PERFORMANCE_THRESHOLD_MS
    
    # Verify translation result
    assert result is not None
    assert 'translated_text' in result
    assert 'confidence_score' in result
    assert result['confidence_score'] >= expected_accuracy
    
    # Test error handling
    with pytest.raises(ValueError):
        await sigma_format.from_sigma(
            detection_id="invalid_detection",
            sigma_text=INVALID_SIGMA_RULE,
            target_format=target_format
        )

@pytest.mark.parametrize('rule_data,expected_valid,error_type', TEST_VALIDATION_CASES)
def test_validate_sigma_rule(rule_data, expected_valid, error_type):
    """Test SIGMA rule validation functionality."""
    try:
        # Parse YAML if valid
        if rule_data:
            rule_dict = yaml.safe_load(rule_data)
        else:
            rule_dict = {}
            
        # Execute validation
        is_valid, error_msg, validation_details = validate_sigma_rule(rule_dict, 'generic')
        
        # Verify validation result
        assert is_valid == expected_valid
        
        if not expected_valid:
            assert error_msg is not None
            if error_type:
                assert error_type in error_msg
                
        # Verify validation details
        assert 'is_valid' in validation_details
        assert 'errors' in validation_details
        assert 'warnings' in validation_details
        
    except Exception as e:
        if not error_type:
            pytest.fail(f"Unexpected validation error: {str(e)}")

@pytest.mark.parametrize('rule_text,expected_structure', TEST_PARSING_CASES)
def test_parse_sigma_rule(rule_text, expected_structure):
    """Test SIGMA rule parsing functionality."""
    try:
        # Execute parsing
        if expected_structure:
            result = parse_sigma_rule(rule_text)
            
            # Verify parsed structure
            assert result is not None
            assert isinstance(result, dict)
            
            # Verify required fields
            for key in ['title', 'detection']:
                assert key in result
                
            # Verify detection structure
            assert 'detection' in result
            if 'condition' in result['detection']:
                assert isinstance(result['detection']['condition'], str)
                
        else:
            with pytest.raises((ValueError, RuntimeError)):
                parse_sigma_rule(rule_text)
                
    except Exception as e:
        if expected_structure:
            pytest.fail(f"Unexpected parsing error: {str(e)}")

def test_sigma_translation_error():
    """Test SigmaTranslationError exception handling."""
    # Test error creation
    error = SigmaTranslationError("Test error message")
    assert str(error) == "Test error message"
    
    # Test error with details
    error_with_details = SigmaTranslationError(
        "Test error",
        details={'field': 'detection', 'reason': 'missing'}
    )
    assert 'details' in error_with_details.__dict__