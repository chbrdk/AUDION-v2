from __future__ import annotations

import re
from typing import List

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


def clean_response_text(text: str, max_paragraphs: int = 3) -> str:
    """Remove doc references, confidence blocks, duplicates, and limit paragraphs."""
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
        if len(cleaned) >= max_paragraphs:
            break

    return "\n\n".join(cleaned).strip()

