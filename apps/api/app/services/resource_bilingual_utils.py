"""Bilingual publish validation for projects and target groups (EN canonical, DE mirrors)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


def _norm_status(value: object) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(getattr(value, "value", "") or "").strip().lower()
    return str(value).strip().lower()


_PUBLICATION_STATUSES = frozenset({"draft", "published"})


def normalize_publication_status(value: object | None) -> str:
    """Return ``draft`` or ``published``; default ``draft`` when missing or blank."""

    if value is None:
        return "draft"
    if isinstance(value, str) and not value.strip():
        return "draft"
    s = _norm_status(value)
    if s not in _PUBLICATION_STATUSES:
        raise ValueError("publication_status_invalid: status must be 'draft' or 'published'")
    return s


@runtime_checkable
class _ProjectLike(Protocol):
    name: str
    name_de: str | None
    description: str | None
    description_de: str | None
    company_context: str | None
    company_context_de: str | None
    status: object


def validate_project_bilingual_publish(*, project: _ProjectLike) -> None:
    """When project is published, require DE mirrors wherever EN text is set."""

    if _norm_status(project.status) != "published":
        return

    hl_de = (project.name_de or "").strip()
    if not hl_de:
        raise ValueError("bilingual_publish_incomplete: project name_de is required when status is published")

    desc_en = (project.description or "").strip()
    if desc_en and not (project.description_de or "").strip():
        raise ValueError("bilingual_publish_incomplete: project description_de is required when description is set")

    ctx_en = (project.company_context or "").strip()
    if ctx_en and not (project.company_context_de or "").strip():
        raise ValueError("bilingual_publish_incomplete: project company_context_de is required when company_context is set")
