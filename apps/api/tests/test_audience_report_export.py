"""Tests for CHECKION audience report export."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_JWT_SECRET", "test-secret-for-audience-export-tests")

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.audience_report_export import (
    _load_personas_for_audience_export,
    build_audience_report_context,
)


def test_build_audience_report_context_missing_id():
    session = MagicMock()
    out = build_audience_report_context(session, checkion_project_id="")
    assert out["available"] is False


def test_build_audience_report_context_no_project():
    session = MagicMock()
    session.scalars.return_value.first.return_value = None
    out = build_audience_report_context(session, checkion_project_id="chk-1")
    assert out["available"] is False
    assert out["reason"] == "no_audion_project_for_checkion_id"


def test_build_audience_report_context_exports_personas():
    project_id = uuid4()
    tg_id = uuid4()
    persona_id = uuid4()

    project = SimpleNamespace(id=project_id, name="Demo", checkion_project_id="chk-1")
    tg = SimpleNamespace(id=tg_id, name="Makler", segment="B2B", description="Broker segment")
    persona = SimpleNamespace(
        id=persona_id,
        name="Sandra",
        headline="Versicherungsmaklerin",
        segment="Broker",
        target_group_id=tg_id,
        profile={
            "pain_points": [{"label": "Kunden fragen nach Haftpflicht"}],
            "goals": ["Schnelle Empfehlungen geben"],
            "interests": ["Haftpflicht"],
        },
        ux_journey_runs=[],
    )

    session = MagicMock()
    call = {"n": 0}

    def scalars_side_effect(_stmt):
        call["n"] += 1
        result = MagicMock()
        if call["n"] == 1:
            result.first.return_value = project
        elif call["n"] == 2:
            result.all.return_value = [tg]
        else:
            result.all.return_value = [persona]
        return result

    session.scalars.side_effect = scalars_side_effect

    out = build_audience_report_context(session, checkion_project_id="chk-1")
    assert out["available"] is True
    assert out["audionProjectName"] == "Demo"
    assert len(out["personas"]) == 1
    assert out["personas"][0]["painPoints"][0] == "Kunden fragen nach Haftpflicht"


def test_build_audience_report_context_platform_project_fallback():
    project_id = uuid4()
    project = SimpleNamespace(
        id=project_id,
        name="Plexon Linked",
        checkion_project_id=None,
        platform_project_id="plat-99",
    )
    session = MagicMock()
    call = {"n": 0}

    def scalars_side_effect(_stmt):
        call["n"] += 1
        result = MagicMock()
        if call["n"] == 1:
            result.first.return_value = None
        elif call["n"] == 2:
            result.first.return_value = project
        elif call["n"] == 3:
            result.all.return_value = []
        else:
            result.all.return_value = []
        return result

    session.scalars.side_effect = scalars_side_effect

    out = build_audience_report_context(
        session,
        checkion_project_id="chk-1",
        platform_project_id="plat-99",
    )
    assert out["available"] is True
    assert out["resolvedVia"] == "platform_project_id"
    assert out["audionProjectName"] == "Plexon Linked"


def test_load_personas_falls_back_without_ux_journey_table():
    project_id = uuid4()
    persona = SimpleNamespace(
        id=uuid4(),
        name="Fallback",
        headline="h",
        segment="s",
        target_group_id=None,
        profile={},
    )
    session = MagicMock()
    call = {"n": 0}

    def scalars_side_effect(_stmt):
        call["n"] += 1
        if call["n"] == 1:
            raise Exception('relation "audion.persona_ux_journey_runs" does not exist')
        result = MagicMock()
        result.all.return_value = [persona]
        return result

    session.scalars.side_effect = scalars_side_effect
    session.get_bind.return_value = None

    rows = _load_personas_for_audience_export(session, project_id, max_personas=24)
    assert len(rows) == 1
    assert rows[0].name == "Fallback"
    assert rows[0].ux_journey_runs == []
