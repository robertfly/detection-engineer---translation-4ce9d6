"""
Unit tests for detection text embedding functionality.
Tests cover embedding generation, caching, similarity computation,
GPU utilization, thread safety, and error handling.

Version: 1.0.0
"""

import pytest  # version: 7.4.3
import numpy as np  # version: 1.24.0
from unittest.mock import Mock, patch  # version: python3.11+
from concurrent.futures import ThreadPoolExecutor  # version: python3.11+
import os
import shutil
from pathlib import Path

from translation_service.genai.embeddings import DetectionEmbedding
from ..conftest import mock_genai_config, sample_detection

class MockModel:
    """Mock embedding model with GPU support simulation."""
    
    def __init__(self, use_gpu: bool = True):
        self.use_gpu = use_gpu
        self.mock_embedding = np.random.rand(1, 768)
        self.calls = 0
        
    def to(self, device):
        """Simulate model device movement."""
        return self
        
    def encode(self, text: str, **kwargs) -> np.ndarray:
        """Mock encoding with GPU memory simulation."""
        self.calls += 1
        if self.use_gpu:
            # Simulate GPU memory allocation
            with patch('torch.cuda.memory_allocated') as mock_mem:
                mock_mem.return_value = 1024 * 1024  # 1MB
                return self.mock_embedding
        return self.mock_embedding

@pytest.mark.asyncio
async def test_detection_embedding_initialization(mock_genai_config):
    """Test DetectionEmbedding initialization with various configurations."""
    
    with patch('translation_service.genai.embeddings.AutoModel') as mock_auto_model, \
         patch('translation_service.genai.embeddings.AutoTokenizer') as mock_auto_tokenizer:
        
        # Test successful initialization
        mock_auto_model.from_pretrained.return_value = MockModel()
        mock_auto_tokenizer.from_pretrained.return_value = Mock()
        
        embedding = DetectionEmbedding(mock_genai_config)
        assert embedding._model is not None
        assert embedding._tokenizer is not None
        assert isinstance(embedding._cache_stats, dict)
        
        # Test GPU detection
        with patch('torch.cuda.is_available', return_value=True):
            embedding = DetectionEmbedding(mock_genai_config)
            assert str(embedding._device) == 'cuda'
        
        with patch('torch.cuda.is_available', return_value=False):
            embedding = DetectionEmbedding(mock_genai_config)
            assert str(embedding._device) == 'cpu'
        
        # Test initialization error handling
        mock_auto_model.from_pretrained.side_effect = Exception("Model load failed")
        with pytest.raises(RuntimeError) as exc_info:
            DetectionEmbedding(mock_genai_config)
        assert "Model load failed" in str(exc_info.value)

@pytest.mark.asyncio
async def test_generate_embedding(mock_genai_config, sample_detection):
    """Test embedding generation with GPU support and error handling."""
    
    with patch('translation_service.genai.embeddings.AutoModel') as mock_auto_model, \
         patch('translation_service.genai.embeddings.AutoTokenizer') as mock_auto_tokenizer:
        
        mock_model = MockModel()
        mock_auto_model.from_pretrained.return_value = mock_model
        mock_auto_tokenizer.from_pretrained.return_value = Mock()
        
        embedding = DetectionEmbedding(mock_genai_config)
        
        # Test successful embedding generation
        detection_text = sample_detection['content']
        result = embedding.generate_embedding(detection_text)
        
        assert isinstance(result, np.ndarray)
        assert result.shape == (768,)  # Standard embedding dimension
        assert np.all((result >= -1) & (result <= 1))  # Value range check
        
        # Test empty input handling
        with pytest.raises(ValueError):
            embedding.generate_embedding("")
        
        # Test GPU memory cleanup
        with patch('torch.cuda.empty_cache') as mock_empty_cache:
            embedding.generate_embedding(detection_text)
            mock_empty_cache.assert_called_once()
        
        # Test cache functionality
        first_result = embedding.generate_embedding(detection_text)
        second_result = embedding.generate_embedding(detection_text)
        assert np.array_equal(first_result, second_result)
        assert embedding._cache_stats['hits'] == 1
        
        # Test error handling during generation
        mock_model.encode.side_effect = Exception("Encoding failed")
        with pytest.raises(RuntimeError) as exc_info:
            embedding.generate_embedding(detection_text)
        assert "Encoding failed" in str(exc_info.value)

