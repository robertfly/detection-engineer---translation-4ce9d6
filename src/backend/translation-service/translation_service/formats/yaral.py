"""
YARA-L Format Handler Module

Implements comprehensive support for Chronicle YARA-L detection rules with advanced parsing,
generation and validation capabilities. Provides high-accuracy translations between YARA-L
and other security detection formats.

Version: 1.0.0
"""

import re  # version: 3.11+
import json  # version: 3.11+
from typing import Dict, Any, Tuple, List, Optional

from ..utils.logger import get_logger
from ..utils.metrics import track_translation

# Initialize structured logger
logger = get_logger(__name__)

# Comprehensive YARA-L syntax patterns
YARAL_RULE_PATTERN = re.compile(r'rule\s+([\w_]+)\s*{')
YARAL_CONDITION_PATTERN = re.compile(r'condition\s*:\s*(.+?)\s*}', re.DOTALL)
YARAL_METADATA_PATTERN = re.compile(r'metadata\s*:\s*{([^}]+)}')
YARAL_STRINGS_PATTERN = re.compile(r'strings\s*:\s*{([^}]+)}')
YARAL_IMPORT_PATTERN = re.compile(r'import\s+"([^"]+)"')
YARAL_EVENT_PATTERN = re.compile(r'event\s+=\s+([^\n]+)')

