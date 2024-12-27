"""
Validation Service Module

Provides comprehensive detection rule validation across multiple security platforms
with detailed validation reporting, confidence scoring, and error feedback.

Version: 1.0.0
"""

import re
from typing import Dict, List, Optional, Any, Counter
from dataclasses import dataclass, field
from pydantic import BaseModel  # version: 2.4.2
from prometheus_client import Counter, Histogram  # version: 0.17.1

from ..config.logging import setup_logging
from ..utils.metrics import track_validation

# Initialize logger
logger = setup_logging(__name__)

# Validation thresholds for different dimensions
VALIDATION_THRESHOLDS = {
    'syntax_score': 0.95,
    'field_mapping_score': 0.90,
    'logic_preservation_score': 0.95,
    'pattern_matching_score': 0.92,
    'temporal_logic_score': 0.93,
    'aggregation_accuracy_score': 0.94
}

# Error categories for detailed reporting
ERROR_CATEGORIES = {
    'SYNTAX': 'Syntax and format errors',
    'FIELD_MAPPING': 'Field name and type mismatches',
    'LOGIC': 'Detection logic preservation issues',
    'PATTERN': 'Pattern matching inconsistencies',
    'TEMPORAL': 'Time window and sequence issues',
    'AGGREGATION': 'Data aggregation and grouping issues'
}

class ValidationResult(BaseModel):
    """Enhanced validation result model with comprehensive scoring and feedback."""
    
    is_valid: bool
    confidence_score: float
    errors: Dict[str, List[str]] = field(default_factory=dict)
    warnings: Dict[str, List[str]] = field(default_factory=dict)
    dimension_scores: Dict[str, float] = field(default_factory=dict)
    validation_details: Dict[str, Any] = field(default_factory=dict)
    checks_passed: Dict[str, bool] = field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True

