"""
Core Translation Service Module

This module provides enterprise-grade translation capabilities for security detections
between different formats using GenAI models with comprehensive validation, caching,
and monitoring.

Version: 1.0.0
"""

import asyncio  # version: 3.11+
from typing import Dict, List, Optional, Any
from pydantic import BaseModel  # version: 2.4.2
from prometheus_client import Counter, Histogram  # version: 0.17.1
import redis  # version: 5.0.1
import time
from functools import wraps

from ..genai.model import TranslationModel
from ..services.validation import ValidationService
from ..utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Global constants
SUPPORTED_FORMATS = ['splunk', 'qradar', 'sigma', 'kql', 'paloalto', 'crowdstrike', 'yara', 'yaral']
MIN_CONFIDENCE_SCORE = 0.85
MAX_RETRIES = 3
CACHE_TTL = 3600  # 1 hour
BATCH_SIZE = 50
METRICS_PREFIX = 'translation_service'

# Initialize metrics
TRANSLATION_REQUESTS = Counter(
    f'{METRICS_PREFIX}_requests_total',
    'Total number of translation requests',
    ['source_format', 'target_format', 'status']
)

TRANSLATION_LATENCY = Histogram(
    f'{METRICS_PREFIX}_latency_seconds',
    'Translation request duration in seconds',
    ['source_format', 'target_format']
)

class TranslationResult(BaseModel):
    """Model for translation results with comprehensive metadata."""
    translated_text: str
    confidence_score: float
    source_format: str
    target_format: str
    validation_result: Dict[str, Any]
    metadata: Dict[str, Any]

class BatchTranslationResult(BaseModel):
    """Model for batch translation results."""
    results: List[TranslationResult]
    success_count: int
    failure_count: int
    total_time: float
    metadata: Dict[str, Any]

def metrics_collector(func):
    """Decorator for collecting comprehensive metrics on translation operations."""
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        start_time = time.time()
        source_format = kwargs.get('source_format', 'unknown')
        target_format = kwargs.get('target_format', 'unknown')
        
        try:
            TRANSLATION_REQUESTS.labels(
                source_format=source_format,
                target_format=target_format,
                status='started'
            ).inc()
            
            result = await func(self, *args, **kwargs)
            
            TRANSLATION_REQUESTS.labels(
                source_format=source_format,
                target_format=target_format,
                status='success'
            ).inc()
            
            duration = time.time() - start_time
            TRANSLATION_LATENCY.labels(
                source_format=source_format,
                target_format=target_format
            ).observe(duration)
            
            return result
            
        except Exception as e:
            TRANSLATION_REQUESTS.labels(
                source_format=source_format,
                target_format=target_format,
                status='error'
            ).inc()
            
            logger.error(
                "Translation failed",
                extra={
                    'error': str(e),
                    'source_format': source_format,
                    'target_format': target_format,
                    'duration': time.time() - start_time
                }
            )
            raise
    return wrapper

