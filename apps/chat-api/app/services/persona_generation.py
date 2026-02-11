from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List
from uuid import UUID

import structlog
from anthropic import Anthropic
from sqlalchemy import select
from msqdx_glass_proto import PersonaProfile, PersonaPrompt
from msqdx_glass_proto.personas import (
    PersonaCommunicationStyle,
    PersonaGoal,
    PersonaPainPoint,
)

from ..core.config import get_settings
from ..db import get_session
from ..models import DocumentChunk, Persona, PersonaPrompt as PersonaPromptModel, PersonaSource
from ..services.persona_image import PersonaImageService

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass
class PersonaGenerationResult:
    profile: PersonaProfile
    prompt: PersonaPrompt
    sources: List[Dict]
    profile_card: Dict[str, Any] | None = None


class PersonaGenerationService:
    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.anthropic_api_key)
        self._image_service = PersonaImageService()

    def generate(self, *, persona: Persona, chunk_ids: List[UUID]) -> PersonaGenerationResult:
        """Generate a detailed persona profile from research chunks."""
        with get_session() as session:
            chunks = session.scalars(
                select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)).order_by(DocumentChunk.id)
            ).all()

        excerpts = "\n".join(f"- {chunk.content}" for chunk in chunks)
        identity_prompt = (
            "Craft a vivid persona profile from the research excerpts. "
            "Return STRICT JSON with this exact structure:\n"
            "{\n"
            '  "name": "string",\n'
            '  "full_name": "string",\n'
            '  "age": 0,\n'
            '  "location": "string",\n'
            '  "headline": "string",\n'
            '  "bio": "string",\n'
            '  "interests": ["string", ...],\n'
            '  "traits": {"trait_name": 0.0-1.0, ...},  // Dict of trait names to float scores\n'
            '  "pain_points": [{"label": "string", "evidence_count": 0}, ...],  // Array of objects\n'
            '  "goals": [{"label": "string", "priority": 1-10}, ...],  // Array of objects with priority\n'
            '  "communication_style": {\n'
            '    "vocabulary": ["word1", "word2", ...],\n'
            '    "sentence_structure": "string",\n'
            '    "skepticism_level": 1-10\n'
            "  },\n"
            '  "color_palette": ["#HEX", ...],\n'
            '  "attention_span": "string",\n'
            '  "social_media_usage": ["platform - frequency", ...],\n'
            '  "values": ["string", ...],\n'
            '  "confidence": 0.0-1.0\n'
            "}\n\n"
            "Base everything strictly on these excerpts:\n"
            f"{excerpts}"
        )

        identity = self._anthropic.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1000,
            temperature=0.2,
            messages=[{"role": "user", "content": identity_prompt}],
        )

        text_content = self._response_to_text(identity)
        text_content = self._extract_json_block(text_content)
        logger.info("persona.generation.response_received", length=len(text_content), preview=text_content[:200])

        try:
            payload = json.loads(text_content)
        except json.JSONDecodeError as e:
            logger.error(
                "persona.generation.json_parse_failed",
                error=str(e),
                content_preview=text_content[:500],
                persona_id=str(persona.id)
            )
            raise ValueError(f"Failed to parse JSON response: {e}. Content: {text_content[:500]}") from e
        
        # Transform API response to match PersonaProfile model
        from datetime import datetime

        # Extract additional identity attributes
        full_name = payload.get("full_name") or payload.get("name", persona.name)
        age_value = payload.get("age")
        age: int | None = None
        if isinstance(age_value, (int, float)):
            age = int(age_value)
        elif isinstance(age_value, str) and age_value.strip().isdigit():
            age = int(age_value.strip())

        location = payload.get("location")

        def _normalize_str_list(value: Any) -> List[str]:
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]
            if isinstance(value, str) and value.strip():
                return [value.strip()]
            return []

        interests = _normalize_str_list(payload.get("interests", []))
        color_palette = [color for color in _normalize_str_list(payload.get("color_palette", [])) if color]
        attention_span = payload.get("attention_span")
        social_media_usage = _normalize_str_list(payload.get("social_media_usage", []))
        values = _normalize_str_list(payload.get("values", []))

        # Transform pain_points: ensure it's a list of PersonaPainPoint objects
        pain_points_raw = payload.get("pain_points", [])
        pain_points = []
        for pp in pain_points_raw:
            if isinstance(pp, dict):
                pain_points.append(PersonaPainPoint(
                    label=pp.get("label", ""),
                    evidence_count=int(pp.get("evidence_count", 0))
                ))
            elif isinstance(pp, str):
                # If it's just a string, convert it
                pain_points.append(PersonaPainPoint(label=pp, evidence_count=1))
        
        # Transform goals: ensure it's a list of PersonaGoal objects
        goals_raw = payload.get("goals", [])
        goals = []
        for idx, goal in enumerate(goals_raw):
            if isinstance(goal, dict):
                goals.append(PersonaGoal(
                    label=goal.get("label", ""),
                    priority=int(goal.get("priority", idx + 1))
                ))
            elif isinstance(goal, str):
                # If it's just a string, convert it
                goals.append(PersonaGoal(label=goal, priority=idx + 1))
        
        # Transform communication_style
        comm_style_raw = payload.get("communication_style", {})
        if isinstance(comm_style_raw, dict):
            comm_style = PersonaCommunicationStyle(
                vocabulary=comm_style_raw.get("vocabulary", []),
                sentence_structure=comm_style_raw.get("sentence_structure", "standard"),
                skepticism_level=int(comm_style_raw.get("skepticism_level", 5))
            )
        else:
            comm_style = PersonaCommunicationStyle(
                vocabulary=[],
                sentence_structure="standard",
                skepticism_level=5
            )
        
        # Transform traits: ensure all values are floats, filter out None values
        traits_raw = payload.get("traits", {})
        traits = {k: float(v) for k, v in traits_raw.items() if v is not None and isinstance(v, (int, float))}
        
        profile = PersonaProfile(
            id=str(persona.id),
            name=payload.get("name", persona.name),
            full_name=full_name,
            age=age,
            location=location,
            segment=persona.segment,
            headline=payload.get("headline", persona.headline),
            bio=payload.get("bio", ""),
            interests=interests,
            color_palette=color_palette,
            attention_span=attention_span,
            social_media_usage=social_media_usage,
            values=values,
            traits=traits,
            pain_points=pain_points,
            goals=goals,
            communication_style=comm_style,
            confidence=float(payload.get("confidence", persona.confidence)),
            version=persona.version,
            created_at=persona.created_at.isoformat(),
        )

        prompt_template = f"""
        PERSONA IDENTITY:
        You are {profile.name}, representing the {profile.segment} perspective.

        BACKSTORY:
        {profile.bio}

        COMMUNICATION STYLE:
        Vocabulary: {", ".join(profile.communication_style.vocabulary)}
        Sentence structure: {profile.communication_style.sentence_structure}
        Skepticism level: {profile.communication_style.skepticism_level}

        TOP PAIN POINTS:
        {chr(10).join(f"- {pp.label} (evidence: {pp.evidence_count})" for pp in profile.pain_points)}

        TOP GOALS:
        {chr(10).join(f"- {g.label} (priority: {g.priority})" for g in profile.goals)}

        RULES:
        - Stay in persona, challenge assumptions, speak naturally.
        - Keep answers concise and conversational unless depth is explicitly required.
        - Do not cite document IDs or confidence percentages unless the user asks.
        """

        prompt = PersonaPrompt(
            persona_id=str(persona.id),
            system_prompt=prompt_template.strip(),
            template_version="2025-01-18",
        )

        # Generate concise profile card summary
        profile_card = None
        try:
            profile_card = self._generate_profile_card(profile)
        except Exception as card_error:
            logger.warning(
                "persona.profile_card.generate_failed",
                error=str(card_error),
                persona_id=str(persona.id),
            )
        
        # Generate persona image
        image_url = None
        try:
            image_url = self._image_service.generate_portrait(profile, save_to_storage=True)
            if image_url:
                logger.info("persona_image.generated", persona_id=str(persona.id), image_url=image_url)
        except Exception as e:
            logger.warning("persona_image.generation_failed_graceful", error=str(e), persona_id=str(persona.id))
            # Continue without image - graceful degradation

        
        with get_session() as session:
            persona_model = session.get(Persona, persona.id)
            if persona_model:
                persona_model.profile = profile.model_dump()
                persona_model.confidence = profile.confidence
                if image_url:
                    persona_model.image_url = image_url
                    persona_model.image_generated_at = datetime.utcnow()
                if profile_card:
                    persona_model.profile_card = profile_card
            persona_prompt = PersonaPromptModel(
                persona_id=persona.id, system_prompt=prompt.system_prompt, template_version="2025-01-18"
            )
            session.add(persona_prompt)
            for chunk in chunk_ids:
                session.add(
                    PersonaSource(
                        persona_id=persona.id,
                        chunk_id=chunk,
                        confidence=profile.confidence,
                        rationale="Seed chunk for persona synthesis",
                    )
                )
            session.commit()

        return PersonaGenerationResult(
            profile=profile,
            prompt=prompt,
            sources=[
                {
                    "chunk_id": str(chunk_id),
                    "confidence": profile.confidence,
                }
                for chunk_id in chunk_ids
            ],
            profile_card=profile_card,
        )

    def generate_profile_card_from_persona(self, persona: Persona) -> Dict[str, Any]:
        profile = self._persona_profile_from_store(persona)
        return self._generate_profile_card(profile)

    def _response_to_text(self, response: Any) -> str:
        if not response.content:
            raise ValueError("Empty response from Anthropic API")
        first_block = response.content[0]
        return first_block.text if hasattr(first_block, "text") else str(first_block)

    def _extract_json_block(self, text_content: str) -> str:
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text_content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        json_match = re.search(r"\{.*\}", text_content, re.DOTALL)
        if json_match:
            return json_match.group(0)
        return text_content.strip()

    def _generate_profile_card(self, profile: PersonaProfile) -> Dict[str, Any]:
        goals_text = "\n".join(f"- {goal.label} (priority {goal.priority})" for goal in profile.goals[:5]) or "- Goal insights pending"
        pains_text = "\n".join(f"- {pain.label} (evidence {pain.evidence_count})" for pain in profile.pain_points[:5]) or "- Frustrations not captured"
        vocab_text = ", ".join(profile.communication_style.vocabulary[:6]) or "plain language"
        traits_text = (
            "\n".join(f"- {label}: {score:.2f}" for label, score in list(profile.traits.items())[:5])
            or "- Traits not scored"
        )

        summary_prompt = f"""
You are crafting a concise, client-ready persona sedcard summary for strategists.
Persona Details:
Name: {profile.name}
Segment: {profile.segment}
Headline: {profile.headline}
Bio: {profile.bio}

Goals:
{goals_text}

Frustrations:
{pains_text}

Traits:
{traits_text}

Communication:
- Sentence structure: {profile.communication_style.sentence_structure}
- Skepticism: {profile.communication_style.skepticism_level}
- Vocabulary: {vocab_text}

Return STRICT JSON with EXACTLY these keys:
{{
  "display_name": "string",
  "headline": "string",
  "archetype": "string",
  "tone": "string",
  "age_range": "string",
  "location": "string",
  "tagline": "string",
  "key_facts": ["string", "string"],
  "goals": ["string", "string"],
  "frustrations": ["string", "string"],
  "preferred_channels": ["string", "string"],
  "call_to_action": "string"
}}
Values must be grounded in the source persona. Use concise human language.
"""

        response = self._anthropic.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=400,
            temperature=0.2,
            messages=[{"role": "user", "content": summary_prompt}],
        )
        summary_text = self._response_to_text(response)
        summary_text = self._extract_json_block(summary_text)

        try:
            data = json.loads(summary_text)
        except json.JSONDecodeError as err:
            logger.warning(
                "persona.profile_card.json_parse_failed",
                error=str(err),
                persona_id=profile.id,
                preview=summary_text[:200],
            )
            data = {}

        normalized = self._normalize_profile_card(data, profile)
        return normalized

    def _normalize_profile_card(self, data: Dict[str, Any], profile: PersonaProfile) -> Dict[str, Any]:
        def _listify(value: Any) -> List[str]:
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]
            if isinstance(value, str) and value.strip():
                return [value.strip()]
            return []

        default_facts = self._build_default_key_facts(profile)
        return {
            "display_name": data.get("display_name") or profile.name,
            "headline": data.get("headline") or profile.headline,
            "archetype": data.get("archetype") or profile.segment,
            "tone": data.get("tone") or "Candid & practical",
            "age_range": data.get("age_range") or "30s-40s",
            "location": data.get("location") or "Not specified",
            "tagline": data.get("tagline") or profile.bio[:120],
            "key_facts": _listify(data.get("key_facts")) or default_facts,
            "goals": _listify(data.get("goals")) or [goal.label for goal in profile.goals[:3]],
            "frustrations": _listify(data.get("frustrations")) or [pain.label for pain in profile.pain_points[:3]],
            "preferred_channels": _listify(data.get("preferred_channels")) or ["Email", "Video call"],
            "call_to_action": data.get("call_to_action") or "Frame ideas in their words and quantify outcomes quickly.",
        }

    def _build_default_key_facts(self, profile: PersonaProfile) -> List[str]:
        facts: List[str] = []
        if profile.headline:
            facts.append(profile.headline)
        if profile.communication_style.vocabulary:
            facts.append(f"Speaks in {profile.communication_style.vocabulary[0]}-style phrasing.")
        if profile.goals:
            facts.append(f"Top goal: {profile.goals[0].label}.")
        if profile.pain_points:
            facts.append(f"Worried about {profile.pain_points[0].label.lower()}.")
        if not facts:
            facts.append("Relies on qualitative research for direction.")
        return facts[:4]

    def _persona_profile_from_store(self, persona: Persona) -> PersonaProfile:
        profile_dict = persona.profile if isinstance(persona.profile, dict) else {}
        if profile_dict:
            try:
                return PersonaProfile(**profile_dict)
            except Exception as exc:
                logger.warning("persona.profile_card.deserialize_failed", error=str(exc), persona_id=str(persona.id))
        comm_dict = profile_dict.get("communication_style", {}) if isinstance(profile_dict, dict) else {}
        communication_style = PersonaCommunicationStyle(
            vocabulary=comm_dict.get("vocabulary", []) if isinstance(comm_dict, dict) else [],
            sentence_structure=comm_dict.get("sentence_structure", "standard") if isinstance(comm_dict, dict) else "standard",
            skepticism_level=int(comm_dict.get("skepticism_level", 5)) if isinstance(comm_dict, dict) else 5,
        )
        return PersonaProfile(
            id=str(persona.id),
            name=persona.name,
            full_name=profile_dict.get("full_name"),
            segment=persona.segment,
            headline=persona.headline,
            bio=profile_dict.get("bio", ""),
            age=profile_dict.get("age"),
            location=profile_dict.get("location"),
            interests=profile_dict.get("interests", []),
            color_palette=profile_dict.get("color_palette", []),
            attention_span=profile_dict.get("attention_span"),
            social_media_usage=profile_dict.get("social_media_usage", []),
            values=profile_dict.get("values", []),
            traits=profile_dict.get("traits", {}),
            pain_points=[
                PersonaPainPoint(label=p.get("label", "Pain point"), evidence_count=int(p.get("evidence_count", 1)))
                for p in profile_dict.get("pain_points", [])
                if isinstance(p, dict)
            ],
            goals=[
                PersonaGoal(label=g.get("label", "Goal"), priority=int(g.get("priority", idx + 1)))
                for idx, g in enumerate(profile_dict.get("goals", []))
                if isinstance(g, dict)
            ],
            communication_style=communication_style,
            confidence=persona.confidence,
            version=persona.version,
            created_at=persona.created_at.isoformat(),
        )