class ValidationService:
    """Advanced service for multi-dimensional detection validation across security platforms."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize validation service with comprehensive configuration."""
        self._format_handlers = {
            'splunk': self._validate_splunk,
            'sigma': self._validate_sigma,
            'qradar': self._validate_qradar,
            'kql': self._validate_kql,
            'yara': self._validate_yara,
            'yara-l': self._validate_yara_l
        }
        
        self._thresholds = VALIDATION_THRESHOLDS
        if config and 'thresholds' in config:
            self._thresholds.update(config['thresholds'])

        # Initialize metrics
        self._error_counters = {
            category: Counter(
                f'validation_errors_total_{category.lower()}',
                f'Total {description}',
                ['format']
            ) for category, description in ERROR_CATEGORIES.items()
        }

        self._score_metrics = {
            dimension: Histogram(
                f'validation_score_{dimension}',
                f'Validation score for {dimension}',
                ['format'],
                buckets=[0.5, 0.75, 0.85, 0.9, 0.95, 0.98, 0.99, 1.0]
            ) for dimension in self._thresholds.keys()
        }

    @track_validation
    def validate_detection(
        self,
        detection_text: str,
        format_type: str,
        options: Optional[Dict[str, Any]] = None
    ) -> ValidationResult:
        """
        Performs comprehensive validation of a translated detection.
        
        Args:
            detection_text: The detection rule text to validate
            format_type: Target format type (e.g., 'splunk', 'sigma')
            options: Optional validation configuration
            
        Returns:
            ValidationResult with detailed validation information
        """
        try:
            # Initialize validation result
            result = ValidationResult(
                is_valid=False,
                confidence_score=0.0,
                errors={category: [] for category in ERROR_CATEGORIES.keys()},
                warnings={category: [] for category in ERROR_CATEGORIES.keys()},
                dimension_scores={},
                validation_details={},
                checks_passed={}
            )

            # Validate basic format requirements
            if not detection_text or not detection_text.strip():
                result.errors['SYNTAX'].append("Empty detection rule")
                return result

            if format_type not in self._format_handlers:
                result.errors['SYNTAX'].append(f"Unsupported format: {format_type}")
                return result

            # Perform format-specific validation
            format_handler = self._format_handlers[format_type]
            format_handler(detection_text, result, options)

            # Calculate dimension scores
            self._calculate_dimension_scores(result)

            # Calculate overall confidence score
            result.confidence_score = self._calculate_confidence_score(result.dimension_scores)

            # Determine overall validity
            result.is_valid = (
                result.confidence_score >= 0.95 and
                not any(result.errors.values()) and
                all(score >= threshold 
                    for score, threshold in zip(
                        result.dimension_scores.values(),
                        self._thresholds.values()
                    ))
            )

            # Track metrics
            self._track_validation_metrics(format_type, result)

            return result

        except Exception as e:
            logger.error(f"Validation error: {str(e)}", extra={
                'format': format_type,
                'error_type': type(e).__name__
            })
            raise

    def validate_batch(
        self,
        detections: List[Dict[str, Any]],
        batch_options: Optional[Dict[str, Any]] = None
    ) -> List[ValidationResult]:
        """
        Validates a batch of detections with optimized processing.
        
        Args:
            detections: List of detection rules to validate
            batch_options: Optional batch validation configuration
            
        Returns:
            List of ValidationResult objects
        """
        results = []
        for detection in detections:
            try:
                result = self.validate_detection(
                    detection['content'],
                    detection['format'],
                    batch_options
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Batch validation error: {str(e)}", extra={
                    'detection_id': detection.get('id'),
                    'format': detection.get('format')
                })
                # Create error result
                results.append(ValidationResult(
                    is_valid=False,
                    confidence_score=0.0,
                    errors={'SYNTAX': [f"Validation failed: {str(e)}"]}
                ))

        return results

    def _calculate_dimension_scores(self, result: ValidationResult) -> None:
        """Calculate detailed scores for each validation dimension."""
        for dimension, threshold in self._thresholds.items():
            # Calculate dimension score based on relevant checks
            checks = result.validation_details.get(dimension, {})
            if checks:
                passed = sum(1 for check in checks.values() if check)
                total = len(checks)
                score = passed / total if total > 0 else 0.0
            else:
                score = 0.0
            
            result.dimension_scores[dimension] = score

    def _calculate_confidence_score(self, dimension_scores: Dict[str, float]) -> float:
        """Calculate overall confidence score with weighted dimensions."""
        if not dimension_scores:
            return 0.0

        weights = {
            'syntax_score': 0.25,
            'field_mapping_score': 0.20,
            'logic_preservation_score': 0.25,
            'pattern_matching_score': 0.15,
            'temporal_logic_score': 0.10,
            'aggregation_accuracy_score': 0.05
        }

        weighted_sum = sum(
            score * weights.get(dimension, 1.0)
            for dimension, score in dimension_scores.items()
        )
        total_weight = sum(
            weights.get(dimension, 1.0)
            for dimension in dimension_scores.keys()
        )

        return weighted_sum / total_weight if total_weight > 0 else 0.0

    def _track_validation_metrics(self, format_type: str, result: ValidationResult) -> None:
        """Track comprehensive validation metrics."""
        # Track dimension scores
        for dimension, score in result.dimension_scores.items():
            self._score_metrics[dimension].labels(format=format_type).observe(score)

        # Track errors
        for category, errors in result.errors.items():
            if errors:
                self._error_counters[category].labels(format=format_type).inc(len(errors))

    # Format-specific validation handlers
    def _validate_splunk(self, detection: str, result: ValidationResult, options: Optional[Dict[str, Any]]) -> None:
        """Validate Splunk SPL detection rules."""
        # Implementation details for Splunk validation
        pass

    def _validate_sigma(self, detection: str, result: ValidationResult, options: Optional[Dict[str, Any]]) -> None:
        """Validate SIGMA detection rules."""
        # Implementation details for SIGMA validation
        pass

    def _validate_qradar(self, detection: str, result: ValidationResult, options: Optional[Dict[str, Any]]) -> None:
        """Validate QRadar AQL detection rules."""
        # Implementation details for QRadar validation
        pass

    def _validate_kql(self, detection: str, result: ValidationResult, options: Optional[Dict[str, Any]]) -> None:
        """Validate KQL detection rules."""
        # Implementation details for KQL validation
        pass

    def _validate_yara(self, detection: str, result: ValidationResult, options: Optional[Dict[str, Any]]) -> None:
        """Validate YARA detection rules."""
        # Implementation details for YARA validation
        pass

    def _validate_yara_l(self, detection: str, result: ValidationResult, options: Optional[Dict[str, Any]]) -> None:
        """Validate YARA-L detection rules."""
        # Implementation details for YARA-L validation
        pass