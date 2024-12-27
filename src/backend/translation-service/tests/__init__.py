"""
Test Package Initializer for Translation Service Test Suite

This module provides comprehensive test configuration, custom markers, format-specific test
categorization, and environment-specific settings for the translation service test suite.
Enables both synchronous and asynchronous testing capabilities with extensive validation support.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1

# Supported detection formats for testing
TEST_FORMATS = [
    'splunk',
    'qradar', 
    'sigma',
    'kql',
    'paloalto',
    'crowdstrike',
    'yara',
    'yaral'
]

# Deployment environments for test configuration
TEST_ENVIRONMENTS = [
    'development',
    'staging',
    'production'
]

def pytest_configure(config: pytest.Config) -> None:
    """
    Configures pytest with custom markers, test categories, and environment-specific settings.
    Enables format-specific testing and validation framework support.

    Args:
        config: pytest configuration object

    Returns:
        None: Updates pytest configuration with custom markers and settings
    """
    # Core test markers
    config.addinivalue_line(
        "markers",
        "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers",
        "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers",
        "async_test: mark test requiring async execution"
    )
    config.addinivalue_line(
        "markers",
        "validation: mark test for validation framework"
    )

    # Format-specific test markers
    for format_name in TEST_FORMATS:
        config.addinivalue_line(
            "markers",
            f"{format_name}: mark test specific to {format_name} format"
        )

    # Environment-specific test markers
    for env in TEST_ENVIRONMENTS:
        config.addinivalue_line(
            "markers",
            f"{env}: mark test for {env} environment"
        )

    # Translation validation markers
    config.addinivalue_line(
        "markers",
        "field_mapping: mark test for field mapping validation"
    )
    config.addinivalue_line(
        "markers",
        "syntax_validation: mark test for syntax validation"
    )
    config.addinivalue_line(
        "markers",
        "confidence_check: mark test for confidence score validation"
    )

    # GenAI model test markers
    config.addinivalue_line(
        "markers",
        "model_validation: mark test for GenAI model validation"
    )
    config.addinivalue_line(
        "markers",
        "prompt_validation: mark test for prompt template validation"
    )
    config.addinivalue_line(
        "markers",
        "embedding_validation: mark test for embedding validation"
    )

    # Performance test markers
    config.addinivalue_line(
        "markers",
        "performance: mark test for performance validation"
    )
    config.addinivalue_line(
        "markers",
        "load_test: mark test for load testing"
    )

    # Error handling test markers
    config.addinivalue_line(
        "markers",
        "error_handling: mark test for error handling validation"
    )
    config.addinivalue_line(
        "markers",
        "retry_logic: mark test for retry mechanism validation"
    )

    # Configure test result aggregation by format
    config.option.report_header = (
        "Translation Service Test Suite\n"
        f"Supported Formats: {', '.join(TEST_FORMATS)}\n"
        f"Test Environments: {', '.join(TEST_ENVIRONMENTS)}"
    )

    # Enable parallel test execution settings
    config.option.dist = "loadfile"
    config.option.tx = "3*popen//python"

    # Configure test isolation for format-specific tests
    config.option.isolated_download = True

    # Configure logging for test execution
    import logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Initialize async test support
    pytest_asyncio.plugin.pytest_configure(config)

    # Set up custom test categories for future expansion
    config.addinivalue_line(
        "markers",
        "custom: mark test for custom detection format"
    )