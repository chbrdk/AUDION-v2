from __future__ import annotations

import asyncio
from typing import List
from uuid import UUID

import structlog
from sqlalchemy import select

from ..celery_app import celery_app
from ..services.analytics_integration import AnalyticsIntegrationService
from ..services.insight_generation import InsightGenerationService
from ..services.journey_generation import JourneyGenerationService
from ..services.journey_validation import JourneyValidationService

logger = structlog.get_logger(__name__)


@celery_app.task(name="journey.generate", bind=True, max_retries=2)
def generate_journey_task(
    self,
    target_group_id: str,
    journey_type: str,
    organization_id: str,
    user_id: str,
    project_id: str | None = None,
) -> str:
    """
    Async Journey Generation.
    Can take 30-60 seconds.
    User gets notification when complete.
    """
    logger.info(
        "journey.generate.task.start",
        target_group_id=target_group_id,
        journey_type=journey_type,
        task_id=self.request.id,
    )
    try:
        service = JourneyGenerationService()
        
        # Run async function in sync context
        journey_draft = asyncio.run(
            service.generate_journey_from_knowledge(
                target_group_id=UUID(target_group_id),
                journey_type=journey_type,
                organization_id=UUID(organization_id),
            )
        )
        
        # Save journey draft
        journey = service.save_journey_draft(
            draft=journey_draft,
            target_group_id=UUID(target_group_id),
            organization_id=UUID(organization_id),
            project_id=UUID(project_id) if project_id else None,
            created_by=user_id,
        )
        
        logger.info(
            "journey.generate.task.completed",
            journey_id=str(journey.id),
            task_id=self.request.id,
        )
        return str(journey.id)
    except Exception as exc:
        logger.error(
            "journey.generate.task.failed",
            error=str(exc),
            task_id=self.request.id,
            exc_info=True,
        )
        raise


@celery_app.task(name="journey.validate", bind=True, max_retries=1)
def validate_journey_task(
    self,
    journey_id: str,
    persona_ids: List[str],
) -> dict:
    """
    Async Validation against multiple Personas.
    Can be parallelized for better performance.
    """
    logger.info(
        "journey.validate.task.start",
        journey_id=journey_id,
        persona_ids=persona_ids,
        task_id=self.request.id,
    )
    try:
        service = JourneyValidationService()
        
        # Parallelize validation across all personas
        async def validate_all_personas():
            validation_tasks = [
                service.validate_journey_against_persona(
                    journey_id=UUID(journey_id),
                    persona_id=UUID(persona_id),
                )
                for persona_id in persona_ids
            ]
            validation_results = await asyncio.gather(*validation_tasks)
            return [
                {
                    "persona_id": persona_id,
                    "overall_fit_score": result.overall_fit_score,
                    "phases": len(result.phases),
                }
                for persona_id, result in zip(persona_ids, validation_results)
            ]
        
        results = asyncio.run(validate_all_personas())
        
        logger.info(
            "journey.validate.task.completed",
            journey_id=journey_id,
            results_count=len(results),
            task_id=self.request.id,
        )
        return {"journey_id": journey_id, "results": results}
    except Exception as exc:
        logger.error(
            "journey.validate.task.failed",
            error=str(exc),
            task_id=self.request.id,
            exc_info=True,
        )
        raise


@celery_app.task(name="journey.sync_measurements", bind=True, rate_limit="10/m", max_retries=2)
def sync_measurements_task(
    self,
    journey_id: str,
    period_start: str | None = None,
    period_end: str | None = None,
) -> dict:
    """
    Periodic syncing of Analytics.
    Runs daily.
    Rate limited to respect API quotas.
    """
    from datetime import date, datetime, timedelta
    
    logger.info(
        "journey.sync_measurements.task.start",
        journey_id=journey_id,
        task_id=self.request.id,
    )
    try:
        service = AnalyticsIntegrationService()
        
        # Default to last 7 days if not specified
        if not period_start:
            period_start = (datetime.now().date() - timedelta(days=7)).isoformat()
        if not period_end:
            period_end = datetime.now().date().isoformat()
        
        period_start_date = date.fromisoformat(period_start)
        period_end_date = date.fromisoformat(period_end)
        
        measurements = service.sync_measurements(
            journey_id=UUID(journey_id),
            period_start=period_start_date,
            period_end=period_end_date,
        )
        
        logger.info(
            "journey.sync_measurements.task.completed",
            journey_id=journey_id,
            measurements_count=len(measurements),
            task_id=self.request.id,
        )
        return {
            "journey_id": journey_id,
            "measurements_count": len(measurements),
            "period_start": period_start,
            "period_end": period_end,
        }
    except Exception as exc:
        logger.error(
            "journey.sync_measurements.task.failed",
            error=str(exc),
            task_id=self.request.id,
            exc_info=True,
        )
        raise


