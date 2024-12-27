"""
SIGMA Format Handler Module

Implements comprehensive SIGMA format translation capabilities with validation,
field mapping, and platform-specific optimizations for high-accuracy detection
rule conversion.

Version: 1.0.0
"""

import yaml  # version: 6.0.1
from typing import Dict, Any, Optional, Tuple, List
from sigma import SigmaRule  # version: 0.9.0
from cachetools import TTLCache  # version: 5.3.0

from ...utils.logger import get_logger
from ...utils.metrics import track_translation
from ...genai.model import TranslationModel

# Initialize logger
logger = get_logger(__name__)

# Constants for SIGMA format handling
SIGMA_FIELDS: Dict[str, str] = {
    'title': 'str',
    'description': 'str',
    'status': 'str',
    'level': 'str',
    'logsource': 'dict',
    'detection': 'dict',
    'falsepositives': 'list',
    'tags': 'list'
}

# Platform-specific field mappings
PLATFORM_MAPPINGS: Dict[str, Dict[str, str]] = {
    'splunk': {
        'EventCode': 'EventCode',
        'CommandLine': 'process_command_line',
        'Image': 'process_path',
        'ParentImage': 'parent_process_path'
    },
    'qradar': {
        'EventCode': 'EventID',
        'CommandLine': 'ProcessCommandLine',
        'Image': 'ProcessPath',
        'ParentImage': 'ParentProcessPath'
    },
    'elastic': {
        'EventCode': 'event.code',
        'CommandLine': 'process.command_line',
        'Image': 'process.executable',
        'ParentImage': 'process.parent.executable'
    }
}

# Cache configuration
CACHE_CONFIG: Dict[str, Any] = {
    'max_size': 1000,
    'ttl': 3600  # 1 hour cache TTL
}

