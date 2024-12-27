"""
FastAPI routes module for the Translation Service.

This module implements the REST API endpoints for the translation service with comprehensive
detection translation capabilities, validation, monitoring, and error handling.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request  # version: 0.104.0
from pydantic import BaseModel, Field, validator  # version: 2.4.2
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17.1
from typing import Dict, List, Optional, Any
import time
import uuid

from ..services.translation import TranslationService
from ..services.validation import ValidationService
from ..config.metrics import get_metrics_config
from ..utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1", tags=["translation"])

# Initialize services
translation_service = TranslationService()
validation_service = ValidationService()

# Initialize metrics
TRANSLATION_COUNTER = Counter(
    'translation_requests_total',
    'Total number of translation requests',
    ['source_format', 'target_format', 'status']
)

TRANSLATION_DURATION = Histogram(
    'translation_duration_seconds',
    'Translation request duration in seconds',
    ['source_format', 'target_format']
)

BATCH_SIZE_GAUGE = Gauge(
    'batch_size_current',
    'Current batch processing size'
)

class TranslationRequest(BaseModel):
    """Enhanced model for single translation request payload."""
    detection_text: str = Field(..., description="Source detection text to translate")
    source_format: str = Field(..., description="Source detection format")
    target_format: str = Field(..., description="Target detection format")
    correlation_id: Optional[str] = Field(None, description="Optional correlation ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata")

    @validator('source_format', 'target_format')
    def validate_formats(cls, value: str) -> str:
        """Validate detection formats."""
        valid_formats = ['splunk', 'qradar', 'sigma', 'kql', 'paloalto', 'crowdstrike', 'yara', 'yaral']
        if value.lower() not in valid_formats:
            raise ValueError(f"Unsupported format: {value}. Valid formats: {', '.join(valid_formats)}")
        return value.lower()

class BatchTranslationRequest(BaseModel):
    """Enhanced model for batch translation request payload."""
    detections: List[TranslationRequest] = Field(..., description="List of detections to translate")
    batch_id: Optional[str] = Field(None, description="Optional batch identifier")
    batch_metadata: Optional[Dict[str, Any]] = Field(None, description="Optional batch metadata")

    @validator('detections')
    def validate_batch_size(cls, detections: List[TranslationRequest]) -> List[TranslationRequest]:
        """Validate batch size constraints."""
        if not detections:
            raise ValueError("Empty batch request")
        if len(detections) > 100:  # Maximum batch size
            raise ValueError("Batch size exceeds maximum limit of 100")
        return detections

@router.post("/translate")
async def translate_detection(
    request: TranslationRequest,
    fastapi_request: Request,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Translate a single detection between formats with comprehensive validation.

    Args:
        request: Translation request payload
        fastapi_request: FastAPI request object
        background_tasks: Background tasks handler

    Returns:
        Dict containing translation result and metadata

    Raises:
        HTTPException: For validation or translation errors
    """
    start_time = time.time()
    correlation_id = request.correlation_id or str(uuid.uuid4())

    try:
        logger.info(
            "Processing translation request",
            extra={
                "correlation_id": correlation_id,
                "source_format": request.source_format,
                "target_format": request.target_format
            }
        )

        # Increment request counter
        TRANSLATION_COUNTER.labels(
            source_format=request.source_format,
            target_format=request.target_format,
            status="started"
        ).inc()

        # Perform translation
        translation_result = await translation_service.translate(
            detection_text=request.detection_text,
            source_format=request.source_format,
            target_format=request.target_format,
            options=request.metadata
        )

        # Validate translation
        validation_result = await validation_service.validate_detection(
            detection_text=translation_result.translated_text,
            format_type=request.target_format
        )

        # Record duration
        duration = time.time() - start_time
        TRANSLATION_DURATION.labels(
            source_format=request.source_format,
            target_format=request.target_format
        ).observe(duration)

        # Prepare response
        response = {
            "correlation_id": correlation_id,
            "translated_text": translation_result.translated_text,
            "confidence_score": translation_result.confidence_score,
            "validation_result": validation_result.dict(),
            "metadata": {
                "duration_seconds": duration,
                "source_format": request.source_format,
                "target_format": request.target_format,
                "timestamp": int(time.time())
            }
        }

        # Update success metrics
        TRANSLATION_COUNTER.labels(
            source_format=request.source_format,
            target_format=request.target_format,
            status="success"
        ).inc()

        return response

    except Exception as e:
        # Update error metrics
        TRANSLATION_COUNTER.labels(
            source_format=request.source_format,
            target_format=request.target_format,
            status="error"
        ).inc()

        logger.error(
            "Translation failed",
            extra={
                "correlation_id": correlation_id,
                "error": str(e),
                "source_format": request.source_format,
                "target_format": request.target_format
            }
        )

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Translation failed",
                "message": str(e),
                "correlation_id": correlation_id
            }
        )

