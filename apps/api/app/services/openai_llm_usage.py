"""Extract PLEXON raw_units for llm_request from OpenAI chat completion objects."""
from __future__ import annotations

from typing import Any


def raw_units_from_openai_chat_completion(completion: Any) -> dict[str, Any]:
    u = getattr(completion, "usage", None)
    if u is None:
        return {}
    raw: dict[str, Any] = {}
    pt = getattr(u, "prompt_tokens", None)
    ct = getattr(u, "completion_tokens", None)
    if pt is not None:
        raw["input_tokens"] = int(pt)
    if ct is not None:
        raw["output_tokens"] = int(ct)
    return raw
