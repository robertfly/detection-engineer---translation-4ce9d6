"""
Test suite for PromptManager class validating prompt generation, format-specific customizations,
template handling, and error scenarios for security detection translations.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
from unittest.mock import Mock, patch  # python3.11+
from typing import Dict, Any

from ...translation_service.genai.prompts import PromptManager
from ...translation_service.config.genai import GenAIConfig

# Test data for various detection formats
SAMPLE_DETECTIONS = {
    'splunk': '''source="windows_logs" EventCode=4625 
                | stats count by src_ip, user 
                | where count > 5''',
    'sigma': '''title: Failed Login Attempts
                status: test
                logsource:
                  product: windows
                  service: security
                detection:
                  selection:
                    EventCode: 4625
                  condition: selection''',
    'qradar': '''SELECT sourceip, username, COUNT(*) 
                 FROM events 
                 WHERE eventname='Authentication Failed' 
                 GROUP BY sourceip, username 
                 HAVING COUNT(*) > 5''',
    'kql': '''SecurityEvent 
             | where EventID == 4625 
             | summarize count() by SourceIP, Account 
             | where count_ > 5''',
    'yara': '''rule suspicious_login_attempts {
                meta:
                    description = "Detect multiple failed login attempts"
                strings:
                    $event = "4625"
                condition:
                    $event and #event > 5
            }'''
}

@pytest.fixture
def mock_config() -> Mock:
    """Create a mock GenAIConfig instance with test settings."""
    config = Mock(spec=GenAIConfig)
    config.supported_formats = ['splunk', 'sigma', 'qradar', 'kql', 'yara', 'yaral']
    config.format_specific_settings = {
        'splunk': {'field_mapping_confidence': 0.95, 'syntax_validation_level': 'strict'},
        'sigma': {'yaml_validation': True, 'condition_complexity_limit': 5},
        'kql': {'time_window_handling': 'preserve', 'function_mapping_strict': True},
        'yara': {'string_extraction_confidence': 0.96, 'rule_complexity_limit': 4}
    }
    config.validate_format.return_value = True
    config.get_format_settings.return_value = {'field_mapping_confidence': 0.95}
    return config

@pytest.fixture
def prompt_manager(mock_config: Mock) -> PromptManager:
    """Create a PromptManager instance for testing."""
    return PromptManager(mock_config)

class TestPromptManager:
    """Test suite for PromptManager functionality."""

    def test_initialization(self, mock_config: Mock) -> None:
        """Test PromptManager initialization with configuration."""
        manager = PromptManager(mock_config)
        
        assert manager._config == mock_config
        assert manager._template_env is not None
        assert manager._format_templates is not None
        assert isinstance(manager._format_requirements, dict)

    @pytest.mark.parametrize('source_format,target_format,detection', [
        ('splunk', 'sigma', SAMPLE_DETECTIONS['splunk']),
        ('sigma', 'kql', SAMPLE_DETECTIONS['sigma']),
        ('qradar', 'splunk', SAMPLE_DETECTIONS['qradar']),
        ('kql', 'yara', SAMPLE_DETECTIONS['kql']),
        ('yara', 'sigma', SAMPLE_DETECTIONS['yara'])
    ])
    def test_generate_translation_prompt(
        self, 
        prompt_manager: PromptManager,
        source_format: str,
        target_format: str,
        detection: str
    ) -> None:
        """Test prompt generation for various format combinations."""
        prompt = prompt_manager.generate_translation_prompt(
            detection_text=detection,
            source_format=source_format,
            target_format=target_format
        )

        # Verify prompt structure and content
        assert source_format in prompt
        assert target_format in prompt
        assert detection in prompt
        assert "Format-Specific Guidelines" in prompt
        assert "Validation Requirements" in prompt

    def test_format_validation(self, prompt_manager: PromptManager) -> None:
        """Test format validation logic and error handling."""
        # Test valid format combination
        assert prompt_manager.validate_formats('splunk', 'sigma') is True

        # Test invalid source format
        with pytest.raises(ValueError) as exc_info:
            prompt_manager._config.validate_format.side_effect = ValueError("Invalid format")
            prompt_manager.validate_formats('invalid_format', 'sigma')
        assert "Invalid format" in str(exc_info.value)

        # Reset mock
        prompt_manager._config.validate_format.side_effect = None

    def test_customize_prompt(self, prompt_manager: PromptManager) -> None:
        """Test prompt customization with format-specific parameters."""
        base_prompt = "Translate the following detection"
        target_format = 'sigma'
        format_params = {
            'field_mappings': {'src_ip': 'source.ip', 'user': 'user.name'},
            'validation_level': 'strict'
        }

        customized_prompt = prompt_manager.customize_prompt(
            base_prompt=base_prompt,
            target_format=target_format,
            format_params=format_params
        )

        assert base_prompt in customized_prompt
        assert "Format-Specific Guidelines for SIGMA" in customized_prompt
        assert "Validation Requirements" in customized_prompt

    def test_field_mapping_instructions(self, prompt_manager: PromptManager) -> None:
        """Test generation of field mapping instructions."""
        detection = SAMPLE_DETECTIONS['splunk']
        mappings = {'src_ip': 'source.ip', 'user': 'user.name'}
        
        prompt = prompt_manager.generate_translation_prompt(
            detection_text=detection,
            source_format='splunk',
            target_format='sigma',
            additional_params={'field_mappings': mappings}
        )

        assert "Field Mappings" in prompt
        assert "source.ip" in prompt
        assert "user.name" in prompt

    def test_error_handling(self, prompt_manager: PromptManager) -> None:
        """Test error handling scenarios."""
        # Test with empty detection
        with pytest.raises(ValueError):
            prompt_manager.generate_translation_prompt(
                detection_text="",
                source_format='splunk',
                target_format='sigma'
            )

        # Test with invalid format combination
        prompt_manager._config.validate_format.side_effect = ValueError("Invalid format")
        with pytest.raises(ValueError) as exc_info:
            prompt_manager.generate_translation_prompt(
                detection_text=SAMPLE_DETECTIONS['splunk'],
                source_format='invalid',
                target_format='sigma'
            )
        assert "Invalid format" in str(exc_info.value)

    @pytest.mark.parametrize('format_name,settings', [
        ('sigma', {'yaml_validation': True}),
        ('splunk', {'syntax_validation_level': 'strict'}),
        ('kql', {'time_window_handling': 'preserve'}),
        ('yara', {'string_extraction_confidence': 0.96})
    ])
    def test_format_specific_guidelines(
        self,
        prompt_manager: PromptManager,
        format_name: str,
        settings: Dict[str, Any]
    ) -> None:
        """Test generation of format-specific guidelines."""
        prompt_manager._config.get_format_settings.return_value = settings
        guidelines = prompt_manager._get_format_guidelines(format_name, settings)
        
        assert format_name.upper() in guidelines
        assert "Guidelines" in guidelines
        
        if format_name == 'sigma':
            assert "YAML format" in guidelines
        elif format_name == 'splunk':
            assert "search command" in guidelines