@router.post("/batch")
async def batch_translate(
    request: BatchTranslationRequest,
    fastapi_request: Request,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Process batch translation request with progress tracking.

    Args:
        request: Batch translation request payload
        fastapi_request: FastAPI request object
        background_tasks: Background tasks handler

    Returns:
        Dict containing batch translation status and results

    Raises:
        HTTPException: For validation or processing errors
    """
    batch_id = request.batch_id or str(uuid.uuid4())
    start_time = time.time()

    try:
        logger.info(
            "Processing batch translation request",
            extra={
                "batch_id": batch_id,
                "batch_size": len(request.detections)
            }
        )

        # Update batch size metric
        BATCH_SIZE_GAUGE.set(len(request.detections))

        # Process batch translations
        batch_result = await translation_service.batch_translate(
            detection_batch=[
                {
                    "detection_text": det.detection_text,
                    "source_format": det.source_format,
                    "target_format": det.target_format
                }
                for det in request.detections
            ],
            batch_options=request.batch_metadata
        )

        # Prepare response
        response = {
            "batch_id": batch_id,
            "total_count": len(request.detections),
            "success_count": batch_result.success_count,
            "failure_count": batch_result.failure_count,
            "results": [result.dict() for result in batch_result.results],
            "metadata": {
                "duration_seconds": time.time() - start_time,
                "timestamp": int(time.time()),
                **request.batch_metadata if request.batch_metadata else {}
            }
        }

        return response

    except Exception as e:
        logger.error(
            "Batch translation failed",
            extra={
                "batch_id": batch_id,
                "error": str(e),
                "batch_size": len(request.detections)
            }
        )

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Batch translation failed",
                "message": str(e),
                "batch_id": batch_id
            }
        )

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Enhanced health check endpoint with dependency status.

    Returns:
        Dict containing detailed service health status
    """
    try:
        # Check translation service
        translation_health = await translation_service.health_check()
        
        # Check validation service
        validation_health = await validation_service.health_check()

        return {
            "status": "healthy",
            "timestamp": int(time.time()),
            "components": {
                "translation_service": translation_health,
                "validation_service": validation_health
            },
            "metrics": {
                "enabled": get_metrics_config().enabled
            }
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": int(time.time())
            }
        )

@router.get("/metrics")
async def metrics() -> Dict[str, Any]:
    """
    Enhanced Prometheus metrics endpoint.

    Returns:
        Dict containing detailed service metrics
    """
    try:
        metrics_config = get_metrics_config()
        if not metrics_config.enabled:
            raise HTTPException(
                status_code=404,
                detail="Metrics collection is disabled"
            )

        return {
            "translation_requests": TRANSLATION_COUNTER._value.get(),
            "translation_duration": TRANSLATION_DURATION._sum.get(),
            "current_batch_size": BATCH_SIZE_GAUGE._value.get(),
            "timestamp": int(time.time())
        }

    except Exception as e:
        logger.error(f"Metrics collection failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Metrics collection failed",
                "message": str(e)
            }
        )