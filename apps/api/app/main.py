from __future__ import annotations

import asyncio

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.logging import configure_logging
from .core.telemetry import configure_tracing
from .db import Base, engine
from . import models  # noqa: F401
from .routers.documents import router as documents_router
from .routers.personas import router as personas_router
from .routers.target_groups import router as target_groups_router
from .routers.queue import router as queue_router
from .ws.chat import router as chat_router
from .services.job_processor import background_job_processor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup: Start background job processor
    task = asyncio.create_task(background_job_processor(interval_seconds=30))
    yield
    # Shutdown: Cancel background task
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    configure_logging()
    configure_tracing()
    Base.metadata.create_all(bind=engine)

    from .core.config import get_settings
    settings = get_settings()

    app = FastAPI(
        title="Dynamic Persona Chat API",
        version="0.1.0",
        lifespan=lifespan,
        root_path=settings.root_path,  # For reverse proxy support
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(documents_router)
    app.include_router(personas_router)
    app.include_router(target_groups_router)
    app.include_router(queue_router)
    app.include_router(chat_router)

    return app


app = create_app()

