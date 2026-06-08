"""Tests for persona UX-journey schema helpers."""

from __future__ import annotations

from app.services.persona_ux_journey_runs_schema import is_missing_persona_ux_journey_runs_error


def test_detects_missing_table_error():
    class Orig(Exception):
        pass

    exc = Exception("relation \"audion.persona_ux_journey_runs\" does not exist")
    exc.orig = Orig()  # type: ignore[attr-defined]
    assert is_missing_persona_ux_journey_runs_error(exc) is True


def test_detects_missing_column_error():
    exc = Exception('column "derived_journey_id" of relation "persona_ux_journey_runs" does not exist')
    assert is_missing_persona_ux_journey_runs_error(exc) is True


def test_ignores_unrelated_errors():
    assert is_missing_persona_ux_journey_runs_error(Exception("projects.id missing")) is False
