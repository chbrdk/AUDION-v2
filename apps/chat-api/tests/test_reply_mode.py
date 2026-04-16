"""Heuristic reply mode (standard vs extended) for persona chat."""

from __future__ import annotations

from app.utils.reply_mode import infer_reply_mode


def test_short_message_standard() -> None:
    assert infer_reply_mode("Hi") == "standard"


def test_long_message_extended() -> None:
    text = "x" * 201
    assert infer_reply_mode(text) == "extended"


def test_multiple_questions_extended() -> None:
    assert infer_reply_mode("What is A? What is B?") == "extended"


def test_analytical_keywords_extended() -> None:
    assert infer_reply_mode("Can you explain the tradeoffs?") == "extended"
    assert infer_reply_mode("Bitte vergleiche die beiden Optionen.") == "extended"


def test_build_persona_user_content_modes_differ() -> None:
    from app.utils.reply_mode import build_persona_user_content

    short = build_persona_user_content(question="Hi", sources_text="", mode="standard")
    long = build_persona_user_content(question="Hi", sources_text="", mode="extended")
    assert "Nutzerfrage" in short
    assert "Nutzerfrage" in long
    assert "Relevant context" not in short
