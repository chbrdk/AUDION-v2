"""Heuristic selection of standard vs extended persona replies (reasoning-friendly, richer structure)."""

from __future__ import annotations

import re
from typing import Literal

ReplyMode = Literal["standard", "extended"]

EXTENDED_SYSTEM_ADDENDUM = (
    "\n\nWhen the user asks for analysis, comparison, or detailed explanation, "
    "use clear structure (short bullets or headings) in the final answer. "
    "Stay in the persona's voice and subjective perspective (how they see it), "
    "not as a generic consultant advising the user unless that fits the role."
)
_EXTENDED_KEYWORD_RE = re.compile(
    r"(?:^|\b)("
    r"why|how\s+(?:do|does|can|could|would|should|is|are)|explain|compare|comparison|contrast|"
    r"pros\s+and\s+cons|trade-?offs?|step\s+by\s+step|outline|structure|deep\s+dive|"
    r"in\s+detail|break\s+down|analyze|analyse|reasoning|think\s+through|"
    r"warum|wieso|wie\s+(?:funktioniert|geht|kann)|erklär(?:en|e|ung)?|vergleich(?:en|e)?|"
    r"unterschied|vor-?\s*und\s*nachteile|im\s+detail|schritt(?:weise)?|"
    r"struktur|analyse|begründ|argument"
    r")\b",
    re.IGNORECASE,
)


def has_extended_analytical_signals(user_message: str) -> bool:
    """True when the user asks for analysis, comparison, or multi-part explanation (not length-only)."""
    text = (user_message or "").strip()
    if not text:
        return False
    if text.count("?") >= 2:
        return True
    if _EXTENDED_KEYWORD_RE.search(text):
        return True
    return False


def infer_reply_mode(user_message: str) -> ReplyMode:
    """Return extended when a longer or analytical answer is likely to help."""
    from ..core.config import get_settings

    text = (user_message or "").strip()
    if not text:
        return "standard"

    min_chars = get_settings().chat_extended_min_chars

    if len(text) >= min_chars:
        return "extended"

    return "extended" if has_extended_analytical_signals(text) else "standard"


def build_persona_user_content(
    *,
    question: str,
    sources_text: str,
    mode: ReplyMode,
) -> str:
    """User message body for non-tool streaming (length and tone live in system prompt addenda)."""
    _ = mode  # retained for API compatibility
    base = (
        "Beantworte die Nutzerfrage unten. "
        "Keine Doc-IDs, Chunk-IDs, Klammern, das Wort 'doc', keine Confidence-Scores oder Meta-Kommentare zum Retrieval.\n\n"
        f"Nutzerfrage:\n{question}"
    )
    if sources_text:
        base += f"\n\nRelevant context:\n{sources_text}"
    return base
