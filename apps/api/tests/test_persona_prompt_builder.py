"""Unit tests for the persona chat prompt builder."""

from __future__ import annotations

import pytest

from app.services.persona_prompt_builder import (
    CHAT_PROMPT_TEMPLATE_VERSION,
    build_compact_chat_prompt,
    build_persona_profile_summary,
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
    assert "Rolle" in out
    assert "Schmerzpunkte" in out or "Time pressure" in out
    assert "Ziele" in out or "Save costs" in out


def test_build_compact_chat_prompt_truncates_long_labels() -> None:
    long_label = "A" * 500
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
    assert "A" * 300 not in out


def test_chat_prompt_template_version_constant() -> None:
    assert CHAT_PROMPT_TEMPLATE_VERSION == "2026-04-rich-chat-v1"


def test_build_persona_profile_summary_includes_all_sections() -> None:
    profile = {
        "bio": "Engineer, 35.",
        "pain_points": [{"label": "Too many tools", "evidence_count": 2}],
        "goals": [{"label": "Simplify stack", "priority": 1}],
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
    assert "Belege: 2" in out
    assert "Simplify stack" in out
    assert "Priorität: 1" in out
    assert "Pragmatism" in out
    assert "DevOps" in out
    assert "API" in out and "Pipeline" in out
    assert "Satzbau" in out
    assert "Skeptizismus" in out
    assert "detail-oriented" in out or "skeptical" in out


def test_build_persona_profile_summary_demographics_and_full_name() -> None:
    profile = {
        "full_name": "Markus Example",
        "age": 54,
        "gender": "male",
        "media_affinity": 83,
        "location": "München",
        "pain_points": [],
        "goals": [],
        "values": [],
        "interests": [],
        "communication_style": {},
        "traits": {},
    }
    out = build_persona_profile_summary(
        name="Markus",
        segment="Der Aufsteiger",
        headline="Status und Auto",
        profile=profile,
    )
    assert "Vollständiger Name: Markus Example" in out
    assert "Alter: 54" in out
    assert "Geschlecht: male" in out
    assert "Medienaffinität" in out and "83" in out
    assert "München" in out
