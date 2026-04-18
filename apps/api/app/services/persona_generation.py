from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List
from uuid import UUID

import numpy as np
import structlog
from sqlalchemy import select, func

if TYPE_CHECKING:
    from msqdx_glass_proto import PersonaProfile, PersonaPrompt  # pragma: no cover

from ..core.config import get_settings
from ..db import get_session
from .persona_headline import truncate_headline as _truncate_headline_for_db
from .persona_bilingual_utils import json_shape_compatible
from ..models import (
    Document,
    DocumentChunk,
    Persona,
    PersonaPrompt as PersonaPromptModel,
    PersonaSource,
    Project,
    TargetGroupSource,
    TargetGroup,
)

logger = structlog.get_logger(__name__)
settings = get_settings()


# LLM instruction: must match PersonaProfile (proto) + extras the UI expects in profile JSON.
PERSONA_LLM_JSON_SCHEMA_INSTRUCTION = (
    "Return ONE JSON object with these keys: "
    "name (string, short display name), full_name (string|null), age (integer|null), "
    "gender (string|null, use English labels where applicable, e.g. female, male, non-binary, prefer not to say), "
    "location (string|null, city/region/country one line), "
    "media_affinity (integer 0-100|null, digital/news/media consumption intensity), "
    "interests (array of 4-10 concise interest tags), "
    "values (array of 4-10 concise value statements for this persona), "
    "headline (string), bio (string), job_title (string|null, contextual only), "
    "pain_points (array of strings or {label, evidence_count} objects), "
    "goals (array of strings or {label, priority} objects where priority MUST be an integer 1..n, not words like high/medium), "
    "traits (object: trait name -> number 0-1 or qualitative level), "
    "communication_style: { vocabulary (string array), sentence_structure (string), skepticism_level (number 1-5) }, "
    "confidence (number 0-1). "
    "Optionally: social_media_usage (string array), attention_span (string), color_palette (string array). "
    "Do not omit interests or values; infer plausible items from the research when not explicit. "
    "LANGUAGE (mandatory): All human-readable string values must be English — name, full_name, headline, bio, "
    "job_title, gender, location, interests, values, pain point labels, goal labels, trait names/keys as shown to users, "
    "communication_style.vocabulary and sentence_structure, attention_span, social_media_usage strings. "
    "Keep JSON keys in English as listed. Numeric fields stay numbers."
)


