"""Unit tests for turn naturalness heuristics."""

from __future__ import annotations

import pytest

from app.utils.turn_naturalness import (
    TurnSessionState,
    build_turn_naturalness_spec,
    compose_persona_system_prompt,
    extract_last_two_user_texts,
    extract_text_from_openai_content,
)


def test_extract_text_from_string() -> None:
    assert extract_text_from_openai_content("hello") == "hello"


def test_extract_text_from_multimodal() -> None:
    content = [
        {"type": "text", "text": "part a"},
        {"type": "image_url", "image_url": {"url": "x"}},
        {"type": "text", "text": "part b"},
    ]
    assert "part a" in extract_text_from_openai_content(content)
    assert "part b" in extract_text_from_openai_content(content)


def test_extract_last_two_user_texts() -> None:
    msgs = [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "ok"},
        {"role": "user", "content": "second"},
    ]
    last, prev = extract_last_two_user_texts(msgs)
    assert last == "second"
    assert prev == "first"


def test_short_user_proportional_brevity() -> None:
    spec = build_turn_naturalness_spec(
        last_user_text="Was kostet das?",
        prev_user_text=None,
        session=None,
    )
    assert spec.reply_mode == "standard"
    assert "ähnlicher Kürze" in spec.system_addendum_de or "kurz" in spec.system_addendum_de.lower()


def test_compact_ack_standard_mode() -> None:
    spec = build_turn_naturalness_spec(last_user_text="danke", prev_user_text=None, session=None)
    assert spec.reply_mode == "standard"
    assert "ein bis zwei kurzen Sätzen" in spec.system_addendum_de or "maximal ein" in spec.system_addendum_de


def test_analytical_extended() -> None:
    spec = build_turn_naturalness_spec(
        last_user_text="Warum ist das so? Erklär die Ursachen im Detail.",
        prev_user_text=None,
        session=None,
    )
    assert spec.reply_mode == "extended"
    assert "anspruchsvoll" in spec.system_addendum_de or "ungefähr" in spec.system_addendum_de


def test_du_instruction() -> None:
    spec = build_turn_naturalness_spec(
        last_user_text="Kannst du mir das erklären? Du weißt doch, wie das geht.",
        prev_user_text=None,
        session=None,
    )
    assert "Du" in spec.system_addendum_de


def test_imperfection_budget_ws_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.utils.turn_naturalness.random.random", lambda: 0.0)
    session = TurnSessionState(imperfections_used=0, assistant_turns=1)
    spec = build_turn_naturalness_spec(
        last_user_text="Erzähl mir mehr über das Thema.",
        prev_user_text=None,
        session=session,
    )
    assert spec.allow_imperfection is True
    assert session.imperfections_used >= 1


def test_imperfection_skipped_when_roll_above_probability(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.utils.turn_naturalness.random.random", lambda: 0.99)
    session = TurnSessionState(imperfections_used=0, assistant_turns=1)
    spec = build_turn_naturalness_spec(
        last_user_text="Erzähl mir mehr über das Thema.",
        prev_user_text=None,
        session=session,
    )
    assert spec.allow_imperfection is False
    assert session.imperfections_used == 0


def test_compose_persona_system_prompt_extended() -> None:
    out = compose_persona_system_prompt(
        "Base prompt",
        reply_mode="extended",
        turn_naturalness_addendum="\n\n[Stil] Kurz.",
    )
    assert "Base prompt" in out
    assert "analysis" in out.lower() or "structure" in out.lower()
    assert "[Stil]" in out


def test_imperfection_exhausted_message() -> None:
    session = TurnSessionState(imperfections_used=10, assistant_turns=2)
    spec = build_turn_naturalness_spec(
        last_user_text="Bitte erklär mir das genauer.",
        prev_user_text=None,
        session=session,
    )
    assert "erschöpft" in spec.system_addendum_de
