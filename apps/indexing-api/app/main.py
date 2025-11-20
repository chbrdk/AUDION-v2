from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.logging import configure_logging
from .core.telemetry import configure_tracing
from .db import Base, engine
from . import models  # noqa: F401
from .routers.documents import router as documents_router
from .routers.health import router as health_router


def create_app() -> FastAPI:
    configure_logging()
    configure_tracing()
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        # Ignore errors if tables/types already exist
        import structlog
        logger = structlog.get_logger(__name__)
        logger.warning("db.init.skipped", error=str(e))

    app = FastAPI(
        title="Indexing API",
        version="0.1.0",
        description="Document upload and processing service for Dynamic Persona Chat",
        docs_url="/docs",
        openapi_url="/openapi.json"
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(documents_router)

    return app


app = create_app()

