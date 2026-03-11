"""
Map backend exceptions to HTTP status and detail for consistent API error responses.
Use in top-level except blocks; do not expose sensitive internals in detail.
"""
from __future__ import annotations

import asyncio

from fastapi import HTTPException

try:
    from pydantic import ValidationError as PydanticValidationError
except ImportError:
    PydanticValidationError = None  # type: ignore[misc, assignment]

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]


def exception_to_http(exc: BaseException, context: str = "Request") -> HTTPException:
    """
    Map known exception types to appropriate HTTP status and detail.
    Returns HTTPException; raise it in the caller.
    """
    if isinstance(exc, HTTPException):
        return exc

    detail = str(exc) or "An error occurred"
    if len(detail) > 200:
        detail = detail[:197] + "..."

    if PydanticValidationError is not None and isinstance(exc, PydanticValidationError):
        errors = getattr(exc, "errors", None)
        msg = detail
        if errors:
            msg = "Validation error: " + "; ".join(
                f"{e.get('loc', ())}: {e.get('msg', '')}" for e in errors[:3]
            )
        return HTTPException(status_code=422, detail=msg)

    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return HTTPException(
            status_code=504,
            detail=f"{context} timed out. Please try again.",
        )

    if httpx is not None and isinstance(exc, httpx.HTTPStatusError):
        status = getattr(exc, "response", None)
        if status is not None:
            code = getattr(status, "status_code", 502)
            if code >= 500:
                return HTTPException(
                    status_code=502,
                    detail=f"Upstream service error ({code}). Please try again.",
                )
            if code == 429:
                return HTTPException(
                    status_code=503,
                    detail="Service temporarily unavailable (rate limit). Please try again later.",
                )
        return HTTPException(status_code=502, detail="Upstream request failed.")

    return HTTPException(
        status_code=500,
        detail=f"{context} failed. Please try again.",
    )
