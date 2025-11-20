from __future__ import annotations

from celery import Celery

from .core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "persona",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_routes={
        "worker.ingest.ingest_document": {"queue": "ingestion"},
    },
    task_track_started=True,
)

