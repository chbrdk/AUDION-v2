from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
import structlog

from .core.config import get_settings
from .core.logging import configure_logging
from .core.telemetry import configure_tracing
from .db import Base, engine
from . import models  # noqa: F401
from .routers.health import router as health_router
from .routers.personas import router as personas_router
from .routers.chat import router as chat_rest_router
from .routers.voice import router as voice_router
from .routers.images import router as images_router
from .ws.chat import router as chat_ws_router

logger = structlog.get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/chat/message/stream"):
            # Log request info before parsing
            content_length = request.headers.get("content-length")
            logger.info("chat.request.received",
                       path=request.url.path,
                       method=request.method,
                       content_length=content_length,
                       content_type=request.headers.get("content-type"))
        
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error("chat.request.error",
                        error=str(e),
                        error_type=type(e).__name__)
            raise


def ensure_persona_profile_card_column() -> None:
    """Make sure the personas.profile_card column exists for legacy databases."""
    stmt = text("ALTER TABLE personas ADD COLUMN IF NOT EXISTS profile_card JSONB")
    with engine.connect() as connection:
        try:
            connection.execute(stmt)
            connection.commit()
        except Exception as exc:
            import structlog
            logger = structlog.get_logger(__name__)
            logger.warning("db.init.profile_card_column_failed", error=str(exc))


def create_app() -> FastAPI:
    configure_logging()
    configure_tracing()
    try:
        Base.metadata.create_all(bind=engine)
        ensure_persona_profile_card_column()
    except Exception as e:
        # Ignore errors if tables/types already exist
        import structlog
        logger = structlog.get_logger(__name__)
        logger.warning("db.init.skipped", error=str(e))

    app = FastAPI(
        title="Chat API",
        version="0.1.0",
        description="Real-time chat and persona service for Dynamic Persona Chat",
        docs_url="/docs",
        openapi_url="/openapi.json"
    )
    app.add_middleware(RequestLoggingMiddleware)
    settings = get_settings()
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] if settings.cors_origins else ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(personas_router)
    app.include_router(chat_rest_router)  # REST API for chat
    app.include_router(voice_router)  # Voice streaming API
    app.include_router(images_router)  # Image upload API
    app.include_router(chat_ws_router)  # WebSocket for chat

    return app


app = create_app()

