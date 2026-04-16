from __future__ import annotations

import structlog
from uuid import UUID

from ..celery_app import celery_app
from ..db import get_session
from ..services.moodboard_service import MoodboardService

logger = structlog.get_logger(__name__)


@celery_app.task(name="moodboard.build", bind=True, max_retries=1)
def build_moodboard_task(self, moodboard_id: str) -> None:
    logger.info("moodboard.build.task.start", moodboard_id=moodboard_id, task_id=self.request.id)
    service = MoodboardService()
    try:
        with get_session() as session:
            service.build_moodboard(session, moodboard_id=UUID(moodboard_id))
        logger.info("moodboard.build.task.done", moodboard_id=moodboard_id, task_id=self.request.id)
    except Exception as exc:
        logger.error("moodboard.build.task.failed", moodboard_id=moodboard_id, error=str(exc), exc_info=True)
        try:
            with get_session() as session:
                service.fail_moodboard(session, moodboard_id=UUID(moodboard_id))
        except Exception:
            pass
        raise

