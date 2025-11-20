from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.logging import configure_logging
from .core.telemetry import configure_tracing
from .db import Base, engine
from . import models  # noqa: F401
from .routers.documents import router as documents_router
from .routers.personas import router as personas_router
from .ws.chat import router as chat_router


def create_app() -> FastAPI:
    configure_logging()
    configure_tracing()
    Base.metadata.create_all(bind=engine)

    app = FastAPI(title="Dynamic Persona Chat API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(documents_router)
    app.include_router(personas_router)
    app.include_router(chat_router)

    return app


app = create_app()

