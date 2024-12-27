"""
Splunk SPL format handler for the Translation Service.

This module implements parsing and generation of Splunk Search Processing Language (SPL) 
detection rules with enhanced validation, error handling, and performance optimizations.

Version: 1.0.0
"""

from typing import Dict, List, Optional, Any, Tuple
import re
from pyparsing import (  # version: 3.1.1
    Word, alphas, alphanums, QuotedString, Forward, Group, 
    OneOrMore, ZeroOrMore, Suppress, Optional as OptionalParse,
    ParserElement, ParseException
)
from pydantic import dataclass, Field, validator  # version: 2.4.2
from cachetools import TTLCache  # version: 5.3.1

from ..utils.logger import get_logger

# Initialize logger with trace ID support
logger = get_logger(__name__)

# SPL syntax constants
SPL_KEYWORDS = [
    'search', 'where', 'eval', 'stats', 'table', 'rename', 'rex', 
    'join', 'sort', 'dedup', 'fields', 'transaction', 'lookup', 
    'append', 'collect'
]

SPL_OPERATORS = [
    '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE', 
    'MATCHES', 'CONTAINS', 'STARTSSWITH', 'ENDSWITH'
]

# Grammar cache with TTL for performance optimization
GRAMMAR_CACHE = TTLCache(maxsize=100, ttl=3600)

@dataclass
class SplunkDetection:
    """Pydantic model for Splunk SPL detection with enhanced validation."""
    
    search_terms: str = Field(..., description="Main search terms of the SPL query")
    field_extractions: Dict[str, str] = Field(default_factory=dict, description="Field extraction patterns")
    pipes: List[str] = Field(default_factory=list, description="SPL pipeline commands")
    metadata: Optional[Dict[str, str]] = Field(default=None, description="Additional detection metadata")
    confidence_score: float = Field(default=0.0, description="Translation confidence score")
    validation_errors: List[str] = Field(default_factory=list, description="Validation error messages")

    def validate_search(self) -> Tuple[bool, List[str]]:
        """
        Validates the SPL search syntax with enhanced error checking.
        
        Returns:
            Tuple containing validation result and list of validation errors
        """
        errors = []
        try:
            # Check for required search components
            if not self.search_terms:
                errors.append("Search terms cannot be empty")
            
            # Validate search term syntax
            search_pattern = re.compile(r'^(search\s+)?[\w\s\*\|\"\'\(\)\[\]\{\}\?\+\-\=\>\<\,\.]+$')
            if not search_pattern.match(self.search_terms):
                errors.append("Invalid search term syntax")
            
            # Validate pipe operations
            for pipe in self.pipes:
                if not any(pipe.strip().startswith(kw) for kw in SPL_KEYWORDS):
                    errors.append(f"Invalid pipe command: {pipe}")
            
            # Validate field extractions
            for field, pattern in self.field_extractions.items():
                try:
                    re.compile(pattern)
                except re.error:
                    errors.append(f"Invalid regex pattern for field {field}")
            
            # Calculate confidence score based on validation results
            self.confidence_score = 1.0 if not errors else 1.0 - (len(errors) * 0.1)
            self.validation_errors = errors
            
            return len(errors) == 0, errors
            
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            errors.append(f"Unexpected validation error: {str(e)}")
            self.confidence_score = 0.0
            self.validation_errors = errors
            return False, errors

