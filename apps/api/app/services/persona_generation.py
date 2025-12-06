from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List
from uuid import UUID

import numpy as np
import structlog
from anthropic import Anthropic
from sqlalchemy import select
from udg_glass_proto import PersonaProfile, PersonaPrompt

from ..core.config import get_settings
from ..db import get_session
from ..models import (
    Document,
    DocumentChunk,
    Persona,
    PersonaPrompt as PersonaPromptModel,
    PersonaSource,
    TargetGroupSource,
)

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

    def _sample_chunks_weighted(
        self,
        chunks: List[DocumentChunk],
        source_map: Dict[UUID, float],
        sample_size: int,
        seed: int | None = None,
    ) -> List[DocumentChunk]:
        """Sample chunks with weighted random selection based on relevance_score."""
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

        # Create weights from relevance_score (normalize to 0-1)
        weights = [source_map.get(chunk.id, 0.0) for chunk in chunks]
        if sum(weights) == 0:
            # Fallback to uniform sampling if no weights
            weights = [1.0] * len(chunks)
        else:
            # Normalize weights
            max_weight = max(weights)
            weights = [w / max_weight if max_weight > 0 else 0.0 for w in weights]

        # Weighted random sampling without replacement
        if sample_size >= len(chunks):
            return chunks

        # Use numpy for weighted sampling
        weights_array = np.array(weights)
        weights_normalized = weights_array / weights_array.sum() if weights_array.sum() > 0 else np.ones(len(chunks)) / len(chunks)
        indices = np.random.choice(len(chunks), size=sample_size, replace=False, p=weights_normalized)
        return [chunks[i] for i in indices]

    def generate(
        self,
        *,
        persona: Persona,
        chunk_ids: List[UUID] | None = None,
        target_group_id: UUID | None = None,
        document_ids: List[UUID] | None = None,
        chunk_weights: Dict[str, float] | None = None,
        limit_chunks: int | None = None,
        variation_params: Dict | None = None,
    ) -> PersonaGenerationResult:
        target_group_sources = []
        with get_session() as session:
            # If target_group_id is provided, get chunks from TargetGroupSource
            if target_group_id:
                target_group_sources = session.scalars(
                    select(TargetGroupSource)
                    .where(TargetGroupSource.target_group_id == target_group_id)
                    .order_by(TargetGroupSource.relevance_score.desc())
                ).all()
                chunk_ids_from_tg = [source.chunk_id for source in target_group_sources]
                
                # Handle manual chunk selection (chunks_manual mode)
                if chunk_ids:
                    # User has manually selected specific chunks
                    # Validate that all chunk_ids belong to this target group
                    valid_chunk_ids = [cid for cid in chunk_ids if cid in chunk_ids_from_tg]
                    if len(valid_chunk_ids) != len(chunk_ids):
                        logger.warning(
                            "persona.generate.invalid_chunks_for_tg",
                            requested=len(chunk_ids),
                            valid=len(valid_chunk_ids),
                        )
                    chunk_ids_to_use = valid_chunk_ids
                    
                    # Update chunk weights if provided (manually set relevance_score)
                    if chunk_weights:
                        for chunk_id_str, weight in chunk_weights.items():
                            try:
                                chunk_uuid = UUID(chunk_id_str)
                                source = session.scalar(
                                    select(TargetGroupSource)
                                    .where(TargetGroupSource.chunk_id == chunk_uuid)
                                    .where(TargetGroupSource.target_group_id == target_group_id)
                                ).first()
                                if source:
                                    source.relevance_score = float(weight)
                            except (ValueError, TypeError):
                                logger.warning("persona.generate.invalid_chunk_weight", chunk_id=chunk_id_str)
                        session.commit()
                    
                    # Get chunks from manual selection
                    chunks = session.scalars(
                        select(DocumentChunk)
                        .where(DocumentChunk.id.in_(chunk_ids_to_use))
                    ).all()
                    # Sort by relevance_score if weights were updated
                    if chunk_weights:
                        source_map = {
                            s.chunk_id: s.relevance_score
                            for s in target_group_sources
                            if s.chunk_id in chunk_ids_to_use
                        }
                        chunks = sorted(chunks, key=lambda c: source_map.get(c.id, 0.0), reverse=True)
                # Apply document filter if document_ids provided (documents mode)
                elif document_ids:
                    chunks = session.scalars(
                        select(DocumentChunk)
                        .join(Document)
                        .where(Document.id.in_(document_ids))
                        .where(DocumentChunk.id.in_(chunk_ids_from_tg))
                    ).all()
                    # Re-sort by relevance_score after document filter
                    source_map = {s.chunk_id: s.relevance_score for s in target_group_sources}
                    chunks = sorted(chunks, key=lambda c: source_map.get(c.id, 0.0), reverse=True)
                # Auto mode: use all chunks from target group
                else:
                    chunks = session.scalars(
                        select(DocumentChunk)
                        .where(DocumentChunk.id.in_(chunk_ids_from_tg))
                    ).all()
                    # Sort by relevance_score from target_group_sources
                    source_map = {s.chunk_id: s.relevance_score for s in target_group_sources}
                    
                    # NEW: Weighted random sampling für Variation
                    should_randomize = variation_params is None or variation_params.get("randomize_chunks", True)
                    if should_randomize:
                        sample_size = variation_params.get("chunk_sample_size") if variation_params else None
                        sample_size = sample_size or limit_chunks or len(chunks)
                        seed = variation_params.get("seed") if variation_params else None  # Optional für Reproduzierbarkeit
                        chunks = self._sample_chunks_weighted(chunks, source_map, sample_size, seed)
                    else:
                        # Original: Sort by relevance_score
                        chunks = sorted(chunks, key=lambda c: source_map.get(c.id, 0.0), reverse=True)
            elif chunk_ids:
                chunks = session.scalars(
                    select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)).order_by(DocumentChunk.id)
                ).all()
            else:
                chunks = []
            
            # Limit chunks for LLM input if specified (only for auto and documents mode, and if not using weighted sampling)
            if limit_chunks and len(chunks) > limit_chunks and not chunk_ids:
                # Only apply limit if we didn't already sample with chunk_sample_size
                if not (variation_params and variation_params.get("chunk_sample_size")):
                    chunks = chunks[:limit_chunks]

        if not chunks:
            raise ValueError("No chunks available for persona generation")

        # Log chunk selection for debugging
        logger.info(
            "persona.generate.chunks_selected",
            persona_id=str(persona.id),
            chunk_count=len(chunks),
            chunk_ids=[str(c.id) for c in chunks[:10]],  # First 10 for logging
            randomize_chunks=variation_params.get("randomize_chunks", False) if variation_params else False,
            chunk_sample_size=variation_params.get("chunk_sample_size") if variation_params else None,
            seed=variation_params.get("seed") if variation_params else None,
        )

        excerpts = "\n".join(f"- {chunk.content}" for chunk in chunks)
        
        # Define prompt variations
        prompt_templates = {
            "vivid": (
                "Craft a vivid, detailed persona profile with demographics, goals, pain points, comms style. "
                "Make it memorable and distinctive. Return JSON with keys name, age, job_title, headline, bio, "
                "pain_points, goals, traits (dict), communication_style (vocabulary[], sentence_structure, skepticism), "
                "confidence. Base everything strictly on:\n"
            ),
            "analytical": (
                "Analyze the provided research data and extract a systematic persona profile with demographics, "
                "goals, pain points, and communication patterns. Return JSON with keys name, age, job_title, "
                "headline, bio, pain_points, goals, traits (dict), communication_style (vocabulary[], sentence_structure, skepticism), "
                "confidence. Base everything strictly on:\n"
            ),
            "personality-focused": (
                "Focus on personality traits and communication style. Create a persona profile emphasizing unique "
                "characteristics, vocabulary, and behavior patterns. Return JSON with keys name, age, job_title, "
                "headline, bio, pain_points, goals, traits (dict), communication_style (vocabulary[], sentence_structure, skepticism), "
                "confidence. Base everything strictly on:\n"
            ),
            "goal-oriented": (
                "Emphasize goals, pain points, and motivations. Create a persona profile that highlights what drives "
                "this person and what they struggle with. Return JSON with keys name, age, job_title, headline, bio, "
                "pain_points, goals, traits (dict), communication_style (vocabulary[], sentence_structure, skepticism), "
                "confidence. Base everything strictly on:\n"
            )
        }

        # Select prompt style
        prompt_style = "vivid"
        if variation_params and "prompt_style" in variation_params:
            prompt_style = variation_params.get("prompt_style", "vivid")
        elif not variation_params or variation_params.get("randomize_prompt", True):
            prompt_style = random.choice(list(prompt_templates.keys()))
        else:
            # Default to vivid if randomize_prompt is False and no prompt_style specified
            prompt_style = "vivid"

        identity_prompt = prompt_templates.get(prompt_style, prompt_templates["vivid"]) + f"{excerpts}"

        # Log prompt style
        logger.info(
            "persona.generate.prompt_style",
            persona_id=str(persona.id),
            prompt_style=prompt_style,
        )

        # Get temperature from variation_params or use default/random
        if variation_params and "temperature" in variation_params:
            temp_value = variation_params["temperature"]
            if isinstance(temp_value, (int, float)) and 0.0 <= temp_value <= 1.0:
                temperature = float(temp_value)
            elif temp_value == "random":
                temperature = random.uniform(0.5, 0.8)
            else:
                # Default to random if invalid value
                temperature = random.uniform(0.5, 0.8)
        else:
            # Default: Higher temperature for more variation
            if variation_params and variation_params.get("temperature_mode") == "random":
                temperature = random.uniform(0.5, 0.8)
            else:
                temperature = 0.6  # Increased from 0.2

        # Log temperature
        logger.info(
            "persona.generate.temperature",
            persona_id=str(persona.id),
            temperature=temperature,
            temperature_mode=variation_params.get("temperature_mode") if variation_params else "default",
        )
        
        identity = self._anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            temperature=temperature,
            messages=[{"role": "user", "content": identity_prompt}],
        )

        import json
        import re

        # Log the response for debugging
        if not identity.content or len(identity.content) == 0:
            logger.error("persona.generate.empty_response", persona_id=str(persona.id))
            raise ValueError("Empty response from Anthropic API")
        
        response_text = identity.content[0].text if identity.content else ""
        logger.info("persona.generate.anthropic_response", persona_id=str(persona.id), response_length=len(response_text), response_preview=response_text[:200])
        
        if not response_text or not response_text.strip():
            logger.error("persona.generate.empty_response_text", persona_id=str(persona.id))
            raise ValueError("Empty response text from Anthropic API")
        
        # Remove markdown code blocks if present (```json ... ```)
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```"):
            # Remove opening ```json or ```
            cleaned_text = re.sub(r'^```(?:json)?\s*\n', '', cleaned_text)
            # Remove closing ```
            cleaned_text = re.sub(r'\n```\s*$', '', cleaned_text)
            cleaned_text = cleaned_text.strip()
        
        try:
            payload = json.loads(cleaned_text)
        except json.JSONDecodeError as exc:
            logger.error("persona.generate.json_parse_error", persona_id=str(persona.id), response_text=response_text[:500], cleaned_text=cleaned_text[:500], error=str(exc))
            raise ValueError(f"Failed to parse JSON response from Anthropic API: {str(exc)}") from exc
        
        # Helper function to safely convert confidence to float
        def parse_confidence(value):
            """Parse confidence value - can be float, string with number, or descriptive text."""
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                # Try to extract a number from the string
                import re
                numbers = re.findall(r'\d+\.?\d*', value)
                if numbers:
                    try:
                        return float(numbers[0])
                    except (ValueError, IndexError):
                        pass
                # If it's a descriptive text like "High", use default mapping
                value_lower = value.lower()
                if "high" in value_lower or "very high" in value_lower:
                    return 0.9
                elif "medium" in value_lower or "moderate" in value_lower:
                    return 0.6
                elif "low" in value_lower:
                    return 0.3
                else:
                    # Default to medium if we can't parse
                    return 0.7
            return persona.confidence
        
        # Merge variation_params if provided (for random persona variations)
        confidence_value = payload.get("confidence", persona.confidence)
        try:
            parsed_confidence = parse_confidence(confidence_value)
        except Exception as exc:
            logger.warning("persona.generate.confidence_parse_failed", persona_id=str(persona.id), confidence_value=confidence_value, error=str(exc))
            parsed_confidence = persona.confidence
        
        # Convert pain_points from strings to PersonaPainPoint objects
        pain_points_raw = payload.get("pain_points", [])
        pain_points = []
        if isinstance(pain_points_raw, list):
            for pp in pain_points_raw:
                if isinstance(pp, str):
                    pain_points.append({"label": pp, "evidence_count": 1})
                elif isinstance(pp, dict):
                    pain_points.append({
                        "label": pp.get("label", str(pp)),
                        "evidence_count": pp.get("evidence_count", 1)
                    })
        
        # Convert goals from strings to PersonaGoal objects
        goals_raw = payload.get("goals", [])
        goals = []
        if isinstance(goals_raw, list):
            for idx, goal in enumerate(goals_raw):
                if isinstance(goal, str):
                    goals.append({"label": goal, "priority": idx + 1})
                elif isinstance(goal, dict):
                    goals.append({
                        "label": goal.get("label", str(goal)),
                        "priority": goal.get("priority", idx + 1)
                    })
        
        # Convert communication_style to PersonaCommunicationStyle format
        comm_style_raw = payload.get("communication_style", {})
        communication_style = {
            "vocabulary": comm_style_raw.get("vocabulary", []) if isinstance(comm_style_raw, dict) else [],
            "sentence_structure": comm_style_raw.get("sentence_structure", "") if isinstance(comm_style_raw, dict) else "",
            "skepticism_level": comm_style_raw.get("skepticism_level", 3) if isinstance(comm_style_raw, dict) else 3
        }
        # If skepticism is a string, try to parse it
        if isinstance(communication_style["skepticism_level"], str):
            skepticism_str = communication_style["skepticism_level"].lower()
            if "high" in skepticism_str or "very high" in skepticism_str:
                communication_style["skepticism_level"] = 5
            elif "medium" in skepticism_str or "moderate" in skepticism_str:
                communication_style["skepticism_level"] = 3
            elif "low" in skepticism_str or "very low" in skepticism_str:
                communication_style["skepticism_level"] = 1
            else:
                communication_style["skepticism_level"] = 3
        
        profile_dict = {
            "id": str(persona.id),
            "name": payload.get("name", persona.name),
            "segment": persona.segment,
            "headline": payload.get("headline", persona.headline),
            "bio": payload.get("bio", ""),
            "traits": payload.get("traits", {}),
            "pain_points": pain_points,
            "goals": goals,
            "communication_style": communication_style,
            "confidence": parsed_confidence,
            "version": persona.version,
            "created_at": persona.created_at.isoformat(),
        }
        
        # Add variation_params to profile if provided
        if variation_params:
            if "traits" not in profile_dict:
                profile_dict["traits"] = {}
            # Merge variation_params into traits
            for key, value in variation_params.items():
                if isinstance(value, (int, float)):
                    profile_dict["traits"][key] = value
        
        profile = PersonaProfile(**profile_dict)

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
        {chr(10).join([f"- {pp.label}" for pp in profile.pain_points]) if profile.pain_points else "None"}

        TOP GOALS:
        {chr(10).join([f"- {g.label}" for g in profile.goals]) if profile.goals else "None"}

        RULES:
        - Stay in persona, challenge assumptions, cite sources by [doc_id].
        - Provide confidence percentage for each answer.
        """

        prompt = PersonaPrompt(
            persona_id=str(persona.id),
            system_prompt=prompt_template.strip(),
            template_version="2025-11-18",
        )

        with get_session() as session:
            persona_model = session.get(Persona, persona.id)
            if persona_model:
                persona_model.profile = profile.model_dump()
                persona_model.confidence = profile.confidence
                # Set target_group_id if provided
                if target_group_id:
                    persona_model.target_group_id = target_group_id
            persona_prompt = PersonaPromptModel(
                persona_id=persona.id, system_prompt=prompt.system_prompt, template_version="2025-11-18"
            )
            session.add(persona_prompt)
            
            # Only create PersonaSource if chunk_ids are provided (not using target_group)
            if chunk_ids and not target_group_id:
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

        # Build sources list for response
        if target_group_id:
            # Get chunk_ids from TargetGroupSource for response
            actual_chunk_ids = [str(source.chunk_id) for source in target_group_sources]
        else:
            actual_chunk_ids = [str(cid) for cid in chunk_ids] if chunk_ids else []

        # Build sources list from actual_chunk_ids
        sources_list = [
            {
                "chunk_id": chunk_id,
                "confidence": profile.confidence,
            }
            for chunk_id in actual_chunk_ids
        ]
        
        return PersonaGenerationResult(
            profile=profile,
            prompt=prompt,
            sources=sources_list,
        )

