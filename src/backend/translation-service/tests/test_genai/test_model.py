"""
Unit tests for the GenAI Translation Model component.

This module implements comprehensive test coverage for the translation model including
accuracy validation, confidence scoring, error handling, and performance metrics.

Version: 1.0.0
"""

# pytest: version 7.4.3
import pytest
# pytest-asyncio: version 0.21.1
import pytest_asyncio
# pytest-cov: version 4.1.0
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, List, Any, Optional
import json
import time

from translation_service.genai.model import TranslationModel
from translation_service.config.genai import GenAIConfig

# Test data constants
SAMPLE_DETECTIONS = {
    'splunk': '''search index=windows EventCode=4688 
        | where CommandLine contains "mimikatz.exe" 
        | stats count by Computer, User''',
    'sigma': '''
title: Mimikatz Execution Detection
logsource:
    product: windows
    service: security
detection:
    selection:
        EventID: 4688
        CommandLine: '*mimikatz.exe*'
    condition: selection''',
    'kql': '''SecurityEvent
        | where EventID == 4688
        | where CommandLine contains "mimikatz.exe"
        | summarize count() by Computer, Account'''
}

@pytest.fixture
def mock_genai_config():
    """Fixture providing mock GenAI configuration."""
    config = Mock(spec=GenAIConfig)
    config.model_name = "gpt-4"
    config.temperature = 0.2
    config.max_tokens = 4096
    config.supported_formats = ["splunk", "sigma", "kql", "qradar", "paloalto", "crowdstrike", "yara", "yaral"]
    config.format_confidence_thresholds = {
        "splunk": 0.95,
        "sigma": 0.90,
        "kql": 0.93
    }
    config.get_format_settings.return_value = {
        "field_mapping_confidence": 0.95,
        "syntax_validation_level": "strict"
    }
    return config

@pytest.fixture
def sample_detections():
    """Fixture providing sample detections for testing."""
    return SAMPLE_DETECTIONS

