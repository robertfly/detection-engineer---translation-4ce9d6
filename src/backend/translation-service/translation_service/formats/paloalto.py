"""
Palo Alto Networks detection format handler for the Translation Service.

This module implements parsing, generation, and validation capabilities for 
Palo Alto Networks security detection rules with comprehensive error handling
and performance monitoring.

Version: 1.0.0
"""

import json  # version: 3.11+
import re  # version: 3.11+
from typing import Dict, List, Optional, Any, Tuple  # version: 3.11+
from dataclasses import dataclass  # version: 3.11+
from ..utils.logger import get_logger

# Regex pattern for Palo Alto rule validation
PALO_ALTO_RULE_PATTERN = re.compile(
    r'^rule\s+[\w-]+\s*{\s*([^}]+)\s*}$',
    re.MULTILINE | re.DOTALL
)

# Constants for validation
MAX_RULE_LENGTH = 50000
REQUIRED_FIELDS = ['name', 'conditions', 'actions', 'severity']
VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational']

# Error message templates
ERROR_MESSAGES = {
    "invalid_length": "Rule exceeds maximum length of {}",
    "missing_field": "Required field {} is missing",
    "invalid_json": "Invalid JSON structure",
    "invalid_syntax": "Invalid rule syntax",
    "invalid_severity": "Invalid severity level"
}

