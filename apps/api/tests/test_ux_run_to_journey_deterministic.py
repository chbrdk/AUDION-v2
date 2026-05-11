"""Unit-tests for the deterministic UX-run -> JourneyDraft mapper.

We focus on the pure-Python clustering logic (`build_deterministic_draft`)
so the test suite needs no DB and no HTTP access.
"""

from __future__ import annotations

from app.services.ux_run_to_journey import build_deterministic_draft


def _sample_steps() -> list[dict]:
    """Three URL sections -> three deterministic phases.

    step 1 -> /discover  (positive)
    step 2 -> /compare   (negative pain-point)
    step 3 -> /checkout  (positive opportunity)
    """
    return [
        {
            "step": 1,
            "action": "navigate",
            "target": "https://example.com/discover/page-a",
            "reasoning": "I want to scan the landing page.",
            "observations": [
                {"category": "layout", "polarity": 1, "severity": "low", "note": "Clear hero."},
            ],
        },
        {
            "step": 2,
            "action": "click",
            "target": "https://example.com/compare/items",
            "reasoning": "Comparing two products before buying.",
            "observations": [
                {
                    "category": "copy",
                    "polarity": -1,
                    "severity": "high",
                    "note": "Pricing tiers unclear.",
                },
            ],
        },
        {
            "step": 3,
            "action": "click",
            "target": "https://example.com/checkout/summary",
            "reasoning": "Continuing to checkout.",
            "observations": [
                {
                    "category": "trust",
                    "polarity": 2,
                    "severity": "low",
                    "note": "Padlock + reviews build trust.",
                },
            ],
        },
    ]


def test_deterministic_three_phases_from_url_clusters() -> None:
    draft = build_deterministic_draft(
        task="Buy a widget",
        site_url="https://example.com/",
        persona_name="Alex",
        steps=_sample_steps(),
        scorecard=None,
    )
    assert draft.journey_type == "ux_audit"
    assert len(draft.phases) == 3
    names = [p["name"] for p in draft.phases]
    assert names == ["Discover", "Compare", "Checkout"]
    for phase in draft.phases:
        assert phase["expected_emotion"] in {
            "frustrated",
            "anxious",
            "neutral",
            "hopeful",
            "satisfied",
            "delighted",
        }
        # Each phase must have at least one element (action + the observation).
        assert len(phase["elements"]) >= 2


def test_deterministic_negative_observation_becomes_pain_point() -> None:
    draft = build_deterministic_draft(
        task="Buy",
        site_url="https://example.com/",
        persona_name=None,
        steps=_sample_steps(),
        scorecard=None,
    )
    compare_phase = next(p for p in draft.phases if p["name"] == "Compare")
    pain_elements = [e for e in compare_phase["elements"] if e["element_type"] == "pain_point"]
    assert pain_elements, "Negative polarity observation must map to a pain_point element."
    assert "Pricing tiers" in pain_elements[0]["content"]


def test_deterministic_positive_observation_becomes_opportunity() -> None:
    draft = build_deterministic_draft(
        task="Buy",
        site_url="https://example.com/",
        persona_name=None,
        steps=_sample_steps(),
        scorecard=None,
    )
    checkout_phase = next(p for p in draft.phases if p["name"] == "Checkout")
    opportunities = [e for e in checkout_phase["elements"] if e["element_type"] == "opportunity"]
    assert opportunities, "Positive polarity observation must map to an opportunity element."


def test_deterministic_quotes_attached_when_scorecard_present() -> None:
    scorecard = {
        "frictionScore": 4.5,
        "personaFitScore": 7.5,
        "perStepRatings": [
            {"step": 1, "ratings": {"persona_fit": 3.5}},
            {"step": 2, "ratings": {"persona_fit": -3.0}},
            {"step": 3, "ratings": {"persona_fit": 4.0}},
        ],
        "quotes": [
            {"step": 2, "text": "Why are prices so confusing?"},
            {"step": 3, "text": "Nice to see a padlock here!"},
        ],
    }
    draft = build_deterministic_draft(
        task="Buy",
        site_url="https://example.com/",
        persona_name="Alex",
        steps=_sample_steps(),
        scorecard=scorecard,
    )
    compare_phase = next(p for p in draft.phases if p["name"] == "Compare")
    quotes = [e for e in compare_phase["elements"] if e["element_type"] == "quote"]
    assert quotes, "Scorecard quotes must be attached to the phase that owns the step."
    assert "prices" in quotes[0]["content"].lower()

    # Emotion is derived from per-step persona_fit average -> negative for "Compare".
    assert compare_phase["expected_emotion"] in {"anxious", "frustrated"}
    # Checkout has very high persona_fit -> satisfied or delighted.
    checkout_phase = next(p for p in draft.phases if p["name"] == "Checkout")
    assert checkout_phase["expected_emotion"] in {"satisfied", "delighted"}


def test_deterministic_handles_empty_steps() -> None:
    draft = build_deterministic_draft(
        task="Nothing happened",
        site_url=None,
        persona_name=None,
        steps=[],
        scorecard=None,
    )
    assert draft.phases == []
    # Name fallback still produced.
    assert draft.name


def test_deterministic_url_pattern_collects_domains_and_paths() -> None:
    draft = build_deterministic_draft(
        task="Compare",
        site_url="https://example.com/",
        persona_name=None,
        steps=_sample_steps(),
        scorecard=None,
    )
    compare_phase = next(p for p in draft.phases if p["name"] == "Compare")
    assert "url_pattern" in compare_phase
    assert "example.com" in compare_phase["url_pattern"]["domains"]
    assert "compare" in compare_phase["url_pattern"]["paths"]
