from __future__ import annotations

from celery import Celery

from .core.config import get_settings
from .celeryconfig import beat_schedule

settings = get_settings()

celery_app = Celery(
    "persona",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_routes={
        "worker.ingest.ingest_document": {"queue": "ingestion"},
        "journey.generate": {"queue": "journeys"},
        "journey.validate": {"queue": "journeys"},
        "journey.sync_measurements": {"queue": "analytics"},
        "journey.analyze_insights": {"queue": "analytics"},
        "journey.sync_all_active": {"queue": "analytics"},
        "journey.analyze_all_insights": {"queue": "analytics"},
    },
    task_track_started=True,
    include=["worker.ingest", "app.tasks.journey_tasks"],  # Auto-import tasks
    beat_schedule=beat_schedule,  # Celery Beat schedule
)

# Import event handlers to register signal handlers
from worker import events  # noqa: F401, E402

