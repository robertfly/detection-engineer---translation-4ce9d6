"""
KQL (Kusto Query Language) format handler for security detection translation.

This module provides comprehensive functionality for translating Microsoft Azure KQL
detection rules to and from other security detection formats with high-fidelity 
translation and robust validation.

Version: 1.0.0
"""

import re  # version: 3.11+
from typing import Dict, List, Optional, Any, Pattern, Match  # version: 3.11+
from ..utils.logger import get_logger

# Global constants for KQL syntax elements
KQL_OPERATORS: List[str] = [
    'where', 'project', 'extend', 'summarize', 'join', 'union', 'parse',
    'distinct', 'top', 'sort', 'count', 'take', 'limit', 'order by',
    'mv-expand', 'make-series'
]

# Compiled regex patterns for performance optimization
KQL_TABLE_PATTERN: Pattern[str] = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]{0,63}$')
KQL_FIELD_PATTERN: Pattern[str] = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]{0,63}$')
KQL_TIME_PATTERN: Pattern[str] = re.compile(r'ago(\d+[hdm])|startofday|endofday|now()')

# Initialize logger
logger = get_logger(__name__)

class KQLFormat:
    """
    Handles translation of KQL format detection rules with comprehensive validation,
    error handling, and performance optimization.
    """

    def __init__(self) -> None:
        """Initialize the KQL format handler with pre-compiled patterns and caching."""
        # Initialize pattern cache for performance
        self.cached_patterns: Dict[str, Any] = {}
        
        # Pre-compile common regex patterns
        self.operator_pattern = re.compile(
            r'\b(' + '|'.join(map(re.escape, KQL_OPERATORS)) + r')\b',
            re.IGNORECASE
        )
        self.table_pattern = KQL_TABLE_PATTERN
        self.field_pattern = KQL_FIELD_PATTERN
        self.time_pattern = KQL_TIME_PATTERN

    def parse(self, detection_content: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parse a KQL detection rule into the common detection model with validation.

        Args:
            detection_content: Raw KQL detection rule content
            options: Optional parsing configuration

        Returns:
            Dict containing the parsed detection in common model format
            or error details if parsing fails
        """
        try:
            logger.debug("Starting KQL detection parsing", 
                        extra={"content_length": len(detection_content)})

            # Validate input
            if not detection_content or len(detection_content.strip()) == 0:
                raise ValueError("Empty detection content")

            # Initialize detection model
            detection_model = {
                "type": "kql",
                "version": "1.0",
                "metadata": {},
                "pattern_matches": [],
                "conditions": [],
                "fields": set()
            }

            # Split into lines and remove comments
            lines = [line.strip() for line in detection_content.split('\n')
                    if line.strip() and not line.strip().startswith("//")]

            # Parse table reference
            table_match = self.table_pattern.match(lines[0].split()[0])
            if not table_match:
                raise ValueError(f"Invalid table name: {lines[0].split()[0]}")
            detection_model["source_table"] = table_match.group(0)

            # Parse time range
            time_specs = []
            for line in lines:
                time_matches = self.time_pattern.finditer(line)
                time_specs.extend(match.group(0) for match in time_matches)
            if time_specs:
                detection_model["time_range"] = time_specs[0]

            # Parse operators and conditions
            current_operator = None
            for line in lines[1:]:
                operator_match = self.operator_pattern.search(line)
                if operator_match:
                    current_operator = operator_match.group(0).lower()
                    operator_content = line[operator_match.end():].strip()
                    
                    # Extract fields
                    fields = self.field_pattern.finditer(operator_content)
                    detection_model["fields"].update(
                        match.group(0) for match in fields
                    )

                    # Build condition
                    if current_operator == "where":
                        detection_model["conditions"].append({
                            "operator": current_operator,
                            "expression": operator_content
                        })
                    elif current_operator in ("project", "extend"):
                        detection_model["pattern_matches"].append({
                            "type": current_operator,
                            "fields": operator_content.split(",")
                        })

            # Convert fields set to list
            detection_model["fields"] = list(detection_model["fields"])

            logger.info("Successfully parsed KQL detection", 
                       extra={"table": detection_model["source_table"],
                             "field_count": len(detection_model["fields"])})

            return detection_model

        except Exception as e:
            error_msg = f"Error parsing KQL detection: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {"error": error_msg, "type": "kql"}

    def generate(self, detection_model: Dict[str, Any], 
                options: Optional[Dict[str, Any]] = None) -> str:
        """
        Generate a KQL detection rule from the common detection model.

        Args:
            detection_model: Common format detection model
            options: Optional generation configuration

        Returns:
            Generated KQL detection rule or error message
        """
        try:
            logger.debug("Starting KQL detection generation")

            # Validate required fields
            if not detection_model.get("source_table"):
                raise ValueError("Missing required source_table")

            # Initialize query parts
            query_parts = []

            # Add table reference
            if not self.table_pattern.match(detection_model["source_table"]):
                raise ValueError(f"Invalid table name: {detection_model['source_table']}")
            query_parts.append(detection_model["source_table"])

            # Add time range if specified
            if "time_range" in detection_model:
                query_parts.append(f"| where TimeGenerated >= {detection_model['time_range']}")

            # Add conditions
            for condition in detection_model.get("conditions", []):
                if condition["operator"] == "where":
                    query_parts.append(f"| where {condition['expression']}")

            # Add pattern matches
            for pattern in detection_model.get("pattern_matches", []):
                if pattern["type"] == "project":
                    query_parts.append(f"| project {', '.join(pattern['fields'])}")
                elif pattern["type"] == "extend":
                    query_parts.append(f"| extend {', '.join(pattern['fields'])}")

            # Build final query with proper formatting
            kql_query = "\n".join(query_parts)

            # Validate generated query
            if not self.validate_syntax(kql_query):
                raise ValueError("Generated query failed syntax validation")

            logger.info("Successfully generated KQL detection",
                       extra={"query_length": len(kql_query)})

            return kql_query

        except Exception as e:
            error_msg = f"Error generating KQL detection: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return f"// Error: {error_msg}"

    def validate_syntax(self, content: str, 
                       options: Optional[Dict[str, Any]] = None) -> bool:
        """
        Validate KQL syntax with comprehensive error reporting.

        Args:
            content: KQL content to validate
            options: Optional validation configuration

        Returns:
            True if syntax is valid, False otherwise
        """
        try:
            logger.debug("Starting KQL syntax validation")

            # Check for empty content
            if not content or len(content.strip()) == 0:
                logger.warning("Empty content provided for validation")
                return False

            lines = content.split('\n')
            
            # Validate table reference
            first_token = lines[0].split()[0]
            if not self.table_pattern.match(first_token):
                logger.error(f"Invalid table name: {first_token}")
                return False

            # Track operator order
            seen_operators = []
            
            # Validate each line
            for line in lines[1:]:
                line = line.strip()
                if not line or line.startswith("//"):
                    continue

                # Check operator syntax
                operator_match = self.operator_pattern.search(line)
                if operator_match:
                    operator = operator_match.group(0).lower()
                    seen_operators.append(operator)

                    # Validate operator order
                    if operator == "project" and "extend" in seen_operators:
                        logger.error("Invalid operator order: project after extend")
                        return False

            # Validate time range presence
            has_time_range = any(
                self.time_pattern.search(line) for line in lines
            )
            if not has_time_range:
                logger.warning("No time range specified in query")

            logger.info("KQL syntax validation successful")
            return True

        except Exception as e:
            logger.error(f"Error during KQL syntax validation: {str(e)}", 
                        exc_info=True)
            return False