from __future__ import annotations

import re
from typing import List, Optional

DOC_PATTERN = re.compile(r"\[\s*(?:doc|chunk|source)_[^\]]*\]", flags=re.IGNORECASE)
NUM_PATTERN = re.compile(r"\[\s*\d+\s*\]")
CONFIDENCE_PATTERN = re.compile(r"\*+\s*confidence[:\s0-9%\-]*", flags=re.IGNORECASE)


def _dedupe_sentences(paragraph: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", paragraph.strip())
    deduped: List[str] = []
    for sentence in sentences:
        stripped = sentence.strip()
        if not stripped:
            continue
        if deduped and stripped.lower() == deduped[-1].lower():
            continue
        deduped.append(stripped)
    return " ".join(deduped)


def clean_response_text(text: str, max_paragraphs: Optional[int] = 2) -> str:
    """Remove doc references, confidence blocks, duplicates, and optionally cap paragraph count.

    For SSE/streaming, pass ``max_paragraphs=None`` so the full answer is kept; the default
    ``2`` is only for short non-streaming replies where brevity is intentional.
    """
    without_refs = DOC_PATTERN.sub("", text)
    without_refs = NUM_PATTERN.sub("", without_refs)
    without_confidence = CONFIDENCE_PATTERN.sub("", without_refs)
    paragraphs = [p.strip() for p in without_confidence.split("\n\n") if p.strip()]

    cleaned: List[str] = []
    for paragraph in paragraphs:
        deduped = _dedupe_sentences(paragraph)
        if not deduped:
            continue
        if cleaned and deduped.lower() == cleaned[-1].lower():
            continue
        cleaned.append(deduped)
        if max_paragraphs is not None and len(cleaned) >= max_paragraphs:
            break

    return "\n\n".join(cleaned).strip()

