"""
Translation Service API Module Initialization

This module initializes and configures the FastAPI application with comprehensive security,
monitoring, and error handling capabilities for the Translation Service.

Version: 1.0.0
"""

from fastapi import FastAPI, Request, HTTPException  # version: 0.104.0
from fastapi.middleware.cors import CORSMiddleware  # version: 0.104.0
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator  # version: 6.1.0
from starlette.middleware.base import BaseHTTPMiddleware  # version: 0.27.0
import time
import uuid
from typing import Dict, Any, Optional

from .routes import router
from ..utils.logger import get_logger
from ..utils.metrics import MetricsManager, TRANSLATION_COUNTER
from ..config.metrics import get_metrics_config

# Initialize logger
logger = get_logger(__name__)

# API version and configuration
API_VERSION = 'v1'
ALLOWED_ORIGINS = ['*']  # Configure appropriately for production
MAX_REQUESTS_PER_MINUTE = 100

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with token bucket algorithm."""
    
    def __init__(self, app, max_requests: int = MAX_REQUESTS_PER_MINUTE):
        super().__init__(app)
        self._requests = {}
        self._max_requests = max_requests
        self._window = 60  # 1 minute window

    async def dispatch(self, request: Request, call_next):
        # Get client identifier (IP or token)
        client_id = request.client.host
        
        # Check rate limit
        current_time = time.time()
        if client_id in self._requests:
            requests = [ts for ts in self._requests[client_id] 
                       if current_time - ts < self._window]
            if len(requests) >= self._max_requests:
                logger.warning(f"Rate limit exceeded for client: {client_id}")
                return JSONResponse(
                    status_code=429,
                    content={"error": "Rate limit exceeded. Please try again later."}
                )
            self._requests[client_id] = requests
        else:
            self._requests[client_id] = []
            
        self._requests[client_id].append(current_time)
        return await call_next(request)

class RequestTracingMiddleware(BaseHTTPMiddleware):
    """Middleware for request tracing and correlation IDs."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or get trace ID
        trace_id = request.headers.get('X-Trace-ID', str(uuid.uuid4()))
        
        # Add trace ID to request state
        request.state.trace_id = trace_id
        
        # Add trace ID to response headers
        response = await call_next(request)
        response.headers['X-Trace-ID'] = trace_id
        
        return response

def init_api(translation_service: Any, config: Optional[Dict[str, Any]] = None) -> FastAPI:
    """
    Initialize and configure the FastAPI application with comprehensive security and monitoring.

    Args:
        translation_service: Translation service instance
        config: Optional API configuration parameters

    Returns:
        FastAPI: Configured FastAPI application instance
    """
    # Create FastAPI instance
    app = FastAPI(
        title="Detection Translation Service",
        description="Enterprise-grade security detection translation service",
        version=API_VERSION,
        docs_url=f"/api/{API_VERSION}/docs",
        redoc_url=f"/api/{API_VERSION}/redoc"
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add request tracing middleware
    app.add_middleware(RequestTracingMiddleware)

    # Add rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=MAX_REQUESTS_PER_MINUTE
    )

    # Initialize metrics
    metrics_config = get_metrics_config()
    if metrics_config.enabled:
        Instrumentator().instrument(app).expose(metrics_config.path)
        metrics_manager = MetricsManager(metrics_config)
        metrics_manager.start()

    # Configure error handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.error(
            f"HTTP error occurred",
            extra={
                'status_code': exc.status_code,
                'detail': exc.detail,
                'path': request.url.path,
                'trace_id': getattr(request.state, 'trace_id', None)
            }
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail,
                "trace_id": getattr(request.state, 'trace_id', None)
            }
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled error occurred",
            extra={
                'error': str(exc),
                'path': request.url.path,
                'trace_id': getattr(request.state, 'trace_id', None)
            }
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "trace_id": getattr(request.state, 'trace_id', None)
            }
        )

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """
        Health check endpoint with dependency status.

        Returns:
            Dict containing service health status
        """
        try:
            return {
                "status": "healthy",
                "version": API_VERSION,
                "timestamp": int(time.time()),
                "metrics_enabled": metrics_config.enabled
            }
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Service unhealthy"
            )

    # Include API router with version prefix
    app.include_router(
        router,
        prefix=f"/api/{API_VERSION}",
        tags=["translation"]
    )

    logger.info(
        f"API initialized successfully",
        extra={
            'version': API_VERSION,
            'metrics_enabled': metrics_config.enabled
        }
    )

    return app