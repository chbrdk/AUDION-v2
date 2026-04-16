from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..models import MoodboardStatus, Persona, PersonaMoodboard, PersonaMoodboardTile
from .openverse_client import OpenverseClient

logger = structlog.get_logger(__name__)


DEFAULT_CATEGORIES: list[str] = [
    "lifestyle",
    "colors",
    "textures",
    "people",
    "ui",
    "typography",
]


def _coerce_keywords(values: Any, *, limit: int = 6) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    if isinstance(values, str):
        out = [values]
    elif isinstance(values, list):
        for v in values:
            if isinstance(v, str) and v.strip():
                out.append(v.strip())
            elif isinstance(v, dict):
                label = v.get("label")
                if isinstance(label, str) and label.strip():
                    out.append(label.strip())
    return out[:limit]


def derive_style_keywords(persona: Persona) -> list[str]:
    """MVP heuristic keyword extraction from persona profile/headline/segment."""
    profile = persona.profile or {}
    keywords: list[str] = []
    keywords.extend(_coerce_keywords(profile.get("interests")))
    keywords.extend(_coerce_keywords(profile.get("values")))
    keywords.extend(_coerce_keywords(profile.get("goals")))
    # fallback anchors
    if isinstance(persona.segment, str) and persona.segment:
        keywords.append(persona.segment)
    if isinstance(persona.headline, str) and persona.headline:
        keywords.append(persona.headline.split(".")[0][:60])
    # dedupe while keeping order
    seen: set[str] = set()
    deduped: list[str] = []
    for k in keywords:
        k2 = k.strip()
        if not k2:
            continue
        low = k2.lower()
        if low in seen:
            continue
        seen.add(low)
        deduped.append(k2)
    return deduped[:12]


def build_queries(*, keywords: list[str], categories: Iterable[str]) -> dict[str, str]:
    base = " ".join(keywords[:5]).strip() or "persona"
    return {cat: f"{base} {cat}".strip() for cat in categories}


@dataclass
class MoodboardService:
    openverse: OpenverseClient | None = None

    def __post_init__(self) -> None:
        if self.openverse is None:
            self.openverse = OpenverseClient()

    def create_or_activate_moodboard(
        self,
        session: Session,
        *,
        persona_id: UUID,
        project_id: UUID | None,
        title: str | None = None,
        updated_by: str | None = None,
    ) -> PersonaMoodboard:
        # Deactivate previous active moodboards for persona.
        session.execute(
            update(PersonaMoodboard)
            .where(PersonaMoodboard.persona_id == persona_id)
            .where(PersonaMoodboard.active.is_(True))
            .values(active=False, updated_at=datetime.utcnow(), updated_by=updated_by)
        )
        moodboard = PersonaMoodboard(
            persona_id=persona_id,
            project_id=project_id,
            title=(title or "Moodboard").strip() or "Moodboard",
            status=MoodboardStatus.draft,
            active=True,
            style_keywords=None,
            updated_by=updated_by,
        )
        session.add(moodboard)
        session.commit()
        session.refresh(moodboard)
        return moodboard

    def build_moodboard(self, session: Session, *, moodboard_id: UUID) -> None:
        moodboard = session.get(PersonaMoodboard, moodboard_id)
        if not moodboard:
            raise ValueError("moodboard_not_found")
        persona = session.get(Persona, moodboard.persona_id)
        if not persona:
            raise ValueError("persona_not_found")

        logger.info("moodboard.build.start", moodboard_id=str(moodboard_id), persona_id=str(persona.id))

        moodboard.status = MoodboardStatus.building
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()

        # Clear existing tiles (rebuild path).
        session.query(PersonaMoodboardTile).filter(PersonaMoodboardTile.moodboard_id == moodboard_id).delete()
        session.commit()

        keywords = derive_style_keywords(persona)
        moodboard.style_keywords = keywords
        session.add(moodboard)
        session.commit()

        queries = build_queries(keywords=keywords, categories=DEFAULT_CATEGORIES)

        order = 0
        seen_urls: set[str] = set()
        for category, q in queries.items():
            results = self.openverse.search_images(q=q, page_size=12, mature=False)  # type: ignore[union-attr]
            # pick up to 4 per category, unique urls
            picked = 0
            for img in results:
                if img.image_url in seen_urls:
                    continue
                seen_urls.add(img.image_url)
                tile = PersonaMoodboardTile(
                    moodboard_id=moodboard_id,
                    category=category,
                    image_url=img.image_url,
                    thumb_url=img.thumb_url,
                    source_type="openverse",
                    source_url=img.source_url,
                    author=img.author,
                    license=img.license,
                    attribution_text=img.attribution_text,
                    tags=[category] + keywords[:3],
                    tile_order=order,
                    locked=False,
                )
                session.add(tile)
                order += 1
                picked += 1
                if picked >= 4:
                    break
            session.commit()

        moodboard.status = MoodboardStatus.ready
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()
        logger.info("moodboard.build.ready", moodboard_id=str(moodboard_id), tiles=order)

    def fail_moodboard(self, session: Session, *, moodboard_id: UUID) -> None:
        moodboard = session.get(PersonaMoodboard, moodboard_id)
        if not moodboard:
            return
        moodboard.status = MoodboardStatus.failed
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()

