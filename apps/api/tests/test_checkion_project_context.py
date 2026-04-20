"""CHECKION site-topics bundle: seed URL rules vs linked CHECKION project."""

from __future__ import annotations

import importlib.util
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("deps not installed", allow_module_level=True)

from app.services.checkion_project_context import fetch_checkion_site_topics_bundle


def _session_with_no_research_run() -> MagicMock:
    session = MagicMock()
    q = MagicMock()
    session.query.return_value = q
    q.where.return_value = q
    q.order_by.return_value = q
    q.first.return_value = None
    return session


@patch("app.services.checkion_project_context.fetch_checkion_raw_slim_pages_for_site_topics")
@patch("app.services.checkion_project_context.get_settings")
def test_bundle_loads_topics_without_research_seed_when_checkion_project_linked(
    mock_get_settings: MagicMock,
    mock_fetch: MagicMock,
) -> None:
    """Deep scan via domain-summary must not require AUDION ProjectResearchRun seed_url."""
    mock_get_settings.return_value = SimpleNamespace(
        checkion_api_base_url="https://checkion.example",
        checkion_api_token="token",
        checkion_request_timeout_seconds=30.0,
    )
    mock_fetch.return_value = (
        [{"url": "https://corp.example/", "pageClassification": {"tags": ["product"]}}],
        "scan-from-checkion",
        "checkion_project",
    )
    project = SimpleNamespace(id=uuid4(), checkion_project_id="  chk-proj-uuid  ")
    session = _session_with_no_research_run()

    out = fetch_checkion_site_topics_bundle(session=session, project=project, explicit_seed_url=None, max_pages=50)

    assert out["unavailable_reason"] is None
    assert out["scan_id"] == "scan-from-checkion"
    assert out["source"] == "checkion_project"
    assert len(out["topics"]) >= 1
    assert out["seed_url_used"] is None
    mock_fetch.assert_called_once()
    call_kw = mock_fetch.call_args.kwargs
    assert call_kw["checkion_project_id"] == "chk-proj-uuid"
    assert call_kw["seed_url"] == ""


@patch("app.services.checkion_project_context.get_settings")
def test_bundle_still_requires_seed_without_checkion_link(mock_get_settings: MagicMock) -> None:
    mock_get_settings.return_value = SimpleNamespace(
        checkion_api_base_url="https://checkion.example",
        checkion_api_token="token",
        checkion_request_timeout_seconds=30.0,
    )
    project = SimpleNamespace(id=uuid4(), checkion_project_id=None)
    session = _session_with_no_research_run()

    out = fetch_checkion_site_topics_bundle(session=session, project=project, explicit_seed_url=None, max_pages=50)

    assert out["unavailable_reason"] == "no_seed_url"
    assert out["topics"] == []
