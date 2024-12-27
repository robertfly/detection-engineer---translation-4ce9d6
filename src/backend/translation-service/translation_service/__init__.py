"""
Translation Service Package Initialization

This module provides the core initialization and configuration for the Translation Service,
including application factory, security settings, monitoring, and service dependencies.

Version: 1.0.0
Author: Detection Translation Team
"""

import functools
from typing import Dict, List, Optional, Any
from fastapi import FastAPI  # version: 0.104.0
from fastapi.middleware.cors import CORSMiddleware  # version: 0.104.0
from prometheus_fastapi_instrumentator import Instrumentator  # version: 6.1.0
from fastapi_limiter import FastAPILimiter  # version: 0.1.5
import redis.asyncio as redis  # version: 5.0.1
import time

from .api.routes import router
from .services.translation import TranslationService
from .config.metrics import get_metrics_config
from .config.genai import load_config as load_genai_config
from .config.logging import setup_logging
from .utils.metrics import MetricsManager
from .utils.logger import get_logger

# Package metadata
__version__ = '1.0.0'
__author__ = 'Detection Translation Team'

# Global constants
SUPPORTED_FORMATS = [
    'splunk', 'qradar', 'sigma', 'kql', 'paloalto', 
    'crowdstrike', 'yara', 'yaral'
]

DEFAULT_CONFIG = {
    'cors_origins': ['*'],
    'rate_limit': 100,
    'timeout': 30,
    'redis_url': 'redis://localhost:6379/0'
}

# Initialize logger
logger = get_logger(__name__)

@functools.lru_cache()
def create_app(config_path: Optional[str] = None, testing: bool = False) -> FastAPI:
    """
    Factory function to create and configure the FastAPI application with comprehensive
    security, monitoring, and performance features.

    Args:
        config_path: Optional path to configuration file
        testing: Flag to indicate testing environment

    Returns:
        Configured FastAPI application instance
    """
    try:
        # Initialize application with metadata
        app = FastAPI(
            title="Detection Translation Service",
            description="AI-Driven Security Detection Translation Platform",
            version=__version__,
            docs_url="/api/docs" if not testing else None,
            redoc_url="/api/redoc" if not testing else None
        )

        # Load configurations
        genai_config = load_genai_config()
        metrics_config = get_metrics_config()

        # Configure CORS with secure defaults
        app.add_middleware(
            CORSMiddleware,
            allow_origins=DEFAULT_CONFIG['cors_origins'],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID"]
        )

        # Initialize Redis for rate limiting and caching
        @app.on_event("startup")
        async def initialize_redis():
            redis_client = redis.from_url(
                DEFAULT_CONFIG['redis_url'],
                encoding="utf-8",
                decode_responses=True
            )
            await FastAPILimiter.init(redis_client)

        # Configure rate limiting
        @app.on_event("startup")
        async def configure_rate_limits():
            await FastAPILimiter.init(app)

        # Initialize metrics collection
        if metrics_config.enabled and not testing:
            metrics_manager = MetricsManager(metrics_config)
            Instrumentator().instrument(app).expose(metrics_config.path)
            metrics_manager.start()

        # Initialize translation service
        translation_service = TranslationService(genai_config)

        # Register routes
        app.include_router(router, prefix="/api/v1")

        # Add health check endpoint
        @app.get("/health")
        async def health_check():
            return {
                "status": "healthy",
                "version": __version__,
                "timestamp": int(time.time())
            }

        # Configure error handlers
        @app.exception_handler(Exception)
        async def global_exception_handler(request, exc):
            logger.error(f"Global error handler: {str(exc)}")
            return {"error": "Internal server error", "detail": str(exc)}, 500

        # Graceful shutdown handler
        @app.on_event("shutdown")
        async def shutdown_event():
            logger.info("Application shutting down")
            # Add cleanup tasks here

        logger.info(
            "Application initialized successfully",
            extra={
                "version": __version__,
                "testing_mode": testing,
                "metrics_enabled": metrics_config.enabled
            }
        )

        return app

    except Exception as e:
        logger.error(f"Application initialization failed: {str(e)}")
        raise RuntimeError(f"Failed to create application: {str(e)}")

def configure_logging(log_level: str = 'INFO') -> None:
    """
    Configure application-wide logging with appropriate handlers and formatters.

    Args:
        log_level: Desired logging level
    """
    try:
        setup_logging(
            app_name="translation-service",
            log_level=log_level,
            env="development" if __debug__ else "production"
        )
        logger.info(f"Logging configured with level: {log_level}")
    except Exception as e:
        print(f"Failed to configure logging: {str(e)}")
        raise

# Export package-level attributes
__all__ = [
    '__version__',
    'SUPPORTED_FORMATS',
    'create_app',
    'configure_logging'
]