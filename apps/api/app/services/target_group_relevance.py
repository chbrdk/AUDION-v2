"""Deterministic relevance scoring for target-group suggestions.

Goal: a stable score based on overlap with known project signals (research + CHECKION tags),
so the UI can rank suggestions even if LLM-generated scores fluctuate.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any


_WORD_RE = re.compile(r"[a-z0-9][a-z0-9\-_]{1,48}", re.IGNORECASE)


def _norm_words(text: str) -> list[str]:
    raw = (text or "").lower()
    return [m.group(0) for m in _WORD_RE.finditer(raw)]


def _extract_research_terms(summary_en: dict[str, Any] | None) -> Counter[str]:
    """
    Best-effort: collect terms from common V1 sections plus any freeform fields.
    This is intentionally conservative (low weight).
    """
    c: Counter[str] = Counter()
    if not isinstance(summary_en, dict):
        return c

    def add_text(t: str, n: int = 1) -> None:
        for w in _norm_words(t):
            c[w] += n

    # V1 known sections (claims + optional summary)
    for key in [
        "company_overview",
        "offerings",
        "industries",
        "icp_hypotheses",
        "buying_roles",
        "objections",
        "proof_points",
        "terminology",
    ]:
        sec = summary_en.get(key)
        if not isinstance(sec, dict):
            continue
        if isinstance(sec.get("summary"), str):
            add_text(sec["summary"], 1)
        claims = sec.get("claims")
        if isinstance(claims, list):
            for cl in claims:
                if isinstance(cl, dict) and isinstance(cl.get("text"), str):
                    add_text(cl["text"], 2 if key == "terminology" else 1)

    # Opportunistic: common non-V1 fields we've seen in the wild (GEO/competition/etc.)
    for loose_key in ["positioning", "competition", "competitors", "geoQueries", "geo_questions", "meta"]:
        v = summary_en.get(loose_key)
        if isinstance(v, str):
            add_text(v, 1)
        elif isinstance(v, list):
            for it in v:
                if isinstance(it, str):
                    add_text(it, 1)
                elif isinstance(it, dict):
                    for vv in it.values():
                        if isinstance(vv, str):
                            add_text(vv, 1)
        elif isinstance(v, dict):
            for vv in v.values():
                if isinstance(vv, str):
                    add_text(vv, 1)

    return c


def _extract_checkion_tag_terms(topics: list[dict[str, Any]] | None) -> Counter[str]:
    c: Counter[str] = Counter()
    if not isinstance(topics, list):
        return c
    for t in topics:
        if not isinstance(t, dict):
            continue
        tag = t.get("tag")
        if not isinstance(tag, str) or not tag.strip():
            continue
        w = t.get("weight_sum")
        mult = 2
        if isinstance(w, (int, float)):
            # keep small: we only use weights to break ties a bit
            mult = max(1, min(6, int(round(float(w)))))
        for word in _norm_words(tag):
            c[word] += mult
    return c


def deterministic_target_group_relevance(
    *,
    name: str,
    segment: str,
    description: str,
    checkion_topics: list[dict[str, Any]] | None,
    research_summary_en: dict[str, Any] | None,
) -> tuple[int, list[str]]:
    """
    Returns (score_0_100, top_signals[]).
    Signals are short strings describing why we scored it (for UI).
    """
    text = " ".join([name or "", segment or "", description or ""]).strip()
    words = set(_norm_words(text))
    if not words:
        return 0, []

    chk = _extract_checkion_tag_terms(checkion_topics)
    res = _extract_research_terms(research_summary_en)

    chk_hits = sum(1 for w in words if w in chk)
    res_hits = sum(1 for w in words if w in res)

    # Weighted overlap; CHECKION tags are strong intent signals.
    raw = chk_hits * 10 + res_hits * 4
    score = max(0, min(100, raw))

    signals: list[str] = []
    if chk_hits:
        # show top matching CHECKION terms by weight
        matches = sorted([w for w in words if w in chk], key=lambda w: chk[w], reverse=True)[:3]
        if matches:
            signals.append("CHECKION tags: " + ", ".join(matches))
    if res_hits:
        matches = sorted([w for w in words if w in res], key=lambda w: res[w], reverse=True)[:3]
        if matches:
            signals.append("Research: " + ", ".join(matches))

    return score, signals

