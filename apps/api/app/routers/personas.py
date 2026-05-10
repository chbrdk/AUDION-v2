from __future__ import annotations

import logging
import time
from base64 import b64decode
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import RedirectResponse, Response, StreamingResponse
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import (
    Document,
    DocumentChunk,
    MoodboardStatus,
    Persona,
    PersonaKnowledgeEntry,
    PersonaMoodboard,
    PersonaMoodboardTile,
    PersonaPrompt as PersonaPromptModel,
    PersonaUxJourneyRun,
    ProcessingJob,
    TargetGroup,
    User,
)
from worker.ingest import enqueue_ingestion
from ..schemas import (
    AiAssistRequest,
    AiAssistResponse,
    Moodboard,
    MoodboardCreateResponse,
    MoodboardPatchRequest,
    MoodboardTile,
    MoodboardTilePatchRequest,
    PersonaCreateRequest,
    PersonaDocument,
    PersonaGenerateRequest,
    PersonaKnowledgeEntry as PersonaKnowledgeEntrySchema,
    PersonaKnowledgeUpsertRequest,
    PersonaListResponse,
    PersonaPatchRequest,
    PersonaResponse,
    PersonaTranslateFieldsRequest,
    PersonaTranslateFieldsResponse,
    PersonaUxJourneyRunItem,
    PersonaUxJourneyRunUpsert,
)
from ..services.ai_assist import AiAssistService
from ..services.auth import get_current_user
from ..services.access_control import list_accessible_project_ids
from ..services.persona_ai_context import (
    build_persona_ai_context as _build_persona_ai_context,
    build_persona_goals_ai_context as _build_persona_goals_ai_context,
    build_persona_interests_ai_context as _build_persona_interests_ai_context,
    build_persona_values_ai_context as _build_persona_values_ai_context,
    build_persona_traits_ai_context as _build_persona_traits_ai_context,
    build_persona_vocabulary_ai_context as _build_persona_vocabulary_ai_context,
    build_persona_sentence_structure_ai_context as _build_persona_sentence_structure_ai_context,
)
from ..services.persona_generation import PersonaGenerationService
from ..services.persona_profile_translate_merge import (
    enrich_profile_patch_json,
    merge_persona_profile_bilingual_enrich,
)
from ..services.persona_prompt_builder import (
    CHAT_PROMPT_TEMPLATE_VERSION,
    build_compact_chat_prompt,
    build_compact_chat_prompt_de,
    build_compact_chat_prompt_llm_bilingual,
)
from ..services.persona_store import PersonaService
from ..services.tavus_client import create_conversation as tavus_create_conversation
from ..services.target_group_store import TargetGroupService
from ..services.storage import StorageService
from ..services.usage_report import report_usage
from ..core.config import get_settings
from ..core.upload_limits import read_upload_with_limit
from msqdx_glass_proto import PersonaPrompt as PersonaPromptProto
from ..celery_app import celery_app
from ..services.moodboard_service import MoodboardService

router = APIRouter(prefix="/personas", tags=["personas"])
# Same avatar under /api/persona-admin for reverse proxies that route /api/* to this service
persona_admin_router = APIRouter(prefix="/api/persona-admin", tags=["personas"])

_log = logging.getLogger(__name__)

generator = PersonaGenerationService()
persona_service = PersonaService()
storage = StorageService()
target_group_service = TargetGroupService()
moodboard_service = MoodboardService()
settings = get_settings()


def _public_tile_image_url(*, persona_id: UUID, tile_id: UUID, project_id: UUID) -> str:
    # Same-origin Next.js proxy (avoids coupling browser image tags to raw API hostnames).
    return f"/api/share/persona/{persona_id}/moodboard-tile/{tile_id}?projectId={project_id}"


def _serialize_moodboard_tile(tile: PersonaMoodboardTile, *, persona_id: UUID, project_id: UUID | None) -> MoodboardTile:
    tags = tile.tags if isinstance(tile.tags, list) else []
    image_url = tile.image_url
    thumb_url = tile.thumb_url
    # Persisted tiles may store a storage key; expose a stable HTTPS URL for browsers.
    if isinstance(image_url, str) and image_url and not image_url.startswith(("http://", "https://", "data:")):
        if project_id is None:
            # Admin clients should use the authenticated proxy route (cookie/JWT), not public share URLs.
            image_url = f"/api/persona-admin/moodboard-tiles/{tile.id}/image"
        else:
            image_url = _public_tile_image_url(persona_id=persona_id, tile_id=tile.id, project_id=project_id)
        thumb_url = image_url

    return MoodboardTile(
        id=str(tile.id),
        moodboardId=str(tile.moodboard_id),
        category=tile.category,
        imageUrl=image_url,
        thumbUrl=thumb_url,
        sourceType=tile.source_type,
        sourceUrl=tile.source_url,
        author=tile.author,
        license=tile.license,
        attributionText=tile.attribution_text,
        caption=tile.caption,
        rationale=tile.rationale,
        tags=[t for t in tags if isinstance(t, str)],
        order=int(tile.tile_order or 0),
        locked=bool(tile.locked),
        createdAt=tile.created_at,
        updatedAt=tile.updated_at,
    )


def _serialize_persona_ux_journey_run(row: PersonaUxJourneyRun) -> PersonaUxJourneyRunItem:
    sc = row.scorecard if isinstance(row.scorecard, dict) else None
    return PersonaUxJourneyRunItem(
        id=str(row.id),
        jobId=str(row.job_id or "").strip(),
        task=row.task,
        siteUrl=row.site_url,
        success=row.success,
        stepsCount=row.steps_count,
        scorecard=sc,
        createdAt=row.created_at,
    )


def _serialize_moodboard(session: Session, moodboard: PersonaMoodboard) -> Moodboard:
    tiles = (
        session.scalars(
            select(PersonaMoodboardTile)
            .where(PersonaMoodboardTile.moodboard_id == moodboard.id)
            .order_by(PersonaMoodboardTile.tile_order.asc(), PersonaMoodboardTile.created_at.asc())
        )
        .all()
    )
    style = moodboard.style_keywords if isinstance(moodboard.style_keywords, list) else []
    project_uuid = moodboard.project_id
    if project_uuid is None:
        persona_obj = session.get(Persona, moodboard.persona_id)
        project_uuid = persona_obj.project_id if persona_obj else None
    return Moodboard(
        id=str(moodboard.id),
        personaId=str(moodboard.persona_id),
        projectId=str(project_uuid) if project_uuid else None,
        title=moodboard.title,
        status=moodboard.status.value if hasattr(moodboard.status, "value") else str(moodboard.status),
        active=bool(moodboard.active),
        styleKeywords=[s for s in style if isinstance(s, str)],
        tiles=[
            _serialize_moodboard_tile(t, persona_id=moodboard.persona_id, project_id=project_uuid)
            for t in tiles
        ],
        createdAt=moodboard.created_at,
        updatedAt=moodboard.updated_at,
    )


def get_db(current_user: User = Depends(get_current_user)):
    with get_session() as session:
        session.info["current_user_id"] = current_user.id
        session.info["allowed_project_ids"] = list_accessible_project_ids(session, current_user.id)
        yield session


def _get_persona_or_404(
    session: Session,
    persona_id: str,
    allowed_project_ids: list[UUID] | None = None,
) -> Persona:
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid persona id") from exc
    persona = session.get(Persona, persona_uuid)
    if allowed_project_ids is None:
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
    if not persona or (allowed_project_ids is not None and persona.project_id not in allowed_project_ids):
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