@dataclass
class PaloAltoFormat:
    """
    Handles translation of security detections to and from Palo Alto Networks format
    with comprehensive validation and error reporting.
    """

    def __init__(self):
        """Initialize the Palo Alto format handler with logging and validation setup."""
        self.logger = get_logger(__name__)
        self.rule_pattern = PALO_ALTO_RULE_PATTERN
        self.error_messages = ERROR_MESSAGES
        self.metrics = {
            "parse_count": 0,
            "generate_count": 0,
            "validation_errors": 0,
            "avg_parse_time": 0.0,
            "avg_generate_time": 0.0
        }

    def parse(self, detection_content: str, trace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse a Palo Alto detection rule into the common detection model.

        Args:
            detection_content: Raw Palo Alto rule content
            trace_id: Optional trace ID for request tracking

        Returns:
            Dict containing the parsed detection in common model format

        Raises:
            ValueError: If the detection content is invalid
        """
        import time
        start_time = time.time()

        try:
            # Validate input length
            if len(detection_content) > MAX_RULE_LENGTH:
                raise ValueError(self.error_messages["invalid_length"].format(MAX_RULE_LENGTH))

            # Sanitize input content
            detection_content = detection_content.strip()

            # Parse JSON structure
            try:
                rule_match = self.rule_pattern.match(detection_content)
                if not rule_match:
                    raise ValueError(self.error_messages["invalid_syntax"])
                
                rule_content = rule_match.group(1)
                rule_data = json.loads("{" + rule_content + "}")
            except json.JSONDecodeError:
                raise ValueError(self.error_messages["invalid_json"])

            # Validate required fields
            for field in REQUIRED_FIELDS:
                if field not in rule_data:
                    raise ValueError(self.error_messages["missing_field"].format(field))

            # Validate severity
            if rule_data["severity"].lower() not in VALID_SEVERITIES:
                raise ValueError(self.error_messages["invalid_severity"])

            # Convert to common model
            common_model = {
                "type": "palo_alto",
                "name": rule_data["name"],
                "description": rule_data.get("description", ""),
                "severity": rule_data["severity"].lower(),
                "conditions": rule_data["conditions"],
                "actions": rule_data["actions"],
                "enabled": rule_data.get("enabled", True),
                "metadata": {
                    "original_format": "palo_alto",
                    "version": rule_data.get("version", "1.0"),
                    "tags": rule_data.get("tags", []),
                    "last_modified": rule_data.get("last_modified", ""),
                }
            }

            # Update metrics
            self.metrics["parse_count"] += 1
            parse_time = time.time() - start_time
            self.metrics["avg_parse_time"] = (
                (self.metrics["avg_parse_time"] * (self.metrics["parse_count"] - 1) + parse_time)
                / self.metrics["parse_count"]
            )

            self.logger.info(
                "Successfully parsed Palo Alto rule",
                extra={
                    "trace_id": trace_id,
                    "rule_name": rule_data["name"],
                    "parse_time": parse_time
                }
            )

            return common_model

        except Exception as e:
            self.metrics["validation_errors"] += 1
            self.logger.error(
                f"Error parsing Palo Alto rule: {str(e)}",
                extra={"trace_id": trace_id, "error_type": type(e).__name__}
            )
            raise

    def generate(self, detection_model: Dict[str, Any], trace_id: Optional[str] = None) -> str:
        """
        Generate a Palo Alto detection rule from the common detection model.

        Args:
            detection_model: Common model detection dictionary
            trace_id: Optional trace ID for request tracking

        Returns:
            String containing the formatted Palo Alto rule

        Raises:
            ValueError: If the detection model is invalid
        """
        import time
        start_time = time.time()

        try:
            # Validate detection model
            if not isinstance(detection_model, dict):
                raise ValueError("Invalid detection model format")

            for field in REQUIRED_FIELDS:
                if field not in detection_model:
                    raise ValueError(self.error_messages["missing_field"].format(field))

            # Convert to Palo Alto format
            rule_data = {
                "name": detection_model["name"],
                "description": detection_model.get("description", ""),
                "severity": detection_model["severity"].upper(),
                "conditions": detection_model["conditions"],
                "actions": detection_model["actions"],
                "enabled": detection_model.get("enabled", True),
                "version": detection_model.get("metadata", {}).get("version", "1.0"),
                "tags": detection_model.get("metadata", {}).get("tags", []),
                "last_modified": detection_model.get("metadata", {}).get("last_modified", "")
            }

            # Generate rule content
            rule_content = json.dumps(rule_data, indent=2)
            formatted_rule = f'rule {rule_data["name"]} {{\n{rule_content}\n}}'

            # Validate generated rule
            if not self.rule_pattern.match(formatted_rule):
                raise ValueError(self.error_messages["invalid_syntax"])

            # Update metrics
            self.metrics["generate_count"] += 1
            generate_time = time.time() - start_time
            self.metrics["avg_generate_time"] = (
                (self.metrics["avg_generate_time"] * (self.metrics["generate_count"] - 1) + generate_time)
                / self.metrics["generate_count"]
            )

            self.logger.info(
                "Successfully generated Palo Alto rule",
                extra={
                    "trace_id": trace_id,
                    "rule_name": rule_data["name"],
                    "generate_time": generate_time
                }
            )

            return formatted_rule

        except Exception as e:
            self.metrics["validation_errors"] += 1
            self.logger.error(
                f"Error generating Palo Alto rule: {str(e)}",
                extra={"trace_id": trace_id, "error_type": type(e).__name__}
            )
            raise

    def validate_rule(self, rule_content: str, trace_id: Optional[str] = None) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Validate a Palo Alto detection rule format.

        Args:
            rule_content: Rule content to validate
            trace_id: Optional trace ID for request tracking

        Returns:
            Tuple containing (is_valid, error_message, validation_details)
        """
        validation_details = {
            "length_check": False,
            "syntax_check": False,
            "required_fields": False,
            "severity_check": False
        }

        try:
            # Check length
            validation_details["length_check"] = len(rule_content) <= MAX_RULE_LENGTH
            if not validation_details["length_check"]:
                return False, self.error_messages["invalid_length"].format(MAX_RULE_LENGTH), validation_details

            # Check syntax
            rule_match = self.rule_pattern.match(rule_content.strip())
            validation_details["syntax_check"] = bool(rule_match)
            if not validation_details["syntax_check"]:
                return False, self.error_messages["invalid_syntax"], validation_details

            # Parse and validate JSON structure
            try:
                rule_content = rule_match.group(1)
                rule_data = json.loads("{" + rule_content + "}")
            except (json.JSONDecodeError, AttributeError):
                return False, self.error_messages["invalid_json"], validation_details

            # Check required fields
            missing_fields = [field for field in REQUIRED_FIELDS if field not in rule_data]
            validation_details["required_fields"] = len(missing_fields) == 0
            if not validation_details["required_fields"]:
                return False, self.error_messages["missing_field"].format(missing_fields[0]), validation_details

            # Validate severity
            validation_details["severity_check"] = rule_data["severity"].lower() in VALID_SEVERITIES
            if not validation_details["severity_check"]:
                return False, self.error_messages["invalid_severity"], validation_details

            self.logger.info(
                "Validation successful for Palo Alto rule",
                extra={"trace_id": trace_id, "validation_details": validation_details}
            )

            return True, None, validation_details

        except Exception as e:
            self.logger.error(
                f"Error during rule validation: {str(e)}",
                extra={"trace_id": trace_id, "error_type": type(e).__name__}
            )
            return False, str(e), validation_details