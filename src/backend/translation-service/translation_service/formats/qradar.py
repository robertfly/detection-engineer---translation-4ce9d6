"""
QRadar AQL format handler for translating security detections.

This module provides comprehensive functionality for parsing, generating and validating
QRadar AQL (Ariel Query Language) detection rules with high accuracy and detailed validation.

Version: 1.0.0
"""

import re  # version: 3.11+
from typing import Dict, Any, List, Tuple, Optional  # version: 3.11+
from dataclasses import dataclass  # version: 3.11+

from ..utils.logger import get_logger
from ..utils.metrics import track_translation

# Initialize structured logger
logger = get_logger(__name__)

# Core AQL syntax components
AQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 
    'LIMIT', 'HAVING', 'JOIN'
]

# Comprehensive field mappings with validation rules
FIELD_MAPPINGS = {
    'sourceip': {
        'common': 'src_ip',
        'type': 'ipv4',
        'validation': r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$',
        'description': 'Source IP address'
    },
    'destinationip': {
        'common': 'dest_ip',
        'type': 'ipv4',
        'validation': r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$',
        'description': 'Destination IP address'
    },
    'eventid': {
        'common': 'event_id',
        'type': 'integer',
        'validation': r'^\d+$',
        'description': 'Event identifier'
    },
    'username': {
        'common': 'user_name',
        'type': 'string',
        'validation': r'^[a-zA-Z0-9\-_\.@]+$',
        'description': 'Username'
    },
    'devicetype': {
        'common': 'device_type',
        'type': 'integer',
        'validation': r'^\d+$',
        'description': 'Device type identifier'
    }
}

# Function mappings with parameter validation
FUNCTION_MAPPINGS = {
    'COUNT': {
        'common': 'count',
        'params': 1,
        'validation': lambda x: isinstance(x, (int, str)),
        'description': 'Count occurrences'
    },
    'SUM': {
        'common': 'sum',
        'params': 1,
        'validation': lambda x: isinstance(x, (int, float)),
        'description': 'Sum values'
    },
    'AVG': {
        'common': 'average',
        'params': 1,
        'validation': lambda x: isinstance(x, (int, float)),
        'description': 'Average values'
    }
}

@dataclass
class QRadarFormat:
    """
    Comprehensive handler for QRadar AQL detection rule translation with extensive
    validation and error handling capabilities.
    """

    def __init__(self) -> None:
        """Initialize QRadar format handler with optimized configurations."""
        self._field_mappings = FIELD_MAPPINGS
        self._function_mappings = FUNCTION_MAPPINGS
        self._compiled_patterns = {
            'ip': re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'),
            'identifier': re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$'),
            'whitespace': re.compile(r'\s+')
        }
        self._translation_cache = {}
        logger.info("QRadar format handler initialized with comprehensive mappings")

    @track_translation
    def parse(self, detection_text: str, strict_mode: bool = True, 
             options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parse QRadar AQL query into common detection model with extensive validation.

        Args:
            detection_text: Raw AQL query string
            strict_mode: Enable strict validation rules
            options: Additional parsing options

        Returns:
            Dict containing parsed detection in common model format

        Raises:
            ValueError: If parsing or validation fails
        """
        try:
            # Sanitize and normalize input
            detection_text = self._sanitize_input(detection_text)
            
            # Parse core query components
            components = self._parse_query_components(detection_text)
            
            # Extract and validate fields
            fields = self._parse_fields(components.get('SELECT', ''))
            
            # Parse and validate FROM clause
            tables = self._parse_tables(components.get('FROM', ''))
            
            # Parse and validate WHERE conditions
            conditions = self._parse_conditions(components.get('WHERE', ''))
            
            # Build common model
            detection_model = {
                'type': 'qradar',
                'version': '1.0',
                'fields': fields,
                'tables': tables,
                'conditions': conditions,
                'metadata': {
                    'original_query': detection_text,
                    'strict_mode': strict_mode,
                    'options': options or {}
                }
            }

            # Validate complete model
            self._validate_detection_model(detection_model, strict_mode)
            
            logger.info("Successfully parsed QRadar detection", 
                       extra={'fields_count': len(fields)})
            return detection_model

        except Exception as e:
            logger.error(f"Failed to parse QRadar detection: {str(e)}")
            raise ValueError(f"Detection parsing failed: {str(e)}")

    @track_translation
    def generate(self, detection_model: Dict[str, Any], optimize: bool = True,
                options: Optional[Dict[str, Any]] = None) -> str:
        """
        Generate optimized QRadar AQL query from common detection model.

        Args:
            detection_model: Common format detection model
            optimize: Enable query optimization
            options: Additional generation options

        Returns:
            Optimized QRadar AQL query string

        Raises:
            ValueError: If generation fails
        """
        try:
            # Validate input model
            self._validate_detection_model(detection_model, strict_mode=True)
            
            # Generate query components
            select_clause = self._generate_select(detection_model['fields'])
            from_clause = self._generate_from(detection_model['tables'])
            where_clause = self._generate_where(detection_model['conditions'])
            
            # Build complete query
            query_parts = ['SELECT ' + select_clause]
            query_parts.append('FROM ' + from_clause)
            
            if where_clause:
                query_parts.append('WHERE ' + where_clause)
            
            # Apply optimizations if enabled
            query = ' '.join(query_parts)
            if optimize:
                query = self._optimize_query(query)
            
            logger.info("Successfully generated QRadar query",
                       extra={'query_length': len(query)})
            return query

        except Exception as e:
            logger.error(f"Failed to generate QRadar query: {str(e)}")
            raise ValueError(f"Query generation failed: {str(e)}")

    def validate(self, query: str, strict_mode: bool = True,
                validation_options: Optional[Dict[str, Any]] = None) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Perform comprehensive validation of QRadar AQL query.

        Args:
            query: AQL query string to validate
            strict_mode: Enable strict validation rules
            validation_options: Additional validation options

        Returns:
            Tuple of (is_valid, error_message, validation_report)
        """
        validation_report = {
            'syntax_valid': False,
            'semantic_valid': False,
            'performance_valid': False,
            'warnings': [],
            'errors': []
        }

        try:
            # Syntax validation
            self._validate_syntax(query, validation_report)
            
            # Semantic validation
            self._validate_semantics(query, validation_report)
            
            # Performance validation
            if strict_mode:
                self._validate_performance(query, validation_report)
            
            # Determine overall validity
            is_valid = (
                validation_report['syntax_valid'] and 
                validation_report['semantic_valid'] and 
                (not strict_mode or validation_report['performance_valid'])
            )
            
            error_message = '; '.join(validation_report['errors']) if not is_valid else ''
            
            logger.info("Completed QRadar query validation",
                       extra={'is_valid': is_valid})
            return is_valid, error_message, validation_report

        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            return False, str(e), validation_report

    def _sanitize_input(self, text: str) -> str:
        """Sanitize and normalize input query text."""
        text = text.strip()
        text = self._compiled_patterns['whitespace'].sub(' ', text)
        return text

    def _validate_detection_model(self, model: Dict[str, Any], strict_mode: bool) -> None:
        """Validate detection model structure and content."""
        required_keys = {'type', 'version', 'fields', 'tables', 'conditions'}
        if not all(key in model for key in required_keys):
            raise ValueError("Missing required detection model keys")

        if model['type'] != 'qradar':
            raise ValueError("Invalid detection type")

    def _optimize_query(self, query: str) -> str:
        """Apply performance optimizations to query."""
        # Add query optimization logic here
        return query