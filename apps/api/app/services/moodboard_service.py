from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable
from uuid import UUID, uuid4

import httpx
import structlog
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import MoodboardStatus, Persona, PersonaMoodboard, PersonaMoodboardTile
from .moodboard_creative import (
    MOODBOARD_CATEGORIES,
    STOCK_ACCEPT_MIN_SCORE,
    build_category_queries,
    build_style_package,
    openai_image_prompt,
    pack_style_keywords,
    pick_best_stock_image,
    stock_tile_caption,
    stock_tile_rationale,
    unpack_style_keywords,
)
from .moodboard_palette import extract_palette_swatches, merge_palette_swatches
from .openai_images_client import OpenAIImagesClient
from .openverse_client import OpenverseClient
from .openverse_client import OpenverseImage
from .pexels_client import PexelsClient, PexelsImage
from .storage import StorageService

logger = structlog.get_logger(__name__)
settings = get_settings()

DEFAULT_CATEGORIES: list[str] = list(MOODBOARD_CATEGORIES)


def _fallback_category_query(category: str) -> str:
    return {
        "lifestyle": "hobby activity documentary authentic no office",
        "places": "lived-in interior architecture environmental",
        "colors": "abstract color palette material swatch",
        "textures": "fabric macro texture shallow depth field",
        "people": "small group gathering candid wide no portrait",
        "objects": "still life product photography hero object",
        "ui": "minimal app interface clean layout",
        "typography": "editorial typography magazine layout",
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

    def _locked_by_category(self, session: Session, *, moodboard_id: UUID) -> dict[str, PersonaMoodboardTile]:
        tiles = (
            session.query(PersonaMoodboardTile)
            .filter(PersonaMoodboardTile.moodboard_id == moodboard_id)
            .filter(PersonaMoodboardTile.locked.is_(True))
            .all()
        )
        out: dict[str, PersonaMoodboardTile] = {}
        for tile in tiles:
            cat = (tile.category or "").strip().lower()
            if cat and cat not in out:
                out[cat] = tile
        return out

    def _delete_unlocked_tiles(self, session: Session, *, moodboard_id: UUID) -> int:
        return (
            session.query(PersonaMoodboardTile)
            .filter(PersonaMoodboardTile.moodboard_id == moodboard_id)
            .filter(PersonaMoodboardTile.locked.is_(False))
            .delete()
        )

    def _renumber_tiles(self, session: Session, *, moodboard_id: UUID) -> None:
        tiles = (
            session.query(PersonaMoodboardTile)
            .filter(PersonaMoodboardTile.moodboard_id == moodboard_id)
            .order_by(PersonaMoodboardTile.tile_order.asc(), PersonaMoodboardTile.created_at.asc())
            .all()
        )
        for idx, tile in enumerate(tiles):
            if tile.tile_order != idx:
                tile.tile_order = idx
                session.add(tile)
        session.commit()

    def _effective_image_source(self) -> str:
        image_source = settings.moodboard_image_source
        if image_source == "auto":
            return "openai" if self.openai_images.enabled() else "openverse"
        return image_source

    def _hybrid_openai_enabled(self) -> bool:
        return bool(settings.moodboard_hybrid_openai and self.openai_images.enabled())

    def _stock_min_score(self) -> float:
        return float(settings.moodboard_stock_min_score or STOCK_ACCEPT_MIN_SCORE)

    def build_moodboard(self, session: Session, *, moodboard_id: UUID) -> None:
        moodboard = session.get(PersonaMoodboard, moodboard_id)
        if not moodboard:
            raise ValueError("moodboard_not_found")
        persona = session.get(Persona, moodboard.persona_id)
        if not persona:
            raise ValueError("persona_not_found")

        locked_before = len(self._locked_by_category(session, moodboard_id=moodboard_id))
        logger.info(
            "moodboard.build.start",
            moodboard_id=str(moodboard_id),
            persona_id=str(persona.id),
            locked_categories=locked_before,
        )

        moodboard.status = MoodboardStatus.building
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()

        _, _, _, _, existing_swatches = unpack_style_keywords(moodboard.style_keywords)
        self._delete_unlocked_tiles(session, moodboard_id=moodboard_id)
        session.commit()

        style_package = build_style_package(persona)
        moodboard.style_keywords = pack_style_keywords(style_package, palette_swatches=existing_swatches or None)
        session.add(moodboard)
        session.commit()

        image_source = self._effective_image_source()
        logger.info(
            "moodboard.build.image_source",
            moodboard_id=str(moodboard_id),
            persona_id=str(persona.id),
            configured=settings.moodboard_image_source,
            effective=image_source,
            hybrid=self._hybrid_openai_enabled(),
        )

        locked = self._locked_by_category(session, moodboard_id=moodboard_id)

        if image_source == "openai":
            self._build_openai_tiles(
                session,
                moodboard=moodboard,
                persona=persona,
                package=style_package,
                locked_by_category=locked,
            )
        else:
            self._build_stock_tiles(
                session,
                moodboard=moodboard,
                persona=persona,
                package=style_package,
                locked_by_category=locked,
            )

        self._apply_palette_swatches(session, moodboard=moodboard, package=style_package)
        self._renumber_tiles(session, moodboard_id=moodboard.id)

    def _create_openai_tile(
        self,
        session: Session,
        *,
        moodboard: PersonaMoodboard,
        persona: Persona,
        package,
        category: str,
        tile_order: int,
        query_hint: str = "",
    ) -> bool:
        prompt = openai_image_prompt(persona=persona, category=category, package=package)
        gen = self.openai_images.generate_png(prompt=prompt)  # type: ignore[union-attr]
        key = f"personas/{persona.id}/moodboards/{moodboard.id}/generated/{uuid4()}.png"
        self.storage.upload(key=key, data=gen.png_bytes, content_type="image/png")  # type: ignore[union-attr]

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
            rationale=(
                f"Generated ({category}) — stock match was weak"
                + (f" for «{query_hint[:40]}»" if query_hint else "")
                + f". {package.mood_manifest[:120]}"
            ),
            tags=[category, "openai", "hybrid"],
            tile_order=tile_order,
            locked=False,
        )
        session.add(tile)
        session.commit()
        return True

    def _build_openai_tiles(
        self,
        session: Session,
        *,
        moodboard: PersonaMoodboard,
        persona: Persona,
        package,
        locked_by_category: dict[str, PersonaMoodboardTile],
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
        order = session.query(PersonaMoodboardTile).filter_by(moodboard_id=moodboard.id).count()

        for idx in range(target):
            category = categories[idx % len(categories)]
            if category in locked_by_category:
                continue
            if self._create_openai_tile(
                session,
                moodboard=moodboard,
                persona=persona,
                package=package,
                category=category,
                tile_order=order,
            ):
                order += 1

        tile_count = session.query(PersonaMoodboardTile).filter_by(moodboard_id=moodboard.id).count()
        if tile_count <= 0:
            moodboard.status = MoodboardStatus.failed
        else:
            moodboard.status = MoodboardStatus.ready
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()
        logger.info("moodboard.build.ready.openai", moodboard_id=str(moodboard.id), tiles=tile_count)

    def _build_stock_tiles(
        self,
        session: Session,
        *,
        moodboard: PersonaMoodboard,
        persona: Persona,
        package,
        locked_by_category: dict[str, PersonaMoodboardTile],
    ) -> None:
        queries = build_category_queries(persona=persona, package=package, categories=MOODBOARD_CATEGORIES)
        order = session.query(PersonaMoodboardTile).filter_by(moodboard_id=moodboard.id).count()
        seen_urls: set[str] = set()
        min_score = self._stock_min_score()
        hybrid = self._hybrid_openai_enabled()

        for category, q in queries.items():
            if category in locked_by_category:
                continue

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
                pexels_results = self.pexels.search_photos(query=pq, per_page=16, page=1)

            pool = [img for img in results if img.image_url not in seen_urls]
            pool.extend(img for img in pexels_results if img.image_url not in seen_urls)
            picked_img, stock_score = pick_best_stock_image(pool, query=q, category=category, package=package)

            if picked_img and stock_score < min_score and hybrid:
                logger.info(
                    "moodboard.build.hybrid.openai",
                    moodboard_id=str(moodboard.id),
                    category=category,
                    stock_score=stock_score,
                    min_score=min_score,
                )
                if self._create_openai_tile(
                    session,
                    moodboard=moodboard,
                    persona=persona,
                    package=package,
                    category=category,
                    tile_order=order,
                    query_hint=q,
                ):
                    order += 1
                continue

            if not picked_img:
                if hybrid and self._create_openai_tile(
                    session,
                    moodboard=moodboard,
                    persona=persona,
                    package=package,
                    category=category,
                    tile_order=order,
                    query_hint=q,
                ):
                    order += 1
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

        tile_count = session.query(PersonaMoodboardTile).filter_by(moodboard_id=moodboard.id).count()
        if tile_count <= 0:
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
        logger.info("moodboard.build.ready", moodboard_id=str(moodboard.id), tiles=tile_count)

    def _load_tile_image_bytes(self, tile: PersonaMoodboardTile) -> bytes | None:
        url = tile.image_url
        if not isinstance(url, str) or not url.strip():
            return None
        try:
            if url.startswith(("http://", "https://")):
                with httpx.Client(timeout=settings.moodboard_palette_fetch_timeout_seconds) as client:
                    resp = client.get(url)
                    resp.raise_for_status()
                    return resp.content
            fp, _ = self.storage.stream(key=url)  # type: ignore[union-attr]
            return fp.read()
        except Exception as e:
            logger.debug("moodboard.palette.fetch_failed", tile_id=str(tile.id), error=str(e))
            return None

    def _apply_palette_swatches(self, session: Session, *, moodboard: PersonaMoodboard, package) -> None:
        tiles = (
            session.query(PersonaMoodboardTile)
            .filter(PersonaMoodboardTile.moodboard_id == moodboard.id)
            .order_by(PersonaMoodboardTile.tile_order.asc())
            .all()
        )
        groups: list[list[dict]] = []
        for tile in tiles:
            data = self._load_tile_image_bytes(tile)
            if not data:
                continue
            groups.append(extract_palette_swatches(data))
        swatches = merge_palette_swatches(groups)
        if not swatches:
            return
        keywords, manifest, hints, directions, _ = unpack_style_keywords(moodboard.style_keywords)
        from .moodboard_creative import MoodboardStylePackage

        pkg = MoodboardStylePackage(
            keywords=keywords or package.keywords,
            mood_manifest=manifest or package.mood_manifest,
            palette_hints=hints or package.palette_hints,
            category_directions=directions or package.category_directions,
            avoid=package.avoid,
        )
        moodboard.style_keywords = pack_style_keywords(pkg, palette_swatches=swatches)
        session.add(moodboard)
        session.commit()
        logger.info("moodboard.palette.extracted", moodboard_id=str(moodboard.id), swatches=len(swatches))

    def fail_moodboard(self, session: Session, *, moodboard_id: UUID) -> None:
        moodboard = session.get(PersonaMoodboard, moodboard_id)
        if not moodboard:
            return
        moodboard.status = MoodboardStatus.failed
        moodboard.updated_at = datetime.utcnow()
        session.add(moodboard)
        session.commit()
