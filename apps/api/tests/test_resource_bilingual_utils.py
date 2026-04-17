"""Unit tests for project / target group bilingual publish helpers (no DB)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from app.services.resource_bilingual_utils import (
    normalize_publication_status,
    validate_project_bilingual_publish,
    validate_target_group_bilingual_publish,
)


@dataclass
class _FakeProject:
    name: str
    name_de: str | None
    description: str | None
    description_de: str | None
    company_context: str | None
    company_context_de: str | None
    status: str


@dataclass
class _FakeTargetGroup:
    name: str
    name_de: str | None
    segment: str
    segment_de: str | None
    description: str | None
    description_de: str | None
    status: str


def test_normalize_publication_status_defaults_and_case() -> None:
    assert normalize_publication_status(None) == "draft"
    assert normalize_publication_status("") == "draft"
    assert normalize_publication_status("  Published ") == "published"


def test_normalize_publication_status_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="publication_status_invalid"):
        normalize_publication_status("live")


def test_validate_project_bilingual_publish_skips_when_draft() -> None:
    p = _FakeProject(
        name="A",
        name_de=None,
        description="x",
        description_de=None,
        company_context="y",
        company_context_de=None,
        status="draft",
    )
    validate_project_bilingual_publish(project=p)


def test_validate_project_bilingual_publish_published_rules() -> None:
    p = _FakeProject(
        name="A",
        name_de="  ",
        description=None,
        description_de=None,
        company_context=None,
        company_context_de=None,
        status="published",
    )
    with pytest.raises(ValueError, match="name_de"):
        validate_project_bilingual_publish(project=p)

    p.name_de = "DE"
    p.description = "en"
    p.description_de = None
    with pytest.raises(ValueError, match="description_de"):
        validate_project_bilingual_publish(project=p)

    p.description_de = "de"
    p.company_context = "ctx"
    p.company_context_de = None
    with pytest.raises(ValueError, match="company_context_de"):
        validate_project_bilingual_publish(project=p)

    p.company_context_de = "de ctx"
    validate_project_bilingual_publish(project=p)


def test_validate_target_group_bilingual_publish_published_rules() -> None:
    tg = _FakeTargetGroup(
        name="n",
        name_de=None,
        segment="s",
        segment_de=None,
        description=None,
        description_de=None,
        status="published",
    )
    with pytest.raises(ValueError, match="name_de"):
        validate_target_group_bilingual_publish(target_group=tg)

    tg.name_de = "nd"
    with pytest.raises(ValueError, match="segment_de"):
        validate_target_group_bilingual_publish(target_group=tg)

    tg.segment_de = "sd"
    tg.description = "d"
    tg.description_de = None
    with pytest.raises(ValueError, match="description_de"):
        validate_target_group_bilingual_publish(target_group=tg)

    tg.description_de = "dd"
    validate_target_group_bilingual_publish(target_group=tg)


def test_init_db_emergency_orm_columns_for_projects_target_groups() -> None:
    """init_db must add bilingual + status columns when migrations were skipped (legacy stamp)."""
    root = Path(__file__).resolve().parents[1]
    init_py = root / "app" / "scripts" / "init_db.py"
    text = init_py.read_text(encoding="utf-8")
    assert "2c. ORM columns on projects / target_groups" in text
    for needle in (
        "audion.projects ADD COLUMN IF NOT EXISTS name_de",
        "audion.projects ADD COLUMN IF NOT EXISTS description_de",
        "audion.projects ADD COLUMN IF NOT EXISTS company_context_de",
        "audion.target_groups ADD COLUMN IF NOT EXISTS name_de",
        "audion.target_groups ADD COLUMN IF NOT EXISTS segment_de",
        "audion.target_groups ADD COLUMN IF NOT EXISTS description_de",
    ):
        assert needle in text, f"missing emergency DDL: {needle}"


def test_init_db_emergency_persona_bilingual_columns() -> None:
    root = Path(__file__).resolve().parents[1]
    init_py = root / "app" / "scripts" / "init_db.py"
    text = init_py.read_text(encoding="utf-8")
    assert "2d. Persona bilingual ORM columns" in text
    for needle in (
        "audion.personas ADD COLUMN IF NOT EXISTS headline_de",
        "audion.personas ADD COLUMN IF NOT EXISTS profile_de",
        "audion.personas ADD COLUMN IF NOT EXISTS profile_card_de",
        "audion.persona_prompts ADD COLUMN IF NOT EXISTS system_prompt_de",
    ):
        assert needle in text, f"missing persona emergency DDL: {needle}"


def test_coolify_migrate_script_present() -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "scripts" / "coolify-migrate.sh"
    assert script.is_file()
    text = script.read_text(encoding="utf-8")
    assert "alembic.ini" in text
    assert "upgrade head" in text


def test_migration_project_target_group_publication_status_columns() -> None:
    root = Path(__file__).resolve().parents[1]
    mig = root / "alembic" / "versions" / "20260418_project_target_group_publication_status.py"
    text = mig.read_text(encoding="utf-8")
    for needle in ('"projects"', '"target_groups"', "status", 'schema="audion"'):
        assert needle in text
    for line in text.splitlines():
        if line.strip().startswith("revision = "):
            rev_id = line.split('"', 2)[1]
            assert len(rev_id) <= 32, (
                "revision id must fit audion.alembic_version.version_num (varchar(32))"
            )
            break
    else:
        raise AssertionError("revision = line not found in migration")
