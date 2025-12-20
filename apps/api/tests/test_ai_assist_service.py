import pytest

pytest.importorskip("msqdx_glass_proto")

from app.services.ai_assist import AiAssistService, PromptTemplateRegistry


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

