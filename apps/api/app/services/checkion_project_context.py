"""Optional CHECKION site-topic context for project-scoped AI prompts (suggest flows)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import Project, ProjectResearchRun, ProjectResearchRunStatus
from .checkion_deep_scan_client import fetch_checkion_raw_slim_pages_for_site_topics
from .checkion_topic_aggregate import aggregate_site_topics_from_slim_pages, format_checkion_site_topics_for_prompt


def resolve_seed_url_for_checkion(
    session: Session,
    *,
    project: Project,
    explicit_seed_url: str | None,
) -> tuple[str | None, str | None]:
    """
    Returns (seed_url, hint) where hint explains resolution when seed is missing (for API messages).
    """
    if explicit_seed_url and str(explicit_seed_url).strip():
        return str(explicit_seed_url).strip(), None
    latest = (
        session.query(ProjectResearchRun)
        .where(ProjectResearchRun.project_id == project.id)
        .where(ProjectResearchRun.status == ProjectResearchRunStatus.succeeded)
        .order_by(ProjectResearchRun.created_at.desc())
        .first()
    )
    if latest and (latest.seed_url or "").strip():
        return str(latest.seed_url).strip(), None
    return None, "no_seed_url"


def fetch_checkion_site_topics_bundle(
    *,
    session: Session,
    project: Project,
    explicit_seed_url: str | None = None,
    max_pages: int = 400,
) -> dict[str, Any]:
    """
    Load CHECKION slim-pages (bounded) and aggregate topics.
    Always returns the same keys for API stability.
    """
    settings = get_settings()
    base = (settings.checkion_api_base_url or "").strip()
    token = (settings.checkion_api_token or "").strip()
    out: dict[str, Any] = {
        "scan_id": None,
        "source": None,
        "topics": [],
        "pages_processed": 0,
        "truncated": False,
        "seed_url_used": None,
        "unavailable_reason": None,
    }
    if not base or not token:
        out["unavailable_reason"] = "checkion_not_configured"
        return out

    checkion_pid = (getattr(project, "checkion_project_id", None) or "").strip() or None
    seed, hint = resolve_seed_url_for_checkion(session, project=project, explicit_seed_url=explicit_seed_url)
    # Linked CHECKION project resolves scan via domain-summary; seed is only required for by-domain fallback.
    if not seed and not checkion_pid:
        out["unavailable_reason"] = hint or "no_seed_url"
        return out

    out["seed_url_used"] = seed if seed else None
    pages, scan_id, source = fetch_checkion_raw_slim_pages_for_site_topics(
        base_url=base,
        token=token,
        seed_url=seed or "",
        checkion_project_id=checkion_pid,
        max_pages=max_pages,
        timeout_seconds=float(settings.checkion_request_timeout_seconds or 30.0),
    )
    out["scan_id"] = scan_id
    out["source"] = source
    if not pages or not scan_id:
        out["unavailable_reason"] = "no_scan_or_empty_slim_pages"
        return out

    agg = aggregate_site_topics_from_slim_pages(pages, top_n=30)
    out["topics"] = agg.get("topics") or []
    out["pages_processed"] = int(agg.get("pages_processed") or 0)
    fetch_hit_cap = len(pages) >= max(1, max_pages)
    out["truncated"] = bool(agg.get("truncated")) or fetch_hit_cap
    return out


def build_optional_checkion_topics_prompt_block(
    session: Session,
    *,
    project: Project,
    explicit_seed_url: str | None = None,
    max_pages: int = 400,
) -> str | None:
    """Short LLM appendix or None if nothing to add."""
    bundle = fetch_checkion_site_topics_bundle(
        session=session,
        project=project,
        explicit_seed_url=explicit_seed_url,
        max_pages=max_pages,
    )
    if bundle.get("unavailable_reason"):
        return None
    topics = bundle.get("topics")
    if not topics:
        return None
    agg_for_format = {
        "topics": topics,
        "pages_processed": bundle.get("pages_processed", 0),
        "truncated": bundle.get("truncated", False),
    }
    return format_checkion_site_topics_for_prompt(agg_for_format)
