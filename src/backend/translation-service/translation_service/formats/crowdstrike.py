"""
Crowdstrike Detection Format Handler

This module implements comprehensive translation capabilities between Crowdstrike NG-SIEM
detection rules and other security detection formats with high-fidelity validation
and detailed error reporting.

Version: 1.0.0
"""

import re  # version: 3.11+
import json  # version: 3.11+
from typing import Dict, Any, Optional, Tuple, List  # version: 3.11+

from ...utils.logger import get_logger
from ...genai.model import TranslationModel

# Initialize logger
logger = get_logger(__name__)

# Mapping of common fields to Crowdstrike-specific field names
CROWDSTRIKE_FIELDS: Dict[str, str] = {
    'process_name': 'ProcessName',
    'command_line': 'CommandLine',
    'file_path': 'FilePath',
    'parent_process': 'ParentProcess',
    'registry_key': 'RegistryKey',
    'registry_value': 'RegistryValue',
    'network_connection': 'NetworkConnection',
    'dns_request': 'DnsRequest',
    'http_request': 'HttpRequest',
    'event_type': 'EventType',
    'user_name': 'UserName',
    'host_name': 'HostName'
}

def validate_crowdstrike_syntax(detection_text: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates Crowdstrike detection syntax with comprehensive error reporting.

    Args:
        detection_text: Detection rule to validate

    Returns:
        Tuple containing:
        - bool: Validation success
        - str: Error message if validation failed
        - Dict: Detailed validation report
    """
    validation_report = {
        'is_valid': True,
        'errors': [],
        'warnings': [],
        'field_validation': {},
        'syntax_validation': {}
    }

    try:
        # Check for required sections
        required_sections = ['metadata', 'events', 'condition']
        for section in required_sections:
            if section not in detection_text.lower():
                validation_report['errors'].append(f"Missing required section: {section}")
                validation_report['is_valid'] = False

        # Validate metadata section
        metadata_match = re.search(r'metadata:\s*{([^}]+)}', detection_text)
        if metadata_match:
            metadata_text = metadata_match.group(1)
            if not re.search(r'title:\s*".+"', metadata_text):
                validation_report['errors'].append("Missing required metadata field: title")
            if not re.search(r'description:\s*".+"', metadata_text):
                validation_report['warnings'].append("Missing recommended metadata field: description")
        else:
            validation_report['errors'].append("Invalid metadata section format")

        # Validate events section
        events_match = re.search(r'events:\s*{([^}]+)}', detection_text)
        if events_match:
            events_text = events_match.group(1)
            # Check field names
            field_matches = re.finditer(r'(\w+):\s*([^,\n]+)', events_text)
            for match in field_matches:
                field_name = match.group(1)
                if field_name not in CROWDSTRIKE_FIELDS.values():
                    validation_report['warnings'].append(f"Non-standard field name: {field_name}")
                validation_report['field_validation'][field_name] = 'valid'
        else:
            validation_report['errors'].append("Invalid events section format")

        # Validate condition section
        condition_match = re.search(r'condition:\s*(.+)', detection_text)
        if condition_match:
            condition_text = condition_match.group(1)
            # Check for valid operators
            valid_operators = ['and', 'or', 'not']
            for op in valid_operators:
                if op in condition_text.lower():
                    validation_report['syntax_validation'][op] = 'valid'
        else:
            validation_report['errors'].append("Invalid condition section format")

        # Set overall validation result
        validation_report['is_valid'] = len(validation_report['errors']) == 0

        return (
            validation_report['is_valid'],
            '\n'.join(validation_report['errors']) if validation_report['errors'] else '',
            validation_report
        )

    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return False, f"Validation failed: {str(e)}", validation_report

def normalize_field_names(field_name: str, reverse: bool = False) -> str:
    """
    Normalizes field names between Crowdstrike and common format.

    Args:
        field_name: Field name to normalize
        reverse: If True, convert from common to Crowdstrike format

    Returns:
        Normalized field name
    """
    if reverse:
        # Convert common format to Crowdstrike format
        return CROWDSTRIKE_FIELDS.get(field_name.lower(), field_name)
    else:
        # Convert Crowdstrike format to common format
        inverse_map = {v.lower(): k for k, v in CROWDSTRIKE_FIELDS.items()}
        return inverse_map.get(field_name.lower(), field_name)

class CrowdstrikeFormat:
    """
    Handler for Crowdstrike detection format with comprehensive translation capabilities.
    """

    def __init__(self, translation_model: TranslationModel):
        """
        Initialize Crowdstrike format handler.

        Args:
            translation_model: GenAI translation model instance
        """
        self._translation_model = translation_model
        self._field_mappings = CROWDSTRIKE_FIELDS
        self._validation_rules = {
            'required_sections': ['metadata', 'events', 'condition'],
            'metadata_fields': ['title', 'description', 'author'],
            'max_condition_depth': 5
        }
        self._cache: Dict[str, Any] = {}

        logger.info("Initialized CrowdstrikeFormat handler")

    def parse(self, detection_text: str) -> Dict[str, Any]:
        """
        Parse Crowdstrike detection into common format.

        Args:
            detection_text: Crowdstrike detection text

        Returns:
            Dict containing parsed detection in common format

        Raises:
            ValueError: If detection text is invalid
        """
        logger.debug("Parsing Crowdstrike detection")

        # Validate detection syntax
        is_valid, error_msg, validation_report = validate_crowdstrike_syntax(detection_text)
        if not is_valid:
            raise ValueError(f"Invalid Crowdstrike detection: {error_msg}")

        try:
            # Parse metadata section
            metadata_match = re.search(r'metadata:\s*{([^}]+)}', detection_text)
            metadata = {}
            if metadata_match:
                metadata_text = metadata_match.group(1)
                for match in re.finditer(r'(\w+):\s*"([^"]+)"', metadata_text):
                    metadata[match.group(1)] = match.group(2)

            # Parse events section
            events_match = re.search(r'events:\s*{([^}]+)}', detection_text)
            events = {}
            if events_match:
                events_text = events_match.group(1)
                for match in re.finditer(r'(\w+):\s*([^,\n]+)', events_text):
                    field_name = normalize_field_names(match.group(1))
                    events[field_name] = match.group(2).strip()

            # Parse condition section
            condition_match = re.search(r'condition:\s*(.+)', detection_text)
            condition = condition_match.group(1) if condition_match else ''

            # Construct common format
            parsed_detection = {
                'metadata': metadata,
                'detection': {
                    'fields': events,
                    'condition': condition
                },
                'validation': validation_report
            }

            logger.info("Successfully parsed Crowdstrike detection")
            return parsed_detection

        except Exception as e:
            logger.error(f"Error parsing Crowdstrike detection: {str(e)}")
            raise ValueError(f"Parsing failed: {str(e)}")

    def generate(self, detection_data: Dict[str, Any]) -> str:
        """
        Generate Crowdstrike detection from common format.

        Args:
            detection_data: Detection data in common format

        Returns:
            Crowdstrike detection string

        Raises:
            ValueError: If detection data is invalid
        """
        logger.debug("Generating Crowdstrike detection")

        try:
            # Validate required sections
            if not all(k in detection_data for k in ['metadata', 'detection']):
                raise ValueError("Missing required sections in detection data")

            # Generate metadata section
            metadata_items = []
            for key, value in detection_data['metadata'].items():
                metadata_items.append(f'    {key}: "{value}"')
            metadata_section = "metadata: {\n" + ",\n".join(metadata_items) + "\n}"

            # Generate events section
            events_items = []
            for field, value in detection_data['detection']['fields'].items():
                crowdstrike_field = normalize_field_names(field, reverse=True)
                events_items.append(f'    {crowdstrike_field}: {value}')
            events_section = "events: {\n" + ",\n".join(events_items) + "\n}"

            # Generate condition section
            condition = detection_data['detection'].get('condition', '')
            condition_section = f"condition: {condition}"

            # Combine sections
            crowdstrike_detection = "\n\n".join([
                metadata_section,
                events_section,
                condition_section
            ])

            # Validate generated detection
            is_valid, error_msg, _ = validate_crowdstrike_syntax(crowdstrike_detection)
            if not is_valid:
                raise ValueError(f"Generated invalid detection: {error_msg}")

            logger.info("Successfully generated Crowdstrike detection")
            return crowdstrike_detection

        except Exception as e:
            logger.error(f"Error generating Crowdstrike detection: {str(e)}")
            raise ValueError(f"Generation failed: {str(e)}")

    def validate(self, detection_text: str) -> Dict[str, Any]:
        """
        Validate Crowdstrike detection with comprehensive checking.

        Args:
            detection_text: Detection text to validate

        Returns:
            Dict containing validation results and suggestions
        """
        logger.debug("Validating Crowdstrike detection")

        try:
            # Perform syntax validation
            is_valid, error_msg, validation_report = validate_crowdstrike_syntax(detection_text)

            # Add performance impact analysis
            validation_report['performance_impact'] = self._analyze_performance_impact(detection_text)

            # Add best practices check
            validation_report['best_practices'] = self._check_best_practices(detection_text)

            # Generate optimization suggestions
            validation_report['optimization_suggestions'] = self._generate_optimization_suggestions(
                detection_text,
                validation_report
            )

            logger.info(
                "Completed detection validation",
                extra={'is_valid': is_valid, 'error_count': len(validation_report['errors'])}
            )

            return validation_report

        except Exception as e:
            logger.error(f"Error during validation: {str(e)}")
            return {
                'is_valid': False,
                'errors': [f"Validation error: {str(e)}"],
                'warnings': [],
                'performance_impact': 'unknown'
            }

    def _analyze_performance_impact(self, detection_text: str) -> str:
        """Analyze potential performance impact of the detection."""
        # Count condition complexity
        condition_match = re.search(r'condition:\s*(.+)', detection_text)
        if condition_match:
            condition = condition_match.group(1)
            operator_count = len(re.findall(r'\b(and|or)\b', condition))
            if operator_count > 5:
                return 'high'
            elif operator_count > 3:
                return 'medium'
        return 'low'

    def _check_best_practices(self, detection_text: str) -> List[str]:
        """Check adherence to Crowdstrike best practices."""
        best_practices = []
        
        # Check metadata completeness
        if not re.search(r'author:', detection_text):
            best_practices.append("Add author information to metadata")
        if not re.search(r'description:', detection_text):
            best_practices.append("Add detailed description to metadata")

        # Check field naming conventions
        if re.search(r'\b[a-z]+_[a-z]+\b', detection_text):
            best_practices.append("Use CamelCase for field names instead of snake_case")

        return best_practices

    def _generate_optimization_suggestions(
        self,
        detection_text: str,
        validation_report: Dict[str, Any]
    ) -> List[str]:
        """Generate optimization suggestions based on validation results."""
        suggestions = []

        # Check condition complexity
        if validation_report.get('performance_impact') == 'high':
            suggestions.append("Consider simplifying condition logic to improve performance")

        # Check field usage
        events_match = re.search(r'events:\s*{([^}]+)}', detection_text)
        if events_match:
            events_text = events_match.group(1)
            if len(events_text.split('\n')) > 10:
                suggestions.append("Consider grouping related fields to reduce complexity")

        return suggestions