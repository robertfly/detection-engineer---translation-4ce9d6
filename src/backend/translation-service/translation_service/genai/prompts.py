"""
Prompt Management Module for GenAI Translation Service

This module manages the generation and customization of prompts for the GenAI translation model,
providing specialized prompts for different security detection formats and translation scenarios.

Version: 1.0.0
"""

from typing import Dict, Optional, Any
from jinja2 import Environment, Template, select_autoescape  # version: 3.1.2
from ...utils.logger import get_logger
from ...config.genai import GenAIConfig

# Initialize logger
logger = get_logger(__name__)

# Base translation template with format-specific placeholders
BASE_TRANSLATION_TEMPLATE: str = '''You are a security detection translator. Translate the following {source_format} detection to {target_format} format:

{detection_text}

Provide only the translated detection without any additional text.'''

# Format-specific templates with specialized instructions
FORMAT_SPECIFIC_TEMPLATES: Dict[str, str] = {
    'splunk': '''Translate this Splunk SPL detection maintaining search terms and pipes structure:
{detection_text}''',
    
    'sigma': '''Convert to SIGMA format following the SIGMA specification v2:
{detection_text}''',
    
    'qradar': '''Transform to QRadar AQL maintaining property correlations:
{detection_text}''',
    
    'kql': '''Convert to KQL optimizing for Azure Sentinel:
{detection_text}''',
    
    'paloalto': '''Adapt for Palo Alto correlation rules:
{detection_text}''',
    
    'crowdstrike': '''Transform for Crowdstrike detection engine:
{detection_text}''',
    
    'yara': '''Convert to YARA rules preserving pattern matches:
{detection_text}''',
    
    'yaral': '''Adapt for YARA-L maintaining logic structure:
{detection_text}'''
}

