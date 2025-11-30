from __future__ import annotations

from celery.schedules import crontab

# Celery Beat Schedule Configuration
beat_schedule = {
    "sync-all-active-journeys": {
        "task": "journey.sync_all_active",
        "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    "analyze-insights-daily": {
        "task": "journey.analyze_all_insights",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM (after sync)
    },
}

