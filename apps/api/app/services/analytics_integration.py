from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List
from uuid import UUID

import structlog
from redis import Redis

from ..core.config import get_settings
from ..db import get_session
from ..models import Journey, JourneyExpectation, JourneyMeasurement

logger = structlog.get_logger(__name__)
settings = get_settings()


class AnalyticsIntegrationService:
    """Service for integrating with external analytics platforms (GA4, Hotjar, HubSpot, etc.)."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.redis = Redis.from_url(self.settings.redis_url)  # Use existing Redis

    async def sync_measurements(
        self,
        journey_id: UUID,
        period_start: date,
        period_end: date,
    ) -> List[JourneyMeasurement]:
        """
        Sync measurements from configured data sources for a journey.
        
        For each expectation in the journey:
        1. Query the appropriate data source
        2. Calculate actual_value
        3. Calculate delta vs expected
        4. Determine status (good/warning/critical)
        5. Store measurement
        """
        with get_session() as session:
            journey = session.get(Journey, journey_id)
            if not journey:
                raise ValueError("Journey not found")

            measurements = []

            # Get all expectations for all phases
            for phase in journey.phases:
                for expectation in phase.expectations:
                    try:
                        # Query data source
                        actual_value = await self._fetch_metric(
                            expectation.data_source,
                            expectation.data_source_config or {},
                            expectation.metric_type.value,
                            {
                                "url_pattern": phase.url_pattern,
                                "form_id": phase.form_id,
                                "event_names": phase.event_names,
                            },
                            period_start,
                            period_end,
                        )

                        # Calculate delta
                        if expectation.expected_value is not None:
                            delta_absolute = actual_value - expectation.expected_value
                            delta_percent = (
                                (delta_absolute / expectation.expected_value * 100)
                                if expectation.expected_value != 0
                                else 0.0
                            )
                        else:
                            delta_absolute = None
                            delta_percent = None

                        # Determine status
                        status = self._determine_status(
                            expectation, actual_value, delta_percent
                        )

                        # Create measurement
                        measurement = JourneyMeasurement(
                            expectation_id=expectation.id,
                            phase_id=phase.id,
                            period_start=datetime.combine(period_start, datetime.min.time()),
                            period_end=datetime.combine(period_end, datetime.max.time()),
                            actual_value=actual_value,
                            delta_absolute=delta_absolute,
                            delta_percent=delta_percent,
                            status=status,
                            data_source=expectation.data_source,
                        )
                        session.add(measurement)
                        measurements.append(measurement)

                    except Exception as exc:
                        logger.error(
                            "analytics.sync.measurement_failed",
                            expectation_id=str(expectation.id),
                            error=str(exc),
                            exc_info=True,
                        )
                        # Create measurement with no_data status
                        measurement = JourneyMeasurement(
                            expectation_id=expectation.id,
                            phase_id=phase.id,
                            period_start=datetime.combine(period_start, datetime.min.time()),
                            period_end=datetime.combine(period_end, datetime.max.time()),
                            actual_value=0.0,
                            status="no_data",
                            data_source=expectation.data_source,
                        )
                        session.add(measurement)
                        measurements.append(measurement)

            session.commit()
            return measurements

    async def _fetch_metric(
        self,
        data_source: str,
        config: Dict[str, Any],
        metric_type: str,
        filters: Dict[str, Any],
        period_start: date,
        period_end: date,
    ) -> float:
        """Fetch metric from data source."""
        # Check cache first
        cache_key = f"analytics:{data_source}:{metric_type}:{period_start}:{period_end}"
        cached = self.redis.get(cache_key)
        if cached:
            try:
                return float(cached)
            except (ValueError, TypeError):
                pass

        # Fetch from data source
        if data_source == "ga4":
            value = await self._fetch_ga4_metric(config, metric_type, filters, period_start, period_end)
        elif data_source == "hotjar":
            value = await self._fetch_hotjar_metric(config, metric_type, filters, period_start, period_end)
        elif data_source == "hubspot":
            value = await self._fetch_hubspot_metric(config, metric_type, filters, period_start, period_end)
        else:
            logger.warning("analytics.unknown_data_source", data_source=data_source)
            value = 0.0

        # Cache result (TTL: 1 hour)
        self.redis.setex(cache_key, 3600, str(value))

        return value

    async def _fetch_ga4_metric(
        self,
        config: Dict[str, Any],
        metric_type: str,
        filters: Dict[str, Any],
        period_start: date,
        period_end: date,
    ) -> float:
        """Fetch metric from Google Analytics 4."""
        # TODO: Implement GA4 API integration
        # This would use the Google Analytics Data API
        # For now, return a placeholder
        logger.info(
            "analytics.ga4.fetch",
            metric_type=metric_type,
            period_start=period_start,
            period_end=period_end,
        )
        return 0.0

    async def _fetch_hotjar_metric(
        self,
        config: Dict[str, Any],
        metric_type: str,
        filters: Dict[str, Any],
        period_start: date,
        period_end: date,
    ) -> float:
        """Fetch metric from Hotjar."""
        # TODO: Implement Hotjar API integration
        logger.info(
            "analytics.hotjar.fetch",
            metric_type=metric_type,
            period_start=period_start,
            period_end=period_end,
        )
        return 0.0

    async def _fetch_hubspot_metric(
        self,
        config: Dict[str, Any],
        metric_type: str,
        filters: Dict[str, Any],
        period_start: date,
        period_end: date,
    ) -> float:
        """Fetch metric from HubSpot."""
        # TODO: Implement HubSpot API integration
        logger.info(
            "analytics.hubspot.fetch",
            metric_type=metric_type,
            period_start=period_start,
            period_end=period_end,
        )
        return 0.0

    def _determine_status(
        self,
        expectation: JourneyExpectation,
        actual_value: float,
        delta_percent: float | None,
    ) -> str:
        """Determine measurement status based on thresholds."""
        if delta_percent is None:
            return "no_data"

        # Check critical threshold
        if (
            expectation.critical_threshold_percent is not None
            and abs(delta_percent) >= expectation.critical_threshold_percent
        ):
            return "critical"

        # Check warning threshold
        if (
            expectation.warning_threshold_percent is not None
            and abs(delta_percent) >= expectation.warning_threshold_percent
        ):
            return "warning"

        return "good"

    async def configure_data_source(
        self,
        journey_id: UUID,
        source_type: str,
        config: Dict[str, Any],
    ) -> None:
        """Configure data source for a journey."""
        with get_session() as session:
            journey = session.get(Journey, journey_id)
            if not journey:
                raise ValueError("Journey not found")

            # Store configuration (could be in journey metadata or separate table)
            # For now, we'll store it per expectation
            # In a full implementation, this might be stored at journey level
            logger.info(
                "analytics.configure",
                journey_id=str(journey_id),
                source_type=source_type,
            )

