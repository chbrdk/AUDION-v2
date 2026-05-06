from __future__ import annotations

import asyncio

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.logging import configure_logging
from .core.telemetry import configure_tracing
from . import models  # noqa: F401
from .routers.discovery import router as discovery_router
from .routers.auth import router as auth_router
from .routers.auth_tokens import router as auth_tokens_router
from .routers.projects import router as projects_router
from .routers.documents import router as documents_router
from .routers.ai_assist import router as ai_router
from .routers.settings import router as settings_router
from .routers.personas import router as personas_router, persona_admin_router
from .routers.target_groups import router as target_groups_router
from .routers.journeys import router as journeys_router
from .routers.queue import router as queue_router
from .routers.integrations_checkion import router as integrations_checkion_router
from .routers.ux_journey_agent import router as ux_journey_agent_router
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
    # Do not call Base.metadata.create_all here: it blocks the worker on first DB connection and breaks
    # Docker/Coolify healthchecks (start.sh only waits briefly for /health). Schema is applied by
    # Alembic + app/scripts/init_db.py after /health is already up.

    from .core.config import get_settings
    settings = get_settings()

    app = FastAPI(
        title="Dynamic Persona Chat API",
        version="0.1.0",
        lifespan=lifespan,
        root_path=settings.root_path,  # For reverse proxy support
    )
    @app.get("/health", include_in_schema=False)
    async def health():
        return {"status": "ok"}
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] if settings.cors_origins else ["*"]
    # Figma plugins run in iframes with origin "null" – always allow it explicitly
    if "null" not in origins:
        origins.append("null")
    # When allow_origins includes "*", credentials must be False per the CORS spec
    use_credentials = "*" not in origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=use_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Union logging middleware removed - Audion is now autonomous

    app.include_router(discovery_router)
    app.include_router(auth_router)
    app.include_router(auth_tokens_router)
    app.include_router(projects_router)
    app.include_router(documents_router)
    app.include_router(ai_router)
    app.include_router(settings_router)
    app.include_router(personas_router)
    app.include_router(persona_admin_router)
    app.include_router(target_groups_router)
    app.include_router(journeys_router)
    app.include_router(queue_router)
    app.include_router(integrations_checkion_router)
    app.include_router(ux_journey_agent_router)
    app.include_router(chat_router)

    return app


app = create_app()
