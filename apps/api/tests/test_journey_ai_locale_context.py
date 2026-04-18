"""Journey AI context gets output_locale / generated_text_locale_name via finalize."""

from __future__ import annotations

from app.services.persona_ai_locale import finalize_ai_locale_context


def test_finalize_sets_german_by_default() -> None:
    ctx = finalize_ai_locale_context({"journey_name": "X"})
    assert ctx["output_locale"] == "de"
    assert ctx["generated_text_locale_name"] == "German"


def test_finalize_respects_output_locale_en() -> None:
    ctx = finalize_ai_locale_context({"output_locale": "en", "journey_name": "X"})
    assert ctx["output_locale"] == "en"
    assert ctx["generated_text_locale_name"] == "English"
