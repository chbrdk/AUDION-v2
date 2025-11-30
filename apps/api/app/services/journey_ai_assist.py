from __future__ import annotations

import json
from textwrap import dedent
from typing import Any, Dict, List

import structlog
from anthropic import Anthropic
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import Journey, JourneyPhase
from ..schemas.journey import JourneyAiGenerationResponse, JourneyAiSuggestion
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService

logger = structlog.get_logger(__name__)
settings = get_settings()


class JourneyAiAssistService:
    """Helper service that orchestrates Claude prompts for journey authoring."""

    _templates: Dict[str, Dict[str, Any]] = {
        "journey_moments": {
            "description": "Generate journey elements (actions, thoughts, touchpoints) for a phase.",
            "output_key": "moments",
            "instructions": dedent(
                """
                You are assisting a customer-journey strategist. Use the provided context to draft up to {max_items} distinct journey moments
                for the CURRENT PHASE. Mix element types such as action, thought, feeling, touchpoint, pain_point, opportunity, or quote.

                CONTEXT
                =======
                JOURNEY NAME: {journey_name}
                JOURNEY TYPE: {journey_type}
                TARGET GROUP: {target_group_summary}

                EXISTING PHASES:
                {phases_summary}

                CURRENT PHASE:
                Name: {phase_name}
                Description: {phase_description}
                Expected Emotion: {phase_emotion}

                PERSONAS:
                {persona_summaries}

                TASK
                ====
                - Produce concise, vivid statements (max 200 characters each).
                - Vary element_type depending on the insight (actions for user behavior, touchpoint for channels, pain_point for friction, etc.).
                - Avoid duplicating existing content.

                Respond in pure JSON with the following schema:
                {{
                  "moments": [
                    {{
                      "element_type": "action|thought|feeling|touchpoint|pain_point|opportunity|question|quote",
                      "content": "descriptive text"
                    }}
                  ]
                }}
                """
            ).strip(),
        },
    }

    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.claude_api_key)
        self.target_group_service = TargetGroupService()
        self.persona_service = PersonaService()

    async def generate(
        self,
        *,
        session: Session,
        journey: Journey,
        template_id: str,
        phase: JourneyPhase | None,
        phase_context: Dict[str, Any] | None = None,
        prompt_variables: Dict[str, Any] | None = None,
        max_suggestions: int = 3,
    ) -> JourneyAiGenerationResponse:
        template = self._templates.get(template_id)
        if not template:
            raise ValueError(f"Unknown template_id '{template_id}'")

        context = await self._build_context(
            session=session,
            journey=journey,
            phase=phase,
            phase_context=phase_context or {},
            max_items=max_suggestions,
        )
        prompt = template["instructions"].format(
            max_items=max_suggestions,
            **context,
            **(prompt_variables or {}),
        )

        logger.info(
            "journey.ai.prompt",
            template_id=template_id,
            journey_id=str(journey.id),
            phase_id=str(phase.id) if phase else None,
        )

        message = self._anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            temperature=0.6,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_output = message.content[0].text if message.content else ""
        suggestions = self._parse_suggestions(
            raw_output=raw_output,
            template=template,
            max_items=max_suggestions,
        )

        return JourneyAiGenerationResponse(
            template_id=template_id,
            suggestions=suggestions,
            raw_output=raw_output,
        )

    async def _build_context(
        self,
        *,
        session: Session,
        journey: Journey,
        phase: JourneyPhase | None,
        phase_context: Dict[str, Any],
        max_items: int,
    ) -> Dict[str, Any]:
        phase_snapshot = phase_context.copy()
        if phase:
            phase_snapshot.setdefault("name", phase.name)
            phase_snapshot.setdefault("description", phase.description or "No description provided.")
            phase_snapshot.setdefault("expected_emotion", phase.expected_emotion or "neutral")
        else:
            phase_snapshot.setdefault("name", "New Phase")
            phase_snapshot.setdefault("description", "No description provided.")
            phase_snapshot.setdefault("expected_emotion", "neutral")

        phases_summary = self._format_phases(journey)
        target_group_summary, persona_summaries = self._target_group_and_personas(session, journey)

        return {
            "journey_name": journey.name,
            "journey_type": journey.journey_type,
            "phases_summary": phases_summary,
            "phase_name": phase_snapshot.get("name"),
            "phase_description": phase_snapshot.get("description"),
            "phase_emotion": phase_snapshot.get("expected_emotion"),
            "target_group_summary": target_group_summary,
            "persona_summaries": persona_summaries or "No persona data available.",
            "max_items": max_items,
        }

    def _format_phases(self, journey: Journey) -> str:
        if not journey.phases:
            return "No phases defined yet."

        sorted_phases = sorted(journey.phases, key=lambda ph: ph.phase_order or 0)
        lines = []
        for ph in sorted_phases:
            desc = ph.description or "No description"
            lines.append(f"{ph.phase_order or 0}. {ph.name}: {desc}")
        return "\n".join(lines)

    def _target_group_and_personas(
        self,
        session: Session,
        journey: Journey,
    ) -> tuple[str, str]:
        if not journey.target_group_id:
            return ("No target group linked to this journey.", "")

        try:
            tg_response = self.target_group_service.get_target_group(session, str(journey.target_group_id))
        except ValueError:
            return ("Target group lookup failed.", "")

        summary = f"{tg_response.name} • Segment: {tg_response.segment or 'n/a'}"
        if tg_response.description:
            summary += f"\nDescription: {tg_response.description}"

        persona_summaries: List[str] = []
        for persona_meta in tg_response.personas[:2]:
            try:
                persona_detail = self.persona_service.get_persona(session, persona_meta.id, use_cache=True)
                profile = getattr(persona_detail, "profile", None)
                traits = []
                if profile and getattr(profile, "traits", None):
                    traits = [f"{k}: {v}" for k, v in profile.traits.items()]
                goals = []
                if profile and getattr(profile, "goals", None):
                    goals = [getattr(g, "label", str(g)) for g in profile.goals]
                pains = []
                if profile and getattr(profile, "pain_points", None):
                    pains = [getattr(p, "label", str(p)) for p in profile.pain_points]

                persona_summary = f"- {persona_detail.name}:"
                if traits:
                    persona_summary += f" Traits: {', '.join(traits[:5])}."
                if goals:
                    persona_summary += f" Goals: {', '.join(goals[:3])}."
                if pains:
                    persona_summary += f" Pain Points: {', '.join(pains[:3])}."
                persona_summaries.append(persona_summary)
            except Exception as exc:  # pragma: no cover - resilience
                logger.warning("journey.ai.persona_fetch_failed", persona_id=persona_meta.id, error=str(exc))
                continue

        return summary, "\n".join(persona_summaries)

    def _parse_suggestions(
        self,
        *,
        raw_output: str,
        template: Dict[str, Any],
        max_items: int,
    ) -> List[JourneyAiSuggestion]:
        if not raw_output:
            return []

        json_str = self._extract_json(raw_output)
        if not json_str:
            logger.warning("journey.ai.json_missing")
            return []

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning("journey.ai.json_invalid", json=json_str[:200])
            return []

        output_key = template.get("output_key", "moments")
        items = data.get(output_key) if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []

        suggestions: List[JourneyAiSuggestion] = []
        for item in items[:max_items]:
            content = item.get("content") if isinstance(item, dict) else None
            if not content:
                continue
            suggestions.append(
                JourneyAiSuggestion(
                    element_type=item.get("element_type"),
                    title=item.get("title"),
                    content=content.strip(),
                )
            )
        return suggestions

    def _extract_json(self, text: str) -> str | None:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end <= start:
            return None
        return text[start:end]