@track_translation
def validate_sigma_rule(rule: Dict, platform: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates a SIGMA rule structure and content with comprehensive checks.

    Args:
        rule: SIGMA rule dictionary
        platform: Target platform for validation

    Returns:
        Tuple containing validation status, error message, and validation details
    """
    validation_result = {
        'is_valid': True,
        'errors': [],
        'warnings': [],
        'platform_compatibility': {}
    }

    try:
        # Validate required fields
        for field, field_type in SIGMA_FIELDS.items():
            if field not in rule:
                validation_result['errors'].append(f"Missing required field: {field}")
                validation_result['is_valid'] = False
            elif not isinstance(rule[field], eval(field_type)):
                validation_result['errors'].append(
                    f"Invalid type for {field}: expected {field_type}"
                )
                validation_result['is_valid'] = False

        # Validate logsource configuration
        if 'logsource' in rule:
            logsource = rule['logsource']
            if not any(k in logsource for k in ['product', 'service', 'category']):
                validation_result['errors'].append(
                    "Logsource must contain at least one of: product, service, category"
                )
                validation_result['is_valid'] = False

        # Validate detection section
        if 'detection' in rule:
            detection = rule['detection']
            if 'condition' not in detection:
                validation_result['errors'].append("Missing detection condition")
                validation_result['is_valid'] = False
            
            # Validate search identifiers
            condition = detection['condition']
            search_identifiers = [k for k in detection.keys() if k != 'condition']
            for identifier in search_identifiers:
                if not isinstance(detection[identifier], (dict, list)):
                    validation_result['errors'].append(
                        f"Invalid search identifier type: {identifier}"
                    )
                    validation_result['is_valid'] = False

        # Platform-specific validation
        if platform in PLATFORM_MAPPINGS:
            platform_fields = PLATFORM_MAPPINGS[platform]
            for field in rule.get('detection', {}).keys():
                if field in platform_fields:
                    validation_result['platform_compatibility'][field] = 'mapped'
                else:
                    validation_result['warnings'].append(
                        f"Field {field} may need manual mapping for {platform}"
                    )

        return (
            validation_result['is_valid'],
            '; '.join(validation_result['errors']),
            validation_result
        )

    except Exception as e:
        logger.error(f"SIGMA rule validation failed: {str(e)}")
        return False, f"Validation error: {str(e)}", validation_result

@track_translation
def parse_sigma_rule(rule_text: str, platform: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses and normalizes a SIGMA rule from YAML format with enhanced error handling.

    Args:
        rule_text: SIGMA rule in YAML format
        platform: Optional target platform for normalization

    Returns:
        Parsed and normalized SIGMA rule dictionary
    """
    try:
        # Parse YAML content
        rule_dict = yaml.safe_load(rule_text)
        
        # Validate basic structure
        if not isinstance(rule_dict, dict):
            raise ValueError("Invalid SIGMA rule structure")

        # Normalize field names
        normalized_rule = {}
        for field, value in rule_dict.items():
            normalized_field = field.lower()
            if normalized_field in SIGMA_FIELDS:
                normalized_rule[normalized_field] = value

        # Apply platform-specific field mappings
        if platform and platform in PLATFORM_MAPPINGS:
            mappings = PLATFORM_MAPPINGS[platform]
            if 'detection' in normalized_rule:
                detection = normalized_rule['detection']
                for search_id, search_def in detection.items():
                    if isinstance(search_def, dict):
                        mapped_def = {}
                        for field, value in search_def.items():
                            mapped_field = mappings.get(field, field)
                            mapped_def[mapped_field] = value
                        detection[search_id] = mapped_def

        return normalized_rule

    except yaml.YAMLError as e:
        logger.error(f"YAML parsing error: {str(e)}")
        raise ValueError(f"Invalid YAML format: {str(e)}")
    except Exception as e:
        logger.error(f"SIGMA rule parsing failed: {str(e)}")
        raise RuntimeError(f"Rule parsing failed: {str(e)}")

class SigmaFormat:
    """
    Advanced handler for translating security detections to and from SIGMA format
    with optimization and validation capabilities.
    """

    def __init__(self, translation_model: TranslationModel):
        """
        Initialize the SIGMA format handler with translation capabilities.

        Args:
            translation_model: GenAI translation model instance
        """
        self._translation_model = translation_model
        self._field_mappings = PLATFORM_MAPPINGS
        self._cache = TTLCache(**CACHE_CONFIG)
        
        logger.info("Initialized SIGMA format handler")

    @track_translation
    async def to_sigma(
        self,
        detection_id: str,
        source_text: str,
        source_format: str,
        platform: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Converts a detection from another format to SIGMA with optimization.

        Args:
            detection_id: Unique identifier for the detection
            source_text: Source detection text
            source_format: Source detection format
            platform: Optional target platform

        Returns:
            Translated and optimized SIGMA rule with metadata
        """
        try:
            # Check cache
            cache_key = f"to_sigma:{detection_id}:{source_format}"
            if cache_key in self._cache:
                logger.debug(f"Cache hit for detection {detection_id}")
                return self._cache[cache_key]

            # Translate using GenAI model
            translation_result = await self._translation_model.translate_detection(
                detection_text=source_text,
                source_format=source_format,
                target_format='sigma',
                options={'platform': platform}
            )

            # Parse and validate SIGMA structure
            sigma_rule = parse_sigma_rule(
                translation_result['translated_text'],
                platform
            )

            # Validate translation
            is_valid, error_msg, validation_details = validate_sigma_rule(
                sigma_rule,
                platform or 'generic'
            )

            if not is_valid:
                raise ValueError(f"Invalid SIGMA translation: {error_msg}")

            # Prepare result with metadata
            result = {
                'sigma_rule': sigma_rule,
                'confidence_score': translation_result['confidence_score'],
                'validation_details': validation_details,
                'metadata': {
                    'detection_id': detection_id,
                    'source_format': source_format,
                    'platform': platform
                }
            }

            # Cache successful translation
            self._cache[cache_key] = result
            
            return result

        except Exception as e:
            logger.error(f"SIGMA translation failed for {detection_id}: {str(e)}")
            raise RuntimeError(f"Translation to SIGMA failed: {str(e)}")

    @track_translation
    async def from_sigma(
        self,
        detection_id: str,
        sigma_text: str,
        target_format: str,
        platform: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Converts a SIGMA rule to another detection format with validation.

        Args:
            detection_id: Unique identifier for the detection
            sigma_text: SIGMA rule text
            target_format: Target detection format
            platform: Optional target platform

        Returns:
            Translated and validated detection with metadata
        """
        try:
            # Validate SIGMA input
            sigma_rule = parse_sigma_rule(sigma_text, platform)
            is_valid, error_msg, _ = validate_sigma_rule(
                sigma_rule,
                platform or 'generic'
            )

            if not is_valid:
                raise ValueError(f"Invalid SIGMA rule: {error_msg}")

            # Check cache
            cache_key = f"from_sigma:{detection_id}:{target_format}"
            if cache_key in self._cache:
                logger.debug(f"Cache hit for detection {detection_id}")
                return self._cache[cache_key]

            # Translate using GenAI model
            translation_result = await self._translation_model.translate_detection(
                detection_text=sigma_text,
                source_format='sigma',
                target_format=target_format,
                options={'platform': platform}
            )

            # Prepare result with metadata
            result = {
                'translated_text': translation_result['translated_text'],
                'confidence_score': translation_result['confidence_score'],
                'validation_result': translation_result['validation_result'],
                'metadata': {
                    'detection_id': detection_id,
                    'source_format': 'sigma',
                    'target_format': target_format,
                    'platform': platform
                }
            }

            # Cache successful translation
            self._cache[cache_key] = result
            
            return result

        except Exception as e:
            logger.error(f"Translation from SIGMA failed for {detection_id}: {str(e)}")
            raise RuntimeError(f"Translation from SIGMA failed: {str(e)}")