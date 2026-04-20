"""Synthesize a structured project research summary with citations (EN canonical + DE mirror)."""

from __future__ import annotations

import json
from typing import Any

import structlog
from openai import OpenAI

from ..core.config import get_settings
from ..schemas.research import ProjectResearchSummaryV1
from .openai_chat_content import (
    describe_empty_chat_completion,
    extract_chat_completion_message_text,
    openai_research_completion_extra_kwargs,
)
from .persona_generation import parse_persona_generation_json

logger = structlog.get_logger(__name__)
settings = get_settings()


def _research_chat_completion(client: OpenAI, **kwargs: Any) -> Any:
    """Chat completion for research; optional reasoning_effort for GPT-5 with SDK/API fallback."""
    model = str(kwargs.get("model") or "")
    extra = openai_research_completion_extra_kwargs(model)
    if not extra:
        return client.chat.completions.create(**kwargs)
    try:
        return client.chat.completions.create(**kwargs, **extra)
    except Exception as e:
        err = str(e).lower()
        if any(s in err for s in ("reasoning_effort", "unsupported", "unknown parameter")):
            logger.warning("project.research.openai_retry_without_reasoning_effort", model=model, error=str(e))
            return client.chat.completions.create(**kwargs)
        raise


def _openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY for project research.")
    return OpenAI(api_key=settings.openai_api_key)


def _sources_prompt(sources: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for i, s in enumerate(sources, start=1):
        url = s.get("url") or ""
        text = s.get("text") or ""
        if not url or not text:
            continue
        block = f"SOURCE {i} URL: {url}\nSOURCE {i} TEXT:\n{text.strip()}\n"
        cp = s.get("checkion_page")
        if isinstance(cp, dict) and cp:
            block += (
                f"SOURCE {i} CHECKION_DEEP_SCAN (optional per-page metadata from an internal site scanner; "
                "e.g. topic/tags/tiers. Use only to sharpen industry fit, wording, or hypotheses. "
                "Do not treat CHECKION labels as facts—every substantive claim must still cite one or more SOURCE URLs from the page text above.):\n"
                f"{json.dumps(cp, ensure_ascii=False)}\n"
            )
        parts.append(block)
    return "\n\n".join(parts)


def synthesize_project_research_summary_en(*, sources: list[dict[str, Any]]) -> dict[str, Any]:
    """Return ProjectResearchSummaryV1 as dict (EN strings)."""
    client = _openai_client()
    model = settings.ai_openai_model or "gpt-5.4-mini"
    max_out = max(4096, int(settings.ai_project_research_max_completion_tokens or 16384))
    max_out = min(max_out, 128_000)

    prompt = f"""You are a research analyst. Using ONLY the sources below, produce a structured research summary as ONE JSON object.\n\nHard rules:\n- Output must be ONE valid JSON object, no markdown fences.\n- English only for all human-readable strings.\n- Every claim MUST include citations: an array of URLs from the provided SOURCE page URLs (the fetched page text).\n- Optional CHECKION_DEEP_SCAN blocks are supplementary signals (classification/metadata from another tool). They are not primary sources; do not cite CHECKION JSON as if it were the company website.\n- If you are unsure, omit the claim (do not guess).\n\nJSON schema:\n{{\n  \"version\": \"v1\",\n  \"company_overview\": {{\"summary\": string|null, \"claims\": [{{\"text\": string, \"citations\": [url], \"confidence\": number|null}}]}},\n  \"offerings\": {{...same...}},\n  \"industries\": {{...same...}},\n  \"icp_hypotheses\": {{...same...}},\n  \"buying_roles\": {{...same...}},\n  \"objections\": {{...same...}},\n  \"proof_points\": {{...same...}},\n  \"terminology\": {{...same...}},\n  \"meta\": {{\"notes\": string|null}}\n}}\n\nSources:\n---\n{_sources_prompt(sources)}\n---\n"""

    chat = _research_chat_completion(
        client,
        messages=[
            {
                "role": "system",
                "content": "You output JSON only and follow the schema strictly.",
            },
            {"role": "user", "content": prompt},
        ],
        model=model,
        response_format={"type": "json_object"},
        max_completion_tokens=max_out,
    )
    text = extract_chat_completion_message_text(chat.choices[0].message).strip()
    if not text:
        raise ValueError(describe_empty_chat_completion(chat))
    parsed = parse_persona_generation_json(text)
    summary = ProjectResearchSummaryV1.model_validate(parsed)
    out = summary.model_dump()
    out.setdefault("meta", {})
    out["meta"]["model"] = model
    return out


def translate_research_summary_en_to_de(*, summary_en: dict[str, Any]) -> dict[str, Any]:
    """Translate EN summary JSON to DE while preserving exact keys/shape."""
    client = _openai_client()
    model = settings.ai_openai_model or "gpt-5.4-mini"
    max_out = max(4096, int(settings.ai_project_research_max_completion_tokens or 16384))
    max_out = min(max_out, 128_000)

    prompt = """You translate a structured research summary JSON from English to German.\nReturn ONE JSON object with the EXACT same keys/shape as the input.\nTranslate ONLY string values to natural German (Hochdeutsch).\nDo not translate URLs. Do not add/remove keys. No markdown fences."""

    chat = _research_chat_completion(
        client,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(summary_en, ensure_ascii=False)},
        ],
        model=model,
        response_format={"type": "json_object"},
        max_completion_tokens=max_out,
    )
    text = extract_chat_completion_message_text(chat.choices[0].message).strip()
    if not text:
        raise ValueError(describe_empty_chat_completion(chat))
    parsed = parse_persona_generation_json(text)
    # Validate shape by parsing as same model (strings can differ).
    ProjectResearchSummaryV1.model_validate(parsed)
    return parsed

