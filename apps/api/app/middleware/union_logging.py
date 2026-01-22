"""UNION Request Logging Middleware for AUDION"""
import time
import logging
import asyncio
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..services.union_client import union_client

logger = logging.getLogger(__name__)


class UnionLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests to UNION."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.app = app
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log it to UNION."""
        start_time = time.time()
        
        # Skip logging for health checks and static assets
        if request.url.path in ["/health", "/favicon.ico", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Extract request info
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Read request body for POST/PUT/PATCH requests (max 50KB)
        request_body = None
        body_size = 0
        MAX_BODY_SIZE = 50 * 1024  # 50KB limit
        
        if method in ["POST", "PUT", "PATCH"]:
            try:
                # Read body
                body_bytes = await request.body()
                body_size = len(body_bytes)
                
                if body_size > 0 and body_size <= MAX_BODY_SIZE:
                    # Try to parse as JSON
                    try:
                        import json
                        request_body = json.loads(body_bytes.decode('utf-8'))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        # If not JSON, store as string (truncated if too long)
                        request_body = body_bytes.decode('utf-8', errors='replace')[:1000]
                
                # Restore body for handler
                async def receive():
                    return {"type": "http.request", "body": body_bytes}
                
                request._receive = receive
            except Exception as e:
                logger.warning(f"Failed to read request body: {e}")
                request_body = None
        
        # Process request
        try:
            response = await call_next(request)
            status_code = response.status_code
            error = None
        except Exception as e:
            status_code = 500
            error = str(e)
            logger.error(f"Request failed: {method} {path} - {e}", exc_info=True)
            raise
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Log to UNION (fire and forget)
        try:
            await union_client.log_api_request(
                method=method,
                path=path,
                status_code=status_code,
                latency_ms=latency_ms,
                request_body=request_body,
                client_ip=client_ip,
                user_agent=user_agent,
                metadata={
                    "query_params": dict(request.query_params),
                    "error": error,
                    "request_body_size": body_size,
                    "request_body_truncated": body_size > MAX_BODY_SIZE if body_size > 0 else False,
                },
            )
        except Exception as e:
            # Don't fail the request if logging fails
            logger.warning(f"Failed to log request to UNION: {e}")
        
        return response

