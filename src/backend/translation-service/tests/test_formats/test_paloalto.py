"""
Unit tests for the Palo Alto Networks format handler.

Tests parsing, generation, validation functionality, performance metrics,
and error handling with extensive test coverage.

Version: 1.0.0
"""

import pytest  # version: ^7.4.3
import json  # version: 3.11+
import time  # version: 3.11+
import logging  # version: 3.11+
from typing import Dict, Any, List, Tuple  # version: 3.11+
from translation_service.formats.paloalto import PaloAltoFormat

# Test constants
PERFORMANCE_THRESHOLD_MS = 100  # Maximum allowed processing time in milliseconds
MAX_MEMORY_USAGE_MB = 512  # Maximum allowed memory usage in megabytes

# Sample valid Palo Alto rule with all possible fields
VALID_PALOALTO_RULE = """rule test_detection {
    "name": "test_detection",
    "description": "Test detection for suspicious activity",
    "severity": "high",
    "conditions": {
        "match": "all",
        "rules": [
            {"field": "src_ip", "operator": "in", "value": ["10.0.0.0/8"]},
            {"field": "dest_port", "operator": "equals", "value": 445}
        ]
    },
    "actions": ["alert", "block"],
    "enabled": true,
    "version": "1.0",
    "tags": ["test", "suspicious"],
    "last_modified": "2023-10-27T10:00:00Z"
}"""

# Invalid rule test cases with expected error messages
INVALID_PALOALTO_RULES: List[Tuple[str, str]] = [
    (
        # Missing required field
        """rule invalid_rule {
            "name": "test",
            "severity": "high",
            "actions": ["alert"]
        }""",
        "Required field conditions is missing"
    ),
    (
        # Invalid severity
        """rule invalid_rule {
            "name": "test",
            "severity": "invalid",
            "conditions": {"match": "all", "rules": []},
            "actions": ["alert"]
        }""",
        "Invalid severity level"
    ),
    (
        # Invalid JSON structure
        """rule invalid_rule {
            invalid json content
        }""",
        "Invalid JSON structure"
    ),
    (
        # Rule too long
        "rule " + "x" * 50001 + " {}",
        "Rule exceeds maximum length of 50000"
    )
]

# Sample detection model for testing generation
SAMPLE_DETECTION_MODEL = {
    "type": "palo_alto",
    "name": "test_detection",
    "description": "Test detection description",
    "severity": "high",
    "conditions": {
        "match": "all",
        "rules": [
            {"field": "src_ip", "operator": "in", "value": ["192.168.1.0/24"]},
            {"field": "event_type", "operator": "equals", "value": "suspicious_login"}
        ]
    },
    "actions": ["alert", "block"],
    "enabled": True,
    "metadata": {
        "version": "1.0",
        "tags": ["test"],
        "last_modified": "2023-10-27T10:00:00Z"
    }
}

# Validation test cases
VALIDATION_TEST_CASES = [
    (VALID_PALOALTO_RULE, True, None),  # Valid rule
    ("", False, "Invalid rule syntax"),  # Empty rule
    ("invalid content", False, "Invalid rule syntax"),  # Invalid syntax
    (
        # Invalid field type
        """rule test {
            "name": "test",
            "severity": 123,
            "conditions": {},
            "actions": []
        }""",
        False,
        "Invalid severity level"
    )
]

@pytest.mark.unit
def test_paloalto_format_initialization():
    """Test PaloAltoFormat class initialization and configuration."""
    # Initialize format handler
    handler = PaloAltoFormat()
    
    # Verify logger configuration
    assert handler.logger is not None
    assert isinstance(handler.logger, logging.Logger)
    assert handler.logger.name == "translation_service.formats.paloalto"
    
    # Verify rule pattern compilation
    assert handler.rule_pattern is not None
    
    # Verify metrics initialization
    assert handler.metrics["parse_count"] == 0
    assert handler.metrics["generate_count"] == 0
    assert handler.metrics["validation_errors"] == 0
    assert handler.metrics["avg_parse_time"] == 0.0
    assert handler.metrics["avg_generate_time"] == 0.0

