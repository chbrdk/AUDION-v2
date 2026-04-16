from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Any, Iterable
from uuid import UUID, uuid4

import structlog
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import MoodboardStatus, Persona, PersonaMoodboard, PersonaMoodboardTile
from .openai_images_client import OpenAIImagesClient
from .openverse_client import OpenverseClient
from .pexels_client import PexelsClient, PexelsImage
from .storage import StorageService

logger = structlog.get_logger(__name__)
settings = get_settings()


DEFAULT_CATEGORIES: list[str] = [
    "lifestyle",
    "colors",
    "textures",
    "people",
    "ui",
    "typography",
]


_PARENS_RE = re.compile(r"\([^)]*\)")
_SPLIT_RE = re.compile(r"[·•\n\r]+|(?:\s[-–—]\s)|[.;,:]+")


def _compact_phrase(text: str, *, max_words: int = 6, max_chars: int = 56) -> str:
    cleaned = _PARENS_RE.sub("", text)
    cleaned = cleaned.replace("—", " ").replace("–", " ").replace("‑", "-")
    cleaned = " ".join(cleaned.split()).strip(" -\t")
    if not cleaned:
        return ""
    words = cleaned.split()
    trimmed = " ".join(words[:max_words]).strip()
    if len(trimmed) > max_chars:
        trimmed = trimmed[:max_chars].rstrip()
    return trimmed


def _coerce_keywords(values: Any, *, limit: int = 6) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    if isinstance(values, str):
        text = values.strip()
        parts = [p.strip() for p in _SPLIT_RE.split(text) if p and p.strip()]
        if parts:
            for p in parts:
                compact = _compact_phrase(p)
                if compact:
                    out.append(compact)
        else:
            compact = _compact_phrase(text)
            if compact:
                out.append(compact)
    elif isinstance(values, list):
        for v in values:
            if isinstance(v, str) and v.strip():
                compact = _compact_phrase(v.strip())
                if compact:
                    out.append(compact)
            elif isinstance(v, dict):
                label = v.get("label")
                if isinstance(label, str) and label.strip():
                    compact = _compact_phrase(label.strip())
                    if compact:
                        out.append(compact)
    return out[:limit]


def derive_style_keywords(persona: Persona) -> list[str]:
    """MVP heuristic keyword extraction from persona profile/headline/segment."""
    profile = persona.profile or {}
    keywords: list[str] = []
    # Lightweight demographic hints improve image relevance (esp. "people" tiles).
    gender = profile.get("gender")
    if isinstance(gender, str) and gender.strip():
        keywords.append(gender.strip())
    media_affinity = profile.get("media_affinity")
    if isinstance(media_affinity, str) and media_affinity.strip():
        keywords.append(media_affinity.strip())
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


def build_queries(*, persona: Persona, keywords: list[str], categories: Iterable[str]) -> dict[str, str]:
    """Build one Openverse query per category.

    Important: Openverse image search behaves much better with **short** queries.
    Long German narrative strings often return **zero** normalized image results.
    """
    compacted: list[str] = []
    for k in keywords[:12]:
        ck = _compact_phrase(k, max_words=3, max_chars=24)
        if ck:
            compacted.append(ck)
        if len(compacted) >= 4:
            break

    # Prefer a single strong anchor term (first compact phrase), not a mega-concatenation.
    anchor = compacted[0] if compacted else "lifestyle"

    # Category-specific English anchors improve recall vs. appending abstract tokens like "ui".
    people_bias = _people_query_bias(persona)
    category_hints: dict[str, str] = {
        "lifestyle": "lifestyle photography",
        "colors": "color palette interior",
        "textures": "texture material macro",
        "people": people_bias,
        "ui": "product design ui",
        "typography": "typography poster",
    }

    return {cat: f"{anchor} {category_hints.get(cat, cat)}".strip() for cat in categories}


def _fallback_category_query(category: str) -> str:
    """Last-resort broad queries when persona-derived anchors return nothing."""
    return {
        "lifestyle": "luxury lifestyle photography",
        "colors": "minimal color palette",
        "textures": "natural textures macro",
        "people": "street style portrait",
        "ui": "modern product ui",
        "typography": "editorial typography",
    }.get(category, "open licensed photography")


def _people_query_bias(persona: Persona) -> str:
    profile = persona.profile or {}
    gender = profile.get("gender")
    if isinstance(gender, str):
        g = gender.strip().lower()
        if g in {"male", "m", "man", "masculine", "männlich", "mann"}:
            return "man portrait confident"
        if g in {"female", "f", "woman", "feminine", "weiblich", "frau"}:
            return "woman portrait confident"
    # Very small heuristic fallback from German copy (best-effort).
    blob = f"{persona.headline} {persona.segment}".lower()
    if "männ" in blob or " mann" in blob or " male" in blob:
        return "man portrait confident"
    if "weib" in blob or " frau" in blob or " female" in blob:
        return "woman portrait confident"
    return "portrait confident"


def _persona_context_blob(persona: Persona, keywords: list[str]) -> str:
    profile = persona.profile or {}
    interests = profile.get("interests")
    values = profile.get("values")
    parts: list[str] = []
    parts.append(f"Name: {persona.name}")
    parts.append(f"Segment: {persona.segment}")
    parts.append(f"Headline: {persona.headline}")
    if isinstance(interests, list):
        parts.append("Interests: " + "; ".join([str(x) for x in interests if isinstance(x, str)][:6]))
    if isinstance(values, list):
        parts.append("Values: " + "; ".join([str(x) for x in values if isinstance(x, str)][:6]))
    if keywords:
        parts.append("Keywords: " + "; ".join(keywords[:8]))
    return "\n".join(parts)


