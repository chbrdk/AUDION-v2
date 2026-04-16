"""Defaults for chat OpenAI settings (no env required)."""

from __future__ import annotations

from app.core.config import Settings


def test_chat_model_and_max_completion_defaults() -> None:
    assert Settings.model_fields["chat_model"].default == "gpt-5.4-nano"
    assert Settings.model_fields["chat_max_completion_tokens"].default == 16384
    assert Settings.model_fields["chat_reasoning_effort_standard"].default == "none"
    assert Settings.model_fields["chat_reasoning_effort_extended"].default == "low"
