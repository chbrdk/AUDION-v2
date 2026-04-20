"""AI service to suggest personas from company context and target group. Uses OpenAI (GPT) only."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import structlog
from openai import OpenAI

from ..core.config import get_settings
from .openai_llm_usage import raw_units_from_openai_chat_completion
from .persona_ai_locale import locale_label_for_ai_prompt, locale_output_guard_footer, normalize_output_locale

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass
class PersonaSuggestion:
    name: str
    headline: str
    bio: str
    age: str | None
    location: str | None
    gender: str | None


def suggest_personas(
    context_text: str,
    target_group_name: str,
    target_group_segment: str,
    target_group_description: str,
    max_suggestions: int = 5,
    *,
    output_locale: str | None = None,
) -> tuple[list[PersonaSuggestion], dict[str, Any]]:
    """
    Call AI to suggest personas for a target group using company/project context.
    Uses OpenAI (GPT-5 / ai_openai_model) only.
    Returns suggestions and OpenAI usage fields for PLEXON (may be empty).
    """
    if not context_text or not context_text.strip():
        raise ValueError(
            "Company context is empty. Add project description or company context first."
        )

    if not settings.openai_api_key:
        raise ValueError(
            "OpenAI API key not configured. Set OPENAI_API_KEY for persona suggestions."
        )

    tg_block = f"""
Target group:
- name: {target_group_name}
- segment: {target_group_segment}
- description: {target_group_description}
"""

    loc = normalize_output_locale(output_locale)
    lang = locale_label_for_ai_prompt(loc)
    if loc == "de":
        gender_hint = 'gender: "weiblich", "männlich", "divers", or null'
        loc_examples = (
            '- name: e.g. "Sarah Müller"\n'
            "- headline: one short German sentence\n"
            '- location: e.g. "Berlin, Deutschland" or null\n'
        )
    else:
        gender_hint = 'gender: "female", "male", "non-binary", or null'
        loc_examples = (
            '- name: e.g. "Alex Morgan"\n'
            "- headline: one short English sentence\n"
            '- location: e.g. "Austin, TX" or null\n'
        )

    prompt = f"""Based on the company/project context and the target group below, suggest between 2 and {max_suggestions} distinct personas that fit this target group. Each persona should feel realistic and relevant to the business context.

LANGUAGE: All human-readable string fields (name, headline, bio, location, gender labels) MUST be in {lang} only.

For each persona provide:
{loc_examples}
- age: Age number or range as string (e.g. "32" or "28-35"), or null
- bio: 2-3 sentences in {lang}
- {gender_hint}

Respond with a JSON array only, no other text. Example:
[{{"name": "...", "age": "32", "headline": "...", "bio": "...", "location": "...", "gender": "..."}}, ...]

Company/project context:
---
{context_text.strip()}
---
{tg_block.strip()}
{locale_output_guard_footer(output_locale=loc)}
"""

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        chat = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful marketing and research assistant. Output only valid JSON arrays. "
                        f"All persona string values must be in {lang} as stated in the user message."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            model=settings.ai_openai_model or "gpt-5.4-mini",
            max_completion_tokens=settings.ai_default_max_tokens or 2048,
        )
        response_text = (chat.choices[0].message.content or "").strip()
        usage_raw = raw_units_from_openai_chat_completion(chat)
    except Exception as e:
        logger.error("suggest_personas.openai_error", error=str(e))
        raise ValueError(f"OpenAI API error: {e}") from e

    if not response_text:
        raise ValueError("Empty response from AI.")

    cleaned = response_text
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*\n", "", cleaned)
        cleaned = re.sub(r"\n```\s*$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                logger.error("suggest_personas.json_error", raw=cleaned[:500], error=str(exc))
                raise ValueError("AI returned invalid JSON.") from exc
        else:
            logger.error("suggest_personas.json_error", raw=cleaned[:500], error=str(exc))
            raise ValueError("AI returned invalid JSON.") from exc

    if not isinstance(data, list):
        raise ValueError("AI response is not a JSON array.")

    result: list[PersonaSuggestion] = []
    for i, item in enumerate(data[: max_suggestions + 2]):
        if not isinstance(item, dict):
            continue
        name = (item.get("name") or "").strip() or f"Persona {i + 1}"
        headline = (item.get("headline") or "").strip() or ""
        bio = (item.get("bio") or "").strip()
        age = item.get("age")
        age = str(age).strip() if age is not None else None
        location = item.get("location")
        location = str(location).strip() if location else None
        gender = item.get("gender")
        gender = str(gender).strip() if gender else None
        if not headline:
            continue
        result.append(
            PersonaSuggestion(
                name=name,
                headline=headline,
                bio=bio,
                age=age or None,
                location=location or None,
                gender=gender or None,
            )
        )

    return result[:max_suggestions], usage_raw
