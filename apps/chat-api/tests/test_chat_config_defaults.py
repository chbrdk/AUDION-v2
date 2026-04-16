"""Defaults for chat OpenAI settings (no env required)."""

from __future__ import annotations

from app.core.config import Settings


def test_chat_model_and_max_completion_defaults() -> None:
    assert Settings.model_fields["chat_model"].default == "gpt-5.4-nano"
    assert Settings.model_fields["chat_max_completion_tokens"].default == 16384
    assert Settings.model_fields["chat_reasoning_effort_standard"].default == "none"
    assert Settings.model_fields["chat_reasoning_effort_extended"].default == "low"
    assert Settings.model_fields["chat_extended_min_chars"].default == 200
    assert Settings.model_fields["turn_naturalness_max_imperfections_per_session"].default == 3
    assert Settings.model_fields["turn_naturalness_http_session_ttl_seconds"].default == 86400
    assert Settings.model_fields["turn_naturalness_http_session_max_entries"].default == 50_000
    assert Settings.model_fields["turn_naturalness_imperfection_probability"].default == 0.35
    assert Settings.model_fields["upload_max_document_bytes"].default == 15 * 1024 * 1024
    assert Settings.model_fields["upload_max_document_chars"].default == 200_000
    assert Settings.model_fields["upload_attachment_ttl_seconds"].default == 3600
