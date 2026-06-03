from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable
from uuid import UUID, uuid4

import structlog
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import MoodboardStatus, Persona, PersonaMoodboard, PersonaMoodboardTile
from .moodboard_creative import (
    MOODBOARD_CATEGORIES,
    build_category_queries,
    build_style_package,
    openai_image_prompt,
    pack_style_keywords,
    pick_best_stock_image,
    stock_tile_caption,
    stock_tile_rationale,
)
from .openai_images_client import OpenAIImagesClient
from .openverse_client import OpenverseClient
from .pexels_client import PexelsClient, PexelsImage
from .storage import StorageService

logger = structlog.get_logger(__name__)
settings = get_settings()

DEFAULT_CATEGORIES: list[str] = list(MOODBOARD_CATEGORIES)
_TILES_PER_CATEGORY = 1


def _fallback_category_query(category: str) -> str:
    return {
        "lifestyle": "documentary lifestyle authentic",
        "places": "lived-in interior space",
        "colors": "muted color palette still life",
        "textures": "natural material macro texture",
        "people": "candid portrait natural light",
        "objects": "personal still life objects",
        "ui": "minimal product interface",
        "typography": "editorial typography layout",
    }.get(category, "editorial photography")


def build_queries(*, persona: Persona, keywords: list[str], categories: Iterable[str]) -> dict[str, str]:
    """Legacy helper used in tests: queries from keyword list without full style package."""
    from .moodboard_creative import MoodboardStylePackage

    package = MoodboardStylePackage(
        keywords=keywords,
        mood_manifest="",
        palette_hints=[],
        category_directions={},
        avoid=[],
    )
    return build_category_queries(persona=persona, package=package, categories=categories)