@pytest.mark.asyncio
async def test_compute_similarity(mock_genai_config):
    """Test similarity computation between detections."""
    
    with patch('translation_service.genai.embeddings.AutoModel') as mock_auto_model, \
         patch('translation_service.genai.embeddings.AutoTokenizer') as mock_auto_tokenizer:
        
        mock_model = MockModel()
        mock_auto_model.from_pretrained.return_value = mock_model
        mock_auto_tokenizer.from_pretrained.return_value = Mock()
        
        embedding = DetectionEmbedding(mock_genai_config)
        
        # Test identical text similarity
        text = "source=\"windows_logs\" EventCode=4625"
        similarity = embedding.compute_similarity(text, text)
        assert similarity == 1.0
        
        # Test different text similarity
        text1 = "source=\"windows_logs\" EventCode=4625"
        text2 = "SELECT * FROM events WHERE EventCode=4625"
        similarity = embedding.compute_similarity(text1, text2)
        assert 0.0 <= similarity <= 1.0
        
        # Test empty input handling
        with pytest.raises(ValueError):
            embedding.compute_similarity("", text1)
        
        with pytest.raises(ValueError):
            embedding.compute_similarity(text1, "")
        
        # Test error handling
        mock_model.encode.side_effect = Exception("Similarity computation failed")
        with pytest.raises(RuntimeError) as exc_info:
            embedding.compute_similarity(text1, text2)
        assert "Similarity computation failed" in str(exc_info.value)

@pytest.mark.asyncio
async def test_embedding_cache(mock_genai_config, sample_detection, tmp_path):
    """Test embedding cache functionality including thread safety."""
    
    cache_dir = tmp_path / "embedding_cache"
    mock_genai_config['embeddings_cache_dir'] = str(cache_dir)
    
    with patch('translation_service.genai.embeddings.AutoModel') as mock_auto_model, \
         patch('translation_service.genai.embeddings.AutoTokenizer') as mock_auto_tokenizer:
        
        mock_model = MockModel()
        mock_auto_model.from_pretrained.return_value = mock_model
        mock_auto_tokenizer.from_pretrained.return_value = Mock()
        
        embedding = DetectionEmbedding(mock_genai_config)
        detection_text = sample_detection['content']
        
        # Test cache directory creation
        assert cache_dir.exists()
        
        # Test cache file creation
        result = embedding.generate_embedding(detection_text)
        cache_files = list(cache_dir.glob("*.npy"))
        assert len(cache_files) == 1
        
        # Test cache hit
        cached_result = embedding.generate_embedding(detection_text)
        assert np.array_equal(result, cached_result)
        assert embedding._cache_stats['hits'] == 1
        
        # Test thread safety
        def concurrent_embedding():
            return embedding.generate_embedding(detection_text)
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(concurrent_embedding) for _ in range(10)]
            results = [f.result() for f in futures]
            
        # Verify all results are identical
        for r in results[1:]:
            assert np.array_equal(results[0], r)
        
        # Test cache invalidation
        embedding.clear_cache()
        assert embedding._cache_stats['hits'] == 0
        assert embedding._cache_stats['misses'] == 1
        
        # Test corrupt cache handling
        corrupt_file = cache_dir / "corrupt.npy"
        corrupt_file.write_bytes(b"corrupt data")
        with pytest.raises(RuntimeError):
            embedding.generate_embedding("corrupted cache test")
        
        # Test cache stats
        stats = embedding.get_cache_stats()
        assert isinstance(stats, dict)
        assert 'hits' in stats
        assert 'misses' in stats
        assert 'hit_rate' in stats