def _openai_prompts_for_moodboard(*, persona: Persona, keywords: list[str]) -> list[tuple[str, str]]:
    """Return (category, prompt) pairs for deterministic moodboard coverage."""
    ctx = _persona_context_blob(persona, keywords)
    people = _people_query_bias(persona)
    return [
        (
            "lifestyle",
            f"{ctx}\n\nCreate a premium editorial lifestyle photograph inspired by the persona. "
            f"Cinematic lighting, shallow depth of field, tasteful luxury cues, no text, no logos, no watermark.",
        ),
        (
            "colors",
            f"{ctx}\n\nCreate an abstract color study / gradient artwork inspired by the persona mood. "
            f"Clean composition, no text, no logos, no watermark.",
        ),
        (
            "textures",
            f"{ctx}\n\nCreate a macro texture photograph (materials, fabric, metal, leather) matching the persona vibe. "
            f"No text, no logos, no watermark.",
        ),
        ("people", f"{ctx}\n\nCreate a realistic portrait photo: {people}. Confident expression, professional wardrobe, neutral background, no text, no logos, no watermark."),
        (
            "ui",
            f"{ctx}\n\nCreate a sleek UI mockup still (device frame optional) matching the persona’s taste. "
            f"Minimal, modern, no readable text, no logos, no watermark.",
        ),
        (
            "typography",
            f"{ctx}\n\nCreate an editorial typography-led poster design using abstract shapes; avoid readable words. "
            f"No logos, no watermark.",
        ),
    ]


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

        if settings.moodboard_image_source == "openai":
            if not self.openai_images.enabled():
                moodboard.status = MoodboardStatus.failed
                moodboard.updated_at = datetime.utcnow()
                session.add(moodboard)
                session.commit()
                logger.error("moodboard.build.openai.disabled", moodboard_id=str(moodboard_id), persona_id=str(persona.id))
                return

            prompts = _openai_prompts_for_moodboard(persona=persona, keywords=keywords)
            target = max(1, min(int(settings.moodboard_openai_image_count or 8), 10))

            order = 0
            # Cycle categories if we want >6 images.
            expanded: list[tuple[str, str]] = []
            i = 0
            while len(expanded) < target:
                cat, pr = prompts[i % len(prompts)]
                expanded.append((cat, pr))
                i += 1

            for idx, (category, prompt) in enumerate(expanded):
                gen = self.openai_images.generate_png(prompt=prompt)
                key = f"personas/{persona.id}/moodboards/{moodboard_id}/generated/{uuid4()}.png"
                self.storage.upload(key=key, data=gen.png_bytes, content_type="image/png")

                caption = gen.revised_prompt[:180] + "…" if gen.revised_prompt and len(gen.revised_prompt) > 180 else gen.revised_prompt
                tile = PersonaMoodboardTile(
                    moodboard_id=moodboard_id,
                    category=category,
                    image_url=key,
                    thumb_url=None,
                    source_type="openai",
                    source_url=settings.openai_image_docs_url,
                    author="OpenAI",
                    license="OpenAI Terms",
                    attribution_text=f"Generated image · OpenAI · {settings.openai_image_docs_url}",
                    caption=caption,
                    rationale="Generated for persona moodboard (OpenAI Images API).",
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
            logger.info("moodboard.build.ready.openai", moodboard_id=str(moodboard_id), tiles=order)
            return

        queries = build_queries(persona=persona, keywords=keywords, categories=DEFAULT_CATEGORIES)

        order = 0
        seen_urls: set[str] = set()
        for category, q in queries.items():
            results = self.openverse.search_images(q=q, page_size=12, mature=False)  # type: ignore[union-attr]
            if not results:
                q2 = _fallback_category_query(category)
                logger.info(
                    "moodboard.build.openverse.retry",
                    moodboard_id=str(moodboard_id),
                    category=category,
                    q=q,
                    q2=q2,
                )
                results = self.openverse.search_images(q=q2, page_size=12, mature=False)  # type: ignore[union-attr]

            pexels_results: list[PexelsImage] = []
            if not results and self.pexels is not None and self.pexels.enabled():
                pq = _compact_phrase(q, max_words=6, max_chars=72) or _fallback_category_query(category)
                logger.info(
                    "moodboard.build.pexels.fallback",
                    moodboard_id=str(moodboard_id),
                    category=category,
                    q=pq,
                )
                pexels_results = self.pexels.search_photos(query=pq, per_page=20, page=1)

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

            for img in pexels_results:
                if img.image_url in seen_urls:
                    continue
                seen_urls.add(img.image_url)
                tile = PersonaMoodboardTile(
                    moodboard_id=moodboard_id,
                    category=category,
                    image_url=img.image_url,
                    thumb_url=img.thumb_url,
                    source_type="pexels",
                    source_url=img.source_url,
                    author=img.author,
                    license=img.license,
                    attribution_text=img.attribution_text,
                    tags=[category, "pexels"] + keywords[:3],
                    tile_order=order,
                    locked=False,
                )
                session.add(tile)
                order += 1
                picked += 1
                if picked >= 4:
                    break
            session.commit()

        if order <= 0:
            moodboard.status = MoodboardStatus.failed
            moodboard.updated_at = datetime.utcnow()
            session.add(moodboard)
            session.commit()
            logger.warning(
                "moodboard.build.no_results",
                moodboard_id=str(moodboard_id),
                persona_id=str(persona.id),
                keywords=keywords[:8],
            )
            return

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