@pytest.mark.unit
def test_parse_valid_paloalto_rule():
    """Test parsing of valid Palo Alto detection rules."""
    handler = PaloAltoFormat()
    trace_id = "test-trace-123"
    
    # Measure parsing performance
    start_time = time.time()
    result = handler.parse(VALID_PALOALTO_RULE, trace_id)
    parse_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    
    # Verify performance
    assert parse_time < PERFORMANCE_THRESHOLD_MS, f"Parsing took {parse_time}ms, exceeding {PERFORMANCE_THRESHOLD_MS}ms threshold"
    
    # Verify parsed result structure
    assert result["type"] == "palo_alto"
    assert result["name"] == "test_detection"
    assert result["severity"] == "high"
    assert "conditions" in result
    assert "actions" in result
    assert result["enabled"] is True
    
    # Verify metadata
    assert result["metadata"]["original_format"] == "palo_alto"
    assert result["metadata"]["version"] == "1.0"
    assert "test" in result["metadata"]["tags"]
    
    # Verify metrics update
    assert handler.metrics["parse_count"] == 1
    assert handler.metrics["avg_parse_time"] > 0

@pytest.mark.unit
@pytest.mark.parametrize("invalid_rule,expected_error", INVALID_PALOALTO_RULES)
def test_parse_invalid_paloalto_rule(invalid_rule: str, expected_error: str):
    """Test parsing of invalid Palo Alto rules with error validation."""
    handler = PaloAltoFormat()
    trace_id = "test-trace-123"
    
    # Verify error handling
    with pytest.raises(ValueError) as exc_info:
        handler.parse(invalid_rule, trace_id)
    
    assert expected_error in str(exc_info.value)
    assert handler.metrics["validation_errors"] > 0

@pytest.mark.unit
def test_generate_paloalto_rule():
    """Test generation of Palo Alto rules from detection model."""
    handler = PaloAltoFormat()
    trace_id = "test-trace-123"
    
    # Measure generation performance
    start_time = time.time()
    result = handler.generate(SAMPLE_DETECTION_MODEL, trace_id)
    generate_time = (time.time() - start_time) * 1000
    
    # Verify performance
    assert generate_time < PERFORMANCE_THRESHOLD_MS
    
    # Verify generated rule structure
    assert "rule test_detection" in result
    assert '"severity": "HIGH"' in result
    assert '"actions": ["alert", "block"]' in result
    assert '"enabled": true' in result
    
    # Verify rule can be parsed back
    parsed = handler.parse(result, trace_id)
    assert parsed["name"] == SAMPLE_DETECTION_MODEL["name"]
    assert parsed["severity"] == SAMPLE_DETECTION_MODEL["severity"]
    
    # Verify metrics update
    assert handler.metrics["generate_count"] == 1
    assert handler.metrics["avg_generate_time"] > 0

@pytest.mark.unit
@pytest.mark.parametrize("rule,expected_valid,expected_error", VALIDATION_TEST_CASES)
def test_validate_paloalto_rule(rule: str, expected_valid: bool, expected_error: str):
    """Test validation of Palo Alto rules with comprehensive test cases."""
    handler = PaloAltoFormat()
    trace_id = "test-trace-123"
    
    # Perform validation
    is_valid, error_msg, validation_details = handler.validate_rule(rule, trace_id)
    
    # Verify validation result
    assert is_valid == expected_valid
    if expected_error:
        assert error_msg == expected_error
    
    # Verify validation details
    assert "length_check" in validation_details
    assert "syntax_check" in validation_details
    assert "required_fields" in validation_details
    assert "severity_check" in validation_details
    
    # Verify performance
    if is_valid:
        assert validation_details["length_check"]
        assert validation_details["syntax_check"]
        assert validation_details["required_fields"]
        assert validation_details["severity_check"]