"""Unit tests for the compact persona chat prompt builder."""

from __future__ import annotations

import pytest

from app.services.persona_prompt_builder import (
    CHAT_PROMPT_TEMPLATE_VERSION,
    build_compact_chat_prompt,
)


def test_build_compact_chat_prompt_contains_identity_and_behaviour() -> None:
    profile = {
        "pain_points": [{"label": "Time pressure"}],
        "goals": [{"label": "Save costs"}],
        "values": [],
        "interests": [],
        "communication_style": {"vocabulary": [], "sentence_structure": "", "skepticism_level": 5},
        "traits": {},
        "bio": "",
    }
    out = build_compact_chat_prompt(
        name="Jan Test",
        segment="B2B decision maker",
        headline="Wants fast ROI",
        profile=profile,
    )
    assert "Jan Test" in out
    assert "B2B decision maker" in out
    assert "Wants fast ROI" in out
    assert "Bleib in der Rolle" in out or "Rolle" in out
    assert "Schmerzpunkte" in out or "Time pressure" in out
    assert "Ziele" in out or "Save costs" in out


def test_build_compact_chat_prompt_truncates_long_labels() -> None:
    long_label = "A" * 200
    profile = {
        "pain_points": [{"label": long_label}],
        "goals": [],
        "values": [],
        "interests": [],
        "communication_style": {},
        "traits": {},
        "bio": "",
    }
    out = build_compact_chat_prompt(
        name="X",
        segment="Y",
        headline="Z",
        profile=profile,
    )
    assert "..." in out
    assert "A" * 120 not in out


def test_chat_prompt_template_version_constant() -> None:
    assert CHAT_PROMPT_TEMPLATE_VERSION == "2025-03-llm"


def test_build_persona_profile_summary_includes_all_sections() -> None:
    from app.services.persona_prompt_builder import build_persona_profile_summary

    profile = {
        "bio": "Engineer, 35.",
        "pain_points": [{"label": "Too many tools"}],
        "goals": [{"label": "Simplify stack"}],
        "values": [{"value": "Pragmatism"}],
        "interests": ["DevOps"],
        "communication_style": {
            "vocabulary": ["API", "Pipeline"],
            "sentence_structure": "Short, technical.",
            "skepticism_level": 7,
        },
        "traits": {"detail-oriented": 0.8, "skeptical": 0.9},
    }
    out = build_persona_profile_summary(
        name="Alex",
        segment="Tech Lead",
        headline="Wants less complexity",
        profile=profile,
    )
    assert "Name: Alex" in out
    assert "Segment: Tech Lead" in out
    assert "Headline: Wants less complexity" in out
    assert "Bio: Engineer" in out
    assert "Too many tools" in out
    assert "Simplify stack" in out
    assert "Pragmatism" in out
    assert "DevOps" in out
    assert "API" in out and "Pipeline" in out
    assert "Satzbau" in out
    assert "Skeptizismus" in out
    assert "detail-oriented" in out or "skeptical" in out
