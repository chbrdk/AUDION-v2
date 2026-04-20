"""project_research_prompt: optional JSON block for suggest flows."""

from __future__ import annotations

import importlib.util
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

if importlib.util.find_spec("sqlalchemy") is None:
    pytest.skip("sqlalchemy not installed", allow_module_level=True)

from app.services.project_research_prompt import build_optional_project_research_json_context


def test_build_returns_prefixed_json_when_summary_present() -> None:
    project = MagicMock()
    project.id = uuid4()
    run = MagicMock(id="run-1")
    summary = MagicMock()
    summary.summary_en = {"positioning": "clear", "geoQueries": ["how to …"]}

    q_run = MagicMock()
    q_run.where.return_value = q_run
    q_run.order_by.return_value = q_run
    q_run.first.return_value = run

    q_sum = MagicMock()
    q_sum.where.return_value = q_sum
    q_sum.order_by.return_value = q_sum
    q_sum.first.return_value = summary

    session = MagicMock()
    session.query.side_effect = [q_run, q_sum]

    out = build_optional_project_research_json_context(session, project=project)

    assert out is not None
    assert out.startswith("PROJECT AI RESEARCH (JSON, English canonical):\n")
    assert "positioning" in out
    assert "geoQueries" in out


def test_build_returns_none_when_no_run() -> None:
    project = MagicMock()
    project.id = uuid4()
    q_run = MagicMock()
    q_run.where.return_value = q_run
    q_run.order_by.return_value = q_run
    q_run.first.return_value = None
    session = MagicMock()
    session.query.return_value = q_run

    assert build_optional_project_research_json_context(session, project=project) is None
