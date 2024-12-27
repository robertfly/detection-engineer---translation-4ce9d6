"""
Comprehensive test suite for the TranslationService class.

This module provides extensive testing of the translation service functionality including:
- Translation accuracy and validation
- Format support and conversion
- Error handling and reporting
- Batch processing capabilities
- Cache management
- Metrics collection

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1
from unittest.mock import Mock, patch, AsyncMock  # version: 3.11+
from typing import Dict, List, Any

from ...translation_service.services.translation import (
    TranslationService,
    TranslationResult,
    BatchTranslationResult,
    SUPPORTED_FORMATS,
    MIN_CONFIDENCE_SCORE
)
from ...translation_service.services.validation import ValidationService

# Test constants
FORMAT_COMBINATIONS = [
    ('splunk', 'sigma'),
    ('sigma', 'qradar'),
    ('qradar', 'kql'),
    ('kql', 'paloalto'),
    ('paloalto', 'crowdstrike'),
    ('crowdstrike', 'yara'),
    ('yara', 'yaral')
]

SAMPLE_DETECTIONS = {
    'splunk': '''search sourcetype=windows EventCode=4688 
        | where CommandLine="*powershell*bypass*" 
        | stats count by Computer, CommandLine''',
    'sigma': '''title: PowerShell Bypass Execution
        description: Detects PowerShell execution with bypass flag
        logsource:
            product: windows
            service: security
        detection:
            selection:
                EventID: 4688
                CommandLine|contains: 'powershell*bypass*'
            condition: selection''',
    'qradar': 'SELECT UTF8(payload) as CommandLine FROM events WHERE "EventID"=4688 AND CommandLine ILIKE "%powershell%bypass%"'
}

class TestTranslationService:
    """Comprehensive test suite for TranslationService functionality."""

    @pytest.fixture
    async def translation_service(self, mock_translation_model, mock_cache, mock_validation_service):
        """Create TranslationService instance with mocked dependencies."""
        service = TranslationService(
            translation_model=mock_translation_model,
            cache_client=mock_cache,
            validation_service=mock_validation_service
        )
        return service

    @pytest.fixture
    def mock_translation_model(self):
        """Mock for GenAI translation model."""
        model = AsyncMock()
        model.translate_detection.return_value = {
            'translated_text': 'Translated detection',
            'confidence_score': 0.95,
            'metadata': {'model': 'gpt-4'}
        }
        return model

    @pytest.fixture
    def mock_cache(self):
        """Mock for Redis cache client."""
        cache = AsyncMock()
        cache.get.return_value = None
        cache.setex.return_value = True
        return cache

    @pytest.fixture
    def mock_validation_service(self):
        """Mock for validation service."""
        validator = AsyncMock()
        validator.validate_detection.return_value = {
            'is_valid': True,
            'validation_result': {'errors': [], 'warnings': []},
            'confidence_score': 0.95
        }
        return validator

    @pytest.mark.asyncio
    async def test_translation_service_initialization(self, translation_service):
        """Test proper initialization of TranslationService."""
        assert translation_service._translation_model is not None
        assert translation_service._cache_client is not None
        assert translation_service._validation_service is not None

    @pytest.mark.asyncio
    @pytest.mark.parametrize('source_format,target_format', FORMAT_COMBINATIONS)
    async def test_format_specific_translations(
        self,
        translation_service,
        source_format: str,
        target_format: str
    ):
        """Test translations between all supported format combinations."""
        # Prepare test data
        detection_text = SAMPLE_DETECTIONS.get(
            source_format,
            'Sample detection for testing'
        )

        # Execute translation
        result = await translation_service.translate(
            detection_text=detection_text,
            source_format=source_format,
            target_format=target_format
        )

        # Verify result structure
        assert isinstance(result, TranslationResult)
        assert result.translated_text is not None
        assert result.confidence_score >= MIN_CONFIDENCE_SCORE
        assert result.source_format == source_format
        assert result.target_format == target_format
        assert result.validation_result is not None

    @pytest.mark.asyncio
    async def test_translation_with_cache(self, translation_service, mock_cache):
        """Test translation caching functionality."""
        # Setup cache hit scenario
        cached_result = TranslationResult(
            translated_text='Cached translation',
            confidence_score=0.98,
            source_format='splunk',
            target_format='sigma',
            validation_result={'is_valid': True},
            metadata={'cached': True}
        )
        mock_cache.get.return_value = cached_result.json()

        # Execute translation
        result = await translation_service.translate(
            detection_text='Test detection',
            source_format='splunk',
            target_format='sigma'
        )

        # Verify cache usage
        assert result.translated_text == 'Cached translation'
        assert result.metadata.get('cached') is True
        mock_cache.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_batch_translation(self, translation_service):
        """Test batch translation functionality."""
        # Prepare batch test data
        batch_detections = [
            {
                'detection_text': SAMPLE_DETECTIONS['splunk'],
                'source_format': 'splunk',
                'target_format': 'sigma'
            },
            {
                'detection_text': SAMPLE_DETECTIONS['sigma'],
                'source_format': 'sigma',
                'target_format': 'qradar'
            }
        ]

        # Execute batch translation
        result = await translation_service.batch_translate(
            detection_batch=batch_detections
        )

        # Verify batch results
        assert isinstance(result, BatchTranslationResult)
        assert result.success_count > 0
        assert len(result.results) == len(batch_detections)
        assert result.total_time > 0
        assert result.metadata.get('batch_size') == len(batch_detections)

    @pytest.mark.asyncio
    async def test_translation_error_handling(self, translation_service, mock_translation_model):
        """Test error handling in translation process."""
        # Setup error scenario
        mock_translation_model.translate_detection.side_effect = RuntimeError("Translation failed")

        # Verify error handling
        with pytest.raises(RuntimeError) as exc_info:
            await translation_service.translate(
                detection_text='Test detection',
                source_format='splunk',
                target_format='sigma'
            )
        assert "Translation failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validation_integration(self, translation_service, mock_validation_service):
        """Test integration with validation service."""
        # Setup validation scenario
        mock_validation_service.validate_detection.return_value = {
            'is_valid': False,
            'validation_result': {
                'errors': ['Invalid syntax'],
                'warnings': ['Performance concern']
            },
            'confidence_score': 0.75
        }

        # Execute translation
        result = await translation_service.translate(
            detection_text='Test detection',
            source_format='splunk',
            target_format='sigma'
        )

        # Verify validation results
        assert not result.validation_result['is_valid']
        assert len(result.validation_result['validation_result']['errors']) > 0
        assert result.confidence_score < MIN_CONFIDENCE_SCORE

    @pytest.mark.asyncio
    async def test_metrics_collection(self, translation_service):
        """Test metrics collection during translation."""
        with patch('prometheus_client.Counter.labels') as mock_counter:
            await translation_service.translate(
                detection_text='Test detection',
                source_format='splunk',
                target_format='sigma'
            )
            
            # Verify metrics collection
            mock_counter.assert_called()
            assert mock_counter.call_count >= 2  # Start and success metrics

    @pytest.mark.asyncio
    async def test_invalid_format_handling(self, translation_service):
        """Test handling of invalid format specifications."""
        with pytest.raises(ValueError) as exc_info:
            await translation_service.translate(
                detection_text='Test detection',
                source_format='invalid',
                target_format='sigma'
            )
        assert "Unsupported format" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_empty_detection_handling(self, translation_service):
        """Test handling of empty detection input."""
        with pytest.raises(ValueError) as exc_info:
            await translation_service.translate(
                detection_text='',
                source_format='splunk',
                target_format='sigma'
            )
        assert "Empty detection text" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_batch_partial_failure(self, translation_service, mock_translation_model):
        """Test batch translation with partial failures."""
        # Setup mixed success/failure scenario
        mock_translation_model.translate_detection.side_effect = [
            {
                'translated_text': 'Success 1',
                'confidence_score': 0.95,
                'metadata': {'model': 'gpt-4'}
            },
            RuntimeError("Translation failed"),
            {
                'translated_text': 'Success 2',
                'confidence_score': 0.96,
                'metadata': {'model': 'gpt-4'}
            }
        ]

        batch_detections = [
            {'detection_text': 'Test 1', 'source_format': 'splunk', 'target_format': 'sigma'},
            {'detection_text': 'Test 2', 'source_format': 'sigma', 'target_format': 'qradar'},
            {'detection_text': 'Test 3', 'source_format': 'qradar', 'target_format': 'kql'}
        ]

        result = await translation_service.batch_translate(batch_detections)

        assert result.success_count == 2
        assert result.failure_count == 1
        assert len(result.results) == 2  # Only successful translations