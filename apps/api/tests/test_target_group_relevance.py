"""Unit tests for deterministic target-group relevance scoring."""

from __future__ import annotations

import importlib.util

import pytest

if importlib.util.find_spec("sqlalchemy") is None:
    pytest.skip("deps not installed", allow_module_level=True)

from app.services.target_group_relevance import deterministic_target_group_relevance


def test_deterministic_scores_higher_with_checkion_tag_overlap():
    score, signals = deterministic_target_group_relevance(
        name="B2B pricing decision makers",
        segment="pricing-leads",
        description="People evaluating pricing and plans for SaaS.",
        checkion_topics=[{"tag": "pricing", "weight_sum": 4.0, "page_count": 10}],
        research_summary_en=None,
    )
    assert score >= 10
    assert any("CHECKION" in s for s in signals)


def test_deterministic_scores_higher_with_research_terminology_overlap():
    summary = {
        "terminology": {"claims": [{"text": "procurement leaders care about compliance"}]},
        "company_overview": {"summary": "B2B compliance platform"},
    }
    score, signals = deterministic_target_group_relevance(
        name="Procurement leaders",
        segment="procurement",
        description="Compliance-focused buyers in procurement.",
        checkion_topics=None,
        research_summary_en=summary,
    )
    assert score > 0
    assert any("Research" in s for s in signals)

