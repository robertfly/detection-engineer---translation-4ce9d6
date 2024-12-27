"""
Unit tests for YARA-L format handler with comprehensive test coverage.

Tests parsing, generation, validation capabilities and field mappings for Chronicle YARA-L 
detection rules with proper test isolation and error handling.

Version: 1.0.0
"""

# External imports
import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1
from typing import Dict, Any

# Internal imports
from translation_service.formats.yaral import YARALFormat

# Test fixtures and sample data
SAMPLE_YARAL_RULE = """
rule windows_suspicious_process {
    meta:
        author = "Security Team"
        description = "Detects suspicious process creation"
        severity = "high"
        platform = "windows"
    strings:
        $cmd = "cmd.exe"
        $powershell = "powershell.exe"
    condition:
        process.name contains "cmd.exe" or
        process.name contains "powershell.exe" and
        process.command_line contains "-enc"
}
"""

INVALID_YARAL_RULE = """
rule invalid_syntax {
    meta:
        author = "Test"
    strings:
        $test = "test
    condition:
        invalid syntax
}
"""

COMPLEX_YARAL_RULE = """
rule network_lateral_movement {
    meta:
        author = "Security Team"
        description = "Detects potential lateral movement"
        mitre_attack = "T1021"
    strings:
        $admin_share = "\\\\admin$"
        $c_share = "\\\\c$"
    event:
        $e1 = network.protocol = "SMB"
        $e2 = process.name = "net.exe"
    condition:
        any of ($admin_share*, $c_share*) and
        any of ($e1, $e2)
}
"""

