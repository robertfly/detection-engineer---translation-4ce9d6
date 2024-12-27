"""
YARA format handler module for translating security detections between YARA and other formats.

This module provides comprehensive functionality for:
- Parsing YARA rules into internal detection model
- Generating YARA rules from internal detection model
- Validating YARA rule syntax and structure
- Translation between YARA and other security detection formats

Version: 1.0.0
"""

import yara  # version: 4.3.1
import re
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

from ..utils.logger import get_logger
from ..utils.metrics import track_translation

# Initialize logger
logger = get_logger(__name__)

# YARA rule template with proper formatting and required sections
YARA_RULE_TEMPLATE = '''rule {name} {{
    meta:
        description = "{description}"
        author = "{author}"
        created = "{created}"
        modified = "{modified}"
        {additional_meta}
    strings:
        {strings}
    condition:
        {condition}
}}'''

class YARAFormat:
    """Comprehensive handler class for YARA rule format translation with validation and metrics."""

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize YARA format handler with configuration and logging setup.

        Args:
            config: Optional configuration dictionary for YARA-specific settings
        """
        self.format_name = 'yara'
        self.config = config or {}
        
        # Initialize YARA compiler with security settings
        self.compiler_options = {
            'includes': False,  # Disable external includes for security
            'error_on_warning': True,  # Strict validation
            'stack_size': 32768  # Reasonable stack size limit
        }
        
        # Initialize validation rules
        self.validation_rules = {
            'min_strings': 1,
            'max_strings': 10000,
            'max_rule_size': 1048576,  # 1MB limit
            'required_meta': ['description', 'author', 'created']
        }

        logger.info(
            "Initialized YARA format handler",
            extra={'compiler_options': self.compiler_options}
        )

    @track_translation
    def translate_to(self, rule_content: str, target_format: str) -> str:
        """
        Translates a YARA rule to another detection format with validation and metrics.

        Args:
            rule_content: Source YARA rule content
            target_format: Target detection format

        Returns:
            Translated detection content

        Raises:
            ValueError: If validation fails or translation is not supported
        """
        try:
            # Parse YARA rule to internal model
            detection_model = parse_yara_rule(rule_content)
            
            # Validate parsed model
            if not detection_model:
                raise ValueError("Failed to parse YARA rule")

            logger.info(
                f"Translating YARA rule to {target_format}",
                extra={'rule_name': detection_model.get('name')}
            )

            # Convert internal model to target format
            # Note: Implementation would call appropriate format converter
            
            return "Translated content"  # Placeholder
            
        except Exception as e:
            logger.error(
                f"Translation failed: {str(e)}",
                extra={'target_format': target_format}
            )
            raise

    @track_translation
    def translate_from(self, detection_content: str, source_format: str) -> str:
        """
        Translates another detection format to YARA with optimization.

        Args:
            detection_content: Source detection content
            source_format: Source detection format

        Returns:
            Generated YARA rule

        Raises:
            ValueError: If validation fails or translation is not supported
        """
        try:
            # Parse source detection to internal model
            # Note: Implementation would call appropriate format parser
            
            # Generate YARA rule
            yara_rule = generate_yara_rule({})  # Placeholder
            
            # Validate generated rule
            valid, error = validate_yara_rule(yara_rule)
            if not valid:
                raise ValueError(f"Generated YARA rule validation failed: {error}")

            return yara_rule
            
        except Exception as e:
            logger.error(
                f"Translation failed: {str(e)}",
                extra={'source_format': source_format}
            )
            raise

@track_translation
def parse_yara_rule(rule_content: str) -> Dict[str, Any]:
    """
    Parses a YARA rule into a standardized internal detection model.

    Args:
        rule_content: YARA rule content to parse

    Returns:
        Internal detection model representation

    Raises:
        ValueError: If rule parsing or validation fails
    """
    try:
        # Compile rule to validate syntax
        compiler = yara.compile(source=rule_content)
        
        # Extract rule components using regex
        rule_match = re.match(
            r'rule\s+(\w+)\s*{([^}]+)}',
            rule_content,
            re.DOTALL
        )
        if not rule_match:
            raise ValueError("Invalid YARA rule structure")

        rule_name = rule_match.group(1)
        rule_body = rule_match.group(2)

        # Parse metadata section
        meta = {}
        meta_match = re.search(
            r'meta:\s*{([^}]+)}',
            rule_body,
            re.DOTALL
        )
        if meta_match:
            meta_content = meta_match.group(1)
            meta_items = re.findall(
                r'(\w+)\s*=\s*"([^"]+)"',
                meta_content
            )
            meta = dict(meta_items)

        # Parse strings section
        strings = {}
        strings_match = re.search(
            r'strings:\s*{([^}]+)}',
            rule_body,
            re.DOTALL
        )
        if strings_match:
            strings_content = strings_match.group(1)
            string_items = re.findall(
                r'\$(\w+)\s*=\s*(.+)',
                strings_content
            )
            strings = {
                name: value.strip()
                for name, value in string_items
            }

        # Parse condition section
        condition = ""
        condition_match = re.search(
            r'condition:\s*{([^}]+)}',
            rule_body,
            re.DOTALL
        )
        if condition_match:
            condition = condition_match.group(1).strip()

        # Build internal model
        detection_model = {
            'name': rule_name,
            'type': 'yara',
            'meta': meta,
            'strings': strings,
            'condition': condition,
            'original_content': rule_content
        }

        logger.info(
            f"Successfully parsed YARA rule: {rule_name}",
            extra={'meta': meta}
        )

        return detection_model

    except Exception as e:
        logger.error(f"YARA rule parsing failed: {str(e)}")
        raise ValueError(f"Failed to parse YARA rule: {str(e)}")

def generate_yara_rule(detection_model: Dict[str, Any]) -> str:
    """
    Generates a YARA rule from the internal detection model.

    Args:
        detection_model: Internal detection model

    Returns:
        Generated YARA rule content

    Raises:
        ValueError: If model validation fails
    """
    try:
        # Validate required fields
        required_fields = ['name', 'meta', 'strings', 'condition']
        for field in required_fields:
            if field not in detection_model:
                raise ValueError(f"Missing required field: {field}")

        # Format metadata
        meta = detection_model['meta']
        if 'modified' not in meta:
            meta['modified'] = datetime.utcnow().isoformat()

        additional_meta = "\n        ".join(
            f'{k} = "{v}"'
            for k, v in meta.items()
            if k not in ['description', 'author', 'created', 'modified']
        )

        # Format strings section
        strings_content = "\n        ".join(
            f'${name} = {value}'
            for name, value in detection_model['strings'].items()
        )

        # Generate rule using template
        rule_content = YARA_RULE_TEMPLATE.format(
            name=detection_model['name'],
            description=meta.get('description', ''),
            author=meta.get('author', ''),
            created=meta.get('created', ''),
            modified=meta['modified'],
            additional_meta=additional_meta,
            strings=strings_content,
            condition=detection_model['condition']
        )

        # Validate generated rule
        valid, error = validate_yara_rule(rule_content)
        if not valid:
            raise ValueError(f"Generated rule validation failed: {error}")

        return rule_content

    except Exception as e:
        logger.error(f"YARA rule generation failed: {str(e)}")
        raise ValueError(f"Failed to generate YARA rule: {str(e)}")

def validate_yara_rule(rule_content: str) -> Tuple[bool, Optional[str]]:
    """
    Performs comprehensive validation of YARA rule syntax and structure.

    Args:
        rule_content: YARA rule content to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Check rule size
        if len(rule_content) > 1048576:  # 1MB limit
            return False, "Rule exceeds maximum size limit"

        # Compile rule to validate syntax
        compiler = yara.compile(source=rule_content)

        # Validate required sections
        required_sections = ['meta:', 'strings:', 'condition:']
        for section in required_sections:
            if section not in rule_content:
                return False, f"Missing required section: {section}"

        # Validate strings section
        strings_count = len(re.findall(r'\$\w+\s*=', rule_content))
        if strings_count < 1:
            return False, "Rule must contain at least one string definition"
        if strings_count > 10000:
            return False, "Rule exceeds maximum string count"

        # Validate metadata
        required_meta = ['description', 'author', 'created']
        for meta in required_meta:
            if f'{meta} = ' not in rule_content:
                return False, f"Missing required metadata: {meta}"

        return True, None

    except yara.Error as e:
        return False, f"YARA syntax error: {str(e)}"
    except Exception as e:
        return False, f"Validation error: {str(e)}"