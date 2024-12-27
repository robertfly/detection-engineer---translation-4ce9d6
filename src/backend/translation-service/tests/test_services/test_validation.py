"""
Comprehensive test suite for ValidationService module.

Tests validation logic, error reporting, and confidence scoring for security detection translations.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
from unittest.mock import Mock, patch  # python3.11+

from ...translation_service.services.validation import ValidationService, ValidationResult

# Test data constants
VALID_SPLUNK_DETECTION = """
search source=windows EventCode=4688 
| where CommandLine="*cmd.exe*" 
| stats count by Computer, CommandLine
"""

INVALID_SPLUNK_DETECTION = """
search source=windows EventCode=4688 
| where CommandLine= 
| stats count by Computer,
"""

VALID_SIGMA_DETECTION = """
title: Suspicious Command Line Execution
status: experimental
description: Detects suspicious command line execution
logsource:
    product: windows
    service: security
detection:
    selection:
        EventID: 4688
        CommandLine: '*cmd.exe*'
    condition: selection
"""

@pytest.fixture
def validation_service():
    """Fixture providing configured ValidationService instance."""
    service = ValidationService()
    # Configure test thresholds
    service._thresholds = {
        'syntax_score': 0.95,
        'field_mapping_score': 0.90,
        'logic_preservation_score': 0.95,
        'pattern_matching_score': 0.92,
        'temporal_logic_score': 0.93,
        'aggregation_accuracy_score': 0.94
    }
    return service

@pytest.mark.validation
class TestValidationService:
    """Test suite for ValidationService functionality."""

    def setup_method(self):
        """Setup method run before each test."""
        self._test_data = {
            'splunk': VALID_SPLUNK_DETECTION,
            'sigma': VALID_SIGMA_DETECTION,
            'invalid': INVALID_SPLUNK_DETECTION
        }
        self._format_handler = Mock()
        self._service = None

    def teardown_method(self):
        """Cleanup method run after each test."""
        self._test_data = {}
        self._format_handler = None
        self._service = None

    @pytest.mark.splunk
    def test_validate_detection_valid_splunk(self, validation_service):
        """Test validation of a correctly formatted Splunk detection."""
        # Arrange
        detection = self._test_data['splunk']

        # Act
        result = validation_service.validate_detection(
            detection_text=detection,
            format_type='splunk'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert result.is_valid is True
        assert result.confidence_score >= 0.95
        assert not result.errors
        assert len(result.dimension_scores) == 6
        assert all(score >= 0.90 for score in result.dimension_scores.values())
        assert 'syntax_score' in result.dimension_scores
        assert 'field_mapping_score' in result.dimension_scores

    @pytest.mark.error_handling
    def test_validate_detection_invalid_syntax(self, validation_service):
        """Test validation of detection with syntax errors."""
        # Arrange
        detection = self._test_data['invalid']

        # Act
        result = validation_service.validate_detection(
            detection_text=detection,
            format_type='splunk'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert result.is_valid is False
        assert result.confidence_score < 0.95
        assert result.errors
        assert 'SYNTAX' in result.errors
        assert any('incomplete statement' in error.lower() 
                  for error in result.errors['SYNTAX'])
        assert result.dimension_scores['syntax_score'] < 0.95

    @pytest.mark.sigma
    def test_validate_detection_valid_sigma(self, validation_service):
        """Test validation of a correctly formatted SIGMA detection."""
        # Arrange
        detection = self._test_data['sigma']

        # Act
        result = validation_service.validate_detection(
            detection_text=detection,
            format_type='sigma'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert result.is_valid is True
        assert result.confidence_score >= 0.95
        assert not result.errors
        assert result.dimension_scores['field_mapping_score'] >= 0.90
        assert 'logsource' in result.validation_details
        assert 'detection' in result.validation_details

    @pytest.mark.batch
    def test_validate_batch_mixed_results(self, validation_service):
        """Test batch validation with mixed valid and invalid detections."""
        # Arrange
        batch_detections = [
            {'content': self._test_data['splunk'], 'format': 'splunk'},
            {'content': self._test_data['invalid'], 'format': 'splunk'},
            {'content': self._test_data['sigma'], 'format': 'sigma'}
        ]

        # Act
        results = validation_service.validate_batch(batch_detections)

        # Assert
        assert len(results) == 3
        assert any(result.is_valid for result in results)
        assert any(not result.is_valid for result in results)
        assert all(isinstance(result, ValidationResult) for result in results)
        assert all(hasattr(result, 'confidence_score') for result in results)

    @pytest.mark.configuration
    def test_validation_thresholds(self, validation_service):
        """Test validation threshold configuration and enforcement."""
        # Arrange
        custom_thresholds = {
            'syntax_score': 0.98,
            'field_mapping_score': 0.95
        }
        validation_service._thresholds.update(custom_thresholds)

        # Act
        result = validation_service.validate_detection(
            detection_text=self._test_data['splunk'],
            format_type='splunk'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert result.dimension_scores['syntax_score'] >= 0.98
        assert result.dimension_scores['field_mapping_score'] >= 0.95
        assert result.is_valid == (result.confidence_score >= 0.95)

    @pytest.mark.error_handling
    def test_validation_empty_detection(self, validation_service):
        """Test validation handling of empty detection input."""
        # Act
        result = validation_service.validate_detection(
            detection_text='',
            format_type='splunk'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert result.is_valid is False
        assert 'Empty detection rule' in result.errors['SYNTAX']
        assert result.confidence_score == 0.0

    @pytest.mark.error_handling
    def test_validation_unsupported_format(self, validation_service):
        """Test validation handling of unsupported format type."""
        # Act
        result = validation_service.validate_detection(
            detection_text=self._test_data['splunk'],
            format_type='unsupported_format'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert result.is_valid is False
        assert 'Unsupported format' in result.errors['SYNTAX']
        assert result.confidence_score == 0.0

    @pytest.mark.performance
    def test_batch_validation_performance(self, validation_service):
        """Test performance of batch validation processing."""
        # Arrange
        large_batch = [
            {'content': self._test_data['splunk'], 'format': 'splunk'}
            for _ in range(100)
        ]

        # Act
        with patch('time.time') as mock_time:
            mock_time.side_effect = [0, 10]  # Simulate 10 second execution
            results = validation_service.validate_batch(large_batch)

        # Assert
        assert len(results) == 100
        assert all(isinstance(result, ValidationResult) for result in results)
        assert all(hasattr(result, 'confidence_score') for result in results)

    @pytest.mark.validation
    def test_validation_result_details(self, validation_service):
        """Test comprehensive validation result details."""
        # Act
        result = validation_service.validate_detection(
            detection_text=self._test_data['splunk'],
            format_type='splunk'
        )

        # Assert
        assert isinstance(result, ValidationResult)
        assert all(key in result.validation_details for key in [
            'syntax_score',
            'field_mapping_score',
            'logic_preservation_score',
            'pattern_matching_score',
            'temporal_logic_score',
            'aggregation_accuracy_score'
        ])
        assert all(isinstance(score, float) 
                  for score in result.dimension_scores.values())
        assert all(isinstance(check, bool) 
                  for check in result.checks_passed.values())