class TestYARALFormat:
    """Test suite for YARA-L format handler functionality."""

    @pytest.fixture(autouse=True)
    def setup_method(self) -> None:
        """Setup method run before each test to ensure isolation."""
        self._handler = YARALFormat()
        self._test_config = {
            "max_strings": 100,
            "max_condition_depth": 5,
            "support_imports": True
        }

    @pytest.mark.asyncio
    async def test_yaral_parse_valid_rule(self) -> None:
        """Test parsing of a valid YARA-L rule into common detection model."""
        try:
            # Parse sample rule
            detection_model = await self._handler.parse(SAMPLE_YARAL_RULE)

            # Verify basic structure
            assert isinstance(detection_model, dict)
            assert detection_model["type"] == "YARA-L"
            assert detection_model["name"] == "windows_suspicious_process"

            # Verify metadata
            assert detection_model["metadata"]["author"] == "Security Team"
            assert detection_model["metadata"]["description"] == "Detects suspicious process creation"
            assert detection_model["metadata"]["severity"] == "high"
            assert detection_model["metadata"]["platform"] == "windows"

            # Verify strings section
            assert len(detection_model["strings"]) == 2
            assert detection_model["strings"]["$cmd"] == "cmd.exe"
            assert detection_model["strings"]["$powershell"] == "powershell.exe"

            # Verify condition logic
            assert "process.name" in detection_model["condition"]
            assert "command_line" in detection_model["condition"]

        except Exception as e:
            pytest.fail(f"Test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_yaral_parse_complex_rule(self) -> None:
        """Test parsing of complex YARA-L rule with events and multiple conditions."""
        try:
            detection_model = await self._handler.parse(COMPLEX_YARAL_RULE)

            # Verify event parsing
            assert "events" in detection_model
            assert len(detection_model["events"]) == 2
            assert any("network.protocol" in event for event in detection_model["events"])
            assert any("process.name" in event for event in detection_model["events"])

            # Verify MITRE ATT&CK mapping
            assert detection_model["metadata"]["mitre_attack"] == "T1021"

            # Verify complex condition structure
            assert "any of" in detection_model["condition"]
            assert "$admin_share" in detection_model["strings"]
            assert "$c_share" in detection_model["strings"]

        except Exception as e:
            pytest.fail(f"Test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_yaral_generate_valid_rule(self) -> None:
        """Test generation of valid YARA-L rule from common detection model."""
        detection_model = {
            "type": "YARA-L",
            "name": "test_detection",
            "metadata": {
                "author": "Test Author",
                "description": "Test Description",
                "severity": "medium"
            },
            "strings": {
                "$test_string": "test pattern",
                "$test_regex": "/test.*/i"
            },
            "condition": "any of ($test_string*, $test_regex*)",
            "events": [
                "process.name contains 'test.exe'",
                "file.path contains '/tmp/'"
            ]
        }

        try:
            # Generate YARA-L rule
            generated_rule = await self._handler.generate(detection_model)

            # Verify rule structure
            assert "rule test_detection" in generated_rule
            assert "meta:" in generated_rule
            assert "strings:" in generated_rule
            assert "condition:" in generated_rule

            # Verify metadata formatting
            assert 'author = "Test Author"' in generated_rule
            assert 'description = "Test Description"' in generated_rule
            assert 'severity = "medium"' in generated_rule

            # Verify strings section
            assert '$test_string = "test pattern"' in generated_rule
            assert '$test_regex = /test.*/i' in generated_rule

            # Verify condition and events
            assert "any of ($test_string*, $test_regex*)" in generated_rule
            assert "process.name contains" in generated_rule
            assert "file.path contains" in generated_rule

        except Exception as e:
            pytest.fail(f"Test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_yaral_validate_rule(self) -> None:
        """Test validation of YARA-L rule syntax and structure."""
        try:
            # Test valid rule validation
            valid_result, valid_message, valid_metadata = await self._handler.validate(SAMPLE_YARAL_RULE)
            assert valid_result is True
            assert valid_message == ""
            assert "checks_performed" in valid_metadata
            assert "structure" in valid_metadata["checks_performed"]

            # Test invalid rule validation
            invalid_result, invalid_message, invalid_metadata = await self._handler.validate(INVALID_YARAL_RULE)
            assert invalid_result is False
            assert "error" in invalid_message.lower()
            assert len(invalid_metadata["warnings"]) > 0

        except Exception as e:
            pytest.fail(f"Test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_yaral_field_mappings(self) -> None:
        """Test field mapping translations between YARA-L and common detection model."""
        try:
            # Test process field mappings
            process_rule = """
            rule process_fields {
                condition:
                    process.name contains "test.exe" and
                    process.command_line contains "-test" and
                    process.id = 1234 and
                    process.path contains "/usr/bin/"
            }
            """
            process_model = await self._handler.parse(process_rule)
            assert "process.name" in process_model["condition"]
            assert "process.command_line" in process_model["condition"]
            assert "process.id" in process_model["condition"]
            assert "process.path" in process_model["condition"]

            # Test network field mappings
            network_rule = """
            rule network_fields {
                condition:
                    network.protocol = "TCP" and
                    network.destination.ip = "192.168.1.1" and
                    network.destination.port = 445
            }
            """
            network_model = await self._handler.parse(network_rule)
            assert "network.protocol" in network_model["condition"]
            assert "network.destination.ip" in network_model["condition"]
            assert "network.destination.port" in network_model["condition"]

            # Test file field mappings
            file_rule = """
            rule file_fields {
                condition:
                    file.path contains "/etc/passwd" and
                    file.name contains "config" and
                    file.hash.md5 = "d41d8cd98f00b204e9800998ecf8427e"
            }
            """
            file_model = await self._handler.parse(file_rule)
            assert "file.path" in file_model["condition"]
            assert "file.name" in file_model["condition"]
            assert "file.hash.md5" in file_model["condition"]

        except Exception as e:
            pytest.fail(f"Test failed: {str(e)}")

    @pytest.mark.asyncio
    async def test_yaral_error_handling(self) -> None:
        """Test error handling for various edge cases and invalid inputs."""
        try:
            # Test empty rule
            with pytest.raises(ValueError, match="Empty rule content"):
                await self._handler.validate("")

            # Test missing condition
            invalid_rule = """
            rule missing_condition {
                meta:
                    author = "Test"
            }
            """
            with pytest.raises(ValueError, match="Missing condition"):
                await self._handler.parse(invalid_rule)

            # Test invalid string format
            invalid_strings = """
            rule invalid_strings {
                strings:
                    invalid_string
                condition:
                    true
            }
            """
            with pytest.raises(ValueError):
                await self._handler.parse(invalid_strings)

        except Exception as e:
            pytest.fail(f"Test failed: {str(e)}")

    def teardown_method(self) -> None:
        """Cleanup method run after each test."""
        self._handler = None
        self._test_config = None