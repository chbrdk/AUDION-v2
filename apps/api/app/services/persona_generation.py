from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List
from uuid import UUID

import structlog
from anthropic import Anthropic
from sqlalchemy import select
from udg_glass_proto import PersonaProfile, PersonaPrompt

from ..core.config import get_settings
from ..db import get_session
from ..models import DocumentChunk, Persona, PersonaPrompt as PersonaPromptModel, PersonaSource

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass
class PersonaGenerationResult:
    profile: PersonaProfile
    prompt: PersonaPrompt
    sources: List[Dict]


class PersonaGenerationService:
    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.claude_api_key)

    def generate(self, *, persona: Persona, chunk_ids: List[UUID]) -> PersonaGenerationResult:
        with get_session() as session:
            chunks = session.scalars(
                select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)).order_by(DocumentChunk.id)
            ).all()

        excerpts = "\n".join(f"- {chunk.content}" for chunk in chunks)
        identity_prompt = (
            "Craft a vivid persona profile with demographics, goals, pain points, comms style. "
            "Return JSON with keys name, age, job_title, headline, bio, pain_points, goals, "
            "traits (dict), communication_style (vocabulary[], sentence_structure, skepticism), "
            "confidence. Base everything strictly on:\n"
            f"{excerpts}"
        )

        identity = self._anthropic.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=1000,
            temperature=0.2,
            messages=[{"role": "user", "content": identity_prompt}],
        )

        import json

        payload = json.loads(identity.content[0].text)  # type: ignore[index]
        profile = PersonaProfile(
            id=str(persona.id),
            name=payload.get("name", persona.name),
            segment=persona.segment,
            headline=payload.get("headline", persona.headline),
            bio=payload.get("bio", ""),
            traits=payload.get("traits", {}),
            painPoints=payload.get("pain_points", []),
            goals=payload.get("goals", []),
            communicationStyle=payload.get("communication_style", {}),
            confidence=float(payload.get("confidence", persona.confidence)),
            version=persona.version,
            createdAt=persona.created_at.isoformat(),
        )

        prompt_template = f"""
        PERSONA IDENTITY:
        You are {profile.name}, representing the {profile.segment} perspective.

        BACKSTORY:
        {profile.bio}

        COMMUNICATION STYLE:
        Vocabulary: {", ".join(profile.communicationStyle.get("vocabulary", []))}
        Sentence structure: {profile.communicationStyle.get("sentence_structure")}
        Skepticism level: {profile.communicationStyle.get("skepticism_level")}

        TOP PAIN POINTS:
        {profile.painPoints}

        TOP GOALS:
        {profile.goals}

        RULES:
        - Stay in persona, challenge assumptions, cite sources by [doc_id].
        - Provide confidence percentage for each answer.
        """

        prompt = PersonaPrompt(
            personaId=str(persona.id),
            systemPrompt=prompt_template.strip(),
            templateVersion="2025-11-18",
        )

        with get_session() as session:
            persona_model = session.get(Persona, persona.id)
            if persona_model:
                persona_model.profile = profile.model_dump()
                persona_model.confidence = profile.confidence
            persona_prompt = PersonaPromptModel(
                persona_id=persona.id, system_prompt=prompt.systemPrompt, template_version="2025-11-18"
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
        )