@router.get(
    "",
    response_model=PersonaListResponse,
    summary="List all personas with filtering and pagination",
    description="""
    Retrieve a paginated list of personas with optional filtering capabilities.
    
    This endpoint allows you to search, filter, and paginate through all personas in the system.
    You can filter by project ID, target group ID, status, and search by name or other attributes.
    
    **Parameters:**
    - `project_id`: Filter personas by project ID (optional)
    - `target_group_id`: Filter personas by target group ID (optional)
    - `status`: Filter personas by status (optional)
    - `q` (alias `search`): Search query to filter personas by name or attributes (optional)
    - `page`: Page number for pagination (default: 1, minimum: 1)
    - `page_size`: Number of items per page (default: 20, minimum: 1, maximum: 100)
    
    **Returns:**
    - A paginated list of personas including total count, current page, and page size information.
    
    **Note:** Results are sorted by creation date (newest first) by default.
    """
)
def list_personas(
    project_id: str | None = None,
    target_group_id: str | None = Query(None),
    status: str | None = None,
    search: str | None = Query(None, alias="q"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_db),
) -> PersonaListResponse:
    _log.info("[AUDION-DEBUG] GET /personas (list) project_id=%s at %.3f", project_id, time.monotonic())
    try:
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        return persona_service.list_personas(
            session,
            allowed_project_ids=allowed_project_ids,
            project_id=project_id,
            target_group_id=None,
            status=status,
            search=search,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        if str(exc) == "project_access_denied":
            raise HTTPException(status_code=403, detail="Project access denied") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _user_id_for_usage(current_user: User | None) -> str | None:
    if not current_user:
        return None
    return getattr(current_user, "plexon_user_id", None) or str(current_user.id)


def _output_locale_from_payload(payload: dict[str, Any] | None) -> str | None:
    """Aligns with web admin: `output_locale` \"en\" | \"de\" (optional `locale` / `ui_locale` aliases)."""
    if not isinstance(payload, dict):
        return None
    v = payload.get("output_locale") or payload.get("locale") or payload.get("ui_locale")
    return str(v).strip() if v is not None and str(v).strip() else None


def _max_items_from_payload(payload: dict[str, Any] | None, *, default: int = 3, cap: int = 10) -> int:
    raw = (payload or {}).get("max_items", default)
    try:
        n = int(raw)
    except (TypeError, ValueError):
        n = default
    return max(1, min(n, cap))


@router.post(
    "/{persona_id}/ai/pain-points",
    response_model=AiAssistResponse,
    summary="Generate AI suggestions for persona pain points",
)
async def generate_persona_pain_points(
    persona_id: str,
    payload: dict[str, Any] | None = Body(default=None),
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAssistResponse:
    persona = _get_persona_or_404(session, persona_id)
    max_items = _max_items_from_payload(payload)
    context = _build_persona_ai_context(session, persona, max_items, output_locale=_output_locale_from_payload(payload))
    ai_request = AiAssistRequest(
        template_id="persona.pain_points",
        context=context,
        max_suggestions=max_items,
    )
    try:
        uid = _user_id_for_usage(current_user)
        ai_assist = AiAssistService(session=session, retrieval_usage_user_id=uid)
        response = await ai_assist.generate(ai_request)
        if uid and response.usage:
            report_usage(
                user_id=uid,
                event_type="llm_request",
                raw_units={
                    "input_tokens": response.usage.get("input_tokens") or response.usage.get("prompt_tokens"),
                    "output_tokens": response.usage.get("output_tokens") or response.usage.get("completion_tokens"),
                },
            )
        return response
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/ai/interests",
    response_model=AiAssistResponse,
    summary="Generate AI suggestions for persona interests",
)
async def generate_persona_interests(
    persona_id: str,
    payload: dict[str, Any] | None = Body(default=None),
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAssistResponse:
    persona = _get_persona_or_404(session, persona_id)
    max_items = _max_items_from_payload(payload)
    context = _build_persona_interests_ai_context(
        session, persona, max_items, output_locale=_output_locale_from_payload(payload)
    )
    ai_request = AiAssistRequest(
        template_id="persona.interests",
        context=context,
        max_suggestions=max_items,
    )
    try:
        uid = _user_id_for_usage(current_user)
        ai_assist = AiAssistService(session=session, retrieval_usage_user_id=uid)
        response = await ai_assist.generate(ai_request)
        if uid and response.usage:
            report_usage(
                user_id=uid,
                event_type="llm_request",
                raw_units={
                    "input_tokens": response.usage.get("input_tokens") or response.usage.get("prompt_tokens"),
                    "output_tokens": response.usage.get("output_tokens") or response.usage.get("completion_tokens"),
                },
            )
        return response
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/ai/values",
    response_model=AiAssistResponse,
    summary="Generate AI suggestions for persona values",
)
async def generate_persona_values(
    persona_id: str,
    payload: dict[str, Any] | None = Body(default=None),
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAssistResponse:
    persona = _get_persona_or_404(session, persona_id)
    max_items = _max_items_from_payload(payload)
    context = _build_persona_values_ai_context(
        session, persona, max_items, output_locale=_output_locale_from_payload(payload)
    )
    ai_request = AiAssistRequest(
        template_id="persona.values",
        context=context,
        max_suggestions=max_items,
    )
    try:
        uid = _user_id_for_usage(current_user)
        ai_assist = AiAssistService(session=session, retrieval_usage_user_id=uid)
        response = await ai_assist.generate(ai_request)
        if uid and response.usage:
            report_usage(
                user_id=uid,
                event_type="llm_request",
                raw_units={
                    "input_tokens": response.usage.get("input_tokens") or response.usage.get("prompt_tokens"),
                    "output_tokens": response.usage.get("output_tokens") or response.usage.get("completion_tokens"),
                },
            )
        return response
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc








@router.post(
    "/{persona_id}/ai/goals",
    response_model=AiAssistResponse,
    summary="Generate AI suggestions for persona goals",
)
async def generate_persona_goals(
    persona_id: str,
    payload: dict[str, Any] | None = Body(default=None),
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAssistResponse:
    persona = _get_persona_or_404(session, persona_id)
    max_items = _max_items_from_payload(payload)
    context = _build_persona_goals_ai_context(
        session, persona, max_items, output_locale=_output_locale_from_payload(payload)
    )
    ai_request = AiAssistRequest(
        template_id="persona.goals",
        context=context,
        max_suggestions=max_items,
    )
    try:
        uid = _user_id_for_usage(current_user)
        ai_assist = AiAssistService(session=session, retrieval_usage_user_id=uid)
        response = await ai_assist.generate(ai_request)
        if uid and response.usage:
            report_usage(
                user_id=uid,
                event_type="llm_request",
                raw_units={
                    "input_tokens": response.usage.get("input_tokens") or response.usage.get("prompt_tokens"),
                    "output_tokens": response.usage.get("output_tokens") or response.usage.get("completion_tokens"),
                },
            )
        return response
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/enrich",
    response_model=PersonaResponse,
    summary="Enrich persona with AI-generated traits",
    description="Calls AI to generate pain points, goals, interests, and values for the persona and merges them into the profile. Optional body: profile_overlay: { bio, age, location, gender }; output_locale: \"en\" | \"de\" (same as persona admin).",
)
async def enrich_persona(
    persona_id: str,
    body: dict | None = Body(default=None),
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaResponse:
    persona = _get_persona_or_404(session, persona_id)
    max_items = 5
    out_loc = _output_locale_from_payload(body)
    uid = _user_id_for_usage(current_user)
    ai_assist = AiAssistService(session=session, retrieval_usage_user_id=uid)

    def _report(r):
        if uid and r.usage:
            report_usage(
                user_id=uid,
                event_type="llm_request",
                raw_units={
                    "input_tokens": r.usage.get("input_tokens") or r.usage.get("prompt_tokens"),
                    "output_tokens": r.usage.get("output_tokens") or r.usage.get("completion_tokens"),
                },
            )

    existing = (persona.profile or {}) if hasattr(persona, "profile") else {}
    pain_points = list(existing.get("pain_points") or existing.get("painPoints") or [])
    goals = list(existing.get("goals") or [])
    interests = list(existing.get("interests") or [])
    values = list(existing.get("values") or [])

    # Traits: PersonaProfile expects Dict[str, float] (trait name -> score). Merge with existing.
    existing_traits_raw = existing.get("traits")
    traits: Dict[str, float] = {}
    if isinstance(existing_traits_raw, dict):
        for k, v in existing_traits_raw.items():
            if isinstance(v, (int, float)):
                traits[k] = float(v)
            elif isinstance(v, str):
                try:
                    traits[k] = float(v)
                except (ValueError, TypeError):
                    traits[k] = 1.0
            else:
                traits[k] = 1.0
    elif isinstance(existing_traits_raw, list):
        for item in existing_traits_raw:
            if isinstance(item, dict):
                name = item.get("name") or item.get("label") or item.get("title") or item.get("content")
                if name:
                    traits[name] = 1.0
            elif isinstance(item, str):
                traits[item] = 1.0

    # Communication style: PersonaProfile expects vocabulary as List[str]. sentence_structure as str.
    comm_style = existing.get("communication_style") or existing.get("communicationStyle") or {}
    if not isinstance(comm_style, dict):
        comm_style = {}
    raw_vocab = comm_style.get("vocabulary") or []
    vocabulary: List[str] = []
    for item in raw_vocab:
        if isinstance(item, str):
            vocabulary.append(item)
        elif isinstance(item, dict):
            w = item.get("word") or item.get("label") or item.get("title") or item.get("content")
            if w:
                vocabulary.append(str(w))
    sentence_structure = (comm_style.get("sentence_structure") or "").strip()

    overlay = (body or {}).get("profile_overlay") if isinstance(body, dict) else None
    if not isinstance(overlay, dict):
        overlay = {}

    try:
        ctx_pain = _build_persona_ai_context(session, persona, max_items, output_locale=out_loc)
        r_pain = await ai_assist.generate(
            AiAssistRequest(template_id="persona.pain_points", context=ctx_pain, max_suggestions=max_items),
        )
        _report(r_pain)
        for s in r_pain.suggestions:
            content = getattr(s, "content", None) or (s if isinstance(s, str) else "")
            if content:
                pain_points.append({"label": content, "evidence_count": 1})

        ctx_goals = _build_persona_goals_ai_context(session, persona, max_items, output_locale=out_loc)
        r_goals = await ai_assist.generate(
            AiAssistRequest(template_id="persona.goals", context=ctx_goals, max_suggestions=max_items),
        )
        _report(r_goals)
        for s in r_goals.suggestions:
            content = getattr(s, "content", None) or (s if isinstance(s, str) else "")
            if content:
                goals.append({"label": content, "priority": 1})

        ctx_interests = _build_persona_interests_ai_context(session, persona, max_items, output_locale=out_loc)
        r_interests = await ai_assist.generate(
            AiAssistRequest(template_id="persona.interests", context=ctx_interests, max_suggestions=max_items),
        )
        _report(r_interests)
        for s in r_interests.suggestions:
            content = getattr(s, "content", None) or (s if isinstance(s, str) else "")
            if content:
                interests.append(content)

        ctx_values = _build_persona_values_ai_context(session, persona, max_items, output_locale=out_loc)
        r_values = await ai_assist.generate(
            AiAssistRequest(template_id="persona.values", context=ctx_values, max_suggestions=max_items),
        )
        _report(r_values)
        for s in r_values.suggestions:
            content = getattr(s, "content", None) or (s if isinstance(s, str) else "")
            if content:
                values.append(content)

        # Traits (persona.traits returns list of {name, description})
        # PersonaProfile expects traits: Dict[str, float] (trait name -> score)
        ctx_traits = _build_persona_traits_ai_context(session, persona, max_items, output_locale=out_loc)
        r_traits = await ai_assist.generate(
            AiAssistRequest(template_id="persona.traits", context=ctx_traits, max_suggestions=max_items),
        )
        _report(r_traits)
        for s in r_traits.suggestions:
            name = getattr(s, "content", None) or (s if isinstance(s, str) else None)
            if name:
                traits[name] = 1.0

        # Vocabulary (persona.vocabulary returns list of {word, description})
        # PersonaProfile expects communication_style.vocabulary: List[str]
        ctx_vocab = _build_persona_vocabulary_ai_context(session, persona, max_items, output_locale=out_loc)
        r_vocab = await ai_assist.generate(
            AiAssistRequest(template_id="persona.vocabulary", context=ctx_vocab, max_suggestions=max_items),
        )
        _report(r_vocab)
        for s in r_vocab.suggestions:
            word = getattr(s, "content", None) or (s if isinstance(s, str) else None)
            if word:
                vocabulary.append(str(word))

        # Sentence structure (persona.sentence_structure returns single description)
        ctx_sent = _build_persona_sentence_structure_ai_context(session, persona, output_locale=out_loc)
        r_sent = await ai_assist.generate(
            AiAssistRequest(template_id="persona.sentence_structure", context=ctx_sent, max_suggestions=1),
        )
        _report(r_sent)
        if r_sent.suggestions:
            content = getattr(r_sent.suggestions[0], "content", None) or (
                r_sent.suggestions[0] if isinstance(r_sent.suggestions[0], str) else ""
            )
            if content:
                sentence_structure = content.strip()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # Build communication_style with vocabulary and sentence_structure; keep skepticism_level if present
    merged_comm = dict(comm_style)
    merged_comm["vocabulary"] = vocabulary
    merged_comm["sentence_structure"] = sentence_structure
    if "skepticism_level" not in merged_comm:
        merged_comm["skepticism_level"] = merged_comm.get("skepticism_level", 0)

    chip_updates: dict[str, Any] = {
        "pain_points": pain_points,
        "goals": goals,
        "interests": interests,
        "values": values,
        "traits": traits,
        "communication_style": merged_comm,
    }
    for key in ("bio", "age", "location", "gender"):
        if overlay is not None and key in overlay:
            chip_updates[key] = overlay[key]
        elif key in existing:
            chip_updates[key] = existing[key]
        else:
            chip_updates[key] = "" if key == "bio" else None

    profile_de_patch: dict[str, Any] | None = None
    try:
        gen = PersonaGenerationService()
        next_en, aligned_de = merge_persona_profile_bilingual_enrich(
            existing_en=existing,
            existing_de=persona.profile_de if isinstance(getattr(persona, "profile_de", None), dict) else None,
            chip_updates=chip_updates,
            from_locale=out_loc,
            translate=lambda fl, s: gen.translate_ui_string_map(from_locale=fl, strings=s),
        )
        profile_json = enrich_profile_patch_json(next_en)
        profile_de_patch = aligned_de
    except Exception as exc:  # noqa: BLE001
        _log.warning(
            "persona.enrich.bilingual_skipped",
            extra={"persona_id": str(persona.id), "error": str(exc)},
        )
        profile_json = {
            "pain_points": pain_points,
            "painPoints": pain_points,
            "goals": goals,
            "interests": interests,
            "values": values,
            "traits": traits,
            "communication_style": merged_comm,
            "communicationStyle": merged_comm,
        }
        for key in ("bio", "age", "location", "gender"):
            if overlay is not None and key in overlay:
                profile_json[key] = overlay[key]
            elif key in existing:
                profile_json[key] = existing[key]
            else:
                profile_json[key] = "" if key == "bio" else None
    try:
        compact_prompt_en, compact_prompt_de = await build_compact_chat_prompt_llm_bilingual(
            session,
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile_json,
        )
    except Exception:  # noqa: BLE001
        compact_prompt_en = build_compact_chat_prompt(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile_json,
        )
        compact_prompt_de = build_compact_chat_prompt_de(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile_json,
        )
    if not (compact_prompt_en or compact_prompt_en.strip()):
        compact_prompt_en = build_compact_chat_prompt(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile_json,
        )
    if not (compact_prompt_de or compact_prompt_de.strip()):
        compact_prompt_de = build_compact_chat_prompt_de(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile_json,
        )
    payload = PersonaPatchRequest(
        name=None,
        segment=None,
        headline=None,
        profile=None,
        profile_de=profile_de_patch,
        confidence=None,
        version=None,
        status=None,
        updated_by=uid or "system",
        prompt=PersonaPromptProto(
            persona_id=str(persona.id),
            system_prompt=compact_prompt_en,
            system_prompt_de=compact_prompt_de,
            template_version=CHAT_PROMPT_TEMPLATE_VERSION,
        ),
    )
    allowed_project_ids = (session.info or {}).get("allowed_project_ids")
    return persona_service.update_persona(
        session,
        persona_id,
        payload,
        profile_json=profile_json,
        allowed_project_ids=allowed_project_ids,
    )


@router.post(
    "/{persona_id}/ensure-chat-prompt",
    summary="Ensure compact chat prompt exists",
    description="Builds and saves a compact system prompt from the persona profile via LLM (or fallback) if missing or not the current template version. Idempotent.",
)
async def ensure_chat_prompt(
    persona_id: str,
    session: Session = Depends(get_db),
) -> dict:
    persona = _get_persona_or_404(session, persona_id)
    latest = session.scalar(
        select(PersonaPromptModel)
        .where(PersonaPromptModel.persona_id == persona.id)
        .order_by(PersonaPromptModel.created_at.desc())
    )
    if latest and getattr(latest, "template_version", None) == CHAT_PROMPT_TEMPLATE_VERSION:
        return {"ensured": False, "prompt_length": len(latest.system_prompt or "")}
    profile = (persona.profile or {}) if hasattr(persona, "profile") else {}
    try:
        built_en, built_de = await build_compact_chat_prompt_llm_bilingual(
            session,
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile,
        )
    except Exception:  # noqa: BLE001
        built_en = build_compact_chat_prompt(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile,
        )
        built_de = build_compact_chat_prompt_de(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile,
        )
    if not (built_en or built_en.strip()):
        built_en = build_compact_chat_prompt(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile,
        )
    if not (built_de or built_de.strip()):
        built_de = build_compact_chat_prompt_de(
            name=persona.name or "",
            segment=persona.segment or "",
            headline=persona.headline or "",
            profile=profile,
        )
    session.add(
        PersonaPromptModel(
            persona_id=persona.id,
            system_prompt=built_en,
            system_prompt_de=built_de,
            template_version=CHAT_PROMPT_TEMPLATE_VERSION,
        )
    )
    session.commit()
    return {"ensured": True, "prompt_length": len(built_en)}


@router.post(
    "",
    response_model=PersonaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new persona manually",
    description="""
    Create a new persona profile manually by providing all required persona information.
    
    This endpoint allows you to manually create a persona without automatic generation.
    All persona fields must be provided in the request payload, including demographics,
    goals, pain points, communication style, and other profile attributes.
    
    **Parameters:**
    - `payload`: The persona creation request containing all persona details:
      - `project_id`: ID of the project this persona belongs to
      - `name`: Full name of the persona
      - `segment`: Target segment description
      - `headline`: Short headline/tagline for the persona
      - `bio`: Detailed biography
      - `profile`: Complete profile object with demographics, goals, pain points, traits, etc.
      - `confidence`: Confidence score (0.0-1.0) for the persona
      - `version`: Version string for the persona
    
    **Returns:**
    - The newly created persona object with all details including generated ID and timestamps.
    
    **Note:** Manual creation bypasses AI generation. All persona attributes must be explicitly provided.
    """
)
def create_persona(payload: PersonaCreateRequest, session: Session = Depends(get_db)) -> PersonaResponse:
    try:
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(payload.project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
            if payload.target_group_id:
                try:
                    target_group_uuid = UUID(payload.target_group_id)
                except ValueError as exc:
                    raise HTTPException(status_code=400, detail="Invalid target_group_id") from exc
                target_group = session.get(TargetGroup, target_group_uuid)
                if not target_group or target_group.project_id != project_uuid:
                    raise HTTPException(status_code=403, detail="Target group access denied")
        return persona_service.create_persona(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/generate",
    response_model=PersonaResponse,
    summary="Generate a persona automatically from research data",
    description="""
    Automatically generate a persona profile using AI based on research data and target group knowledge.
    
    This endpoint uses AI-powered persona generation to create a comprehensive persona profile
    based on available research chunks, documents, and knowledge entries associated with a target group.
    The generation process analyzes relevant research data and extracts demographics, goals,
    pain points, communication patterns, and other persona attributes.
    
    **Parameters (`PersonaGenerateRequest`):**
    - `project_id`: UUID of the project this persona belongs to (required)
    - `segment`: Target segment / archetype label (required)
    - `persona_id`: Optional UUID of an existing persona (uses its `target_group_id` for knowledge when set)
    - `output_locale`: Optional `"en"` \| `"de"` for generated profile string language (omit = English).

    For target-group-scoped generation (description, `filter_mode`, chunks, etc.), use
    `POST /target-groups/{target_group_id}/personas/generate` instead.
    
    **Returns:**
    - The generated persona object with AI-extracted attributes including demographics,
      goals, pain points, traits, communication style, and confidence score.
    
    **Note:** Generation is asynchronous and may take several seconds. The persona is created
    with a "Pending Persona" placeholder name initially and updated once generation completes.
    """
)
def generate_persona(
    payload: PersonaGenerateRequest,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaResponse:
    allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
    if allowed_project_ids is not None:
        try:
            project_uuid = UUID(payload.project_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid project_id") from exc
        if project_uuid not in allowed_project_ids:
            raise HTTPException(status_code=403, detail="Project access denied")

    # Determine target_group_id if persona_id is provided (persona might already have target_group)
    target_group_id = None
    if payload.persona_id:
        try:
            existing_persona = session.get(Persona, UUID(payload.persona_id))
            if existing_persona and allowed_project_ids is not None and existing_persona.project_id not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Persona access denied")
            if existing_persona and existing_persona.target_group_id:
                target_group_id = existing_persona.target_group_id
        except ValueError:
            pass
    
    persona = Persona(
        project_id=UUID(payload.project_id),
        name="Pending Persona",
        segment=payload.segment,
        headline="Auto-generated persona",
        profile={},
        confidence=0.7,
        version="1.0.0",
        target_group_id=target_group_id,
    )
    session.add(persona)
    session.commit()
    session.refresh(persona)

    # In real pipeline chunk IDs would come from discovery stage
    # Now supports target_group_id for knowledge retrieval
    chunk_ids: List[UUID] = []
    generator.generate(
        persona=persona,
        chunk_ids=chunk_ids if not target_group_id else None,
        target_group_id=target_group_id,
        output_locale=payload.output_locale,
    )

    uid = _user_id_for_usage(current_user)
    if uid:
        report_usage(
            user_id=uid,
            event_type="persona_generate",
            raw_units={"runs": 1},
            idempotency_key=f"persona_generate:{persona.id}",
        )

    session.refresh(persona)
    return persona_service.get_persona(session, str(persona.id), use_cache=False)


@router.get(
    "/{persona_id}",
    response_model=PersonaResponse,
    summary="Get details of a specific persona",
    description="""
    Retrieve comprehensive details of a specific persona by its ID.
    
    This endpoint returns all information about a persona including its profile,
    demographics, goals, pain points, communication style, associated documents,
    knowledge entries, and metadata.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - Complete persona object with all attributes:
      - Basic information (name, headline, bio, segment)
      - Profile details (demographics, goals, pain points, traits)
      - Communication style (vocabulary, sentence structure, skepticism level)
      - Confidence score and version
      - Associated project and target group IDs
      - Creation and update timestamps
      - Image URL for avatar
    
    **Note:** Results are cached for performance. Use cache invalidation endpoints
    if persona data has been recently updated.
    """
)
def get_persona(persona_id: str, session: Session = Depends(get_db)) -> PersonaResponse:
    # Backend request trace: count GET /personas/:id for debugging request storms (remove after fix verified).
    _log.info("[AUDION-DEBUG] GET /personas/%s at %.3f", persona_id, time.monotonic())
    try:
        _get_persona_or_404(session, persona_id)
        return persona_service.get_persona(session, persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Persona not found") from exc


@router.get(
    "/{persona_id}/public",
    response_model=PersonaResponse,
    summary="Get persona by ID (public share link)",
    description="Public endpoint for shared chat links. No auth required. Validates project_id as share token.",
)
def get_persona_public(
    persona_id: str,
    project_id: str = Query(..., description="Project ID - acts as share token"),
) -> PersonaResponse:
    """Allow unauthenticated access when project_id matches the persona's project."""
    try:
        persona_uuid = UUID(persona_id)
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid persona or project ID") from exc
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona or persona.project_id != project_uuid:
            raise HTTPException(status_code=404, detail="Persona not found")
        return persona_service.get_persona(session, persona_id)


@router.get(
    "/{persona_id}/moodboards/public",
    response_model=Moodboard,
    summary="Get active moodboard (public share link)",
    description="Public endpoint for shared chat links. No auth required. Validates project_id as share token.",
)
def get_moodboard_public(
    persona_id: str,
    project_id: str = Query(..., description="Project ID - acts as share token"),
) -> Moodboard:
    try:
        persona_uuid = UUID(persona_id)
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid persona or project ID") from exc
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona or persona.project_id != project_uuid:
            raise HTTPException(status_code=404, detail="Persona not found")
        mb = session.scalar(
            select(PersonaMoodboard)
            .where(PersonaMoodboard.persona_id == persona_uuid)
            .where(PersonaMoodboard.active.is_(True))
            .order_by(PersonaMoodboard.updated_at.desc())
            .limit(1)
        )
        if not mb:
            raise HTTPException(status_code=404, detail="Moodboard not found")
        return _serialize_moodboard(session, mb)


@router.get(
    "/{persona_id}/moodboard-tiles/{tile_id}/image",
    summary="Serve moodboard tile image bytes (public share link)",
    description="No auth required. Validates project_id as share token.",
)
def get_moodboard_tile_image_public(
    persona_id: str,
    tile_id: str,
    project_id: str = Query(..., description="Project ID - acts as share token"),
) -> StreamingResponse:
    try:
        persona_uuid = UUID(persona_id)
        tile_uuid = UUID(tile_id)
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid persona, tile, or project ID") from exc

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona or persona.project_id != project_uuid:
            raise HTTPException(status_code=404, detail="Persona not found")

        tile = session.get(PersonaMoodboardTile, tile_uuid)
        if not tile:
            raise HTTPException(status_code=404, detail="Tile not found")

        mb = session.get(PersonaMoodboard, tile.moodboard_id)
        if not mb or mb.persona_id != persona_uuid:
            raise HTTPException(status_code=404, detail="Tile not found")

        if isinstance(tile.image_url, str) and tile.image_url.startswith(("http://", "https://")):
            return RedirectResponse(tile.image_url)

        fp, content_type = storage.stream(key=tile.image_url)
        return StreamingResponse(fp, media_type=content_type)


@router.patch(
    "/{persona_id}",
    response_model=PersonaResponse,
    summary="Update an existing persona",
    description="""
    Partially update an existing persona with new or modified attributes.
    
    This endpoint allows you to update specific fields of a persona without providing
    all required fields. Only the fields provided in the request payload will be updated.
    All other fields remain unchanged.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona to update (UUID format)
    - `payload`: The partial update request containing only the fields to update:
      - `name`: Updated persona name (optional)
      - `segment`: Updated segment description (optional)
      - `headline`: Updated headline (optional)
      - `bio`: Updated biography (optional)
      - `profile`: Updated profile object (optional, can be partial)
      - `confidence`: Updated confidence score (optional)
      - `version`: Updated version string (optional)
    
    **Returns:**
    - The updated persona object with all fields (updated and unchanged).
    
    **Note:** Partial updates are supported. Fields not included in the payload remain unchanged.
    The cache for this persona is automatically invalidated after update.
    """
)
async def update_persona(
    persona_id: str,
    body: dict = Body(...),
    session: Session = Depends(get_db),
) -> PersonaResponse:
    """
    Update persona with direct JSON access to avoid Pydantic None filtering issues.
    """
    import structlog
    from msqdx_glass_proto.personas import PersonaPrompt
    logger = structlog.get_logger(__name__)
    
    # CRITICAL: Log that this route was called
    logger.info("persona.update.router.entry", persona_id=persona_id)
    
    # CRITICAL: body is already a dict from FastAPI Body(...)
    # This preserves None values exactly as sent from frontend
    
    logger.info("persona.update.router.body_received", persona_id=persona_id, body_keys=list(body.keys())[:20] if body else [])
    
    # Extract profile JSON directly (no Pydantic!)
    profile_json = body.get("profile")

    # Parse prompt safely: frontend may send camelCase (systemPrompt, templateVersion)
    prompt_value = None
    if body.get("prompt") and isinstance(body.get("prompt"), dict):
        try:
            raw = body["prompt"]
            sp = raw.get("systemPrompt") or raw.get("system_prompt") or ""
            sp_de = raw.get("systemPromptDe") or raw.get("system_prompt_de")
            tv = raw.get("templateVersion") or raw.get("template_version") or "1.0.0"
            pid = raw.get("personaId") or raw.get("persona_id") or persona_id
            prompt_value = PersonaPrompt(
                persona_id=str(pid),
                system_prompt=sp,
                system_prompt_de=sp_de,
                template_version=str(tv),
            )
        except Exception as prompt_exc:  # noqa: BLE001
            logger.warning("persona.update.router.prompt_parse_failed", persona_id=persona_id, error=str(prompt_exc))
            prompt_value = None

    # Build payload object manually from JSON
    # Keep Pydantic only for simple fields, not for profile
    payload = PersonaPatchRequest(
        name=body.get("name"),
        segment=body.get("segment"),
        headline=body.get("headline"),
        headline_de=body.get("headline_de") or body.get("headlineDe"),
        profile=None,  # We handle profile separately as raw JSON
        profile_de=body.get("profile_de") or body.get("profileDe"),
        profile_card_de=body.get("profile_card_de") or body.get("profileCardDe"),
        confidence=body.get("confidence"),
        version=body.get("version"),
        status=body.get("status"),
        updated_by=body.get("updated_by"),
        last_reviewed_at=body.get("last_reviewed_at"),
        image_url=body.get("image_url"),
        locked_by=body.get("locked_by"),
        locked_at=body.get("locked_at"),
        prompt=prompt_value,
        project_id=body.get("project_id"),
        target_group_id=body.get("target_group_id"),
        tavus_replica_id=body.get("tavus_replica_id") or body.get("tavusReplicaId"),
        tavus_persona_id=body.get("tavus_persona_id") or body.get("tavusPersonaId"),
    )

    logger.info("persona.update.router.start", persona_id=persona_id, has_profile=profile_json is not None)
    if profile_json:
        logger.info(
            "persona.update.router.profile_json",
            persona_id=persona_id,
            gender_in=('gender' in profile_json),
            gender_value=profile_json.get('gender'),
            media_affinity_in=('media_affinity' in profile_json),
            media_affinity_value=profile_json.get('media_affinity'),
            age_in=('age' in profile_json),
            age_value=profile_json.get('age'),
            profile_keys=list(profile_json.keys())[:30],
        )

    try:
        allowed_project_ids = (session.info or {}).get("allowed_project_ids")
        return persona_service.update_persona(
            session,
            persona_id,
            payload,
            profile_json=profile_json,
            allowed_project_ids=allowed_project_ids,
        )
    except ValueError as exc:
        err = str(exc)
        if err == "persona_not_found":
            raise HTTPException(status_code=404, detail="Persona not found") from exc
        if err.startswith("bilingual_publish_incomplete:"):
            raise HTTPException(status_code=400, detail=err) from exc
        if err in (
            "invalid_project_id",
            "project_access_denied",
            "invalid_target_group_id",
            "target_group_not_found",
            "target_group_project_access_denied",
            "profile_de must be shape-compatible with profile",
            "profile_card_de must be shape-compatible with profile_card",
        ):
            raise HTTPException(status_code=400, detail=err) from exc
        raise HTTPException(status_code=404, detail="Persona not found") from exc
    except Exception as exc:
        logger.exception("persona.update.router.failed", persona_id=persona_id, error=str(exc))
        detail = str(exc)
        # Surface DB truncation errors so deployers know to run headline migration
        if "StringDataRightTruncation" in detail or "value too long" in detail:
            detail = (
                f"{detail} "
                "If headline/segment/name is long, ensure migration 20260309_personas_headline_text (headline→TEXT) is applied."
            )
        raise HTTPException(status_code=500, detail=detail) from exc


@router.delete(
    "/{persona_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a persona permanently",
    description="""
    Permanently delete a persona and all associated data from the system.
    
    This endpoint performs a complete deletion of a persona including:
    - Removing all associated documents and their chunks from storage and vector database
    - Deleting all knowledge entries
    - Removing all persona sources and prompts
    - Deleting the persona record itself
    - Invalidating all caches
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona to delete (UUID format)
    - `actor`: Optional identifier of who is performing the deletion (for audit logging)
    
    **Returns:**
    - 204 No Content on successful deletion
    
    **Note:** This is a permanent deletion operation. All associated data including
    documents, chunks, embeddings, and knowledge entries are removed. This action cannot
    be undone. An audit log entry is created before deletion for tracking purposes.
    """
)
def delete_persona(persona_id: str, actor: str | None = Query(None), session: Session = Depends(get_db)) -> None:
    try:
        persona_service.delete_persona(session, persona_id, actor=actor)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Persona not found") from exc


@router.get(
    "/{persona_id}/documents",
    response_model=List[PersonaDocument],
    summary="List all documents associated with a persona",
    description="""
    Retrieve a list of all documents that have been uploaded and associated with a specific persona.
    
    This endpoint returns all documents linked to the persona, including their processing status,
    file metadata, and ingestion information. Documents are returned in reverse chronological order
    (newest first).
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - A list of document objects, each containing:
      - Document ID and filename
      - File size, content type, and upload timestamp
      - Processing status (pending, processing, completed, failed)
      - Upload metadata (uploaded_by, progress percentage)
      - Error information if processing failed
    
    **Note:** Only documents that are directly associated with the persona are returned.
    Documents may be in various states of processing (pending, processing, completed, or failed).
    """
)
async def list_persona_documents(persona_id: str, session: Session = Depends(get_db)) -> List[PersonaDocument]:
    from ..core.config import get_settings
    from ..services.storion_client import storion_client
    import structlog
    import uuid as uuid_module
    
    logger = structlog.get_logger(__name__)
    settings = get_settings()
    
    # Try to get from STORION if proxy enabled
    if settings.use_storion_proxy:
        try:
            storion_files = await storion_client.list_files(
                service="audion",
                entity_type="persona",
                entity_id=persona_id,
            )
            
            # Convert STORION files to PersonaDocument format
            documents = []
            for file_data in storion_files:
                # Create a minimal Document object for serialization
                document = Document(
                    id=uuid4(),  # Temporary ID, STORION file_id is in object_key
                    filename=file_data.get("filename", ""),
                    content_type=file_data.get("content_type", ""),
                    size_bytes=file_data.get("size", 0),
                    status=file_data.get("status", "pending"),
                    object_key=file_data.get("id", ""),  # STORION file_id
                    file_path=file_data.get("id", ""),
                    persona_id=uuid_module.UUID(persona_id),
                    uploaded_by=file_data.get("uploaded_by"),
                )
                documents.append(persona_service.serialize_document(document, session=session))
            
            if documents:
                return documents
        except Exception as e:
            logger.warning("document.list.storion_failed", error=str(e), persona_id=persona_id)
            # Fallback to local query
    
    # Local query (fallback or if proxy disabled)
    _get_persona_or_404(session, persona_id)
    try:
        return persona_service.list_documents(session, persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/documents",
    response_model=PersonaDocument,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document for a persona",
    description="""
    Upload a document file to be associated with a persona and processed for knowledge extraction.
    
    This endpoint accepts a file upload, stores it in persistent storage, and enqueues it for
    asynchronous processing. The document will be processed to extract text, create chunks,
    generate embeddings, and store them in the vector database for persona-related knowledge retrieval.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona to associate the document with (UUID format)
    - `file`: The document file to upload (multipart/form-data, supports PDF, DOCX, TXT, etc.)
    - `uploaded_by`: Optional identifier of who uploaded the document (default: "persona-admin-ui")
    
    **Returns:**
    - The created document object with processing status "processing" and a unique document ID.
    
    **Note:** Processing happens asynchronously. Use the document status endpoint or list documents
    to check processing progress. The document will be chunked, embedded, and made searchable
    once processing completes. The persona cache is automatically invalidated after upload.
    """
)
async def upload_persona_document(
    persona_id: str,
    file: UploadFile = File(...),
    uploaded_by: str = Form("persona-admin-ui"),
    session: Session = Depends(get_db),
) -> PersonaDocument:
    from ..core.config import get_settings
    from ..services.storion_client import storion_client
    import structlog
    
    logger = structlog.get_logger(__name__)
    settings = get_settings()
    
    persona = _get_persona_or_404(session, persona_id)
    contents = await read_upload_with_limit(
        file, settings.upload_max_document_bytes, label="Document"
    )
    if not contents:
        raise HTTPException(status_code=400, detail="File was empty")
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload.bin"

    # Proxy to STORION if enabled
    if settings.use_storion_proxy:
        try:
            logger.info("document.upload.proxy_to_storion", persona_id=persona_id, filename=filename)
            
            # Upload to STORION
            result = await storion_client.upload_file(
                file_content=contents,
                filename=filename,
                service="audion",
                entity_type="persona",
                entity_id=str(persona.id),
                uploaded_by=uploaded_by,
            )
            
            # Create local document record for backward compatibility
            document_id = uuid4()
            document = Document(
                id=document_id,
                filename=filename,
                content_type=content_type,
                size_bytes=len(contents),
                status="processing",  # Will be updated by STORION processing
                object_key=result.get("file_id", ""),  # Store STORION file_id
                file_path=result.get("file_id", ""),
                persona_id=persona.id,
                uploaded_by=uploaded_by,
            )
            session.add(document)
            session.commit()
            
            logger.info("document.upload.storion_success", 
                       document_id=str(document.id), 
                       storion_file_id=result.get("file_id"),
                       job_id=result.get("job_id"))
            
            session.refresh(document)
            persona_service.invalidate_cache(persona_id)
            return persona_service.serialize_document(document, session=session)
        
        except Exception as e:
            logger.error("document.upload.storion_failed", error=str(e), exc_info=True)
            # Fallback to local processing if STORION fails
            logger.warning("document.upload.fallback_to_local", persona_id=persona_id)
    
    # Local processing (fallback or if proxy disabled)
    document_id = uuid4()
    key = f"personas/{persona_id}/documents/{document_id}/{filename}"
    
    # Create document with processing status
    document = Document(
        id=document_id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(contents),
        status="processing",
        object_key=key,
        file_path=key,
        persona_id=persona.id,
        uploaded_by=uploaded_by,
    )
    session.add(document)
    session.flush()
    
    # Create processing job
    job = ProcessingJob(document_id=document.id, status="pending", progress=0)
    session.add(job)
    session.commit()
    
    # Store file in filesystem (persistent storage for ingestion)
    storage.upload(key=key, data=contents, content_type=content_type)
    
    # Get the persistent file path for ingestion (same as storage path)
    data_dir = Path(settings.data_dir)
    persistent_file = data_dir / key.lstrip("/")
    
    # Enqueue ingestion task with persistent file path
    logger.info("document.upload.enqueue", document_id=str(document.id), file_path=str(persistent_file), persona_id=str(persona_id))
    enqueue_ingestion(str(document.id), str(persistent_file))
    logger.info("document.upload.enqueued", document_id=str(document.id))
    
    session.refresh(document)
    persona_service.invalidate_cache(persona_id)
    return persona_service.serialize_document(document, session=session)


@router.get(
    "/{persona_id}/knowledge",
    response_model=List[PersonaKnowledgeEntrySchema],
    summary="List knowledge entries for a persona",
    description="""
    Retrieve all manual knowledge entries that have been added to a persona.
    
    This endpoint returns a list of knowledge entries that were manually created and
    associated with the persona. These entries complement the automatically extracted
    knowledge from documents and can include domain-specific insights, observations,
    or additional context about the persona.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - A list of knowledge entry objects, each containing:
      - Entry ID and title
      - Content text
      - Optional metadata payload
      - Creator information and timestamps
    
    **Note:** Knowledge entries are separate from document-derived knowledge chunks.
    These are manually curated entries that provide additional context for the persona.
    """
)
def list_persona_knowledge(persona_id: str, session: Session = Depends(get_db)) -> List[PersonaKnowledgeEntrySchema]:
    _get_persona_or_404(session, persona_id)
    try:
        return persona_service.list_knowledge(session, persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/knowledge",
    response_model=PersonaKnowledgeEntrySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add a knowledge entry to a persona",
    description="""
    Create a new manual knowledge entry and associate it with a persona.
    
    This endpoint allows you to add manually curated knowledge entries to a persona.
    These entries provide additional context, insights, or observations that complement
    the automatically extracted knowledge from documents. Knowledge entries can include
    domain-specific information, expert notes, or qualitative observations.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `payload`: The knowledge entry creation request containing:
      - `title`: A short title or heading for the knowledge entry
      - `content`: The main content text of the knowledge entry
      - `metadata`: Optional metadata object with additional structured information
      - `created_by`: Identifier of who created this entry (optional)
    
    **Returns:**
    - The newly created knowledge entry object with ID and timestamps.
    
    **Note:** Knowledge entries are stored separately from document chunks and provide
    a way to add manual annotations and insights to personas. The persona cache is
    automatically invalidated after adding knowledge.
    """
)
def add_persona_knowledge(
    persona_id: str,
    payload: PersonaKnowledgeUpsertRequest,
    session: Session = Depends(get_db),
) -> PersonaKnowledgeEntrySchema:
    persona = _get_persona_or_404(session, persona_id)
    entry = PersonaKnowledgeEntry(
        persona_id=persona.id,
        title=payload.title,
        content=payload.content,
        metadata_payload=payload.metadata,
        created_by=payload.created_by,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    persona_service.invalidate_cache(persona_id)
    return persona_service.serialize_knowledge_entry(entry)


@router.post(
    "/{persona_id}/avatar",
    response_model=PersonaResponse,
    summary="Upload an avatar image for a persona",
    description="""
    Upload an avatar/profile image for a persona.
    
    This endpoint accepts an image file (PNG, JPEG, etc.) and associates it with a persona
    as their avatar. The image is stored in persistent storage and the persona's image_url
    is updated to reference the stored image.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `file`: The image file to upload (multipart/form-data, supports PNG, JPEG, GIF, etc.)
    - `updated_by`: Optional identifier of who uploaded the avatar (default: "persona-admin-ui")
    
    **Returns:**
    - The updated persona object with the new image_url pointing to the stored avatar.
    
    **Note:** The image is stored in the personas/{persona_id}/avatars/ directory with a
    unique filename. The persona cache is automatically invalidated after upload. Previously
    uploaded avatars are not automatically deleted.
    """
)
async def upload_persona_avatar(
    persona_id: str,
    file: UploadFile = File(...),
    updated_by: str = Form("persona-admin-ui"),
    session: Session = Depends(get_db),
) -> PersonaResponse:
    from ..core.config import get_settings
    settings = get_settings()
    persona = _get_persona_or_404(session, persona_id)
    contents = await read_upload_with_limit(
        file, settings.upload_max_avatar_bytes, label="Avatar image"
    )
    if not contents:
        raise HTTPException(status_code=400, detail="File was empty")
    content_type = file.content_type or "image/png"
    key = f"personas/{persona_id}/avatars/{uuid4()}-{file.filename or 'avatar.png'}"
    storage.upload(key=key, data=contents, content_type=content_type)
    persona.image_url = key
    persona.updated_by = updated_by
    persona.updated_at = datetime.utcnow()
    session.add(persona)
    session.commit()
    session.refresh(persona)
    persona_service.invalidate_cache(persona_id)
    return persona_service.get_persona(session, persona_id, use_cache=False)


@router.get(
    "/{persona_id}/documents/{document_id}/download",
    summary="Download a persona document",
    description="""
    Download a document file that is associated with a persona.
    
    This endpoint retrieves the original document file from storage and streams it back
    to the client with appropriate content type and download headers.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `document_id`: The unique identifier of the document to download (UUID format)
    
    **Returns:**
    - Streaming response with the document file content:
      - Content-Type header set to the document's MIME type
      - Content-Disposition header with the original filename for download
      - Binary file content streamed directly from storage
    
    **Note:** The document must be associated with the specified persona. If the document
    doesn't exist or isn't linked to the persona, a 404 error is returned.
    """
)
def download_persona_document(
    persona_id: str,
    document_id: str,
    session: Session = Depends(get_db),
) -> StreamingResponse:
    persona = _get_persona_or_404(session, persona_id)
    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc
    document = session.get(Document, document_uuid)
    if not document or document.persona_id != persona.id or not document.object_key:
        raise HTTPException(status_code=404, detail="Document not found")
    body, content_type = storage.stream(key=document.object_key)
    filename = document.filename or "document"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(body, media_type=content_type, headers=headers)


@router.post(
    "/{persona_id}/documents/{document_id}/retry",
    response_model=PersonaDocument,
    summary="Retry ingestion for a failed document",
    description="""
    Retry the ingestion process for a document that previously failed or is stuck in processing.
    
    This endpoint resets the processing job status and re-enqueues the document for ingestion.
    Useful when a document processing job failed due to transient errors or got stuck in
    a processing state.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `document_id`: The unique identifier of the document to retry (UUID format)
    
    **Returns:**
    - The document object with reset status ("processing") and cleared error information.
    
    **Note:** The document's processing job is reset to "pending" status and re-enqueued.
    Any previous error messages are cleared. The document must have a valid file path in storage.
    The persona cache is automatically invalidated after retry.
    """
)
def retry_persona_document_ingestion(
    persona_id: str,
    document_id: str,
    session: Session = Depends(get_db),
) -> PersonaDocument:
    """Retry ingestion for a document that failed or is stuck."""
    persona = _get_persona_or_404(session, persona_id)
    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc
    document = session.get(Document, document_uuid)
    if not document or document.persona_id != persona.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not document.file_path:
        raise HTTPException(status_code=400, detail="Document file path missing")
    
    # Get or create processing job
    job = session.scalar(
        select(ProcessingJob).where(ProcessingJob.document_id == document_uuid)
    )
    if not job:
        job = ProcessingJob(document_id=document_uuid, status="pending", progress=0)
        session.add(job)
    
    # Reset job status
    job.status = "pending"
    job.progress = 0
    job.error = None
    document.status = "processing"
    session.commit()
    
    # Get the persistent file path for ingestion
    from ..core.config import get_settings
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    # document.file_path is relative to data_dir (e.g., "personas/.../file.pdf")
    # Construct full path: data_dir / file_path
    file_path_clean = document.file_path.lstrip("/")
    persistent_file = data_dir / file_path_clean
    
    # Enqueue ingestion task
    enqueue_ingestion(str(document.id), str(persistent_file))
    
    session.refresh(document)
    persona_service.invalidate_cache(persona_id)
    return persona_service.serialize_document(document, session=session)


@router.delete(
    "/{persona_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a persona document",
    description="""
    Permanently delete a document and all its associated data from the system.
    
    This endpoint performs a complete cleanup of a document including:
    - Removing the document file from storage
    - Deleting all document chunks from the vector database (Qdrant)
    - Removing all chunks from the database
    - Deleting the processing job record
    - Removing the document record itself
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `document_id`: The unique identifier of the document to delete (UUID format)
    
    **Returns:**
    - 204 No Content on successful deletion
    
    **Note:** This is a permanent deletion operation. All associated data including
    embeddings and chunks are removed. This action cannot be undone. The persona cache
    is automatically invalidated after deletion.
    """
)
def delete_persona_document(
    persona_id: str,
    document_id: str,
    session: Session = Depends(get_db),
) -> None:
    """Delete a document and all its associated data."""
    persona = _get_persona_or_404(session, persona_id)
    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc
    document = session.get(Document, document_uuid)
    if not document or document.persona_id != persona.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file from storage
    if document.object_key:
        try:
            storage.delete(key=document.object_key)
        except Exception:
            pass  # File might not exist, continue with cleanup
    
    # Delete chunks from Qdrant
    from ..core.config import get_settings
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    settings = get_settings()
    try:
        qdrant = QdrantClient(settings.qdrant_url)
        collection = "research_chunks"
        if qdrant.collection_exists(collection):
            # Delete all points for this document
            qdrant.delete(
                collection_name=collection,
                points_selector=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="document_id",
                            match=qmodels.MatchValue(value=str(document.id)),
                        )
                    ]
                ),
            )
    except Exception:
        pass  # Qdrant might not be available, continue with cleanup
    
    # Delete chunks from database
    session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_uuid))
    
    # Delete processing job
    session.execute(delete(ProcessingJob).where(ProcessingJob.document_id == document_uuid))
    
    # Delete document
    session.delete(document)
    session.commit()
    
    persona_service.invalidate_cache(persona_id)


def _serve_persona_avatar(persona_id: str, session: Session):
    """Shared logic for GET avatar: resolve persona and return image response."""
    persona = _get_persona_or_404(session, persona_id)
    if not persona.image_url:
        raise HTTPException(status_code=404, detail="Avatar not found")
    if persona.image_url.startswith(("http://", "https://")):
        return RedirectResponse(persona.image_url)
    if persona.image_url.startswith("data:"):
        try:
            header, encoded = persona.image_url.split(",", 1)
            media_type = header.split(";")[0].split(":", 1)[1] if ";" in header else "image/png"
            data = b64decode(encoded)
        except (ValueError, IndexError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="Invalid avatar data URI") from exc
        return Response(content=data, media_type=media_type)
    try:
        body, content_type = storage.stream(key=persona.image_url)
    except Exception as exc:  # pragma: no cover - external dependency
        raise HTTPException(status_code=404, detail="Avatar not found") from exc
    return StreamingResponse(body, media_type=content_type)


@router.get(
    "/{persona_id}/avatar",
    summary="Get the avatar image for a persona",
    description="""
    Retrieve the avatar/profile image associated with a persona.
    
    This endpoint returns the avatar image for a persona. The image can be stored in
    different formats: as a URL (external), as a data URI (base64 encoded), or as a
    file in storage (internal). The endpoint handles all formats and streams the image
    with appropriate content type headers.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - Streaming response with the avatar image:
      - If image_url is an external URL: Redirect response to the external URL
      - If image_url is a data URI: Binary image data extracted from the data URI
      - If image_url is a storage key: Streaming response with image from storage
      - Appropriate Content-Type header based on image format
    
    **Note:** If no avatar has been set for the persona, a 404 error is returned.
    The endpoint automatically handles different image storage formats.
    """
)
def get_persona_avatar(persona_id: str, session: Session = Depends(get_db)):
    return _serve_persona_avatar(persona_id, session)


@persona_admin_router.get("/{persona_id}/avatar", include_in_schema=False)
def get_persona_avatar_via_admin_path(persona_id: str, session: Session = Depends(get_db)):
    """Serve avatar at /persona-admin/:id/avatar for proxies that route /api/persona-admin to this API."""
    return _serve_persona_avatar(persona_id, session)


@persona_admin_router.post(
    "/tavus/session",
    summary="Create Tavus video chat session",
    description="Create a Tavus CVI (Conversational Video Interface) session for the given persona. Persona must have tavus_replica_id configured. Returns conversation_url and related fields for embedding.",
)
def create_tavus_session(
    body: dict = Body(...),
    session: Session = Depends(get_db),
):
    """Create a Tavus conversation and return conversation_url (and optional meeting_token) for CVI embed."""
    settings = get_settings()
    if not settings.tavus_api_key:
        raise HTTPException(
            status_code=503,
            detail="Tavus video chat is not configured (TAVUS_API_KEY missing).",
        )
    persona_id = body.get("persona_id")
    if not persona_id:
        raise HTTPException(status_code=400, detail="persona_id is required")
    persona = _get_persona_or_404(session, persona_id)
    replica_id = persona.tavus_replica_id
    if not replica_id:
        raise HTTPException(
            status_code=400,
            detail="Persona has no Tavus replica configured. Set tavus_replica_id in the persona metadata.",
        )
    persona_id_tavus = persona.tavus_persona_id
    conversation_name = body.get("conversation_name") or f"Chat with {persona.name}"
    # Use the same system prompt as in text chat (from DB); fallback to short summary if no prompt.
    conversational_context = None
    if persona.prompt and getattr(persona.prompt, "system_prompt", None):
        full_prompt = (persona.prompt.system_prompt or "").strip()
        if full_prompt:
            # Tavus may have context length limits; 12k chars is a safe upper bound for conversational_context.
            conversational_context = full_prompt[:12000] if len(full_prompt) > 12000 else full_prompt
    if not conversational_context:
        parts = [f"You are in a conversation as {persona.name}."]
        if persona.headline:
            parts.append(f"Summary: {persona.headline}")
        if persona.segment:
            parts.append(f"Segment: {persona.segment}.")
        conversational_context = " ".join(parts) if len(parts) > 1 else (parts[0] if parts else None)
    try:
        data = tavus_create_conversation(
            replica_id=replica_id,
            persona_id=persona_id_tavus,
            conversation_name=conversation_name,
            conversational_context=conversational_context,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        _log.warning("tavus.session.create_failed", persona_id=persona_id, error=str(e))
        raise HTTPException(
            status_code=502,
            detail="Failed to create Tavus session. Please try again later.",
        ) from e
    return data


@persona_admin_router.post(
    "/{persona_id}/translate-fields",
    response_model=PersonaTranslateFieldsResponse,
    summary="Translate persona UI field strings (admin, en↔de)",
)
def translate_persona_fields_admin(
    persona_id: str,
    body: PersonaTranslateFieldsRequest,
    session: Session = Depends(get_db),
) -> PersonaTranslateFieldsResponse:
    _get_persona_or_404(session, persona_id)
    fl = (body.from_locale or "").strip().lower()
    if fl not in ("en", "de"):
        raise HTTPException(status_code=400, detail="from_locale must be en or de")
    try:
        out = generator.translate_ui_string_map(from_locale=fl, strings=dict(body.strings or {}))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        # OpenAI SDK errors (e.g. BadRequestError) must not become uncaught 500s.
        if type(exc).__module__.startswith("openai"):
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        raise
    return PersonaTranslateFieldsResponse(strings=out)


@persona_admin_router.get(
    "/{persona_id}/moodboards/active",
    response_model=Moodboard,
    summary="Get active moodboard for persona (admin)",
)
def get_active_moodboard_admin(persona_id: str, session: Session = Depends(get_db)) -> Moodboard:
    persona = _get_persona_or_404(session, persona_id)
    mb = session.scalar(
        select(PersonaMoodboard)
        .where(PersonaMoodboard.persona_id == persona.id)
        .where(PersonaMoodboard.active.is_(True))
        .order_by(PersonaMoodboard.updated_at.desc())
        .limit(1)
    )
    if not mb:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    return _serialize_moodboard(session, mb)


@persona_admin_router.post(
    "/{persona_id}/moodboards",
    response_model=MoodboardCreateResponse,
    summary="Create moodboard and enqueue build (admin)",
)
def create_moodboard_admin(
    persona_id: str,
    body: dict = Body(default_factory=dict),
    session: Session = Depends(get_db),
) -> MoodboardCreateResponse:
    import structlog

    logger = structlog.get_logger(__name__)
    persona = _get_persona_or_404(session, persona_id)
    title = body.get("title") if isinstance(body, dict) else None
    updated_by = body.get("updated_by") if isinstance(body, dict) else None
    project_id = persona.project_id
    mb = moodboard_service.create_or_activate_moodboard(
        session,
        persona_id=persona.id,
        project_id=project_id,
        title=title if isinstance(title, str) else None,
        updated_by=updated_by if isinstance(updated_by, str) else None,
    )
    result = celery_app.send_task(
        "moodboard.build",
        kwargs={"moodboard_id": str(mb.id)},
        queue="moodboards",
        routing_key="moodboards",
    )
    logger.info(
        "moodboard.build.enqueued",
        moodboard_id=str(mb.id),
        persona_id=str(persona.id),
        celery_task_id=getattr(result, "id", None),
        queue="moodboards",
    )
    return MoodboardCreateResponse(moodboard=_serialize_moodboard(session, mb))


@persona_admin_router.post(
    "/moodboards/{moodboard_id}/rebuild",
    response_model=MoodboardCreateResponse,
    summary="Rebuild moodboard tiles (admin)",
)
def rebuild_moodboard_admin(moodboard_id: str, session: Session = Depends(get_db)) -> MoodboardCreateResponse:
    import structlog

    logger = structlog.get_logger(__name__)
    try:
        mb_uuid = UUID(moodboard_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid moodboard id") from exc
    mb = session.get(PersonaMoodboard, mb_uuid)
    if not mb:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    # Ensure access via persona project permissions:
    _get_persona_or_404(session, str(mb.persona_id))
    mb.status = MoodboardStatus.draft
    session.add(mb)
    session.commit()
    result = celery_app.send_task(
        "moodboard.build",
        kwargs={"moodboard_id": str(mb.id)},
        queue="moodboards",
        routing_key="moodboards",
    )
    logger.info(
        "moodboard.build.enqueued",
        moodboard_id=str(mb.id),
        persona_id=str(mb.persona_id),
        celery_task_id=getattr(result, "id", None),
        queue="moodboards",
    )
    session.refresh(mb)
    return MoodboardCreateResponse(moodboard=_serialize_moodboard(session, mb))


@persona_admin_router.patch(
    "/moodboards/{moodboard_id}",
    response_model=Moodboard,
    summary="Patch moodboard metadata (admin)",
)
def patch_moodboard_admin(
    moodboard_id: str,
    payload: MoodboardPatchRequest,
    session: Session = Depends(get_db),
) -> Moodboard:
    try:
        mb_uuid = UUID(moodboard_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid moodboard id") from exc
    mb = session.get(PersonaMoodboard, mb_uuid)
    if not mb:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    _get_persona_or_404(session, str(mb.persona_id))
    if payload.title is not None:
        mb.title = payload.title.strip() or mb.title
    if payload.active is not None and payload.active:
        # deactivate others
        session.execute(
            update(PersonaMoodboard)
            .where(PersonaMoodboard.persona_id == mb.persona_id)
            .where(PersonaMoodboard.id != mb.id)
            .values(active=False, updated_at=datetime.utcnow(), updated_by=payload.updated_by)
        )
        mb.active = True
    if payload.status is not None:
        try:
            mb.status = MoodboardStatus(payload.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status") from None
    if payload.updated_by is not None:
        mb.updated_by = payload.updated_by
    session.add(mb)
    session.commit()
    session.refresh(mb)
    return _serialize_moodboard(session, mb)


@persona_admin_router.patch(
    "/moodboard-tiles/{tile_id}",
    response_model=MoodboardTile,
    summary="Patch moodboard tile (admin)",
)
def patch_moodboard_tile_admin(
    tile_id: str,
    payload: MoodboardTilePatchRequest,
    session: Session = Depends(get_db),
) -> MoodboardTile:
    try:
        tile_uuid = UUID(tile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid tile id") from exc
    tile = session.get(PersonaMoodboardTile, tile_uuid)
    if not tile:
        raise HTTPException(status_code=404, detail="Tile not found")
    mb = session.get(PersonaMoodboard, tile.moodboard_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    _get_persona_or_404(session, str(mb.persona_id))

    if payload.caption is not None:
        tile.caption = payload.caption
    if payload.rationale is not None:
        tile.rationale = payload.rationale
    if payload.tags is not None:
        tile.tags = payload.tags
    if payload.order is not None:
        tile.tile_order = int(payload.order)
    if payload.locked is not None:
        tile.locked = bool(payload.locked)
    session.add(tile)
    session.commit()
    session.refresh(tile)
    project_uuid = mb.project_id
    if project_uuid is None:
        persona_obj = session.get(Persona, mb.persona_id)
        project_uuid = persona_obj.project_id if persona_obj else None
    return _serialize_moodboard_tile(tile, persona_id=mb.persona_id, project_id=project_uuid)


@persona_admin_router.get(
    "/moodboard-tiles/{tile_id}/image",
    summary="Serve moodboard tile image bytes (admin)",
)
def get_moodboard_tile_image_admin(tile_id: str, session: Session = Depends(get_db)) -> StreamingResponse:
    try:
        tile_uuid = UUID(tile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid tile id") from exc
    tile = session.get(PersonaMoodboardTile, tile_uuid)
    if not tile:
        raise HTTPException(status_code=404, detail="Tile not found")
    mb = session.get(PersonaMoodboard, tile.moodboard_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    _get_persona_or_404(session, str(mb.persona_id))

    if isinstance(tile.image_url, str) and tile.image_url.startswith(("http://", "https://")):
        return RedirectResponse(tile.image_url)

    fp, content_type = storage.stream(key=tile.image_url)
    return StreamingResponse(fp, media_type=content_type)


@persona_admin_router.delete(
    "/moodboard-tiles/{tile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete moodboard tile (admin)",
)
def delete_moodboard_tile_admin(tile_id: str, session: Session = Depends(get_db)) -> None:
    try:
        tile_uuid = UUID(tile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid tile id") from exc
    tile = session.get(PersonaMoodboardTile, tile_uuid)
    if not tile:
        raise HTTPException(status_code=404, detail="Tile not found")
    mb = session.get(PersonaMoodboard, tile.moodboard_id)
    if not mb:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    _get_persona_or_404(session, str(mb.persona_id))
    session.execute(delete(PersonaMoodboardTile).where(PersonaMoodboardTile.id == tile_uuid))
    session.commit()


@persona_admin_router.get(
    "/{persona_id}/ux-journey-runs",
    response_model=list[PersonaUxJourneyRunItem],
    summary="List UX-journey agent runs recorded for this persona (admin)",
)
def list_persona_ux_journey_runs_admin(
    persona_id: str,
    session: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
) -> list[PersonaUxJourneyRunItem]:
    persona = _get_persona_or_404(session, persona_id)
    rows = (
        session.scalars(
            select(PersonaUxJourneyRun)
            .where(PersonaUxJourneyRun.persona_id == persona.id)
            .order_by(PersonaUxJourneyRun.created_at.desc())
            .limit(limit)
        )
        .all()
    )
    return [_serialize_persona_ux_journey_run(r) for r in rows]


@persona_admin_router.post(
    "/{persona_id}/ux-journey-runs",
    response_model=PersonaUxJourneyRunItem,
    summary="Upsert a UX-journey agent run for this persona (admin)",
)
def upsert_persona_ux_journey_run_admin(
    persona_id: str,
    body: PersonaUxJourneyRunUpsert,
    session: Session = Depends(get_db),
) -> PersonaUxJourneyRunItem:
    persona = _get_persona_or_404(session, persona_id)
    job_id = body.jobId.strip()
    if not job_id:
        raise HTTPException(status_code=400, detail="jobId is required")

    existing = session.scalar(
        select(PersonaUxJourneyRun).where(
            PersonaUxJourneyRun.persona_id == persona.id,
            PersonaUxJourneyRun.job_id == job_id,
        )
    )
    score_payload = body.scorecard if isinstance(body.scorecard, dict) else None

    if existing:
        if body.task is not None:
            existing.task = body.task
        if body.siteUrl is not None:
            existing.site_url = body.siteUrl
        if body.success is not None:
            existing.success = body.success
        if body.stepsCount is not None:
            existing.steps_count = body.stepsCount
        if score_payload is not None:
            existing.scorecard = score_payload
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _serialize_persona_ux_journey_run(existing)

    row = PersonaUxJourneyRun(
        id=uuid4(),
        persona_id=persona.id,
        job_id=job_id,
        task=body.task,
        site_url=body.siteUrl,
        success=body.success,
        steps_count=body.stepsCount,
        scorecard=score_payload,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _serialize_persona_ux_journey_run(row)
