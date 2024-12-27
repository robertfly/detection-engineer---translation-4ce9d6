"""
Comprehensive test suite for QRadar format handler.

This module provides extensive test coverage for QRadar AQL query parsing,
generation, validation and error handling capabilities.

Version: 1.0.0
"""

# External imports
import pytest  # version: 7.4.3
import pytest_asyncio  # version: 0.21.1
from typing import Dict, Any

# Internal imports
from translation_service.formats.qradar import QRadarFormat

class TestQRadarFormat:
    """Comprehensive test suite for QRadar format translation functionality."""

    def setup_method(self, method):
        """Initialize test environment before each test method."""
        self.format_handler = QRadarFormat()
        
        # Test queries covering various AQL patterns
        self.test_queries = {
            'basic_select': 'SELECT sourceip, destinationip FROM events',
            'with_where': 'SELECT sourceip FROM events WHERE username = "admin"',
            'with_group': 'SELECT COUNT(*) FROM events GROUP BY sourceip',
            'complex': '''
                SELECT sourceip, destinationip, COUNT(*) as event_count 
                FROM events 
                WHERE devicetype = 123 
                AND username = 'system' 
                GROUP BY sourceip, destinationip
                HAVING COUNT(*) > 5
            ''',
            'invalid_syntax': 'SELEC sourceip FRUM events',
            'invalid_field': 'SELECT invalid_field FROM events',
            'malformed': 'SELECT sourceip FROM events WHERE',
        }

        # Test detection models
        self.test_models = {
            'basic': {
                'type': 'qradar',
                'version': '1.0',
                'fields': ['sourceip', 'destinationip'],
                'tables': ['events'],
                'conditions': [],
                'metadata': {'original_query': ''}
            },
            'complex': {
                'type': 'qradar',
                'version': '1.0',
                'fields': ['sourceip', 'username', 'COUNT(*)'],
                'tables': ['events'],
                'conditions': [
                    {'field': 'devicetype', 'operator': '=', 'value': 123}
                ],
                'metadata': {'original_query': ''}
            }
        }

    def teardown_method(self, method):
        """Clean up test environment after each test method."""
        self.format_handler = None
        self.test_queries = None
        self.test_models = None

    @pytest.mark.asyncio
    async def test_qradar_parse_valid_query(self):
        """Test parsing of valid QRadar AQL queries."""
        # Test basic SELECT parsing
        result = self.format_handler.parse(self.test_queries['basic_select'])
        assert result['type'] == 'qradar'
        assert 'sourceip' in result['fields']
        assert 'destinationip' in result['fields']
        assert result['tables'] == ['events']

        # Test WHERE clause parsing
        result = self.format_handler.parse(self.test_queries['with_where'])
        assert len(result['conditions']) == 1
        assert result['conditions'][0]['field'] == 'username'
        assert result['conditions'][0]['value'] == 'admin'

        # Test GROUP BY parsing
        result = self.format_handler.parse(self.test_queries['with_group'])
        assert 'COUNT(*)' in result['fields']
        assert 'sourceip' in result.get('group_by', [])

        # Test complex query parsing
        result = self.format_handler.parse(self.test_queries['complex'])
        assert len(result['fields']) == 3
        assert len(result['conditions']) == 2
        assert 'group_by' in result
        assert 'having' in result

    @pytest.mark.asyncio
    async def test_qradar_parse_invalid_query(self):
        """Test error handling for invalid QRadar AQL queries."""
        # Test syntax error handling
        with pytest.raises(ValueError) as exc_info:
            self.format_handler.parse(self.test_queries['invalid_syntax'])
        assert "syntax error" in str(exc_info.value).lower()

        # Test invalid field handling
        with pytest.raises(ValueError) as exc_info:
            self.format_handler.parse(self.test_queries['invalid_field'])
        assert "invalid field" in str(exc_info.value).lower()

        # Test malformed query handling
        with pytest.raises(ValueError) as exc_info:
            self.format_handler.parse(self.test_queries['malformed'])
        assert "malformed query" in str(exc_info.value).lower()

        # Test empty query handling
        with pytest.raises(ValueError) as exc_info:
            self.format_handler.parse("")
        assert "empty query" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_qradar_generate_valid_model(self):
        """Test generation of QRadar AQL queries from detection models."""
        # Test basic query generation
        result = self.format_handler.generate(self.test_models['basic'])
        assert "SELECT" in result
        assert "sourceip" in result
        assert "destinationip" in result
        assert "FROM events" in result

        # Test complex query generation
        result = self.format_handler.generate(self.test_models['complex'])
        assert "SELECT" in result
        assert "sourceip" in result
        assert "username" in result
        assert "COUNT(*)" in result
        assert "WHERE devicetype = 123" in result

        # Test query optimization
        result = self.format_handler.generate(self.test_models['basic'], optimize=True)
        assert result.count(" ") <= self.format_handler.generate(
            self.test_models['basic'], optimize=False).count(" ")

    def test_qradar_validate_query(self):
        """Test QRadar AQL query validation functionality."""
        # Test valid query validation
        is_valid, error, report = self.format_handler.validate(
            self.test_queries['basic_select'])
        assert is_valid
        assert not error
        assert report['syntax_valid']
        assert report['semantic_valid']

        # Test invalid syntax validation
        is_valid, error, report = self.format_handler.validate(
            self.test_queries['invalid_syntax'])
        assert not is_valid
        assert error
        assert not report['syntax_valid']

        # Test performance validation
        is_valid, error, report = self.format_handler.validate(
            self.test_queries['complex'], strict_mode=True)
        assert 'performance_valid' in report

        # Test security validation
        malicious_query = "SELECT * FROM events; DROP TABLE events;"
        is_valid, error, report = self.format_handler.validate(malicious_query)
        assert not is_valid
        assert "security violation" in error.lower()

    @pytest.mark.asyncio
    async def test_qradar_field_mapping(self):
        """Test QRadar field mapping accuracy."""
        # Test standard field mapping
        query = "SELECT sourceip as src_ip FROM events"
        result = self.format_handler.parse(query)
        assert result['fields'][0] == 'sourceip'
        assert 'field_mappings' in result['metadata']
        assert result['metadata']['field_mappings']['sourceip'] == 'src_ip'

        # Test multiple field mappings
        query = "SELECT sourceip as src_ip, destinationip as dst_ip FROM events"
        result = self.format_handler.parse(query)
        assert len(result['metadata']['field_mappings']) == 2

    @pytest.mark.asyncio
    async def test_qradar_function_translation(self):
        """Test QRadar function translation accuracy."""
        # Test COUNT function
        query = "SELECT COUNT(*) as event_count FROM events"
        result = self.format_handler.parse(query)
        assert 'COUNT(*)' in result['fields']

        # Test multiple functions
        query = "SELECT COUNT(*), AVG(eventid) FROM events"
        result = self.format_handler.parse(query)
        assert 'COUNT(*)' in result['fields']
        assert 'AVG(eventid)' in result['fields']

    def test_qradar_error_handling(self):
        """Test comprehensive error handling scenarios."""
        # Test null input handling
        with pytest.raises(ValueError) as exc_info:
            self.format_handler.parse(None)
        assert "null input" in str(exc_info.value).lower()

        # Test invalid model handling
        with pytest.raises(ValueError) as exc_info:
            self.format_handler.generate({'invalid': 'model'})
        assert "invalid model" in str(exc_info.value).lower()

        # Test validation error details
        is_valid, error, report = self.format_handler.validate(
            "SELECT invalid_function() FROM events")
        assert not is_valid
        assert "invalid function" in error.lower()
        assert len(report['errors']) > 0