"""OpenAI Chat Completions streaming helpers (content + optional reasoning deltas)."""

from __future__ import annotations

from typing import Any, Iterator, Tuple

import structlog

logger = structlog.get_logger(__name__)


def reasoning_text_from_openai_delta(delta: Any) -> str | None:
    if delta is None:
        return None
    for name in ("reasoning", "reasoning_content"):
        raw = getattr(delta, name, None)
        if not raw:
            continue
        if isinstance(raw, str) and raw:
            return raw
        if isinstance(raw, list):
            parts: list[str] = []
            for item in raw:
                if isinstance(item, dict):
                    t = item.get("text")
                    if isinstance(t, str):
                        parts.append(t)
                elif isinstance(item, str):
                    parts.append(item)
            return "".join(parts) if parts else None
    return None


def iter_chat_completion_stream_parts(
    client: Any,
    *,
    reasoning_effort: str | None,
    **kwargs: Any,
) -> Iterator[Tuple[str | None, str | None]]:
    """
    Yield (content_delta, reasoning_delta) per chunk. Either may be None.
    Falls back without reasoning_effort if the API rejects the parameter.
    """
    create = getattr(client.chat.completions, "create", None)
    if create is None:
        raise RuntimeError("OpenAI client has no chat.completions.create")

    stream: Any
    if reasoning_effort and reasoning_effort.lower() != "none":
        try:
            stream = create(reasoning_effort=reasoning_effort, **kwargs)
        except TypeError:
            stream = create(**kwargs)
        except Exception as e:
            logger.warning("openai_chat.reasoning_effort_fallback", error=str(e), error_type=type(e).__name__)
            stream = create(**kwargs)
    else:
        stream = create(**kwargs)

    for chunk in stream:
        if not chunk.choices or len(chunk.choices) == 0:
            continue
        delta = chunk.choices[0].delta
        if not delta:
            continue
        content = getattr(delta, "content", None)
        reasoning = reasoning_text_from_openai_delta(delta)
        yield (content, reasoning)
