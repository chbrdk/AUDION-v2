import pytest

pytest.importorskip("msqdx_glass_proto")

from app.services.ai_assist import AiAssistService, PromptTemplateRegistry, seed_default_templates_for_project


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

