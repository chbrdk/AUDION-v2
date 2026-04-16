"""Heuristic selection of standard vs extended persona replies (reasoning-friendly, richer structure)."""

from __future__ import annotations

import re
from typing import Literal

ReplyMode = Literal["standard", "extended"]

# Tunable thresholds (tests assert behaviour; env overrides live in Settings if added later).
_EXTENDED_MIN_CHARS = 200

EXTENDED_SYSTEM_ADDENDUM = (
    "\n\nWhen the user asks for analysis, comparison, or detailed explanation, "
    "use clear structure (short bullets or headings) in the final answer."
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


def infer_reply_mode(user_message: str) -> ReplyMode:
    """Return extended when a longer or analytical answer is likely to help."""
    text = (user_message or "").strip()
    if not text:
        return "standard"

    if len(text) >= _EXTENDED_MIN_CHARS:
        return "extended"

    if text.count("?") >= 2:
        return "extended"

    if _EXTENDED_KEYWORD_RE.search(text):
        return "extended"

    return "standard"


def build_persona_user_content(
    *,
    question: str,
    sources_text: str,
    mode: ReplyMode,
) -> str:
    """User message body for non-tool streaming (retrieval context already embedded)."""
    if mode == "extended":
        base = (
            "Give a clear, helpful answer. You may use light markdown (short headings ##, bullets) "
            "when it improves structure. Prefer concise sections over a wall of text. "
            "Do not repeat words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
            "Do not mention confidence scores, percentages, or meta commentary about the retrieval system. "
            "Aim for thoroughness appropriate to the question (roughly up to ~350 words) unless the user asks for brevity. "
            f"\n\nUser message: {question}"
        )
    else:
        base = (
            "Answer succinctly in natural, conversational language. "
            "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
            "Keep the reply under 90 words and at most three short paragraphs unless the user explicitly asks for more detail. "
            "Do not mention confidence scores, percentages, or meta commentary. "
            "Avoid markdown formatting (no bold, bullets) unless the user requests it. "
            "Share only the most relevant details, and go deeper only when it truly adds value. "
            f"\n\nUser message: {question}"
        )

    if sources_text:
        base += f"\n\nRelevant context:\n{sources_text}"
    return base