class TestTranslationModel:
    """
    Comprehensive test suite for TranslationModel functionality.
    Tests translation accuracy, confidence scoring, error handling, and performance.
    """

    @pytest.fixture(autouse=True)
    async def setup_method(self, mock_genai_config):
        """Setup method run before each test."""
        self.model = TranslationModel(mock_genai_config)
        self.performance_thresholds = {
            'translation_time': 5.0,  # seconds
            'confidence_min': 0.85,
            'validation_time': 1.0  # seconds
        }

    async def teardown_method(self):
        """Cleanup method run after each test."""
        await self.model._client.aclose()

    @pytest.mark.asyncio
    async def test_model_initialization(self, mock_genai_config):
        """Test correct model initialization with configuration."""
        assert self.model._config == mock_genai_config
        assert self.model._cache == {}
        assert self.model._client is not None
        assert self.model._prompt_manager is not None
        assert self.model._embedding_manager is not None

    @pytest.mark.asyncio
    async def test_translate_detection_success(self, mock_genai_config, sample_detections):
        """Test successful translation between different detection formats."""
        # Mock OpenAI response
        mock_response = AsyncMock()
        mock_response.choices = [Mock(message=Mock(content="Translated detection"))]
        self.model._client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Test translation from Splunk to Sigma
        start_time = time.time()
        result = await self.model.translate_detection(
            detection_text=sample_detections['splunk'],
            source_format='splunk',
            target_format='sigma'
        )

        # Verify translation result structure
        assert isinstance(result, dict)
        assert 'translated_text' in result
        assert 'confidence_score' in result
        assert 'validation_result' in result
        assert 'metadata' in result

        # Verify performance
        translation_time = time.time() - start_time
        assert translation_time < self.performance_thresholds['translation_time']

        # Verify confidence score
        assert 0 <= result['confidence_score'] <= 1
        assert result['confidence_score'] >= self.performance_thresholds['confidence_min']

        # Verify metadata
        assert result['metadata']['model'] == mock_genai_config.model_name
        assert result['metadata']['source_format'] == 'splunk'
        assert result['metadata']['target_format'] == 'sigma'

    @pytest.mark.asyncio
    async def test_translation_validation(self, mock_genai_config):
        """Test translation validation logic and error handling."""
        # Test invalid input
        with pytest.raises(ValueError):
            await self.model.translate_detection("", "splunk", "sigma")

        # Test unsupported format
        with pytest.raises(ValueError):
            await self.model.translate_detection(
                "test detection",
                "unsupported_format",
                "sigma"
            )

        # Test API error handling
        self.model._client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))
        with pytest.raises(RuntimeError):
            await self.model.translate_detection(
                "test detection",
                "splunk",
                "sigma"
            )

    @pytest.mark.asyncio
    async def test_confidence_calculation(self, mock_genai_config):
        """Test confidence score calculation and thresholds."""
        # Mock embedding similarity
        self.model._embedding_manager.compute_similarity = Mock(return_value=0.95)

        confidence = await self.model.calculate_confidence(
            "source detection",
            "translated detection",
            "sigma"
        )

        assert isinstance(confidence, float)
        assert 0 <= confidence <= 1
        assert confidence >= self.performance_thresholds['confidence_min']

    @pytest.mark.asyncio
    async def test_format_specific_validation(self, mock_genai_config):
        """Test format-specific validation rules."""
        # Test Sigma format validation
        sigma_result = await self.model.validate_translation(
            '''title: Test Detection
            logsource:
                product: windows
                service: security
            detection:
                selection:
                    EventID: 4688
                condition: selection''',
            'sigma'
        )
        assert sigma_result['is_valid']
        assert not sigma_result['errors']

        # Test invalid Sigma detection
        invalid_sigma = await self.model.validate_translation(
            "Invalid SIGMA detection",
            'sigma'
        )
        assert not invalid_sigma['is_valid']
        assert len(invalid_sigma['errors']) > 0

    @pytest.mark.asyncio
    async def test_caching_behavior(self, mock_genai_config, sample_detections):
        """Test translation caching functionality."""
        # Mock successful translation
        mock_response = AsyncMock()
        mock_response.choices = [Mock(message=Mock(content="Cached translation"))]
        self.model._client.chat.completions.create = AsyncMock(return_value=mock_response)

        # First translation - should cache
        result1 = await self.model.translate_detection(
            sample_detections['splunk'],
            'splunk',
            'sigma'
        )

        # Second translation - should use cache
        result2 = await self.model.translate_detection(
            sample_detections['splunk'],
            'splunk',
            'sigma'
        )

        assert result1['translated_text'] == result2['translated_text']
        assert result1['confidence_score'] == result2['confidence_score']

    @pytest.mark.asyncio
    async def test_performance_metrics(self, mock_genai_config):
        """Test performance metrics collection."""
        mock_response = AsyncMock()
        mock_response.choices = [Mock(message=Mock(content="Test translation"))]
        self.model._client.chat.completions.create = AsyncMock(return_value=mock_response)

        # Perform translation and measure time
        start_time = time.time()
        await self.model.translate_detection(
            "test detection",
            'splunk',
            'sigma'
        )
        translation_time = time.time() - start_time

        # Verify performance metrics
        assert translation_time < self.performance_thresholds['translation_time']

    @pytest.mark.asyncio
    async def test_error_handling_and_retries(self, mock_genai_config):
        """Test error handling and retry mechanism."""
        # Mock API failure then success
        mock_error_response = AsyncMock(side_effect=[
            Exception("API Error"),
            Mock(choices=[Mock(message=Mock(content="Successful retry"))])
        ])
        self.model._client.chat.completions.create = mock_error_response

        # Should succeed after retry
        result = await self.model.translate_detection(
            "test detection",
            'splunk',
            'sigma'
        )

        assert result['translated_text'] == "Successful retry"

        # Verify continuous failures
        mock_continuous_failure = AsyncMock(side_effect=Exception("Persistent API Error"))
        self.model._client.chat.completions.create = mock_continuous_failure

        with pytest.raises(RuntimeError):
            await self.model.translate_detection(
                "test detection",
                'splunk',
                'sigma'
            )