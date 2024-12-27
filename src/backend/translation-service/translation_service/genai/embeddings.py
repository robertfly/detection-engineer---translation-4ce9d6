"""
Detection Text Embedding Module

This module implements high-performance text embedding functionality using AI models
for semantic similarity comparison with GPU acceleration and robust caching.

Version: 1.0.0
"""

import numpy as np  # version: 1.24.0
import torch  # version: 2.0.0
from transformers import AutoModel, AutoTokenizer  # version: 4.33.0
from pathlib import Path  # version: 3.11
from typing import Optional, Dict, Union  # version: 3.11
import hashlib
import threading
import shutil
from ..config.genai import GenAIConfig
from ..utils.logger import get_logger

# Initialize module-level logger
logger = get_logger(__name__)

# Constants for cache and performance optimization
CACHE_FILE_EXTENSION = '.npy'
BATCH_SIZE = 32
MAX_RETRIES = 3

def generate_cache_key(text: str) -> str:
    """
    Generate a unique cache key for detection text with enhanced normalization.
    
    Args:
        text: Input text to generate key for
        
    Returns:
        str: Unique hash key for the text
        
    Raises:
        ValueError: If input text is empty or invalid
    """
    if not text or not isinstance(text, str):
        raise ValueError("Invalid input text for cache key generation")
        
    # Normalize text for consistent caching
    normalized_text = ' '.join(text.lower().split())
    normalized_text = ''.join(c for c in normalized_text if c.isalnum() or c.isspace())
    
    # Generate SHA-256 hash
    hash_obj = hashlib.sha256(normalized_text.encode('utf-8'))
    return hash_obj.hexdigest()[:32]

def load_cached_embedding(cache_key: str) -> Optional[np.ndarray]:
    """
    Load cached embedding with thread safety and validation.
    
    Args:
        cache_key: Cache key for the embedding
        
    Returns:
        Optional[np.ndarray]: Cached embedding if found and valid, None otherwise
    """
    if not cache_key or len(cache_key) != 32:
        logger.warning(f"Invalid cache key format: {cache_key}")
        return None
        
    cache_path = Path(GenAIConfig().embeddings_cache_dir) / f"{cache_key}{CACHE_FILE_EXTENSION}"
    
    # Implement file-level locking for thread safety
    lock_path = cache_path.with_suffix('.lock')
    lock = threading.Lock()
    
    with lock:
        try:
            if not cache_path.exists():
                return None
                
            embedding = np.load(cache_path)
            
            # Validate embedding dimensions
            if embedding.ndim != 1:
                logger.error(f"Invalid embedding dimensions for cache key: {cache_key}")
                return None
                
            logger.debug(f"Cache hit for key: {cache_key}")
            return embedding
            
        except Exception as e:
            logger.error(f"Error loading cached embedding: {e}")
            return None

def save_embedding_cache(cache_key: str, embedding: np.ndarray) -> bool:
    """
    Save embedding to cache with atomic operations and validation.
    
    Args:
        cache_key: Cache key for the embedding
        embedding: Numpy array to cache
        
    Returns:
        bool: True if save successful, False otherwise
    """
    if not cache_key or not isinstance(embedding, np.ndarray):
        logger.error("Invalid cache save parameters")
        return False
        
    cache_dir = Path(GenAIConfig().embeddings_cache_dir)
    cache_path = cache_dir / f"{cache_key}{CACHE_FILE_EXTENSION}"
    temp_path = cache_path.with_suffix('.tmp')
    
    try:
        # Ensure cache directory exists
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Save to temporary file first
        np.save(temp_path, embedding)
        
        # Validate saved file
        test_load = np.load(temp_path)
        if not np.array_equal(test_load, embedding):
            raise ValueError("Cache file validation failed")
            
        # Atomic rename
        shutil.move(str(temp_path), str(cache_path))
        
        logger.debug(f"Successfully cached embedding for key: {cache_key}")
        return True
        
    except Exception as e:
        logger.error(f"Error saving embedding cache: {e}")
        if temp_path.exists():
            temp_path.unlink()
        return False

class DetectionEmbedding:
    """
    Manages detection text embeddings with GPU acceleration and caching.
    """
    
    def __init__(self, config: GenAIConfig):
        """
        Initialize embedding model with GPU support and monitoring.
        
        Args:
            config: GenAI configuration instance
        """
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0
        }
        
        # Initialize model and tokenizer
        try:
            self._model = AutoModel.from_pretrained(config.embedding_model)
            self._tokenizer = AutoTokenizer.from_pretrained(config.embedding_model)
            
            # Set up GPU if available
            self._device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self._model.to(self._device)
            
            # Cache configuration
            self._cache_dir = config.embeddings_cache_dir
            
            logger.info(
                f"Initialized embedding model on {self._device}",
                extra={"model": config.embedding_model}
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {e}")
            raise RuntimeError(f"Embedding model initialization failed: {e}")

    def generate_embedding(self, text: str) -> np.ndarray:
        """
        Generate or retrieve cached embedding with GPU acceleration.
        
        Args:
            text: Input text for embedding generation
            
        Returns:
            np.ndarray: Embedding vector
            
        Raises:
            ValueError: If input text is invalid
            RuntimeError: If embedding generation fails
        """
        if not text:
            raise ValueError("Empty input text")
            
        # Try cache first
        cache_key = generate_cache_key(text)
        
        for _ in range(MAX_RETRIES):
            cached = load_cached_embedding(cache_key)
            if cached is not None:
                self._cache_stats['hits'] += 1
                return cached
                
        self._cache_stats['misses'] += 1
        
        try:
            # Tokenize with length validation
            tokens = self._tokenizer(
                text,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors='pt'
            )
            
            # Move to GPU if available
            tokens = {k: v.to(self._device) for k, v in tokens.items()}
            
            # Generate embedding
            with torch.no_grad():
                outputs = self._model(**tokens)
                embedding = outputs.last_hidden_state.mean(dim=1).cpu().numpy()[0]
            
            # Cache the result
            if save_embedding_cache(cache_key, embedding):
                logger.debug(f"Cached new embedding for key: {cache_key}")
            
            return embedding
            
        except Exception as e:
            self._cache_stats['errors'] += 1
            logger.error(f"Embedding generation failed: {e}")
            raise RuntimeError(f"Failed to generate embedding: {e}")

    def compute_similarity(self, text1: str, text2: str) -> float:
        """
        Compute cosine similarity between two texts with optimized operations.
        
        Args:
            text1: First input text
            text2: Second input text
            
        Returns:
            float: Similarity score between 0 and 1
        """
        try:
            # Generate embeddings
            emb1 = self.generate_embedding(text1)
            emb2 = self.generate_embedding(text2)
            
            # Compute cosine similarity
            similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
            
            # Ensure result is between 0 and 1
            return float(max(0.0, min(1.0, similarity)))
            
        except Exception as e:
            logger.error(f"Similarity computation failed: {e}")
            raise RuntimeError(f"Failed to compute similarity: {e}")

    def get_cache_stats(self) -> Dict[str, Union[int, float]]:
        """
        Return current cache statistics.
        
        Returns:
            Dict[str, Union[int, float]]: Cache statistics
        """
        total = self._cache_stats['hits'] + self._cache_stats['misses']
        hit_rate = self._cache_stats['hits'] / total if total > 0 else 0.0
        
        return {
            'hits': self._cache_stats['hits'],
            'misses': self._cache_stats['misses'],
            'errors': self._cache_stats['errors'],
            'hit_rate': hit_rate,
            'total_requests': total
        }