@celery_app.task(name="journey.analyze_insights", bind=True, rate_limit="5/m", max_retries=1)
def analyze_insights_task(
    self,
    journey_id: str,
) -> dict:
    """
    Generates insights from new measurements.
    Runs after each sync.
    """
    logger.info(
        "journey.analyze_insights.task.start",
        journey_id=journey_id,
        task_id=self.request.id,
    )
    try:
        service = InsightGenerationService()
        insights = service.analyze_measurements(journey_id=UUID(journey_id))
        
        logger.info(
            "journey.analyze_insights.task.completed",
            journey_id=journey_id,
            insights_count=len(insights),
            task_id=self.request.id,
        )
        return {
            "journey_id": journey_id,
            "insights_count": len(insights),
            "insight_ids": [str(i.id) for i in insights],
        }
    except Exception as exc:
        logger.error(
            "journey.analyze_insights.task.failed",
            error=str(exc),
            task_id=self.request.id,
            exc_info=True,
        )
        raise


@celery_app.task(name="journey.sync_all_active")
def sync_all_active_journeys() -> dict:
    """Sync measurements for all active journeys."""
    from datetime import date, datetime, timedelta
    
    from ..db import get_session
    from ..models import Journey, JourneyStatus
    
    logger.info("journey.sync_all_active.start")
    try:
        with get_session() as session:
            active_journeys = (
                session.query(Journey)
                .filter(Journey.status == JourneyStatus.active)
                .filter(Journey.tracking_enabled == True)
                .all()
            )
            
            period_start = (datetime.now().date() - timedelta(days=7)).isoformat()
            period_end = datetime.now().date().isoformat()
            
            results = []
            for journey in active_journeys:
                try:
                    sync_measurements_task.delay(
                        journey_id=str(journey.id),
                        period_start=period_start,
                        period_end=period_end,
                    )
                    results.append({"journey_id": str(journey.id), "status": "queued"})
                except Exception as exc:
                    logger.error(
                        "journey.sync_all_active.journey_failed",
                        journey_id=str(journey.id),
                        error=str(exc),
                    )
                    results.append({"journey_id": str(journey.id), "status": "failed", "error": str(exc)})
            
            logger.info(
                "journey.sync_all_active.completed",
                total=len(active_journeys),
                queued=sum(1 for r in results if r["status"] == "queued"),
            )
            return {"total": len(active_journeys), "results": results}
    except Exception as exc:
        logger.error("journey.sync_all_active.failed", error=str(exc), exc_info=True)
        raise


@celery_app.task(name="journey.analyze_all_insights")
def analyze_all_insights() -> dict:
    """Analyze insights for all active journeys."""
    from ..db import get_session
    from ..models import Journey, JourneyStatus
    
    logger.info("journey.analyze_all_insights.start")
    try:
        with get_session() as session:
            active_journeys = session.scalars(
                select(Journey)
                .where(Journey.status == JourneyStatus.active)
                .where(Journey.tracking_enabled == True)
            ).all()
            
            results = []
            for journey in active_journeys:
                try:
                    analyze_insights_task.delay(journey_id=str(journey.id))
                    results.append({"journey_id": str(journey.id), "status": "queued"})
                except Exception as exc:
                    logger.error(
                        "journey.analyze_all_insights.journey_failed",
                        journey_id=str(journey.id),
                        error=str(exc),
                    )
                    results.append({"journey_id": str(journey.id), "status": "failed", "error": str(exc)})
            
            logger.info(
                "journey.analyze_all_insights.completed",
                total=len(active_journeys),
                queued=sum(1 for r in results if r["status"] == "queued"),
            )
            return {"total": len(active_journeys), "results": results}
    except Exception as exc:
        logger.error("journey.analyze_all_insights.failed", error=str(exc), exc_info=True)
        raise

