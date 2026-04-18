"""Persona AI locale helpers (no heavy deps)."""

from __future__ import annotations

from app.services.persona_ai_locale import (
    append_locale_output_guard,
    finalize_ai_locale_context,
    locale_label_for_ai_prompt,
    locale_output_guard_footer,
    merge_communication_style_de_overlay,
    normalize_output_locale,
    persona_profile_for_ai,
)


def test_normalize_output_locale() -> None:
    assert normalize_output_locale(None) == "de"
    assert normalize_output_locale("en") == "en"
    assert normalize_output_locale("EN") == "en"
    assert normalize_output_locale("de") == "de"


def test_finalize_ai_locale_context() -> None:
    assert finalize_ai_locale_context({})["generated_text_locale_name"] == "German"
    assert finalize_ai_locale_context({})["output_locale"] == "de"
    assert finalize_ai_locale_context({"output_locale": "en"})["generated_text_locale_name"] == "English"
    assert finalize_ai_locale_context({"generated_text_locale_name": "English"})["output_locale"] == "en"


def test_merge_communication_style_de_overlay() -> None:
    base = {"vocabulary": ["a"], "sentence_structure": "short", "skepticism_level": 1}
    patch = {"vocabulary": ["x", "y"], "sentence_structure": "lang"}
    assert merge_communication_style_de_overlay(base, patch)["vocabulary"] == ["x", "y"]


def test_persona_profile_for_ai_de_merges_lists() -> None:
    from types import SimpleNamespace

    p = SimpleNamespace(
        profile={"interests": ["en_i"], "traits": {"Calm": 0.5}, "communication_style": {"vocabulary": ["a"], "sentence_structure": "s", "skepticism_level": 0}},
        profile_de={"interests": ["de_i"], "communication_style": {"vocabulary": ["de_v"], "sentence_structure": "de_s"}},
    )
    out = persona_profile_for_ai(p, "de")  # type: ignore[arg-type]
    assert out["interests"] == ["de_i"]
    assert out["traits"] == {"Calm": 0.5}
    assert out["communication_style"]["vocabulary"] == ["de_v"]


def test_locale_label_for_ai_prompt() -> None:
    assert locale_label_for_ai_prompt("en") == "English"
    assert locale_label_for_ai_prompt("de") == "German"


def test_locale_output_guard_footer_de_and_en() -> None:
    de_f = locale_output_guard_footer(output_locale="de")
    assert "KRITISCH" in de_f
    assert "AUSGABESPRACHE DEUTSCH" in de_f
    en_f = locale_output_guard_footer(output_locale="en")
    assert "CRITICAL OUTPUT LANGUAGE" in en_f
    assert "English" in en_f


def test_append_locale_output_guard() -> None:
    out = append_locale_output_guard("Preamble", output_locale="de")
    assert out.startswith("Preamble")
    assert "KRITISCH" in out
