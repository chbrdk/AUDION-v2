from __future__ import annotations

from typing import List
from uuid import UUID

import structlog
from anthropic import Anthropic

from sqlalchemy import select

from ..core.config import get_settings
from ..db import get_session
from ..models import Journey, JourneyInsight, JourneyMeasurement
from ..schemas.journey import InsightResponse

logger = structlog.get_logger(__name__)
settings = get_settings()


class InsightGenerationService:
    """Service for generating insights from journey measurements using LLM."""

    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.claude_api_key)

    async def analyze_measurements(self, journey_id: UUID) -> List[JourneyInsight]:
        """
        Analyze measurements and generate insights.
        
        Types of insights:
        - CONFIRMATION: Expected matches actual (e.g., 40% CTR expected, 42% actual)
        - CONTRADICTION: Expected contradicts actual (e.g., expected ROI focus, actual 70% look for pricing)
        - DISCOVERY: Unexpected pattern (e.g., Phase 2 has 3x more exits than Phase 1)
        - ANOMALY: Sudden change (e.g., drop from 45% to 12%)
        """
        with get_session() as session:
            journey = session.get(Journey, journey_id)
            if not journey:
                raise ValueError("Journey not found")

            # Get all measurements for the journey
            measurements = []
            for phase in journey.phases:
                for expectation in phase.expectations:
                    phase_measurements = session.scalars(
                        select(JourneyMeasurement)
                        .where(JourneyMeasurement.expectation_id == expectation.id)
                        .order_by(JourneyMeasurement.synced_at.desc())
                        .limit(10)
                    ).all()
                    measurements.extend(phase_measurements)

            if not measurements:
                logger.info("insights.no_measurements", journey_id=str(journey_id))
                return []

            # Generate insights using LLM
            insights = await self._generate_insights_with_llm(journey, measurements)

            # Save insights to database
            saved_insights = []
            for insight_data in insights:
                insight = JourneyInsight(
                    journey_id=journey.id,
                    phase_id=UUID(insight_data.get("phase_id")) if insight_data.get("phase_id") else None,
                    expectation_id=UUID(insight_data.get("expectation_id")) if insight_data.get("expectation_id") else None,
                    insight_type=insight_data.get("insight_type", "discovery"),
                    title=insight_data.get("title", ""),
                    description=insight_data.get("description"),
                    ai_analysis=insight_data.get("ai_analysis"),
                    ai_recommendations=insight_data.get("ai_recommendations"),
                    evidence=insight_data.get("evidence"),
                    confidence=insight_data.get("confidence", 0.8),
                    priority=insight_data.get("priority", 0.5),
                )
                session.add(insight)
                saved_insights.append(insight)

            session.commit()
            return saved_insights

    async def _generate_insights_with_llm(
        self, journey: Journey, measurements: List[JourneyMeasurement]
    ) -> List[dict]:
        """Generate insights using Claude API."""
        
        # Build context from measurements
        measurement_summary = []
        for m in measurements[:20]:  # Limit to recent measurements
            measurement_summary.append({
                "expectation_id": str(m.expectation_id),
                "phase_id": str(m.phase_id) if m.phase_id else None,
                "expected": "N/A",  # Would need to join with expectation
                "actual": m.actual_value,
                "delta_percent": m.delta_percent,
                "status": m.status.value,
                "period": f"{m.period_start.date()} to {m.period_end.date()}",
            })

        prompt = f"""Analyze the following journey measurements and generate insights:

JOURNEY: {journey.name}
TYPE: {journey.journey_type}

MEASUREMENTS:
{self._format_measurements(measurement_summary)}

Generate insights of the following types:
1. CONFIRMATION: Expected matches actual (within reasonable threshold)
2. CONTRADICTION: Expected contradicts actual (significant mismatch)
3. DISCOVERY: Unexpected pattern or trend
4. ANOMALY: Sudden change or outlier

For each insight, provide:
- insight_type: confirmation, contradiction, discovery, or anomaly
- title: Short descriptive title
- description: Detailed description
- confidence: 0.0-1.0
- priority: 0.0-1.0 (higher = more important)
- ai_recommendations: List of actionable recommendations
- evidence: Supporting data points

Return as JSON array of insights.
"""

        try:
            message = self._anthropic.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )

            # Parse response
            import json
            content = message.content[0].text
            json_start = content.find("[")
            json_end = content.rfind("]") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                insights = json.loads(json_str)
                return insights
            else:
                logger.warning("insights.invalid_json", content=content[:200])
                return []
        except Exception as exc:
            logger.error("insights.llm_failed", error=str(exc), exc_info=True)
            return []

    def _format_measurements(self, measurements: List[dict]) -> str:
        """Format measurements for prompt."""
        lines = []
        for m in measurements:
            lines.append(
                f"- Expectation {m['expectation_id']}: Expected N/A, Actual {m['actual']}, "
                f"Delta {m['delta_percent']}%, Status {m['status']}, Period {m['period']}"
            )
        return "\n".join(lines)

    async def generate_ai_recommendations(
        self, insight: JourneyInsight, context: dict
    ) -> List[str]:
        """Generate AI recommendations for an insight."""
        prompt = f"""Based on this insight:

TITLE: {insight.title}
DESCRIPTION: {insight.description}
TYPE: {insight.insight_type.value}

CONTEXT: {context}

Generate 3-5 actionable recommendations to address this insight.
Return as JSON array of strings.
"""

        try:
            message = self._anthropic.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )

            import json
            content = message.content[0].text
            json_start = content.find("[")
            json_end = content.rfind("]") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                recommendations = json.loads(json_str)
                return recommendations
            return []
        except Exception as exc:
            logger.error("insights.recommendations_failed", error=str(exc), exc_info=True)
            return []

    async def suggest_persona_updates(
        self, persona_id: UUID, contradictions: List[JourneyInsight]
    ) -> List[dict]:
        """
        Suggest persona updates based on contradictions.
        
        If multiple contradictions point to the same issue,
        suggest updating the persona profile.
        """
        if not contradictions:
            return []

        # Analyze contradictions to find patterns
        # This would use LLM to identify common themes
        # For now, return empty list
        logger.info(
            "insights.suggest_persona_updates",
            persona_id=str(persona_id),
            contradiction_count=len(contradictions),
        )
        return []