class PromptManager:
    """
    Manages the generation and customization of prompts for security detection translation
    with enhanced template management and format-specific optimizations.
    """

    def __init__(self, config: GenAIConfig):
        """
        Initialize the prompt manager with configuration and template environment.

        Args:
            config: GenAI configuration instance
        """
        self._template_env = Environment(
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
        self._format_templates = FORMAT_SPECIFIC_TEMPLATES.copy()
        self._format_requirements = {}
        self._config = config

        logger.info(
            "Initialized PromptManager",
            extra={"supported_formats": len(config.supported_formats)}
        )

    def generate_translation_prompt(
        self,
        detection_text: str,
        source_format: str,
        target_format: str,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generates a comprehensive translation prompt with format-specific optimizations.

        Args:
            detection_text: The detection rule to translate
            source_format: Source detection format
            target_format: Target detection format
            additional_params: Optional additional parameters for customization

        Returns:
            Optimized prompt for translation with format-specific guidelines

        Raises:
            ValueError: If formats are invalid or incompatible
        """
        # Validate formats
        if not self.validate_formats(source_format, target_format):
            raise ValueError(f"Invalid format combination: {source_format} -> {target_format}")

        logger.debug(
            "Generating translation prompt",
            extra={
                "source_format": source_format,
                "target_format": target_format,
                "text_length": len(detection_text)
            }
        )

        # Get format-specific settings
        source_settings = self._config.get_format_settings(source_format)
        target_settings = self._config.get_format_settings(target_format)

        # Build the base prompt
        base_prompt = self._template_env.from_string(BASE_TRANSLATION_TEMPLATE).render(
            source_format=source_format,
            target_format=target_format,
            detection_text=detection_text
        )

        # Add format-specific guidelines
        format_guidelines = self._get_format_guidelines(target_format, target_settings)
        enhanced_prompt = f"{base_prompt}\n\n{format_guidelines}"

        # Add field mapping instructions if available
        if additional_params and additional_params.get('field_mappings'):
            mapping_instructions = self._generate_field_mapping_instructions(
                source_format,
                target_format,
                additional_params['field_mappings']
            )
            enhanced_prompt = f"{enhanced_prompt}\n\n{mapping_instructions}"

        logger.info(
            "Generated translation prompt",
            extra={
                "prompt_length": len(enhanced_prompt),
                "has_mappings": bool(additional_params and additional_params.get('field_mappings'))
            }
        )

        return enhanced_prompt

    def customize_prompt(
        self,
        base_prompt: str,
        target_format: str,
        format_params: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Enhances prompt with format-specific requirements and validation rules.

        Args:
            base_prompt: Base prompt to enhance
            target_format: Target detection format
            format_params: Optional format-specific parameters

        Returns:
            Enhanced prompt with format-specific optimizations
        """
        if not self._config.validate_format(target_format):
            raise ValueError(f"Unsupported target format: {target_format}")

        format_settings = self._config.get_format_settings(target_format)
        
        # Add format-specific syntax requirements
        syntax_guidelines = self._get_syntax_guidelines(target_format, format_settings)
        enhanced_prompt = f"{base_prompt}\n\n{syntax_guidelines}"

        # Add validation requirements
        validation_rules = self._get_validation_rules(target_format, format_settings)
        if validation_rules:
            enhanced_prompt = f"{enhanced_prompt}\n\nValidation Requirements:\n{validation_rules}"

        # Apply custom format parameters if provided
        if format_params:
            enhanced_prompt = self._apply_format_params(enhanced_prompt, format_params)

        logger.debug(
            "Customized prompt",
            extra={
                "target_format": target_format,
                "has_custom_params": bool(format_params)
            }
        )

        return enhanced_prompt

    def validate_formats(self, source_format: str, target_format: str) -> bool:
        """
        Validates source and target formats with detailed error reporting.

        Args:
            source_format: Source detection format
            target_format: Target detection format

        Returns:
            bool: Validation result
        """
        try:
            self._config.validate_format(source_format)
            self._config.validate_format(target_format)
            
            logger.debug(
                "Validated format combination",
                extra={
                    "source_format": source_format,
                    "target_format": target_format
                }
            )
            return True
        except ValueError as e:
            logger.error(
                "Format validation failed",
                extra={
                    "error": str(e),
                    "source_format": source_format,
                    "target_format": target_format
                }
            )
            return False

    def _get_format_guidelines(self, format_name: str, settings: Dict) -> str:
        """Generate format-specific guidelines based on settings."""
        guidelines = [f"Format-Specific Guidelines for {format_name.upper()}:"]
        
        if format_name == 'sigma':
            guidelines.extend([
                "- Use YAML format with proper indentation",
                "- Include required fields: title, description, status, level",
                "- Define logsource with product, service, and category"
            ])
        elif format_name == 'splunk':
            guidelines.extend([
                "- Maintain search command order and pipe structure",
                "- Use appropriate time functions and fields",
                "- Include necessary field extractions"
            ])
        # Add other format-specific guidelines...

        return "\n".join(guidelines)

    def _get_syntax_guidelines(self, format_name: str, settings: Dict) -> str:
        """Generate syntax guidelines for specific formats."""
        return f"Syntax Requirements for {format_name.upper()}:\n" + \
               self._format_templates.get(format_name, "")

    def _get_validation_rules(self, format_name: str, settings: Dict) -> str:
        """Generate format-specific validation rules."""
        validation_rules = []
        if settings.get('syntax_validation_level') == 'strict':
            validation_rules.append("- Strict syntax validation required")
        if settings.get('field_mapping_confidence'):
            validation_rules.append(f"- Field mapping confidence > {settings['field_mapping_confidence']}")
        
        return "\n".join(validation_rules)

    def _generate_field_mapping_instructions(
        self,
        source_format: str,
        target_format: str,
        mappings: Dict[str, str]
    ) -> str:
        """Generate field mapping instructions."""
        return f"Field Mappings from {source_format} to {target_format}:\n" + \
               "\n".join([f"- Map {src} to {dst}" for src, dst in mappings.items()])

    def _apply_format_params(self, prompt: str, params: Dict[str, Any]) -> str:
        """Apply format-specific parameters to the prompt."""
        template = self._template_env.from_string(prompt)
        return template.render(**params)