def _optional_str(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _coerce_str_list(val: Any) -> list[str]:
    if val is None:
        return []
    if isinstance(val, list):
        out: list[str] = []
        for x in val:
            if x is None:
                continue
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
            elif isinstance(x, dict):
                label = x.get("label") or x.get("name") or x.get("title")
                if label:
                    out.append(str(label).strip())
            else:
                s = str(x).strip()
                if s:
                    out.append(s)
        return out
    if isinstance(val, str) and val.strip():
        return [val.strip()]
    return []


def _parse_age_optional(val: Any) -> int | None:
    if val is None:
        return None
    if isinstance(val, bool):
        return None
    if isinstance(val, int):
        return val if 0 < val < 130 else None
    if isinstance(val, float):
        i = int(val)
        return i if 0 < i < 130 else None
    if isinstance(val, str):
        m = re.search(r"\b(\d{1,3})\b", val)
        if m:
            i = int(m.group(1))
            if 0 < i < 130:
                return i
    return None


def _parse_media_affinity_optional(val: Any) -> int | None:
    if val is None:
        return None
    if isinstance(val, bool):
        return None
    if isinstance(val, (int, float)):
        x = int(round(float(val)))
        return max(0, min(100, x))
    if isinstance(val, str):
        m = re.search(r"\d+", val)
        if m:
            return _parse_media_affinity_optional(int(m.group(0)))
    return None


def _parse_goal_priority(raw: Any, idx: int) -> int:
    """Coerce LLM goal priority to int (models often return 'high' / 'medium' / MoSCoW)."""
    if raw is None:
        return idx + 1
    if isinstance(raw, bool):
        return idx + 1
    if isinstance(raw, int):
        return max(1, min(999, raw))
    if isinstance(raw, float):
        return max(1, min(999, int(round(raw))))
    if isinstance(raw, str):
        s = raw.strip().lower()
        if s.isdigit():
            return max(1, min(999, int(s)))
        m = re.search(r"\b(\d+)\b", s)
        if m:
            return max(1, min(999, int(m.group(1))))
        # Qualitative importance → ordered bands; idx keeps duplicates within a band distinct
        if any(k in s for k in ("critical", "must", "p0", "highest", "urgent")):
            return 1 + idx
        if any(k in s for k in ("high", "should", "important", "p1")):
            return 10 + idx
        if any(k in s for k in ("medium", "could", "moderate", "p2", "mid")):
            return 20 + idx
        if any(k in s for k in ("low", "wont", "nice", "p3", "lower", "lowest")):
            return 30 + idx
    return idx + 1


def _compose_identity_context_block(*, persona: Persona, target_group_id: UUID | None) -> str:
    """Project company context, target group summary, and user segment/brief for the LLM (traits, pain points, etc.)."""
    blocks: list[str] = []
    with get_session() as session:
        if persona.project_id is not None:
            project = session.get(Project, persona.project_id)
            if project is not None:
                cc = (project.company_context or "").strip()
                if cc:
                    blocks.append(
                        "COMPANY / PROJECT CONTEXT (ground truth; align facts, industry, and tone with this):\n" + cc
                    )
                else:
                    desc = (project.description or "").strip()
                    if desc:
                        blocks.append("PROJECT DESCRIPTION:\n" + desc)
        if target_group_id is not None:
            tg = session.get(TargetGroup, target_group_id)
            if tg is not None:
                blocks.append(
                    "TARGET GROUP (segmentation context):\n"
                    f"- Name: {tg.name}\n"
                    f"- Segment: {tg.segment or '—'}\n"
                    f"- Description: {tg.description or '—'}"
                )
    user_lines: list[str] = []
    seg = (persona.segment or "").strip()
    if seg and seg.lower() not in {"unspecified", "pending"}:
        user_lines.append(f"Persona segment label to align with: {seg}")
    hl = (persona.headline or "").strip()
    if hl:
        user_lines.append(
            "AUTHOR / PRODUCT BRIEF — reflect this in traits, pain_points, goals, communication_style, and bio "
            f"(not only as a tagline): {hl}"
        )
    parts: list[str] = []
    if blocks:
        parts.append("\n\n".join(blocks))
    if user_lines:
        parts.append("USER / PRODUCT FOCUS:\n" + "\n".join(f"- {line}" for line in user_lines))
    if not parts:
        return ""
    out = "\n\n" + "\n\n".join(parts) + "\n"
    out += (
        "\nLANGUAGE: All newly written persona strings in the JSON must be in English, even if research excerpts are not. "
        "Translate faithfully when needed.\n"
    )
    return out


def parse_persona_generation_json(response_text: str) -> dict:
    """Parse LLM output into a JSON object with lightweight repairs.

    We occasionally see invalid JSON due to unescaped quotes/newlines in string values,
    even when the model is instructed to output JSON. This function makes best-effort
    repairs and surfaces a clear error when it can't recover.
    """
    import json

    text = (response_text or "").strip()
    if not text:
        raise ValueError("Empty response text from AI Provider")

    # Remove markdown code blocks if present (```json ... ```), including missing final newline before ```.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
        text = text.strip()

    def _attempt(value: str) -> dict | None:
        try:
            obj = json.loads(value)
        except json.JSONDecodeError:
            return None
        return obj if isinstance(obj, dict) else None

    # 1) direct parse
    parsed = _attempt(text)
    if parsed is not None:
        return parsed

    # 2) normalize smart quotes / weird whitespace + retry
    repaired = (
        text.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u201e", '"')
        .replace("\u2033", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u00a0", " ")
    )
    parsed = _attempt(repaired)
    if parsed is not None:
        return parsed

    # 3) extract the first {...} and retry
    match = re.search(r"\{.*\}", repaired, re.DOTALL)
    if match:
        parsed = _attempt(match.group())
        if parsed is not None:
            return parsed
        # raw_decode can sometimes handle trailing garbage after a valid object
        try:
            decoder = json.JSONDecoder()
            obj, _ = decoder.raw_decode(match.group())
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    # 4) last resort: surface context for debugging
    raise ValueError("Failed to parse JSON response from AI Provider")


def anthropic_complete_text(
    client: Any,
    *,
    model: str,
    max_tokens: int,
    temperature: float,
    system: str,
    messages: List[Dict[str, Any]],
) -> str:
    """Complete assistant text via the Messages API using streaming.

    The Anthropic Python SDK rejects some non-streaming requests when the implied
    completion budget can exceed ~10 minutes; streaming satisfies that contract.
    """
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=messages,
    ) as stream:
        return stream.get_final_text()


@dataclass
class PersonaGenerationResult:
    profile: Any
    prompt: Any
    sources: List[Dict]


class PersonaGenerationService:
    def __init__(self) -> None:
        self.provider = settings.ai_default_provider
        self._anthropic = None
        self._openai = None
        self._openai_repair_lazy_failed = False

        # Smart provider detection:
        # If default is anthropic but no key is present, and we have an OpenAI key, switch to OpenAI.
        if self.provider == "anthropic" and not settings.claude_api_key:
            if settings.openai_api_key:
                logger.info("persona.generate.provider_switch", reason="missing_anthropic_key", new_provider="openai")
                self.provider = "openai"
        
        if self.provider == "openai":
            if not settings.openai_api_key:
                logger.warning("persona.generate.missing_openai_key")
            if settings.openai_api_key:
                try:
                    from openai import OpenAI  # type: ignore

                    self._openai = OpenAI(api_key=settings.openai_api_key)
                except Exception as exc:
                    logger.warning("persona.generate.openai_import_failed", error=str(exc))
                    self._openai = None
        else:
            # Default to Anthropic
            if settings.claude_api_key:
                try:
                    from anthropic import Anthropic  # type: ignore

                    self._anthropic = Anthropic(
                        api_key=settings.claude_api_key,
                        timeout=settings.ai_request_timeout_seconds,
                    )
                except Exception as exc:
                    logger.warning("persona.generate.anthropic_import_failed", error=str(exc))
                    self._anthropic = None
            elif not settings.openai_api_key:
                # If neither key is present, we can't do much.
                pass

    def _openai_for_json_repair(self):
        """OpenAI client for a salvage pass when the primary model returns invalid JSON."""
        if self._openai is not None:
            return self._openai
        if self._openai_repair_lazy_failed or not settings.openai_api_key:
            return None
        try:
            from openai import OpenAI  # type: ignore

            self._openai = OpenAI(api_key=settings.openai_api_key)
            return self._openai
        except Exception as exc:
            self._openai_repair_lazy_failed = True
            logger.warning("persona.generate.openai_repair_client_failed", error=str(exc))
            return None

    def _repair_json_via_openai(self, *, persona_id: UUID, broken_text: str) -> str:
        client = self._openai_for_json_repair()
        if client is None:
            return ""
        logger.info("persona.generate.json_repair_openai", persona_id=str(persona_id))
        max_out = settings.ai_persona_json_repair_max_tokens
        repair = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You fix invalid JSON. Return ONLY a single valid JSON object. "
                        "Do not add any prose. Ensure all strings are properly escaped. "
                        "All human-readable string values must remain or become English. "
                        "Preserve and include interests, values, demographics (full_name, gender, location, age, media_affinity), "
                        "traits, pain_points, goals, communication_style, confidence when inferring missing parts."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "The following content is supposed to be a JSON object but is invalid.\n\n"
                        f"{broken_text}\n\n"
                        "Return the corrected JSON object only. Schema: "
                        + PERSONA_LLM_JSON_SCHEMA_INSTRUCTION
                    ),
                },
            ],
            model=settings.ai_openai_model or "gpt-5-mini",
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=max_out,
        )
        return repair.choices[0].message.content or ""

    def _repair_json_via_anthropic(self, *, persona_id: UUID, broken_text: str) -> str:
        if not self._anthropic:
            return ""
        logger.info("persona.generate.json_repair_anthropic", persona_id=str(persona_id))
        max_out = settings.ai_persona_json_repair_max_tokens
        return anthropic_complete_text(
            self._anthropic,
            model=settings.ai_persona_identity_anthropic_model,
            max_tokens=max_out,
            temperature=0.0,
            system=(
                "You fix invalid or truncated JSON. Output a single valid JSON object only. "
                "No markdown, no code fences, no commentary. Properly escape double quotes inside strings. "
                "All human-readable strings must be English. "
                "Include interests, values, full_name, gender, location, age, media_affinity when repairing."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Repair the following so it is one complete valid JSON object. Schema: "
                        + PERSONA_LLM_JSON_SCHEMA_INSTRUCTION
                        + " Fill in reasonable interests, values, and demographics if truncation removed parts.\n\n"
                        f"{broken_text[:120_000]}"
                    ),
                }
            ],
        )

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

    def _translate_profile_json_en_to_de(self, *, persona_id: UUID, english_profile: dict[str, Any]) -> dict[str, Any] | None:
        """Create a German JSON mirror with identical structure to the English profile JSON."""

        client = self._openai_for_json_repair()
        if client is None:
            logger.warning("persona.translate.profile_de.skipped_no_openai", persona_id=str(persona_id))
            return None

        try:
            completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You translate persona profile JSON from English to German.\n"
                            "Return ONE JSON object with the EXACT same keys/shape as the input.\n"
                            "Translate ONLY string leaf values to natural German.\n"
                            "Keep numbers/booleans/nulls unchanged. Do not add/remove keys.\n"
                            "Do not wrap JSON in markdown fences."
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps(english_profile, ensure_ascii=False),
                    },
                ],
                model=settings.ai_openai_model or "gpt-5-mini",
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=min(int(settings.ai_persona_openai_identity_max_tokens or 8192), 8192),
            )
            text = completion.choices[0].message.content or ""
            parsed = parse_persona_generation_json(text)
            return parsed if isinstance(parsed, dict) else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("persona.translate.profile_de.failed", persona_id=str(persona_id), error=str(exc))
            return None

    def _translate_system_prompt_en_to_de(self, *, persona_id: UUID, english_prompt: str) -> str | None:
        client = self._openai_for_json_repair()
        if client is None:
            logger.warning("persona.translate.system_prompt_de.skipped_no_openai", persona_id=str(persona_id))
            return None
        try:
            completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a professional translator. Translate the following English persona system prompt "
                            "into natural German. Preserve intent, constraints, and first-person roleplay style. "
                            "Return only the German text (no markdown fences, no JSON)."
                        ),
                    },
                    {"role": "user", "content": english_prompt},
                ],
                model=settings.ai_openai_model or "gpt-5-mini",
                temperature=0.2,
                max_tokens=min(int(settings.ai_persona_openai_identity_max_tokens or 8192), 4096),
            )
            out = (completion.choices[0].message.content or "").strip()
            return out or None
        except Exception as exc:  # noqa: BLE001
            logger.warning("persona.translate.system_prompt_de.failed", persona_id=str(persona_id), error=str(exc))
            return None

    def translate_ui_string_map(self, *, from_locale: str, strings: dict[str, str]) -> dict[str, str]:
        """Translate short persona field strings for admin UI (en→de or de→en). Same keys in/out."""
        fl = (from_locale or "").strip().lower()
        if fl not in ("en", "de"):
            raise ValueError("translate_invalid_locale")
        src = {k: v for k, v in strings.items() if isinstance(k, str) and isinstance(v, str) and v.strip()}
        if not src:
            return {}
        client = self._openai_for_json_repair()
        if client is None:
            raise RuntimeError("openai_not_configured")
        to_lang = "German" if fl == "en" else "English"
        try:
            completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You translate short persona admin field values into natural {to_lang}.\n"
                            "Input is one JSON object: field keys to short text.\n"
                            f"Return ONE JSON object with the SAME keys only; values are {to_lang} translations.\n"
                            "Preserve meaning. Keep proper names and place names when commonly left untranslated.\n"
                            "Do not add or remove keys. Use empty string only if input was empty.\n"
                            "No markdown fences."
                        ),
                    },
                    {"role": "user", "content": json.dumps(src, ensure_ascii=False)},
                ],
                model=settings.ai_openai_model or "gpt-4o-mini",
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=2048,
            )
            text = (completion.choices[0].message.content or "").strip()
            parsed = parse_persona_generation_json(text)
            if not isinstance(parsed, dict):
                return {}
            out: dict[str, str] = {}
            for k in src:
                raw = parsed.get(k)
                out[k] = raw.strip() if isinstance(raw, str) else str(raw) if raw is not None else ""
            return out
        except Exception as exc:  # noqa: BLE001
            logger.warning("persona.translate.ui_fields.failed", error=str(exc))
            raise

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

        # Prepare excerpts
        excerpts = ""
        
        if not chunks:
            # Check if there are any documents for this target group
            doc_count = 0
            if target_group_id:
                doc_count = session.execute(
                    select(func.count(Document.id)).where(Document.target_group_id == target_group_id)
                ).scalar()
            
            # If no documents/chunks, try to use Target Group description as fallback
            target_group = session.get(TargetGroup, target_group_id) if target_group_id else None
            
            if doc_count == 0 and target_group:
                logger.info("persona.generate.no_documents_fallback", target_group_id=str(target_group_id))
                excerpts = (
                    f"Target Group: {target_group.name}\n"
                    f"Segment: {target_group.segment}\n"
                    f"Description: {target_group.description or 'No description provided.'}\n"
                    f"Note: No specific documents were provided, so generate a persona based on this high-level description."
                )
            elif doc_count == 0 and not chunk_ids:
                raise ValueError("No documents found for this target group. Please upload documents first.")
            elif not chunks:
                raise ValueError("No processed knowledge chunks available. Please wait for document processing to complete or check for failures.")
        else:
            excerpts = "\n".join(f"- {chunk.content}" for chunk in chunks)
        
        # Define prompt variations (schema shared with PERSONA_LLM_JSON_SCHEMA_INSTRUCTION)
        prompt_templates = {
            "vivid": (
                "Craft a vivid, detailed persona profile with demographics, interests, values, goals, pain points, "
                "and communication style. Make it memorable and distinctive. "
                + PERSONA_LLM_JSON_SCHEMA_INSTRUCTION
                + " Base everything strictly on:\n"
            ),
            "analytical": (
                "Analyze the provided research data and extract a systematic persona profile with demographics, "
                "interests, values, goals, pain points, and communication patterns. "
                + PERSONA_LLM_JSON_SCHEMA_INSTRUCTION
                + " Base everything strictly on:\n"
            ),
            "personality-focused": (
                "Focus on personality traits, interests, values, and communication style. Create a persona profile "
                "emphasizing unique characteristics, vocabulary, and behavior patterns. "
                + PERSONA_LLM_JSON_SCHEMA_INSTRUCTION
                + " Base everything strictly on:\n"
            ),
            "goal-oriented": (
                "Emphasize goals, pain points, values, and motivations. Create a persona profile that highlights what "
                "drives this person and what they struggle with. "
                + PERSONA_LLM_JSON_SCHEMA_INSTRUCTION
                + " Base everything strictly on:\n"
            ),
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

        context_block = _compose_identity_context_block(persona=persona, target_group_id=target_group_id)
        excerpt_block = f"{excerpts}" if excerpts else ""
        if excerpt_block.strip():
            excerpt_block = "\nRESEARCH EXCERPTS:\n" + excerpt_block
        identity_prompt = (
            prompt_templates.get(prompt_style, prompt_templates["vivid"]) + context_block + excerpt_block
        )

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
        
        response_text = ""
        
        if self.provider == "openai" and self._openai:
            # Use OpenAI
            try:
                chat_completion = self._openai.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a helpful persona generation assistant.\n"
                                "Output MUST be a single valid JSON object.\n"
                                "Do NOT wrap JSON in markdown fences. Do NOT add any commentary.\n"
                                "All human-readable string values in the JSON must be English.\n"
                                "Include interests, values, full_name, gender, location, age, media_affinity as in the user schema.\n"
                                "Avoid using unescaped double-quotes inside string values (e.g. don’t quote phrases like “...”)."
                            ),
                        },
                        {"role": "user", "content": identity_prompt}
                    ],
                    model=settings.ai_openai_model or "gpt-5-mini",
                    temperature=temperature,
                    response_format={"type": "json_object"},
                    max_tokens=settings.ai_persona_openai_identity_max_tokens,
                )
                response_text = chat_completion.choices[0].message.content or ""
            except Exception as e:
                logger.error("persona.generate.openai_error", error=str(e))
                raise ValueError(f"OpenAI API Error: {str(e)}")
        else:
            # Use Anthropic (Fallback or Default)
            if not self._anthropic:
                 raise ValueError("Anthropic client not initialized and OpenAI not selected/available.")

            response_text = anthropic_complete_text(
                self._anthropic,
                model=settings.ai_persona_identity_anthropic_model,
                max_tokens=settings.ai_persona_identity_max_tokens,
                temperature=temperature,
                system=(
                    "You output a single JSON object only. Do not wrap it in markdown or code fences. "
                    "Do not add commentary before or after the JSON. Escape any double quotes inside string values. "
                    "All human-readable strings in the JSON must be English. "
                    "The object must include interests (array), values (array), demographics "
                    "(full_name, gender, location, age, media_affinity 0-100) plus headline, bio, traits, pain_points, goals, "
                    "communication_style, confidence."
                ),
                messages=[{"role": "user", "content": identity_prompt}],
            )

        # Log the response for debugging
        if not response_text:
            logger.error("persona.generate.empty_response", persona_id=str(persona.id))
            raise ValueError("Empty response from AI Provider")

        logger.info(
            "persona.generate.response",
            persona_id=str(persona.id),
            provider=self.provider,
            response_length=len(response_text),
            response_preview=response_text[:200],
        )

        try:
            payload = parse_persona_generation_json(response_text)
        except ValueError as exc:
            logger.warning(
                "persona.generate.json_repair_attempt",
                persona_id=str(persona.id),
                provider=self.provider,
                error=str(exc),
            )
            payload = None
            last_repair_error: str | None = None
            try:
                repaired_text = self._repair_json_via_openai(persona_id=persona.id, broken_text=response_text)
                if repaired_text.strip():
                    payload = parse_persona_generation_json(repaired_text)
            except Exception as repair_exc:
                last_repair_error = str(repair_exc)
                logger.warning(
                    "persona.generate.json_repair_openai_failed",
                    persona_id=str(persona.id),
                    error=last_repair_error,
                )
            if payload is None:
                try:
                    repaired_text = self._repair_json_via_anthropic(
                        persona_id=persona.id, broken_text=response_text
                    )
                    if repaired_text.strip():
                        payload = parse_persona_generation_json(repaired_text)
                except Exception as repair_exc:
                    last_repair_error = str(repair_exc)
                    logger.warning(
                        "persona.generate.json_repair_anthropic_failed",
                        persona_id=str(persona.id),
                        error=last_repair_error,
                    )
            if payload is None:
                logger.error(
                    "persona.generate.json_parse_error",
                    persona_id=str(persona.id),
                    response_preview=response_text[:500],
                    error=str(exc),
                    repair_error=last_repair_error,
                )
                raise ValueError("Failed to parse JSON response from AI Provider") from exc
        
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
                        "priority": _parse_goal_priority(goal.get("priority", idx + 1), idx),
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

        # Normalize trait scores: accept numeric or common string buckets
        def _to_score(value: float | int | str | list | dict) -> float:
            # Already numeric
            if isinstance(value, (int, float)):
                return float(value)
            # Lists: treat as qualitative -> default mid/high if non-empty
            if isinstance(value, list):
                return 0.7 if len(value) > 0 else 0.5
            # Dicts: not expected, default mid
            if isinstance(value, dict):
                return 0.5
            if isinstance(value, str):
                import re as _re2
                v = value.strip().lower()
                # normalize separators/punctuation to spaces
                v = v.replace("—", " ").replace("-", " ")
                v = _re2.sub(r"[^a-z0-9\.\s]", " ", v)
                v = " ".join(v.split())
                # Map qualitative buckets to numeric scores (0-1 range)
                mapping = {
                    "very_low": 0.15,
                    "very low": 0.15,
                    "low": 0.35,
                    "moderate": 0.5,
                    "medium": 0.5,
                    "moderate_to_high": 0.65,
                    "moderate to high": 0.65,
                    "high": 0.8,
                    "very_high": 0.95,
                    "very high": 0.95,
                }
                if v in mapping:
                    return mapping[v]
                # token-based heuristics
                if "very" in v and "high" in v:
                    return 0.95
                if "very" in v and "low" in v:
                    return 0.15
                if "moderate" in v or "medium" in v or "balanced" in v:
                    # if also "high" present, lean higher
                    if "high" in v:
                        return 0.65
                    if "low" in v:
                        return 0.45
                    return 0.5
                if "high" in v or "strong" in v or "intense" in v or "driven" in v:
                    return 0.8
                if "low" in v or "minimal" in v or "cautious" in v:
                    return 0.3
                # Try to extract a number from the string
                nums = _re2.findall(r"\d+\.?\d*", v)
                if nums:
                    try:
                        return float(nums[0])
                    except Exception as exc:
                        logger.debug("persona.scoring.trait_parse_failed", value=v, error=str(exc))
                # Fallback qualitative defaults
                if any(word in v for word in ["low", "minimal", "cautious"]):
                    return 0.3
                if any(word in v for word in ["high", "strong", "intense", "driven"]):
                    return 0.8
                if any(word in v for word in ["moderate", "balanced", "medium"]):
                    return 0.5
                # Default mid
                return 0.5
            # Unknown type -> mid
            return 0.5

        raw_traits = payload.get("traits", {}) or {}
        normalized_traits: dict[str, float] = {}
        if isinstance(raw_traits, dict):
            for k, v in raw_traits.items():
                normalized_traits[k] = _to_score(v)
        # Merge variation_params into traits (already handled below), but keep normalization

        full_name = _optional_str(payload.get("full_name") or payload.get("fullName"))
        age_val = _parse_age_optional(payload.get("age"))
        gender_val = _optional_str(payload.get("gender"))
        location_val = _optional_str(payload.get("location"))
        media_aff = _parse_media_affinity_optional(
            payload.get("media_affinity") if payload.get("media_affinity") is not None else payload.get("mediaAffinity")
        )
        interests = _coerce_str_list(payload.get("interests"))
        values_list = _coerce_str_list(payload.get("values"))
        color_palette = _coerce_str_list(payload.get("color_palette") or payload.get("colorPalette"))
        social_media_usage = _coerce_str_list(payload.get("social_media_usage") or payload.get("socialMediaUsage"))
        attention_span = _optional_str(payload.get("attention_span") or payload.get("attentionSpan"))

        profile_dict = {
            "id": str(persona.id),
            "name": payload.get("name", persona.name),
            "segment": persona.segment,
            "headline": payload.get("headline", persona.headline),
            "bio": payload.get("bio", ""),
            "full_name": full_name,
            "age": age_val,
            "gender": gender_val,
            "location": location_val,
            "media_affinity": media_aff,
            "interests": interests,
            "values": values_list,
            "color_palette": color_palette,
            "attention_span": attention_span,
            "social_media_usage": social_media_usage,
            "traits": normalized_traits,
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

        # Final safety: coerce all trait values to float
        traits_dict = profile_dict.get("traits", {}) or {}
        safe_traits: dict[str, float] = {}
        if isinstance(traits_dict, dict):
            for k, v in traits_dict.items():
                safe_traits[k] = _to_score(v)
        profile_dict["traits"] = safe_traits

        profile_de_dict = self._translate_profile_json_en_to_de(persona_id=persona.id, english_profile=profile_dict)
        if profile_de_dict is not None:
            if not json_shape_compatible(profile_dict, profile_de_dict):
                logger.warning(
                    "persona.translate.profile_de.shape_mismatch",
                    persona_id=str(persona.id),
                )
                profile_de_dict = None
        
        # Import proto types lazily so module import works in lightweight test envs.
        from msqdx_glass_proto import PersonaProfile, PersonaPrompt  # type: ignore

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

        prompt_de_text = self._translate_system_prompt_en_to_de(persona_id=persona.id, english_prompt=prompt.system_prompt)

        with get_session() as session:
            persona_model = session.get(Persona, persona.id)
            if persona_model:
                persona_model.profile = profile.model_dump()
                persona_model.confidence = profile.confidence
                persona_model.name = profile.name
                persona_model.headline = _truncate_headline_for_db(profile.headline) or profile.headline
                if profile_de_dict is not None:
                    persona_model.profile_de = profile_de_dict
                    hl_de = _optional_str(profile_de_dict.get("headline"))
                    if hl_de:
                        persona_model.headline_de = _truncate_headline_for_db(hl_de) or hl_de
                # Set target_group_id if provided
                if target_group_id:
                    persona_model.target_group_id = target_group_id
            persona_prompt = PersonaPromptModel(
                persona_id=persona.id,
                system_prompt=prompt.system_prompt,
                system_prompt_de=prompt_de_text,
                template_version="2025-11-18",
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

