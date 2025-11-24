"""Celery worker package for ingestion tasks."""

# Import tasks to ensure they are registered
from . import ingest  # noqa: F401
# Import event handlers to register signal handlers
from . import events  # noqa: F401

# Export celery_app for backward compatibility with -A worker.ingest
from app.celery_app import celery_app

__all__ = ["celery_app"]

