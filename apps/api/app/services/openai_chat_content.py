"""Helpers for OpenAI Chat Completions text extraction (reasoning models, multipart content)."""

from __future__ import annotations

from typing import Any


def extract_chat_completion_message_text(message: Any) -> str:
    """Normalize `choice.message.content` to a string (SDK may return str or list of parts)."""
    content = getattr(message, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if hasattr(part, "text") and getattr(part, "text", None):
                parts.append(str(part.text))
            elif isinstance(part, dict) and part.get("type") == "text":
                parts.append(str(part.get("text") or ""))
        return "\n".join(parts) if parts else ""
    return ""


def openai_research_completion_extra_kwargs(model: str) -> dict[str, Any]:
    """Extra kwargs for research JSON calls (GPT-5 family burns completion budget on reasoning)."""
    m = (model or "").lower()
    if "gpt-5" in m:
        return {"reasoning_effort": "low"}
    return {}


def describe_empty_chat_completion(completion: Any) -> str:
    """Human-readable detail when the assistant message has no usable text."""
    if completion is None or not getattr(completion, "choices", None):
        return "Empty response text from AI Provider (no choices)."

    choice = completion.choices[0]
    fr = getattr(choice, "finish_reason", None)
    msg = getattr(choice, "message", None)
    refusal = getattr(msg, "refusal", None) if msg is not None else None

    bits: list[str] = []
    if fr is not None:
        bits.append(f"finish_reason={fr!r}")
    if refusal:
        bits.append(f"refusal={refusal!r}")

    u = getattr(completion, "usage", None)
    if u is not None:
        ct = getattr(u, "completion_tokens", None)
        if ct is not None:
            bits.append(f"completion_tokens={ct}")
        details = getattr(u, "completion_tokens_details", None)
        if details is not None:
            rt = getattr(details, "reasoning_tokens", None)
            if rt is not None:
                bits.append(f"reasoning_tokens={rt}")

    tail = "; ".join(bits) if bits else "no usage details"
    return (
        "Empty response text from AI Provider "
        f"({tail}). For GPT-5 models, increase AI_PROJECT_RESEARCH_MAX_COMPLETION_TOKENS "
        "or keep reasoning_effort low so JSON output fits in the completion budget."
    )
