"""Unit tests for CHECKION slim-page topic aggregation."""

from __future__ import annotations

import importlib.util

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("deps not installed", allow_module_level=True)

from app.services.checkion_topic_aggregate import aggregate_site_topics_from_slim_pages, format_checkion_site_topics_for_prompt


def test_aggregate_merges_tag_tiers_and_tags_and_sorts_by_page_count() -> None:
    pages = [
        {
            "url": "https://a.example/p1",
            "score": 10,
            "pageClassification": {
                "tagTiers": [{"tag": "pricing", "tier": 2}],
                "tags": ["saas"],
            },
        },
        {
            "url": "https://a.example/p2",
            "score": 20,
            "pageClassification": {"tagTiers": [{"tag": "pricing", "tier": 1}]},
        },
        {
            "url": "https://a.example/p3",
            "score": 5,
            "pageClassification": {"tags": ["saas", "blog"]},
        },
    ]
    out = aggregate_site_topics_from_slim_pages(pages, top_n=30)
    tags = [t["tag"] for t in out["topics"]]
    assert "pricing" in tags and "saas" in tags
    pricing = next(t for t in out["topics"] if t["tag"] == "pricing")
    saas = next(t for t in out["topics"] if t["tag"] == "saas")
    assert pricing["page_count"] == 2
    assert saas["page_count"] == 2
    assert pricing["weight_sum"] >= saas["weight_sum"]
    assert isinstance(pricing.get("median_score"), float)
    assert out["truncated"] is False


def test_aggregate_truncated_when_more_than_top_n_distinct_tags() -> None:
    pages = [
        {"url": f"https://x.example/{i}", "pageClassification": {"tags": [f"tag{i}"]}}
        for i in range(40)
    ]
    out = aggregate_site_topics_from_slim_pages(pages, top_n=5)
    assert len(out["topics"]) == 5
    assert out["truncated"] is True


def test_format_prompt_includes_header_and_truncates() -> None:
    agg = {
        "topics": [{"tag": "alpha", "page_count": 3, "weight_sum": 2.5, "median_score": 1.0}],
        "pages_processed": 3,
        "truncated": False,
    }
    text = format_checkion_site_topics_for_prompt(agg, max_chars=500)
    assert "CHECKION_SITE_TOPICS" in text
    assert "alpha" in text


def test_format_prompt_empty_when_no_topics() -> None:
    assert format_checkion_site_topics_for_prompt({"topics": []}) == ""
