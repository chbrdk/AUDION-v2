"""persona.geo_questions template registration (no DB)."""

from __future__ import annotations

from pathlib import Path

import yaml


def _load_templates() -> list[dict]:
    path = Path(__file__).resolve().parents[1] / "app" / "prompts" / "templates.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data.get("templates") or []


def test_persona_geo_questions_template_registered() -> None:
    templates = _load_templates()
    tpl = next((t for t in templates if t.get("template_id") == "persona.geo_questions"), None)
    assert tpl is not None, "persona.geo_questions template missing"
    prompt = tpl.get("prompt") or ""
    for var in (
        "persona_name",
        "persona_segment",
        "persona_profile",
        "persona_goals",
        "persona_pain_points",
        "brand_name",
        "brand_url",
        "max_items",
        "generated_text_locale_name",
    ):
        assert f"${{{var}}}" in prompt, f"missing template variable {var}"
    output = tpl.get("output") or {}
    assert output.get("mode") == "json"
    assert output.get("key") == "items"