class YARALFormat:
    """
    Advanced handler for YARA-L detection rules with comprehensive support for 
    Chronicle YARA-L specific features, complex pattern matching, and robust validation.
    """

    def __init__(self) -> None:
        """Initialize the YARA-L format handler with enhanced configurations."""
        # Initialize rule metadata configuration
        self._rule_metadata = {
            "format_version": "1.0.0",
            "supported_platforms": ["Chronicle"],
            "min_engine_version": "2.0"
        }

        # Configure field mappings for YARA-L syntax
        self._field_mappings = {
            "process": "process.command_line",
            "file": "file.full_path",
            "network": "network.ip",
            "registry": "registry.key_path",
            "event": "event.type"
        }

        # Initialize YARA-L specific configuration
        self._yaral_specific_config = {
            "max_strings": 1000,
            "max_condition_depth": 10,
            "support_imports": True,
            "allow_external_variables": True
        }

        # Set up validation patterns
        self._validation_patterns = {
            "rule_name": re.compile(r'^[a-zA-Z0-9_]+$'),
            "string_id": re.compile(r'^\$[a-zA-Z0-9_]+$'),
            "metadata_key": re.compile(r'^[a-zA-Z0-9_]+$')
        }

    @track_translation
    def parse(self, content: str) -> Dict[str, Any]:
        """
        Parse a YARA-L rule into the common detection model format with enhanced support
        for YARA-L specific features.

        Args:
            content: Raw YARA-L rule content

        Returns:
            Dict containing parsed detection model with comprehensive YARA-L elements

        Raises:
            ValueError: If rule parsing fails or validation errors occur
        """
        try:
            # Extract rule name
            rule_match = YARAL_RULE_PATTERN.search(content)
            if not rule_match:
                raise ValueError("Invalid YARA-L rule: Missing rule name")
            
            rule_name = rule_match.group(1)
            if not self._validation_patterns["rule_name"].match(rule_name):
                raise ValueError(f"Invalid rule name format: {rule_name}")

            # Parse imports
            imports = []
            for import_match in YARAL_IMPORT_PATTERN.finditer(content):
                imports.append(import_match.group(1))

            # Parse metadata section
            metadata = {}
            metadata_match = YARAL_METADATA_PATTERN.search(content)
            if metadata_match:
                metadata_content = metadata_match.group(1)
                for line in metadata_content.split('\n'):
                    line = line.strip()
                    if '=' in line:
                        key, value = map(str.strip, line.split('=', 1))
                        key = key.strip('"\'')
                        value = value.strip('"\',')
                        if self._validation_patterns["metadata_key"].match(key):
                            metadata[key] = value

            # Parse strings section
            strings = {}
            strings_match = YARAL_STRINGS_PATTERN.search(content)
            if strings_match:
                strings_content = strings_match.group(1)
                for line in strings_content.split('\n'):
                    line = line.strip()
                    if '=' in line:
                        string_id, pattern = map(str.strip, line.split('=', 1))
                        if self._validation_patterns["string_id"].match(string_id):
                            strings[string_id] = pattern.strip('" ')

            # Parse condition section
            condition_match = YARAL_CONDITION_PATTERN.search(content)
            if not condition_match:
                raise ValueError("Invalid YARA-L rule: Missing condition")
            condition = condition_match.group(1).strip()

            # Parse event filters
            events = []
            for event_match in YARAL_EVENT_PATTERN.finditer(content):
                events.append(event_match.group(1).strip())

            # Construct detection model
            detection_model = {
                "type": "YARA-L",
                "name": rule_name,
                "imports": imports,
                "metadata": {
                    **self._rule_metadata,
                    **metadata
                },
                "strings": strings,
                "condition": condition,
                "events": events,
                "field_mappings": self._field_mappings.copy()
            }

            logger.info(
                f"Successfully parsed YARA-L rule: {rule_name}",
                extra={"rule_elements": len(strings) + len(events)}
            )

            return detection_model

        except Exception as e:
            logger.error(
                f"Failed to parse YARA-L rule: {str(e)}",
                extra={"content_length": len(content)}
            )
            raise ValueError(f"YARA-L parsing error: {str(e)}")

    @track_translation
    def generate(self, detection_model: Dict[str, Any]) -> str:
        """
        Generate a YARA-L rule from the common detection model with optimized structure
        and validation.

        Args:
            detection_model: Common format detection model

        Returns:
            Generated YARA-L rule with validated structure

        Raises:
            ValueError: If rule generation fails or validation errors occur
        """
        try:
            # Validate detection model
            if not isinstance(detection_model, dict):
                raise ValueError("Invalid detection model format")

            required_fields = ["name", "metadata", "condition"]
            for field in required_fields:
                if field not in detection_model:
                    raise ValueError(f"Missing required field: {field}")

            # Generate imports section
            imports_section = ""
            if detection_model.get("imports"):
                imports_section = "\n".join(
                    f'import "{imp}"' for imp in detection_model["imports"]
                )

            # Generate metadata section
            metadata_section = "metadata:\n{\n"
            for key, value in detection_model["metadata"].items():
                if self._validation_patterns["metadata_key"].match(key):
                    metadata_section += f'    {key} = "{value}"\n'
            metadata_section += "}\n"

            # Generate strings section
            strings_section = ""
            if detection_model.get("strings"):
                strings_section = "strings:\n{\n"
                for string_id, pattern in detection_model["strings"].items():
                    if self._validation_patterns["string_id"].match(string_id):
                        strings_section += f'    {string_id} = "{pattern}"\n'
                strings_section += "}\n"

            # Generate events section
            events_section = ""
            if detection_model.get("events"):
                events_section = "\n".join(
                    f"    event = {event}" for event in detection_model["events"]
                )

            # Generate condition section
            condition_section = f"condition:\n{{\n    {detection_model['condition']}\n}}"

            # Combine all sections
            rule_content = [
                f"rule {detection_model['name']} {{",
                imports_section,
                metadata_section,
                strings_section,
                events_section,
                condition_section,
                "}"
            ]

            # Generate final rule
            generated_rule = "\n\n".join(section for section in rule_content if section)

            logger.info(
                f"Successfully generated YARA-L rule: {detection_model['name']}",
                extra={"rule_length": len(generated_rule)}
            )

            return generated_rule

        except Exception as e:
            logger.error(
                f"Failed to generate YARA-L rule: {str(e)}",
                extra={"model_name": detection_model.get("name", "unknown")}
            )
            raise ValueError(f"YARA-L generation error: {str(e)}")

    def validate(self, content: str) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Perform comprehensive validation of YARA-L rules with detailed error reporting.

        Args:
            content: YARA-L rule content to validate

        Returns:
            Tuple containing:
            - bool: Validation success status
            - str: Error message if validation failed
            - Dict: Validation metadata and details
        """
        validation_metadata = {
            "checks_performed": [],
            "warnings": [],
            "metrics": {}
        }

        try:
            # Validate basic structure
            validation_metadata["checks_performed"].append("structure")
            if not content.strip():
                return False, "Empty rule content", validation_metadata

            # Validate rule name
            rule_match = YARAL_RULE_PATTERN.search(content)
            validation_metadata["checks_performed"].append("rule_name")
            if not rule_match:
                return False, "Missing rule name", validation_metadata

            rule_name = rule_match.group(1)
            if not self._validation_patterns["rule_name"].match(rule_name):
                return False, f"Invalid rule name format: {rule_name}", validation_metadata

            # Validate strings section
            validation_metadata["checks_performed"].append("strings")
            strings_match = YARAL_STRINGS_PATTERN.search(content)
            if strings_match:
                strings_content = strings_match.group(1)
                string_count = len(strings_content.split('\n'))
                validation_metadata["metrics"]["string_count"] = string_count
                
                if string_count > self._yaral_specific_config["max_strings"]:
                    validation_metadata["warnings"].append(
                        f"High string count ({string_count}) may impact performance"
                    )

            # Validate condition complexity
            validation_metadata["checks_performed"].append("condition")
            condition_match = YARAL_CONDITION_PATTERN.search(content)
            if not condition_match:
                return False, "Missing condition section", validation_metadata

            condition = condition_match.group(1)
            condition_depth = condition.count('(')
            validation_metadata["metrics"]["condition_depth"] = condition_depth

            if condition_depth > self._yaral_specific_config["max_condition_depth"]:
                validation_metadata["warnings"].append(
                    f"Complex condition structure (depth: {condition_depth})"
                )

            # Validate metadata
            validation_metadata["checks_performed"].append("metadata")
            metadata_match = YARAL_METADATA_PATTERN.search(content)
            if metadata_match:
                metadata_content = metadata_match.group(1)
                for line in metadata_content.split('\n'):
                    if '=' in line:
                        key = line.split('=')[0].strip()
                        if not self._validation_patterns["metadata_key"].match(key):
                            return False, f"Invalid metadata key format: {key}", validation_metadata

            logger.info(
                f"Completed YARA-L validation for rule: {rule_name}",
                extra={
                    "validation_checks": len(validation_metadata["checks_performed"]),
                    "warnings": len(validation_metadata["warnings"])
                }
            )

            return True, "", validation_metadata

        except Exception as e:
            logger.error(
                f"YARA-L validation error: {str(e)}",
                extra={"content_length": len(content)}
            )
            return False, f"Validation error: {str(e)}", validation_metadata