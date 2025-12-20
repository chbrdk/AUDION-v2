from __future__ import annotations

from typing import List
from uuid import UUID

import structlog
from msqdx_glass_proto import PersonaProfile

from ..db import get_session
from ..models import Journey, JourneyPhase
from ..schemas.journey import (
    FrictionPoint,
    JourneyValidationReport,
    PhaseValidationResult,
)
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService

logger = structlog.get_logger(__name__)


class JourneyValidationService:
    def __init__(self) -> None:
        self.persona_service = PersonaService()
        self.target_group_service = TargetGroupService()

    async def validate_journey_against_persona(
        self,
        journey_id: UUID,
        persona_id: UUID,
        mode: str = "automated",
    ) -> JourneyValidationReport:
        """
        Validate a journey against a persona.
        
        Uses PersonaService to get persona profile and validates journey phases
        against persona traits, goals, pain_points, and behaviors.
        """
        with get_session() as session:
            # Get persona with full profile
            persona_response = self.persona_service.get_persona(session, str(persona_id))
            profile: PersonaProfile = persona_response.profile

            # Get journey with phases
            journey = session.get(Journey, journey_id)
            if not journey:
                raise ValueError("Journey not found")

            phases = journey.phases  # SQLAlchemy Relationship

            # Validate each phase
            validation_results = []
            for phase in phases:
                fit_score = self.calculate_fit_score(phase, profile)
                friction_points = self.identify_friction_points(phase, profile)
                recommendations = self.generate_recommendations(phase, profile, fit_score)

                validation_results.append(
                    PhaseValidationResult(
                        phase_id=str(phase.id),
                        phase_name=phase.name,
                        fit_score=fit_score,
                        status=self._get_status_from_score(fit_score),
                        friction_points=friction_points,
                        recommendations=recommendations,
                    )
                )

            overall_score = (
                sum(r.fit_score for r in validation_results) / len(validation_results)
                if validation_results
                else 0.0
            )

            from datetime import datetime

            return JourneyValidationReport(
                journey_id=str(journey_id),
                overall_fit_score=overall_score,
                phases=validation_results,
                validated_at=datetime.utcnow(),
            )

    def calculate_fit_score(self, phase: JourneyPhase, profile: PersonaProfile) -> float:
        """
        Calculate fit score based on:
        - Action Alignment (30%): Do phase actions match persona behaviors?
        - Emotion Fit (20%): Does expected emotion match persona traits?
        - Content Relevance (25%): Relevance for persona goals/pain points?
        - Timing Plausibility (15%): Realistic duration for persona?
        - Missing Elements (10%): Missing important touchpoints?
        """
        scores = []

        # 1. Action Alignment (30%)
        action_score = self._score_action_alignment(phase, profile)
        scores.append(("action", action_score, 0.30))

        # 2. Emotion Fit (20%)
        emotion_score = self._score_emotion_fit(phase, profile)
        scores.append(("emotion", emotion_score, 0.20))

        # 3. Content Relevance (25%)
        content_score = self._score_content_relevance(phase, profile)
        scores.append(("content", content_score, 0.25))

        # 4. Timing Plausibility (15%)
        timing_score = self._score_timing_plausibility(phase, profile)
        scores.append(("timing", timing_score, 0.15))

        # 5. Missing Elements (10%)
        elements_score = self._score_elements_completeness(phase, profile)
        scores.append(("elements", elements_score, 0.10))

        # Calculate weighted average
        total_score = sum(score * weight for _, score, weight in scores)
        return round(total_score * 100, 2)  # Convert to 0-100 scale

    def _score_action_alignment(self, phase: JourneyPhase, profile: PersonaProfile) -> float:
        """Score how well phase actions align with persona behaviors."""
        # Get actions from phase elements
        actions = [
            e.content
            for e in phase.elements
            if e.element_type.value == "action"
        ]

        if not actions:
            return 0.5  # Neutral if no actions defined

        # Check if actions align with persona behaviors
        behaviors = getattr(profile, "behaviors", []) or []
        if not behaviors:
            return 0.5  # Neutral if no behaviors defined

        # Simple keyword matching (can be enhanced with semantic similarity)
        behavior_text = " ".join(behaviors).lower()
        action_text = " ".join(actions).lower()

        # Count matching keywords
        behavior_words = set(behavior_text.split())
        action_words = set(action_text.split())
        common_words = behavior_words.intersection(action_words)

        if not behavior_words:
            return 0.5

        alignment_ratio = len(common_words) / len(behavior_words)
        return min(alignment_ratio * 2, 1.0)  # Scale up, cap at 1.0

    def _score_emotion_fit(self, phase: JourneyPhase, profile: PersonaProfile) -> float:
        """Score how well expected emotion fits persona traits."""
        if not phase.expected_emotion:
            return 0.5  # Neutral if no emotion defined

        # Get persona traits
        traits = getattr(profile, "traits", {}) or {}
        if not traits:
            return 0.5  # Neutral if no traits defined

        # Map emotions to trait expectations
        emotion_trait_map = {
            "frustrated": ["impatient", "skeptical", "critical"],
            "anxious": ["cautious", "risk_averse", "uncertain"],
            "neutral": ["balanced", "practical", "analytical"],
            "hopeful": ["optimistic", "curious", "open"],
            "satisfied": ["content", "confident", "trusting"],
            "delighted": ["enthusiastic", "excited", "positive"],
        }

        expected_traits = emotion_trait_map.get(phase.expected_emotion.lower(), [])
        if not expected_traits:
            return 0.5

        # Check if persona has matching traits
        trait_names = [k.lower().replace("_", " ") for k in traits.keys()]
        matching_traits = [
            t for t in expected_traits
            if any(t.lower() in tn or tn in t.lower() for tn in trait_names)
        ]

        return len(matching_traits) / len(expected_traits) if expected_traits else 0.5

    def _score_content_relevance(self, phase: JourneyPhase, profile: PersonaProfile) -> float:
        """Score relevance of phase content for persona goals/pain points."""
        # Get goals and pain points
        goals = getattr(profile, "goals", []) or []
        pain_points = getattr(profile, "pain_points", []) or []

        if not goals and not pain_points:
            return 0.5  # Neutral if no goals/pain points

        # Extract text from phase
        phase_text = f"{phase.name} {phase.description or ''}".lower()
        if phase.elements:
            phase_text += " " + " ".join([e.content.lower() for e in phase.elements])

        # Check relevance to goals
        goal_matches = 0
        if goals:
            goal_texts = [
                (g.label if hasattr(g, "label") else str(g)).lower()
                for g in goals
            ]
            for goal_text in goal_texts:
                if any(word in phase_text for word in goal_text.split()[:3]):  # Check first 3 words
                    goal_matches += 1
            goal_score = goal_matches / len(goals) if goals else 0.0
        else:
            goal_score = 0.0

        # Check relevance to pain points
        pain_matches = 0
        if pain_points:
            pain_texts = [
                (pp.label if hasattr(pp, "label") else str(pp)).lower()
                for pp in pain_points
            ]
            for pain_text in pain_texts:
                if any(word in phase_text for word in pain_text.split()[:3]):
                    pain_matches += 1
            pain_score = pain_matches / len(pain_points) if pain_points else 0.0
        else:
            pain_score = 0.0

        # Weighted average (goals 60%, pain points 40%)
        return (goal_score * 0.6) + (pain_score * 0.4)

    def _score_timing_plausibility(self, phase: JourneyPhase, profile: PersonaProfile) -> float:
        """Score if duration is plausible for persona."""
        if not phase.expected_duration_min or not phase.expected_duration_max:
            return 0.5  # Neutral if no duration defined

        # Convert to minutes for comparison
        duration_min = phase.expected_duration_min
        duration_max = phase.expected_duration_max
        if phase.duration_unit == "hours":
            duration_min *= 60
            duration_max *= 60
        elif phase.duration_unit == "days":
            duration_min *= 60 * 24
            duration_max *= 60 * 24

        avg_duration = (duration_min + duration_max) / 2

        # Check persona traits for time preferences
        traits = getattr(profile, "traits", {}) or {}
        trait_names = [k.lower() for k in traits.keys()]

        # Impatient personas expect shorter durations
        if any("impatient" in t or "quick" in t for t in trait_names):
            if avg_duration > 30:  # More than 30 minutes
                return 0.3  # Low score for long duration
            return 0.9  # High score for short duration

        # Cautious personas might need more time
        if any("cautious" in t or "careful" in t for t in trait_names):
            if avg_duration < 10:  # Less than 10 minutes
                return 0.3  # Low score for very short duration
            return 0.8  # Good score for reasonable duration

        # Default: neutral for average durations (5-60 minutes)
        if 5 <= avg_duration <= 60:
            return 0.8
        elif avg_duration < 5:
            return 0.6
        else:
            return 0.5

    def _score_elements_completeness(self, phase: JourneyPhase, profile: PersonaProfile) -> float:
        """Score if phase has all necessary elements."""
        required_types = ["action", "touchpoint"]
        optional_types = ["thought", "feeling", "pain_point", "opportunity"]

        element_types = {e.element_type.value for e in phase.elements}

        # Check required elements
        has_required = all(et in element_types for et in required_types)
        if not has_required:
            return 0.3  # Low score if missing required elements

        # Bonus for optional elements
        has_optional = sum(1 for et in optional_types if et in element_types)
        optional_score = min(has_optional / len(optional_types), 1.0)

        return 0.7 + (optional_score * 0.3)  # 70% base + 30% bonus

    def identify_friction_points(
        self, phase: JourneyPhase, profile: PersonaProfile
    ) -> List[FrictionPoint]:
        """Identify friction points between phase and persona."""
        friction_points = []

        # Check emotion mismatch
        if phase.expected_emotion:
            emotion_score = self._score_emotion_fit(phase, profile)
            if emotion_score < 0.5:
                friction_points.append(
                    FrictionPoint(
                        description=f"Expected emotion '{phase.expected_emotion}' may not align with persona traits",
                        severity="medium",
                        persona_quote=None,
                    )
                )

        # Check action alignment
        action_score = self._score_action_alignment(phase, profile)
        if action_score < 0.5:
            friction_points.append(
                FrictionPoint(
                    description="Phase actions may not align with persona behaviors",
                    severity="high",
                    persona_quote=None,
                )
            )

        # Check missing touchpoints
        has_touchpoint = any(
            e.element_type.value == "touchpoint" for e in phase.elements
        )
        if not has_touchpoint:
            friction_points.append(
                FrictionPoint(
                    description="Phase lacks touchpoint information",
                    severity="low",
                    persona_quote=None,
                )
            )

        return friction_points

    def generate_recommendations(
        self, phase: JourneyPhase, profile: PersonaProfile, fit_score: float
    ) -> List[str]:
        """Generate recommendations to improve phase fit."""
        recommendations = []

        if fit_score < 50:
            recommendations.append(
                "Consider revising phase actions to better align with persona behaviors"
            )

        emotion_score = self._score_emotion_fit(phase, profile)
        if emotion_score < 0.5:
            recommendations.append(
                "Adjust expected emotion to better match persona traits"
            )

        timing_score = self._score_timing_plausibility(phase, profile)
        if timing_score < 0.5:
            recommendations.append(
                "Review phase duration - may not be realistic for this persona"
            )

        if not any(e.element_type.value == "pain_point" for e in phase.elements):
            recommendations.append(
                "Add pain points to better understand persona challenges in this phase"
            )

        return recommendations

    def _get_status_from_score(self, fit_score: float) -> str:
        """Get status from fit score."""
        if fit_score >= 80:
            return "good"
        elif fit_score >= 60:
            return "warning"
        else:
            return "critical"

