"""Tests for the AI/deterministic dispatcher in UxRunToJourneyService.

We mock the LLM (`AiAssistService.generate`) to keep these fast and
deterministic. The fixtures verify two contracts:

1. AI mode with a valid JSON response returns ``mode='ai'``.
2. AI mode with invalid JSON falls back to deterministic clustering.
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.ux_run_to_journey import UxRunToJourneyService


@pytest.fixture()
def steps() -> list[dict]:
    return [
        {
            "step": 1,
            "action": "navigate",
            "target": "https://example.com/start",
            "reasoning": "Open landing page.",
            "observations": [],
        },
        {
            "step": 2,
            "action": "click",
            "target": "https://example.com/finish",
            "reasoning": "Press CTA.",
            "observations": [],
        },
    ]


class _FakeResponse:
    def __init__(self, raw_output: str) -> None:
        self.raw_output = raw_output


def _stub_ai(raw_output: str):
    """Build a stub AiAssistService that returns `raw_output` from `generate`."""

    class _StubAi:
        async def generate(self, request, retrieval_usage_user_id=None):  # noqa: ARG002
            return _FakeResponse(raw_output)

    return _StubAi()


def test_convert_ai_with_valid_json_returns_ai_mode(steps: list[dict]) -> None:
    ai_payload = (
        '{"name": "AI Journey", "description": "AI desc",'
        ' "phases": ['
        '   {"name": "Phase A", "phase_order": 1, "expected_emotion": "neutral",'
        '    "elements": [{"element_type": "action", "content": "Open"}]}'
        ' ]}'
    )
    service = UxRunToJourneyService(ai_assist=_stub_ai(ai_payload))  # type: ignore[arg-type]

    draft, mode_used, fallback_used = asyncio.run(
        service.convert(
            mode="ai",
            task="Buy widget",
            site_url="https://example.com/",
            persona={"name": "Alex"},
            steps=steps,
            scorecard=None,
            journey_type="ux_audit",
            locale="en",
        )
    )
    assert mode_used == "ai"
    assert fallback_used is False
    assert draft.name == "AI Journey"
    assert len(draft.phases) == 1


def test_convert_ai_with_invalid_response_falls_back_to_deterministic(steps: list[dict]) -> None:
    service = UxRunToJourneyService(ai_assist=_stub_ai("garbage not json"))  # type: ignore[arg-type]

    draft, mode_used, fallback_used = asyncio.run(
        service.convert(
            mode="ai",
            task="Buy widget",
            site_url="https://example.com/",
            persona={"name": "Alex"},
            steps=steps,
            scorecard=None,
            journey_type="ux_audit",
            locale="en",
        )
    )
    assert mode_used == "deterministic"
    assert fallback_used is True
    assert len(draft.phases) >= 1
    # Deterministic mode always uses the persona name when available.
    assert "Alex" in draft.name


def test_convert_deterministic_explicit_mode(steps: list[dict]) -> None:
    service = UxRunToJourneyService(ai_assist=_stub_ai("should not be called"))  # type: ignore[arg-type]

    draft, mode_used, fallback_used = asyncio.run(
        service.convert(
            mode="deterministic",
            task="Buy widget",
            site_url="https://example.com/",
            persona={"name": "Alex"},
            steps=steps,
            scorecard=None,
            journey_type="ux_audit",
        )
    )
    assert mode_used == "deterministic"
    assert fallback_used is False
    assert draft.phases
