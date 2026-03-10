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
    assert CHAT_PROMPT_TEMPLATE_VERSION == "2025-03-compact"