class TranslationService:
    """
    Enterprise-grade service for translating security detections between formats
    with comprehensive validation, caching, and monitoring capabilities.
    """

    def __init__(
        self,
        translation_model: TranslationModel,
        cache_client: redis.Redis,
        validation_service: ValidationService
    ):
        """
        Initialize the translation service with required components.

        Args:
            translation_model: GenAI translation model instance
            cache_client: Redis cache client
            validation_service: Validation service instance
        """
        self._translation_model = translation_model
        self._cache_client = cache_client
        self._validation_service = validation_service
        
        logger.info(
            "Initialized TranslationService",
            extra={'supported_formats': SUPPORTED_FORMATS}
        )

    @metrics_collector
    async def translate(
        self,
        detection_text: str,
        source_format: str,
        target_format: str,
        options: Optional[Dict[str, Any]] = None
    ) -> TranslationResult:
        """
        Translate a single detection with comprehensive validation and caching.

        Args:
            detection_text: Source detection text
            source_format: Source detection format
            target_format: Target detection format
            options: Optional translation parameters

        Returns:
            TranslationResult containing translation and metadata

        Raises:
            ValueError: For invalid inputs
            RuntimeError: For translation failures
        """
        if not detection_text:
            raise ValueError("Empty detection text provided")
            
        if source_format not in SUPPORTED_FORMATS or target_format not in SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format(s): {source_format} -> {target_format}")

        # Generate cache key
        cache_key = f"translation:{source_format}:{target_format}:{hash(detection_text)}"

        try:
            # Check cache first
            cached_result = await self._get_cached_translation(cache_key)
            if cached_result:
                logger.info("Cache hit for translation")
                return cached_result

            # Perform translation
            translation_result = await self._translation_model.translate_detection(
                detection_text=detection_text,
                source_format=source_format,
                target_format=target_format,
                options=options
            )

            # Validate translation
            validation_result = await self._validation_service.validate_detection(
                detection_text=translation_result['translated_text'],
                format_type=target_format,
                options=options
            )

            # Create comprehensive result
            result = TranslationResult(
                translated_text=translation_result['translated_text'],
                confidence_score=translation_result['confidence_score'],
                source_format=source_format,
                target_format=target_format,
                validation_result=validation_result.dict(),
                metadata={
                    'timestamp': time.time(),
                    'model_version': translation_result['metadata']['model'],
                    'validation_passed': validation_result.is_valid
                }
            )

            # Cache successful translation
            if validation_result.is_valid and result.confidence_score >= MIN_CONFIDENCE_SCORE:
                await self._cache_translation(cache_key, result)

            return result

        except Exception as e:
            logger.error(
                "Translation failed",
                extra={
                    'error': str(e),
                    'source_format': source_format,
                    'target_format': target_format
                }
            )
            raise RuntimeError(f"Translation failed: {str(e)}")

    async def batch_translate(
        self,
        detection_batch: List[Dict[str, str]],
        batch_options: Optional[Dict[str, Any]] = None
    ) -> BatchTranslationResult:
        """
        Perform batch translation with optimized parallel processing.

        Args:
            detection_batch: List of detections to translate
            batch_options: Optional batch processing parameters

        Returns:
            BatchTranslationResult with comprehensive results and metadata
        """
        start_time = time.time()
        results = []
        success_count = 0
        failure_count = 0

        try:
            # Process in optimal batch sizes
            for i in range(0, len(detection_batch), BATCH_SIZE):
                batch_slice = detection_batch[i:i + BATCH_SIZE]
                
                # Create translation tasks
                tasks = [
                    self.translate(
                        detection_text=item['detection_text'],
                        source_format=item['source_format'],
                        target_format=item['target_format'],
                        options=batch_options
                    )
                    for item in batch_slice
                ]
                
                # Execute batch in parallel
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for result in batch_results:
                    if isinstance(result, Exception):
                        failure_count += 1
                        logger.error(f"Batch translation error: {str(result)}")
                    else:
                        success_count += 1
                        results.append(result)

            return BatchTranslationResult(
                results=results,
                success_count=success_count,
                failure_count=failure_count,
                total_time=time.time() - start_time,
                metadata={
                    'batch_size': len(detection_batch),
                    'timestamp': time.time()
                }
            )

        except Exception as e:
            logger.error(f"Batch translation failed: {str(e)}")
            raise RuntimeError(f"Batch translation failed: {str(e)}")

    async def _get_cached_translation(self, cache_key: str) -> Optional[TranslationResult]:
        """Retrieve cached translation result."""
        try:
            cached_data = await self._cache_client.get(cache_key)
            if cached_data:
                return TranslationResult.parse_raw(cached_data)
            return None
        except Exception as e:
            logger.error(f"Cache retrieval error: {str(e)}")
            return None

    async def _cache_translation(self, cache_key: str, result: TranslationResult) -> None:
        """Cache successful translation result."""
        try:
            await self._cache_client.setex(
                cache_key,
                CACHE_TTL,
                result.json()
            )
        except Exception as e:
            logger.error(f"Cache storage error: {str(e)}")