class SplunkFormat:
    """Handler class for Splunk SPL format with performance optimization."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Splunk format handler with optimized configuration.
        
        Args:
            config: Optional configuration overrides
        """
        self._parser_config = config or {}
        self._cached_grammar = {}
        self._parse_cache = TTLCache(maxsize=1000, ttl=3600)
        
        # Initialize optimized SPL grammar
        self._init_grammar()
    
    def _init_grammar(self):
        """Initialize the SPL parsing grammar with caching."""
        try:
            if 'base_grammar' in GRAMMAR_CACHE:
                self._cached_grammar = GRAMMAR_CACHE['base_grammar']
                return
                
            # Define base grammar elements
            field = Word(alphas, alphanums + "_")
            value = QuotedString('"') | QuotedString("'") | Word(alphanums + "_-.*?")
            operator = Forward()
            for op in SPL_OPERATORS:
                operator |= Suppress(op)
            
            # Define search expression
            search_expr = Group(
                OptionalParse(Suppress("search")) +
                OneOrMore(
                    Group(field + operator + value) |
                    Word(alphanums + "_-.*?|()[]{}=><")
                )
            )
            
            # Define pipe commands
            pipe_command = Group(
                Suppress("|") +
                Word(alphas) +
                ZeroOrMore(
                    Group(field + operator + value) |
                    Word(alphanums + "_-.*?|()[]{}=><")
                )
            )
            
            # Complete SPL grammar
            spl_grammar = search_expr + ZeroOrMore(pipe_command)
            
            self._cached_grammar['search_expr'] = search_expr
            self._cached_grammar['pipe_command'] = pipe_command
            self._cached_grammar['spl_grammar'] = spl_grammar
            
            # Cache the grammar
            GRAMMAR_CACHE['base_grammar'] = self._cached_grammar
            
        except Exception as e:
            logger.error(f"Grammar initialization error: {str(e)}")
            raise
    
    def parse(self, detection_text: str, trace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse Splunk SPL detection into common model format with error handling.
        
        Args:
            detection_text: SPL detection text to parse
            trace_id: Optional trace ID for logging
            
        Returns:
            Common model representation with validation results
        """
        try:
            # Check parse cache
            cache_key = hash(detection_text)
            if cache_key in self._parse_cache:
                logger.debug("Returning cached parse result", extra={"trace_id": trace_id})
                return self._parse_cache[cache_key]
            
            # Parse SPL using cached grammar
            parsed = self._cached_grammar['spl_grammar'].parseString(detection_text)
            
            # Extract components
            search_terms = " ".join(str(t) for t in parsed[0])
            pipes = []
            field_extractions = {}
            
            # Process pipe commands
            for pipe in parsed[1:]:
                pipe_str = " ".join(str(t) for t in pipe)
                pipes.append(pipe_str)
                
                # Extract field patterns from rex commands
                if pipe[0] == "rex":
                    field_match = re.search(r'field=(\w+)\s+(?:"|\')(.+?)(?:"|\')', pipe_str)
                    if field_match:
                        field_extractions[field_match.group(1)] = field_match.group(2)
            
            # Create and validate detection model
            detection = SplunkDetection(
                search_terms=search_terms,
                field_extractions=field_extractions,
                pipes=pipes
            )
            is_valid, validation_errors = detection.validate_search()
            
            # Convert to common model
            common_model = {
                "type": "splunk",
                "search_terms": detection.search_terms,
                "field_extractions": detection.field_extractions,
                "pipes": detection.pipes,
                "confidence_score": detection.confidence_score,
                "validation_errors": validation_errors,
                "is_valid": is_valid
            }
            
            # Cache successful parse
            if is_valid:
                self._parse_cache[cache_key] = common_model
            
            return common_model
            
        except ParseException as pe:
            logger.error(f"SPL parse error: {str(pe)}", extra={"trace_id": trace_id})
            return {
                "type": "splunk",
                "is_valid": False,
                "validation_errors": [f"Parse error at position {pe.loc}: {str(pe)}"],
                "confidence_score": 0.0
            }
        except Exception as e:
            logger.error(f"Unexpected parsing error: {str(e)}", extra={"trace_id": trace_id})
            return {
                "type": "splunk",
                "is_valid": False,
                "validation_errors": [f"Unexpected error: {str(e)}"],
                "confidence_score": 0.0
            }
    
    def generate(self, common_model: Dict[str, Any], trace_id: Optional[str] = None) -> str:
        """
        Generate Splunk SPL from common model format with validation.
        
        Args:
            common_model: Common model representation
            trace_id: Optional trace ID for logging
            
        Returns:
            Generated Splunk SPL detection
        """
        try:
            # Validate common model
            if not common_model.get("search_terms"):
                raise ValueError("Missing required search terms")
            
            # Build SPL components
            components = []
            
            # Add search command if not present
            search_terms = common_model["search_terms"]
            if not search_terms.strip().lower().startswith("search "):
                search_terms = f"search {search_terms}"
            components.append(search_terms)
            
            # Add field extractions
            for field, pattern in common_model.get("field_extractions", {}).items():
                components.append(f'| rex field={field} "{pattern}"')
            
            # Add additional pipes
            for pipe in common_model.get("pipes", []):
                if not pipe.strip().startswith("|"):
                    pipe = f"| {pipe}"
                components.append(pipe)
            
            # Join components
            spl_detection = " ".join(components)
            
            # Validate generated SPL
            detection = SplunkDetection(
                search_terms=search_terms,
                field_extractions=common_model.get("field_extractions", {}),
                pipes=common_model.get("pipes", [])
            )
            is_valid, validation_errors = detection.validate_search()
            
            if not is_valid:
                logger.warning(
                    "Generated invalid SPL detection",
                    extra={
                        "trace_id": trace_id,
                        "validation_errors": validation_errors
                    }
                )
            
            return spl_detection
            
        except Exception as e:
            logger.error(f"SPL generation error: {str(e)}", extra={"trace_id": trace_id})
            raise ValueError(f"Failed to generate SPL: {str(e)}")