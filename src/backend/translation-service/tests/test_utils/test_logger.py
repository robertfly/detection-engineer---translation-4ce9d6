"""
Unit tests for the translation service logger utility.

Tests JSON formatting, trace ID management, ELK Stack integration,
environment-specific configuration, performance, and security aspects.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
from unittest.mock import patch, MagicMock
import json  # version: 3.11+
import logging
import uuid
from typing import Any, Dict

from ...translation_service.utils.logger import (
    get_logger,
    set_trace_id,
    get_trace_id,
    JsonFormatter
)

# Test constants
TEST_LOGGER_NAME = "test_logger"
TEST_TRACE_ID = str(uuid.uuid4())
TEST_LOG_MESSAGE = "Test log message"
TEST_EXTRA_FIELDS = {
    "service": "translation-service",
    "operation": "test",
    "duration_ms": 150
}

@pytest.mark.parametrize('env,expected_level', [
    ('development', 'DEBUG'),
    ('staging', 'INFO'),
    ('production', 'WARNING')
])
def test_get_logger_creation(env: str, expected_level: str) -> None:
    """Test logger creation with environment-specific configurations."""
    # Configure test environment
    config_override = {
        'environment': env,
        'level': expected_level,
        'format': 'json',
        'elk_enabled': True
    }

    # Create logger instance
    logger = get_logger(TEST_LOGGER_NAME, config_override)

    # Verify logger configuration
    assert logger.name == TEST_LOGGER_NAME
    assert logger.level == getattr(logging, expected_level)
    assert len(logger.handlers) > 0

    # Verify JSON formatter configuration
    json_handler = next(h for h in logger.handlers if isinstance(h, logging.StreamHandler))
    assert isinstance(json_handler.formatter, JsonFormatter)

    # Test logging with extra fields
    with patch.object(json_handler, 'emit') as mock_emit:
        logger.info(TEST_LOG_MESSAGE, extra={'extra_fields': TEST_EXTRA_FIELDS})
        assert mock_emit.called
        record = mock_emit.call_args[0][0]
        assert hasattr(record, 'extra_fields')
        assert record.extra_fields == TEST_EXTRA_FIELDS

@pytest.mark.parametrize('log_data', [
    'simple message',
    {'complex': 'structure', 'nested': {'field': 'value'}},
    ['array', 'content', 123],
    {'special_chars': '!@#$%^&*()', 'unicode': '你好'},
    {'long_field': 'x' * 40000}  # Test field truncation
])
def test_json_formatter(log_data: Any) -> None:
    """Test JSON formatter functionality with various data types."""
    formatter = JsonFormatter(default_fields={'service': 'translation-service'})
    
    # Create test log record
    record = logging.LogRecord(
        name=TEST_LOGGER_NAME,
        level=logging.INFO,
        pathname='test_logger.py',
        lineno=1,
        msg=log_data,
        args=(),
        exc_info=None
    )

    # Format log record
    formatted_log = formatter.format(record)
    parsed_log = json.loads(formatted_log)

    # Verify required fields
    assert 'timestamp' in parsed_log
    assert parsed_log['level'] == 'INFO'
    assert parsed_log['name'] == TEST_LOGGER_NAME
    assert parsed_log['service'] == 'translation-service'

    # Verify message formatting
    if isinstance(log_data, (dict, list)):
        assert isinstance(parsed_log['message'], str)
    else:
        assert parsed_log['message'] == str(log_data)

    # Verify field length limits
    for value in parsed_log.values():
        if isinstance(value, str):
            assert len(value) <= formatter._max_field_length

@pytest.mark.asyncio
@pytest.mark.parametrize('trace_id', [
    str(uuid.uuid4()),  # Valid UUID
    None,  # No trace ID
    'invalid-trace-id'  # Invalid format
])
async def test_trace_id_management(trace_id: str) -> None:
    """Test trace ID functionality and propagation."""
    # Test trace ID setting
    if trace_id is None:
        assert get_trace_id() == ''
    else:
        set_trace_id(trace_id)
        current_trace_id = get_trace_id()
        
        if trace_id and len(trace_id) == 36:  # Valid UUID length
            try:
                uuid.UUID(trace_id)
                assert current_trace_id == trace_id
            except ValueError:
                assert current_trace_id == ''
        else:
            assert current_trace_id == ''

    # Test trace ID in logs
    logger = get_logger(TEST_LOGGER_NAME)
    with patch.object(logger.handlers[0], 'emit') as mock_emit:
        logger.info(TEST_LOG_MESSAGE)
        record = mock_emit.call_args[0][0]
        formatted_log = logger.handlers[0].formatter.format(record)
        parsed_log = json.loads(formatted_log)
        
        if trace_id and len(trace_id) == 36:
            try:
                uuid.UUID(trace_id)
                assert parsed_log.get('trace_id') == trace_id
            except ValueError:
                assert 'trace_id' not in parsed_log
        else:
            assert 'trace_id' not in parsed_log

@pytest.mark.integration
@pytest.mark.parametrize('environment', ['development', 'staging', 'production'])
def test_logger_integration(environment: str) -> None:
    """Test end-to-end logger functionality with ELK Stack integration."""
    # Configure test environment
    config = {
        'environment': environment,
        'elk_enabled': True,
        'trace_id_enabled': True,
        'file_enabled': True,
        'file_path': f'/tmp/test-{environment}.log'
    }

    # Initialize logger with trace ID
    logger = get_logger(TEST_LOGGER_NAME, config)
    test_trace_id = str(uuid.uuid4())
    set_trace_id(test_trace_id)

    # Test structured logging
    with patch('logging.Handler.emit') as mock_emit:
        # Log various message types
        logger.info(TEST_LOG_MESSAGE, extra={'extra_fields': TEST_EXTRA_FIELDS})
        logger.error("Test error", exc_info=Exception("Test exception"))
        logger.warning({"complex": "message"})

        # Verify log structure and content
        for call in mock_emit.call_args_list:
            record = call[0][0]
            formatted_log = logger.handlers[0].formatter.format(record)
            parsed_log = json.loads(formatted_log)

            # Verify common fields
            assert 'timestamp' in parsed_log
            assert 'level' in parsed_log
            assert 'name' in parsed_log
            assert 'message' in parsed_log
            assert parsed_log.get('trace_id') == test_trace_id
            assert parsed_log.get('service') == 'translation-service'
            assert parsed_log.get('environment') == environment

            # Verify environment-specific logging
            if environment == 'development':
                assert record.levelno >= logging.DEBUG
            elif environment == 'staging':
                assert record.levelno >= logging.INFO
            else:  # production
                assert record.levelno >= logging.WARNING

            # Verify error logging
            if record.levelno == logging.ERROR:
                assert 'exception' in parsed_log

def test_logger_security() -> None:
    """Test logger security features and data sanitization."""
    logger = get_logger(TEST_LOGGER_NAME)
    sensitive_data = {
        'password': 'secret123',
        'api_key': 'key123',
        'token': 'bearer123',
        'safe_field': 'public_data'
    }

    with patch.object(logger.handlers[0], 'emit') as mock_emit:
        logger.info("Security test", extra={'extra_fields': sensitive_data})
        record = mock_emit.call_args[0][0]
        formatted_log = logger.handlers[0].formatter.format(record)
        parsed_log = json.loads(formatted_log)

        # Verify sensitive data handling
        extra_fields = parsed_log.get('extra_fields', {})
        assert 'safe_field' in str(extra_fields)
        assert 'password' not in str(extra_fields)
        assert 'api_key' not in str(extra_fields)
        assert 'token' not in str(extra_fields)
        assert 'secret123' not in str(extra_fields)
        assert 'bearer123' not in str(extra_fields)