"""Aggregate CHECKION slim-page pageClassification into site-level topic summaries."""

from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Any


def _page_score(page: dict[str, Any]) -> float | None:
    s = page.get("score")
    if isinstance(s, (int, float)):
        return float(s)
    return None


def _collect_tags_from_page(page: dict[str, Any]) -> list[tuple[str, float]]:
    """Return (tag, weight) contributions from one slim page."""
    out: list[tuple[str, float]] = []
    pc = page.get("pageClassification")
    if not isinstance(pc, dict):
        return out
    tiers = pc.get("tagTiers")
    if isinstance(tiers, list):
        for t in tiers:
            if not isinstance(t, dict):
                continue
            tag = str(t.get("tag") or "").strip()
            if not tag:
                continue
            tier = t.get("tier")
            w = 1.0
            if isinstance(tier, (int, float)):
                w = max(0.25, float(tier))
            out.append((tag, w))
    tags = pc.get("tags")
    if isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                out.append((tag.strip(), 1.0))
    return out


def aggregate_site_topics_from_slim_pages(
    pages: list[dict[str, Any]],
    *,
    top_n: int = 30,
) -> dict[str, Any]:
    """
    Build ranked topic list from slim-page ``pageClassification`` (tagTiers + tags).

    Returns JSON-serializable dict:
      topics: [{ tag, page_count, weight_sum, median_score|null }, ...]
      pages_processed: int
      truncated: bool (true if more than top_n distinct tags after ranking — we cap list, not input)
    """
    tag_pages: dict[str, set[str]] = defaultdict(set)
    tag_weight: dict[str, float] = defaultdict(float)
    tag_scores: dict[str, list[float]] = defaultdict(list)

    for page in pages:
        if not isinstance(page, dict):
            continue
        url = str(page.get("url") or "").strip() or "_"
        sc = _page_score(page)
        for tag, w in _collect_tags_from_page(page):
            tag_weight[tag] += w
            tag_pages[tag].add(url)
            if sc is not None:
                tag_scores[tag].append(sc)

    rows: list[dict[str, Any]] = []
    for tag, urls in tag_pages.items():
        scores = tag_scores.get(tag) or []
        med = None
        if scores:
            med = float(statistics.median(scores))
        rows.append(
            {
                "tag": tag,
                "page_count": len(urls),
                "weight_sum": round(tag_weight[tag], 3),
                "median_score": med,
            }
        )

    rows.sort(key=lambda r: (r["page_count"], r["weight_sum"]), reverse=True)
    truncated = len(rows) > top_n
    rows = rows[:top_n]

    return {
        "topics": rows,
        "pages_processed": len([p for p in pages if isinstance(p, dict) and p.get("url")]),
        "truncated": truncated,
    }


def format_checkion_site_topics_for_prompt(
    aggregate: dict[str, Any],
    *,
    max_chars: int = 3500,
) -> str:
    """Compact block for LLM context; hard-truncated."""
    topics = aggregate.get("topics")
    if not isinstance(topics, list) or not topics:
        return ""
    lines = [
        "CHECKION_SITE_TOPICS (optional scanner metadata from latest Deep Scan slim-pages; "
        "not verified facts—use only to sharpen segments, wording, or hypotheses):",
    ]
    for t in topics:
        if not isinstance(t, dict):
            continue
        tag = t.get("tag")
        if not tag:
            continue
        pc = t.get("page_count")
        ws = t.get("weight_sum")
        ms = t.get("median_score")
        extra = f" pages={pc} weight={ws}" + (f" median_score={ms:.1f}" if isinstance(ms, (int, float)) else "")
        lines.append(f"- {tag}:{extra}")
    text = "\n".join(lines)
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 20] + "\n… (truncated)"
