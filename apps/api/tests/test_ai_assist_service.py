import pytest

pytest.importorskip("msqdx_glass_proto")

from app.services.ai_assist import (
    TEMPLATE_CACHE_PREFIX_LAST_VAR,
    AiAssistService,
    PromptTemplateRegistry,
    seed_default_templates_for_project,
)


def test_seed_default_templates_invalid_project_id() -> None:
    """seed_default_templates_for_project returns 0 for invalid project_id."""
    from app.db import get_session

    with get_session() as session:
        count = seed_default_templates_for_project(session, "not-a-valid-uuid")
    assert count == 0


def test_prompt_template_registry_loads_templates() -> None:
    registry = PromptTemplateRegistry()
    templates = registry.list_templates()
    assert any(template.template_id == "journey.moments" for template in templates)


def test_extract_json_from_message() -> None:
    service = AiAssistService(registry=PromptTemplateRegistry())
    payload = "Intro text {\"items\": [{\"content\": \"hello\"}]} trailing noise"
    extracted = service._extract_json(payload)  # type: ignore[attr-defined]
    assert extracted is not None
    assert extracted.startswith("{")


def test_render_prompt_prefix_suffix_no_cache_var() -> None:
    """When cache_prefix_last_variable is None, returns full rendered prompt and empty suffix."""
    service = AiAssistService(registry=PromptTemplateRegistry())
    prompt = "Hello ${name}. Next: ${task}."
    context = {"name": "Alice", "task": "run"}
    prefix, suffix = service._render_prompt_prefix_suffix(  # type: ignore[attr-defined]
        prompt, context, None
    )
    assert prefix == "Hello Alice. Next: run."
    assert suffix == ""


def test_render_prompt_prefix_suffix_with_cache_var() -> None:
    """Prefix ends after last occurrence of the cache variable; suffix is the rest rendered."""
    service = AiAssistService(registry=PromptTemplateRegistry())
    prompt = "PREFIX ${knowledge_context}\n\nSUFFIX ${journey_type}."
    context = {"knowledge_context": "Company info here.", "journey_type": "customer"}
    prefix, suffix = service._render_prompt_prefix_suffix(  # type: ignore[attr-defined]
        prompt, context, "knowledge_context"
    )
    assert prefix == "PREFIX Company info here."
    assert suffix == "SUFFIX customer."


def test_render_prompt_prefix_suffix_placeholder_missing() -> None:
    """When placeholder is not in prompt, returns full rendered and empty suffix."""
    service = AiAssistService(registry=PromptTemplateRegistry())
    prompt = "Only ${other} here."
    context = {"other": "x"}
    prefix, suffix = service._render_prompt_prefix_suffix(  # type: ignore[attr-defined]
        prompt, context, "knowledge_context"
    )
    assert prefix == "Only x here."
    assert suffix == ""


def test_template_cache_prefix_map_has_expected_templates() -> None:
    """TEMPLATE_CACHE_PREFIX_LAST_VAR includes high-value templates for caching."""
    assert "journey.full_generation" in TEMPLATE_CACHE_PREFIX_LAST_VAR
    assert TEMPLATE_CACHE_PREFIX_LAST_VAR["journey.full_generation"] == "knowledge_context"
    assert "persona.pain_points" in TEMPLATE_CACHE_PREFIX_LAST_VAR
    assert TEMPLATE_CACHE_PREFIX_LAST_VAR["persona.pain_points"] == "persona_profile"

