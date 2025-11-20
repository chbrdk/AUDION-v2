from __future__ import annotations

from celery import Celery

from .core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "indexing-api",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.task_routes = {
    "app.workers.process.process_document": {"queue": "ingestion"},
}
celery_app.conf.task_track_started = True

celery_app.conf.task_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.result_serializer = "json"
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# Worker configuration to handle crashes better
celery_app.conf.worker_max_tasks_per_child = 10  # Restart worker after 10 tasks to prevent memory leaks
celery_app.conf.worker_prefetch_multiplier = 1  # Don't prefetch too many tasks
celery_app.conf.task_acks_late = True  # Acknowledge tasks only after completion
celery_app.conf.task_reject_on_worker_lost = True  # Re-queue tasks if worker crashes

