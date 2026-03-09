"""AI service to suggest target groups from project company context."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

import structlog
from anthropic import Anthropic
from openai import OpenAI

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass
class TargetGroupSuggestion:
    name: str
    segment: str
    description: str


def suggest_target_groups(
    context_text: str,
    max_suggestions: int = 5,
) -> list[TargetGroupSuggestion]:
    """
    Call AI to suggest target groups from company/project context.
    Returns a list of TargetGroupSuggestion (name, segment, description).
    """
    if not context_text or not context_text.strip():
        raise ValueError("Company context is empty. Please add a project description or company context first.")

    provider = settings.ai_default_provider
    if provider == "anthropic" and not settings.claude_api_key and settings.openai_api_key:
        provider = "openai"

    prompt = f"""Based on the following company/project context, suggest between 3 and {max_suggestions} target groups (audience segments) that would be relevant for this project.
For each target group provide:
- name: A short, human-readable name (e.g. "Technical Decision Makers")
- segment: A brief segment label (e.g. "tech-leads")
- description: 2-3 sentences describing this audience and why they matter for the project

Respond with a JSON array only, no other text. Example format:
[{{"name": "...", "segment": "...", "description": "..."}}, ...]

Company/project context:
---
{context_text.strip()}
---"""

    response_text = ""
    if provider == "openai" and settings.openai_api_key:
        client = OpenAI(api_key=settings.openai_api_key)
        try:
            chat = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful marketing and research assistant. Output only valid JSON arrays."},
                    {"role": "user", "content": prompt},
                ],
                model=settings.ai_openai_model or "gpt-4o-mini",
                temperature=0.5,
                max_tokens=settings.ai_default_max_tokens or 2048,
            )
            response_text = (chat.choices[0].message.content or "").strip()
        except Exception as e:
            logger.error("suggest_target_groups.openai_error", error=str(e))
            raise ValueError(f"OpenAI API error: {e}") from e
    else:
        if not settings.claude_api_key:
            raise ValueError("No AI API key configured. Set CLAUDE_API_KEY or OPENAI_API_KEY.")
        client = Anthropic(api_key=settings.claude_api_key)
        try:
            msg = client.messages.create(
                model=settings.ai_anthropic_model or "claude-3-5-sonnet-20241022",
                max_tokens=settings.ai_default_max_tokens or 2048,
                temperature=0.5,
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = (msg.content[0].text if msg.content else "").strip()
        except Exception as e:
            logger.error("suggest_target_groups.anthropic_error", error=str(e))
            raise ValueError(f"Anthropic API error: {e}") from e

    if not response_text:
        raise ValueError("Empty response from AI.")

    # Strip markdown code blocks if present
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
                logger.error("suggest_target_groups.json_error", raw=cleaned[:500], error=str(exc))
                raise ValueError("AI returned invalid JSON.") from exc
        else:
            logger.error("suggest_target_groups.json_error", raw=cleaned[:500], error=str(exc))
            raise ValueError("AI returned invalid JSON.") from exc

    if not isinstance(data, list):
        raise ValueError("AI response is not a JSON array.")

    result: list[TargetGroupSuggestion] = []
    for i, item in enumerate(data[: max_suggestions + 2]):
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("name_short") or ""
        segment = item.get("segment") or item.get("segment_id") or ""
        description = item.get("description") or ""
        if isinstance(name, str) and isinstance(segment, str) and isinstance(description, str):
            name = name.strip() or f"Target Group {i + 1}"
            segment = segment.strip() or f"segment-{i + 1}"
            result.append(TargetGroupSuggestion(name=name, segment=segment, description=description.strip()))

    return result[:max_suggestions]