@dataclass
class MoodboardService:
    openverse: OpenverseClient | None = None
    pexels: PexelsClient | None = None
    openai_images: OpenAIImagesClient | None = None
    storage: StorageService | None = None

    def __post_init__(self) -> None:
        if self.openverse is None:
            self.openverse = OpenverseClient()
        if self.pexels is None:
            self.pexels = PexelsClient()
        if self.openai_images is None:
            self.openai_images = OpenAIImagesClient()
        if self.storage is None:
            self.storage = StorageService()

    def create_or_activate_moodboard(
        self,
        session: Session,
        *,
        persona_id: UUID,
        project_id: UUID | None,
        title: str | None = None,
        updated_by: str | None = None,
    ) -> PersonaMoodboard:
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

        session.query(PersonaMoodboardTile).filter(PersonaMoodboardTile.moodboard_id == moodboard_id).delete()
        session.commit()

        style_package = build_style_package(persona)
        moodboard.style_keywords = pack_style_keywords(style_package)
        session.add(moodboard)
        session.commit()

        image_source = settings.moodboard_image_source
        if image_source == "auto":
            image_source = "openai" if self.openai_images.enabled() else "openverse"

        logger.info(
            "moodboard.build.image_source",
            moodboard_id=str(moodboard_id),
            persona_id=str(persona.id),
            configured=settings.moodboard_image_source,
            effective=image_source,
        )

        if image_source == "openai":
            self._build_openai_tiles(session, moodboard=moodboard, persona=persona, package=style_package)
            return

        self._build_stock_tiles(session, moodboard=moodboard, persona=persona, package=style_package)

    def _build_openai_tiles(
        self,
        session: Session,
        *,
        moodboard: PersonaMoodboard,
        persona: Persona,
        package,
    ) -> None:
        if not self.openai_images.enabled():
            moodboard.status = MoodboardStatus.failed
            moodboard.updated_at = datetime.utcnow()
            session.add(moodboard)
            session.commit()
            logger.error("moodboard.build.openai.disabled", moodboard_id=str(moodboard.id), persona_id=str(persona.id))
            return

        target = max(1, min(int(settings.moodboard_openai_image_count or 8), 10))
        categories = list(MOODBOARD_CATEGORIES)
        order = 0
        for idx in range(target):
            category = categories[idx % len(categories)]
            prompt = openai_image_prompt(persona=persona, category=category, package=package)
            gen = self.openai_images.generate_png(prompt=prompt)
            key = f"personas/{persona.id}/moodboards/{moodboard.id}/generated/{uuid4()}.png"
            self.storage.upload(key=key, data=gen.png_bytes, content_type="image/png")

            caption = stock_tile_caption(category=category, package=package)
            if gen.revised_prompt and len(gen.revised_prompt) < 200:
                caption = gen.revised_prompt

            tile = PersonaMoodboardTile(
                moodboard_id=moodboard.id,
                category=category,
                image_url=key,
                thumb_url=None,
                source_type="openai",
                source_url=settings.openai_image_docs_url,
                author="OpenAI",
                license="OpenAI Terms",
                attribution_text=f"Generated image · OpenAI · {settings.openai_image_docs_url}",
                caption=caption,
                rationale=package.mood_manifest[:240],
                tags=[category, "openai", f"idx:{idx}"],
                tile_order=order,
                locked=False,
            )
            session.add(tile)
            order += 1
            session.commit()

        moodboard.status = MoodboardStatus.ready
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()
        logger.info("moodboard.build.ready.openai", moodboard_id=str(moodboard.id), tiles=order)

    def _build_stock_tiles(
        self,
        session: Session,
        *,
        moodboard: PersonaMoodboard,
        persona: Persona,
        package,
    ) -> None:
        queries = build_category_queries(persona=persona, package=package, categories=MOODBOARD_CATEGORIES)
        order = 0
        seen_urls: set[str] = set()

        for category, q in queries.items():
            results = self.openverse.search_images(q=q, page_size=16, mature=False)  # type: ignore[union-attr]
            if not results:
                q2 = _fallback_category_query(category)
                logger.info(
                    "moodboard.build.openverse.retry",
                    moodboard_id=str(moodboard.id),
                    category=category,
                    q=q,
                    q2=q2,
                )
                results = self.openverse.search_images(q=q2, page_size=16, mature=False)  # type: ignore[union-attr]

            pexels_results: list[PexelsImage] = []
            if not results and self.pexels is not None and self.pexels.enabled():
                pq = q if len(q) < 72 else _fallback_category_query(category)
                logger.info(
                    "moodboard.build.pexels.fallback",
                    moodboard_id=str(moodboard.id),
                    category=category,
                    q=pq,
                )
                pexels_results = self.pexels.search_photos(query=pq, per_page=16, page=1)

            pool = [img for img in results if img.image_url not in seen_urls]
            pool.extend(img for img in pexels_results if img.image_url not in seen_urls)
            picked_img = pick_best_stock_image(pool, query=q, category=category, package=package)
            if not picked_img:
                continue

            seen_urls.add(picked_img.image_url)
            pexels_urls = {img.image_url for img in pexels_results}
            source_type = "pexels" if picked_img.image_url in pexels_urls else "openverse"
            tile = PersonaMoodboardTile(
                moodboard_id=moodboard.id,
                category=category,
                image_url=picked_img.image_url,
                thumb_url=picked_img.thumb_url,
                source_type=source_type,
                source_url=picked_img.source_url,
                author=picked_img.author,
                license=picked_img.license,
                attribution_text=picked_img.attribution_text,
                caption=stock_tile_caption(category=category, package=package),
                rationale=stock_tile_rationale(category=category, package=package, query=q),
                tags=[category] + package.keywords[:4],
                tile_order=order,
                locked=False,
            )
            session.add(tile)
            order += 1
            session.commit()

        if order <= 0:
            moodboard.status = MoodboardStatus.failed
            moodboard.updated_at = datetime.utcnow()
            session.add(moodboard)
            session.commit()
            logger.warning(
                "moodboard.build.no_results",
                moodboard_id=str(moodboard.id),
                persona_id=str(persona.id),
            )
            return

        moodboard.status = MoodboardStatus.ready
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()
        logger.info("moodboard.build.ready", moodboard_id=str(moodboard.id), tiles=order)

    def fail_moodboard(self, session: Session, *, moodboard_id: UUID) -> None:
        moodboard = session.get(PersonaMoodboard, moodboard_id)
        if not moodboard:
            return
        moodboard.status = MoodboardStatus.failed
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()
