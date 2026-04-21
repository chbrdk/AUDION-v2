from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID, uuid4

import httpx
import time
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db, get_session
from ..models import (
    Journey,
    JourneyPhase,
    Project,
    ProjectMember,
    ProjectMemberStatus,
    ProjectRole,
    TargetGroup,
    User,
    ProjectResearchRun,
    ProjectResearchRunStatus,
    ProjectResearchSource,
    ProjectResearchSummary,
    ProjectResearchEvent,
)
from ..schemas import (
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectEasySetupPersonaSummary,
    ProjectEasySetupRequest,
    ProjectEasySetupResponse,
    ProjectEasySetupTargetGroupSummary,
    ProjectListResponse,
    ProjectMemberAddRequest,
    ProjectMemberResponse,
    ProjectGenerateJourneyRequest,
    ProjectResponse,
    ProjectUpdateRequest,
    SuggestTargetGroupsRequest,
    SuggestTargetGroupsResponse,
    TargetGroupCreateRequest,
    TargetGroupSuggestionItem,
    ProjectResearchLatestResponse,
    ProjectResearchRunStatusResponse,
    ProjectResearchStartRequest,
    CheckionSiteTopicsResponse,
    CheckionSiteTopicItem,
)
from ..schemas.journey import JourneyResponse
from ..services.ai_assist import seed_default_templates_for_project
from ..services.auth import get_current_user
from ..services.journey_generation import JourneyGenerationService
from ..services.journey_serializer import to_journey_response
from ..services.easy_setup_url import fetch_website_plain_text, normalize_public_http_url
from ..services.persona_bootstrap import generate_persona_for_target_group
from ..services.suggest_target_groups import suggest_target_groups as run_suggest_target_groups
from ..services.resource_bilingual_utils import normalize_publication_status, validate_project_bilingual_publish
from ..services.target_group_store import TargetGroupService
from ..services.usage_report import report_usage
from ..services.checkion_project_context import (
    build_optional_checkion_topics_prompt_block,
    fetch_checkion_site_topics_bundle,
)
from ..services.project_research_prompt import (
    build_optional_project_research_json_context,
    get_latest_project_research_summary_en,
)
from ..services.target_group_relevance import deterministic_target_group_relevance
from ..services.ai_suggestion_cache import (
    SUGGESTION_CACHE_PROMPT_VERSION,
    SUGGEST_TARGET_GROUPS_KIND,
    get_cache_entry,
    stable_context_hash,
    upsert_cache_entry,
)
from ..celery_app import celery_app

router = APIRouter(prefix="/projects", tags=["projects"])


def _user_id_for_usage(current_user: User | None) -> str | None:
    if not current_user:
        return None
    return getattr(current_user, "plexon_user_id", None) or str(current_user.id)


def _get_project(session: Session, project_id: str) -> Project:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id") from exc
    project = session.get(Project, project_uuid)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_membership(session: Session, *, project_id: UUID, user_id: UUID) -> ProjectMember | None:
    return session.scalar(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .where(ProjectMember.user_id == user_id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
    )


def _require_member(session: Session, *, project_id: UUID, user_id: UUID) -> ProjectMember:
    membership = _get_membership(session, project_id=project_id, user_id=user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")
    return membership


def _require_admin_or_owner(membership: ProjectMember) -> None:
    if membership.role not in {ProjectRole.owner, ProjectRole.admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def _project_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        name_de=getattr(project, "name_de", None),
        owner_user_id=str(project.owner_user_id),
        description=project.description,
        description_de=getattr(project, "description_de", None),
        company_context=project.company_context,
        company_context_de=getattr(project, "company_context_de", None),
        status=getattr(project, "status", None) or "draft",
        checkion_project_id=getattr(project, "checkion_project_id", None),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _member_response(member: ProjectMember, user: User) -> ProjectMemberResponse:
    return ProjectMemberResponse(
        id=str(member.id),
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        role=member.role.value,
        status=member.status.value,
        created_at=member.created_at,
    )


@router.get("", response_model=ProjectListResponse)
def list_projects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectListResponse:
    projects = session.scalars(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
        .order_by(Project.created_at.desc())
    ).all()
    items = [_project_response(project) for project in projects]
    return ProjectListResponse(items=items, total=len(items))


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectResponse:
    try:
        publication_status = normalize_publication_status(getattr(payload, "status", None))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    project = Project(
        id=uuid4(),
        name=payload.name.strip(),
        name_de=(payload.name_de.strip() if payload.name_de else None) or None,
        owner_user_id=current_user.id,
        status=publication_status,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(project)
    try:
        session.flush()
        validate_project_bilingual_publish(project=project)
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    membership = ProjectMember(
        id=uuid4(),
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.owner,
        status=ProjectMemberStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(membership)
    session.flush()

    seed_default_templates_for_project(session, str(project.id))
    session.commit()

    return _project_response(project)


@router.post(
    "/bootstrap",
    response_model=ProjectEasySetupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Easy setup: project, first target group, and persona",
    description=(
        "Creates a project with description and company context from the customer brief, "
        "optionally merges plain text from a public website, suggests a first target group via AI, "
        "creates it, and generates the first persona for that group."
    ),
)
def project_easy_setup(
    payload: ProjectEasySetupRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectEasySetupResponse:
    website_excerpt_included = False
    website_appendix = ""
    if payload.website_url and payload.website_url.strip():
        normalized, url_err = normalize_public_http_url(payload.website_url.strip())
        if url_err:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=url_err)
        if normalized:
            excerpt, _fetch_err = fetch_website_plain_text(normalized)
            if excerpt:
                website_appendix = f"\n\n---\nSource (public page text): {normalized}\n{excerpt}"
                website_excerpt_included = True

    customer = payload.customer_name.strip()
    about = payload.about.strip()
    project_name = (payload.project_name.strip() if payload.project_name else customer) or customer
    if not project_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project name is required.")

    description = f"Customer / brand: {customer}\n\n{about}".strip()
    company_context = f"{about}{website_appendix}".strip()

    project = Project(
        id=uuid4(),
        name=project_name,
        owner_user_id=current_user.id,
        description=description,
        company_context=company_context,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(project)
    session.flush()

    membership = ProjectMember(
        id=uuid4(),
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.owner,
        status=ProjectMemberStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(membership)
    session.flush()

    seed_default_templates_for_project(session, str(project.id))
    session.commit()
    session.refresh(project)

    context_parts = [description]
    if company_context:
        context_parts.append(company_context)
    context_text = "\n\n".join(context_parts)

    try:
        suggestions, usage_raw = run_suggest_target_groups(
            context_text=context_text,
            max_suggestions=3,
            output_locale=payload.output_locale,
            bilingual=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    uid = _user_id_for_usage(current_user)
    if uid and usage_raw:
        report_usage(user_id=uid, event_type="llm_request", raw_units=usage_raw)

    if not suggestions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI did not return target group suggestions. Add more context or check OpenAI configuration.",
        )

    first = suggestions[0]
    tg_service = TargetGroupService()
    try:
        tg_response = tg_service.create_target_group(
            session,
            TargetGroupCreateRequest(
                project_id=str(project.id),
                name=first.name,
                segment=first.segment,
                description=first.description,
                name_de=first.name_de or None,
                segment_de=first.segment_de or None,
                description_de=first.description_de or None,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tg = session.get(TargetGroup, UUID(tg_response.id))
    if not tg:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Target group was created but could not be loaded.",
        )

    try:
        persona_response = generate_persona_for_target_group(
            session,
            target_group=tg,
            segment=first.segment,
            description=first.description,
            output_locale=None,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Persona generation failed: {exc}",
        ) from exc

    if uid:
        report_usage(
            user_id=uid,
            event_type="persona_generate",
            raw_units={"runs": 1},
            idempotency_key=f"persona_generate:{persona_response.metadata.personaId}",
        )

    session.refresh(project)
    return ProjectEasySetupResponse(
        project=_project_response(project),
        target_group=ProjectEasySetupTargetGroupSummary(
            id=tg_response.id,
            name=tg_response.name,
            segment=tg_response.segment,
        ),
        persona=ProjectEasySetupPersonaSummary(
            id=persona_response.metadata.personaId,
            name=persona_response.profile.name,
            segment=persona_response.profile.segment,
        ),
        website_excerpt_included=website_excerpt_included,
    )


@router.get(
    "/{project_id}/integrations/checkion/site-topics",
    response_model=CheckionSiteTopicsResponse,
    summary="CHECKION Deep Scan site topics",
    description="Aggregates pageClassification tags from the latest slim-pages scan (linked CHECKION project or hostname fallback). Optional query seed_url overrides seed resolution.",
)
def get_checkion_site_topics(
    project_id: str,
    seed_url: str | None = Query(None, description="Optional seed URL for by-domain fallback when no CHECKION link."),
    max_pages: int = Query(400, ge=1, le=2000, description="Max slim-pages to scan for aggregation."),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> CheckionSiteTopicsResponse:
    project = _get_project(session, project_id)
    _require_member(session, project_id=project.id, user_id=current_user.id)
    bundle = fetch_checkion_site_topics_bundle(
        session=session,
        project=project,
        explicit_seed_url=seed_url,
        max_pages=max_pages,
    )
    raw_topics = bundle.get("topics") or []
    topics: list[CheckionSiteTopicItem] = []
    for t in raw_topics:
        if isinstance(t, dict) and t.get("tag"):
            topics.append(CheckionSiteTopicItem.model_validate(t))
    return CheckionSiteTopicsResponse(
        scan_id=bundle.get("scan_id"),
        source=bundle.get("source"),
        topics=topics,
        pages_processed=int(bundle.get("pages_processed") or 0),
        truncated=bool(bundle.get("truncated")),
        seed_url_used=bundle.get("seed_url_used"),
        unavailable_reason=bundle.get("unavailable_reason"),
    )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectDetailResponse:
    project = _get_project(session, project_id)
    _require_member(session, project_id=project.id, user_id=current_user.id)

    members = session.scalars(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.created_at.asc())
    ).all()
    users = {
        user.id: user
        for user in session.scalars(select(User).where(User.id.in_([m.user_id for m in members]))).all()
    }
    member_responses = [
        _member_response(member, users[member.user_id])
        for member in members
        if member.user_id in users
    ]

    return ProjectDetailResponse(**_project_response(project).model_dump(), members=member_responses)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectResponse:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    if payload.status is not None:
        try:
            project.status = normalize_publication_status(payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.name_de is not None:
        project.name_de = payload.name_de.strip() or None
    if payload.description is not None:
        project.description = payload.description
    if payload.description_de is not None:
        project.description_de = payload.description_de.strip() or None
    if payload.company_context is not None:
        project.company_context = payload.company_context
    if payload.company_context_de is not None:
        project.company_context_de = payload.company_context_de.strip() or None
    if payload.checkion_project_id is not None:
        raw_chk = str(payload.checkion_project_id).strip()
        project.checkion_project_id = raw_chk if raw_chk else None
    project.updated_at = datetime.utcnow()
    try:
        validate_project_bilingual_publish(project=project)
        session.commit()
        session.refresh(project)
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _project_response(project)


@router.post(
    "/{project_id}/suggest-target-groups",
    response_model=SuggestTargetGroupsResponse,
    summary="Suggest target groups from company context",
    description="Uses AI to suggest target groups (name, segment, description) from the project's description and company_context. Save company context first via PATCH /projects/{id}.",
)
def suggest_target_groups_endpoint(
    project_id: str,
    body: SuggestTargetGroupsRequest | None = Body(None),
    force_refresh: bool = Query(False, description="Bypass cached suggestions and re-generate."),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> SuggestTargetGroupsResponse:
    project = _get_project(session, project_id)
    _require_member(session, project_id=project.id, user_id=current_user.id)
    membership = _get_membership(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    parts = []
    if project.description and project.description.strip():
        parts.append(project.description.strip())
    if project.company_context and project.company_context.strip():
        parts.append(project.company_context.strip())

    inc_res = True if body is None else bool(body.include_project_research)
    research_summary_en = None
    research_summary_id = None
    if inc_res:
        research_summary_en = get_latest_project_research_summary_en(session, project=project)
        research_block = build_optional_project_research_json_context(session, project=project)
        if research_block:
            parts.append(research_block)
    inc_chk = True if body is None else bool(body.include_checkion_topics)
    checkion_bundle = None
    if inc_chk:
        checkion_bundle = fetch_checkion_site_topics_bundle(session=session, project=project, explicit_seed_url=None)
        chk_block = build_optional_checkion_topics_prompt_block(session, project=project, explicit_seed_url=None)
        if chk_block:
            parts.append(chk_block)
    context_text = "\n\n".join(parts) if parts else ""

    max_suggestions = min(max(1, (body.max_suggestions if body else 5)), 10)

    if not context_text.strip():
        return SuggestTargetGroupsResponse(suggestions=[])

    # Cache: stable key from effective inputs (not the full context_text).
    bilingual = bool(body and body.bilingual)
    output_locale = None if bilingual else (body.output_locale if body else None)
    checkion_scan_id = (checkion_bundle or {}).get("scan_id") if isinstance(checkion_bundle, dict) else None
    checkion_topics = (checkion_bundle or {}).get("topics") if isinstance(checkion_bundle, dict) else None
    ctx_payload = {
        "kind": SUGGEST_TARGET_GROUPS_KIND,
        "prompt_version": SUGGESTION_CACHE_PROMPT_VERSION,
        "project": {
            "id": str(project.id),
            "description": (project.description or "").strip(),
            "company_context": (project.company_context or "").strip(),
            "checkion_project_id": (getattr(project, "checkion_project_id", None) or "").strip() or None,
        },
        "include_project_research": inc_res,
        "include_checkion_topics": inc_chk,
        "research": {
            "has_summary": bool(isinstance(research_summary_en, dict) and research_summary_en),
            # Hash the summary to avoid storing the full blob in the key.
            "summary_hash": stable_context_hash(research_summary_en) if isinstance(research_summary_en, dict) else None,
        },
        "checkion": {
            "scan_id": checkion_scan_id,
            "topics_hash": stable_context_hash({"topics": checkion_topics}) if isinstance(checkion_topics, list) else None,
        },
        "request": {
            "max_suggestions": max_suggestions,
            "bilingual": bilingual,
            "output_locale": output_locale,
        },
    }
    ctx_hash = stable_context_hash(ctx_payload)
    if not force_refresh:
        cached = get_cache_entry(session, project_id=str(project.id), kind=SUGGEST_TARGET_GROUPS_KIND, context_hash=ctx_hash)
        if cached and isinstance(cached.response_payload, dict) and isinstance(cached.response_payload.get("suggestions"), list):
            try:
                return SuggestTargetGroupsResponse.model_validate(cached.response_payload)
            except Exception:
                pass

    try:
        suggestions, usage_raw = run_suggest_target_groups(
            context_text=context_text,
            max_suggestions=max_suggestions,
            output_locale=output_locale,
            bilingual=bilingual,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    uid = _user_id_for_usage(current_user)
    if uid and usage_raw:
        report_usage(user_id=uid, event_type="llm_request", raw_units=usage_raw)

    items: list[TargetGroupSuggestionItem] = []
    for s in suggestions:
        det_score, det_signals = deterministic_target_group_relevance(
            name=s.name,
            segment=s.segment,
            description=s.description,
            checkion_topics=checkion_topics,
            research_summary_en=research_summary_en if isinstance(research_summary_en, dict) else None,
        )
        items.append(
            TargetGroupSuggestionItem(
                name=s.name,
                segment=s.segment,
                description=s.description,
                name_de=s.name_de or None,
                segment_de=s.segment_de or None,
                description_de=s.description_de or None,
                relevance_score=getattr(s, "relevance_score", None),
                relevance_reason=(getattr(s, "relevance_reason", "") or "").strip() or None,
                relevance_score_deterministic=det_score,
                relevance_signals=det_signals[:8],
            )
        )
    items.sort(key=lambda x: (x.relevance_score_deterministic or 0, x.relevance_score or 0), reverse=True)
    out = SuggestTargetGroupsResponse(suggestions=items)

    # Store cache entry (best-effort; failures should not fail the request).
    try:
        upsert_cache_entry(
            session,
            project=project,
            kind=SUGGEST_TARGET_GROUPS_KIND,
            context_hash=ctx_hash,
            request_payload=ctx_payload,
            response_payload=out.model_dump(),
            meta={
                "model": (get_settings().ai_openai_model or "gpt-5.4-mini"),
                "usage_raw": usage_raw,
            },
        )
    except Exception:
        session.rollback()
    return out


@router.post(
    "/{project_id}/research/start",
    response_model=ProjectResearchRunStatusResponse,
    summary="Start Project AI Research",
    description="Creates a project research run and enqueues a Celery task to crawl + synthesize a bilingual research summary.",
)
def start_project_research(
    project_id: str,
    body: ProjectResearchStartRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectResearchRunStatusResponse:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    seed_url, err = normalize_public_http_url(body.seed_url)
    if err or not seed_url:
        raise HTTPException(status_code=400, detail=err or "Invalid seed_url")

    crawl_limits: dict[str, int] = {}
    if body.max_pages is not None:
        crawl_limits["max_pages"] = body.max_pages
    if body.max_depth is not None:
        crawl_limits["max_depth"] = body.max_depth

    run = ProjectResearchRun(
        project_id=project.id,
        requested_by_user_id=current_user.id,
        status=ProjectResearchRunStatus.queued,
        seed_url=seed_url,
        crawl_limits=crawl_limits or None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    # Emit durable event immediately (this is the true "queued" moment).
    has_seq = False
    try:
        has_seq = bool(
            session.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'audion'
                      AND table_name = 'project_research_events'
                      AND column_name = 'seq'
                    LIMIT 1
                    """
                )
            ).scalar()
        )
    except Exception:
        has_seq = False

    if has_seq:
        next_seq = session.scalar(
            select(func.coalesce(func.max(ProjectResearchEvent.seq), 0)).where(ProjectResearchEvent.run_id == run.id)
        )
        session.add(
            ProjectResearchEvent(
                run_id=run.id,
                seq=int(next_seq or 0) + 1,
                event_type="run_queued",
                message="Run created; waiting for worker to start.",
                payload={"seed_url": seed_url},
                created_at=datetime.utcnow(),
            )
        )
        session.commit()
    else:
        # Legacy DBs that were stamped but not migrated yet (no `seq` column).
        session.execute(
            text(
                """
                INSERT INTO audion.project_research_events
                  (id, run_id, event_type, message, payload, created_at)
                VALUES
                  (:id, :run_id, :event_type, :message, CAST(:payload AS jsonb), :created_at)
                """
            ),
            {
                "id": str(uuid4()),
                "run_id": str(run.id),
                "event_type": "run_queued",
                "message": "Run created; waiting for worker to start.",
                "payload": json.dumps({"seed_url": seed_url}, ensure_ascii=False),
                "created_at": datetime.utcnow(),
            },
        )
        session.commit()

    result = celery_app.send_task(
        "project.research.run",
        kwargs={"run_id": str(run.id)},
        queue="research",
        routing_key="research",
    )
    # Store celery task id in meta? (Not modeled yet) -> keep out for now.
    _ = result

    return ProjectResearchRunStatusResponse(
        run_id=str(run.id),
        status=run.status.value if hasattr(run.status, "value") else str(run.status),
        pages_fetched=0,
        pages_total_cap=(crawl_limits.get("max_pages") if crawl_limits else None),
        started_at=run.started_at.isoformat() if run.started_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
    )


@router.get(
    "/{project_id}/research/status",
    response_model=ProjectResearchRunStatusResponse,
    summary="Get Project AI Research status",
)
def get_project_research_status(
    project_id: str,
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectResearchRunStatusResponse:
    project = _get_project(session, project_id)
    _require_member(session, project_id=project.id, user_id=current_user.id)
    membership = _get_membership(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    try:
        rid = UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run_id") from None

    run = session.get(ProjectResearchRun, rid)
    if not run or run.project_id != project.id:
        raise HTTPException(status_code=404, detail="Research run not found")

    pages_fetched = session.scalar(
        select(func.count(ProjectResearchSource.id)).where(ProjectResearchSource.run_id == run.id)
    )

    limits = run.crawl_limits if isinstance(run.crawl_limits, dict) else {}
    cap = limits.get("max_pages") if isinstance(limits.get("max_pages"), int) else None

    return ProjectResearchRunStatusResponse(
        run_id=str(run.id),
        status=run.status.value if hasattr(run.status, "value") else str(run.status),
        error=run.error,
        pages_fetched=int(pages_fetched or 0),
        pages_total_cap=cap,
        started_at=run.started_at.isoformat() if run.started_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
    )


@router.get(
    "/{project_id}/research/latest",
    response_model=ProjectResearchLatestResponse,
    summary="Get latest Project AI Research summary",
)
def get_latest_project_research(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectResearchLatestResponse:
    project = _get_project(session, project_id)
    _require_member(session, project_id=project.id, user_id=current_user.id)
    membership = _get_membership(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    run = (
        session.query(ProjectResearchRun)
        .where(ProjectResearchRun.project_id == project.id)
        .order_by(ProjectResearchRun.created_at.desc())
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="No research run found")

    summary = (
        session.query(ProjectResearchSummary)
        .where(ProjectResearchSummary.run_id == run.id)
        .order_by(ProjectResearchSummary.created_at.desc())
        .first()
    )
    if not summary:
        raise HTTPException(status_code=404, detail="No research summary found")

    return ProjectResearchLatestResponse(
        run_id=str(run.id),
        status=run.status.value if hasattr(run.status, "value") else str(run.status),
        summary_en=summary.summary_en if isinstance(summary.summary_en, dict) else {},
        summary_de=summary.summary_de if isinstance(summary.summary_de, dict) else None,
        citations=summary.citations if isinstance(summary.citations, dict) else None,
        created_at=summary.created_at.isoformat() if getattr(summary, "created_at", None) else None,
    )


@router.get(
    "/{project_id}/research/stream",
    summary="Stream Project AI Research progress (SSE)",
    description="Server-Sent Events stream of durable research progress events for a run. Supports resume via `after` cursor.",
)
def stream_project_research_events(
    project_id: str,
    run_id: str,
    after: str | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    try:
        rid = UUID(run_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid run_id") from exc

    run = session.get(ProjectResearchRun, rid)
    if not run or run.project_id != project.id:
        raise HTTPException(status_code=404, detail="Research run not found")

    def _iter_sse():
        # Backward compatibility: some prod DBs may have `project_research_events` but no `seq` yet.
        has_seq = False
        try:
            with get_session() as s:
                has_seq = bool(
                    s.execute(
                        text(
                            """
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'audion'
                              AND table_name = 'project_research_events'
                              AND column_name = 'seq'
                            LIMIT 1
                            """
                        )
                    ).scalar()
                )
        except Exception:
            has_seq = False

        last_seq: int | None = None
        # Legacy (no seq column): resume cursor is (created_at, id) — ORM cannot be used because mapper includes `seq`.
        last_created_at: datetime | None = None
        last_event_id: UUID | None = None
        if after:
            # after can be a seq integer, an event UUID, or an ISO timestamp (created_at)
            if has_seq and after.isdigit():
                last_seq = int(after)
            else:
                try:
                    eid = UUID(after)
                    with get_session() as s:
                        if has_seq:
                            ev = s.get(ProjectResearchEvent, eid)
                            if ev and ev.run_id == run.id:
                                last_seq = ev.seq
                        else:
                            row = s.execute(
                                text(
                                    """
                                    SELECT created_at, id
                                    FROM audion.project_research_events
                                    WHERE id = :eid AND run_id = :rid
                                    LIMIT 1
                                    """
                                ),
                                {"eid": str(eid), "rid": str(run.id)},
                            ).first()
                            if row:
                                last_created_at, last_event_id = row[0], row[1]
                except Exception:
                    try:
                        dt = datetime.fromisoformat(after.replace("Z", "+00:00"))
                        with get_session() as s:
                            if has_seq:
                                ev = (
                                    s.query(ProjectResearchEvent)
                                    .where(ProjectResearchEvent.run_id == run.id)
                                    .where(ProjectResearchEvent.created_at <= dt)
                                    .order_by(
                                        ProjectResearchEvent.created_at.desc(),
                                        ProjectResearchEvent.seq.desc(),
                                    )
                                    .first()
                                )
                                if ev:
                                    last_seq = ev.seq
                            else:
                                row = s.execute(
                                    text(
                                        """
                                        SELECT created_at, id
                                        FROM audion.project_research_events
                                        WHERE run_id = :rid AND created_at <= :dt
                                        ORDER BY created_at DESC, id DESC
                                        LIMIT 1
                                        """
                                    ),
                                    {"rid": str(run.id), "dt": dt},
                                ).first()
                                if row:
                                    last_created_at, last_event_id = row[0], row[1]
                    except Exception:
                        if has_seq:
                            last_seq = None
                        else:
                            last_created_at = None
                            last_event_id = None

        ping_every_seconds = 15.0
        last_ping = time.monotonic()

        while True:
            # Use short-lived DB sessions for streaming to avoid long-held connections/transactions.
            events: list = []
            if has_seq:
                with get_session() as s:
                    q = s.query(ProjectResearchEvent).where(ProjectResearchEvent.run_id == run.id)
                    if last_seq is not None:
                        q = q.where(ProjectResearchEvent.seq > last_seq)
                    events = q.order_by(ProjectResearchEvent.seq.asc()).limit(200).all()
            else:
                with get_session() as s:
                    # NOTE: Avoid `%(lc)s IS NULL` with an untyped NULL bind — Postgres can't infer the parameter type.
                    if last_created_at is None or last_event_id is None:
                        rows = s.execute(
                            text(
                                """
                                SELECT id, event_type, message, payload, created_at
                                FROM audion.project_research_events
                                WHERE run_id = :rid
                                ORDER BY created_at ASC, id ASC
                                LIMIT 200
                                """
                            ),
                            {"rid": str(run.id)},
                        ).mappings().all()
                    else:
                        rows = s.execute(
                            text(
                                """
                                SELECT id, event_type, message, payload, created_at
                                FROM audion.project_research_events
                                WHERE run_id = :rid
                                  AND (
                                    created_at > :lc
                                    OR (created_at = :lc AND id > :lid)
                                  )
                                ORDER BY created_at ASC, id ASC
                                LIMIT 200
                                """
                            ),
                            {"rid": str(run.id), "lc": last_created_at, "lid": str(last_event_id)},
                        ).mappings().all()
                    events = list(rows)

            for ev in events:
                if has_seq:
                    created_at = ev.created_at.replace(tzinfo=None).isoformat() + "Z" if ev.created_at else None
                    data = {
                        "id": str(ev.id),
                        "seq": int(ev.seq) if getattr(ev, "seq", None) is not None else None,
                        "type": ev.event_type,
                        "message": ev.message,
                        "payload": ev.payload,
                        "created_at": created_at,
                    }
                    payload_str = json.dumps(data, ensure_ascii=False)
                    yield "event: progress\n"
                    yield f"data: {payload_str}\n\n"
                    if getattr(ev, "seq", None) is not None:
                        last_seq = int(ev.seq)
                else:
                    eid = ev["id"]
                    ca = ev["created_at"]
                    created_at = ca.replace(tzinfo=None).isoformat() + "Z" if ca else None
                    data = {
                        "id": str(eid),
                        "seq": None,
                        "type": ev["event_type"],
                        "message": ev["message"],
                        "payload": ev["payload"],
                        "created_at": created_at,
                    }
                    payload_str = json.dumps(data, ensure_ascii=False)
                    yield "event: progress\n"
                    yield f"data: {payload_str}\n\n"
                    last_created_at = ca
                    last_event_id = eid if isinstance(eid, UUID) else UUID(str(eid))

            # Stop conditions: run finished and no pending events since last_seq.
            if not events:
                with get_session() as s:
                    fresh_run = s.get(ProjectResearchRun, run.id)
                    if fresh_run and fresh_run.status in (
                        ProjectResearchRunStatus.succeeded,
                        ProjectResearchRunStatus.failed,
                    ):
                        yield "event: done\n"
                        yield "data: {}\n\n"
                        return

            now = time.monotonic()
            if now - last_ping >= ping_every_seconds:
                yield "event: ping\n"
                yield "data: {}\n\n"
                last_ping = now

            time.sleep(0.5)

    return StreamingResponse(
        _iter_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post(
    "/{project_id}/generate-journey",
    response_model=JourneyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate journey from project knowledge",
    description="Generates a full user journey from project description, company context, and optionally target group (personas + knowledge chunks). Returns the created journey with phases and elements.",
)
async def generate_journey_from_project_endpoint(
    project_id: str,
    body: ProjectGenerateJourneyRequest | None = Body(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> JourneyResponse:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    payload = body or ProjectGenerateJourneyRequest()
    target_group_id: UUID | None = None
    if payload.target_group_id and payload.target_group_id.strip():
        try:
            tg_uuid = UUID(payload.target_group_id.strip())
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target_group_id") from None
        tg = session.get(TargetGroup, tg_uuid)
        if not tg or tg.project_id != project.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target group not found or does not belong to this project")
        target_group_id = tg_uuid

    organization_id = project.id
    if payload.organization_id and payload.organization_id.strip():
        try:
            organization_id = UUID(payload.organization_id.strip())
        except ValueError:
            pass

    usage_uid = _user_id_for_usage(current_user)
    service = JourneyGenerationService()
    try:
        draft, ai_usage = await service.generate_journey_from_project(
            session=session,
            project_id=project.id,
            target_group_id=target_group_id,
            journey_type=payload.journey_type or "customer_journey",
            organization_id=organization_id,
            retrieval_usage_user_id=usage_uid,
            output_locale=payload.output_locale,
        )
    except ValueError as exc:
        if "project_not_found" in str(exc):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except (httpx.TimeoutException, TimeoutError) as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Journey generation timed out. Try again or reduce company context.",
        ) from exc
    except Exception as exc:
        err_msg = getattr(exc, "message", None) or str(exc)
        if "timed out" in err_msg.lower() or "timeout" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Journey generation timed out. Try again or reduce company context.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Journey generation failed. Please try again.",
        ) from exc

    created = service.save_journey_draft(
        draft=draft,
        target_group_id=target_group_id,
        organization_id=organization_id,
        project_id=project.id,
        created_by=getattr(current_user, "plexon_user_id", None) or str(current_user.id),
    )

    if usage_uid:
        inp = (ai_usage or {}).get("input_tokens") or (ai_usage or {}).get("prompt_tokens")
        out = (ai_usage or {}).get("output_tokens") or (ai_usage or {}).get("completion_tokens")
        if inp is not None or out is not None:
            report_usage(
                user_id=usage_uid,
                event_type="llm_request",
                raw_units={"input_tokens": inp, "output_tokens": out},
                idempotency_key=f"journey_from_project:{created.id}",
            )
        else:
            report_usage(
                user_id=usage_uid,
                event_type="journey_generate",
                raw_units={"runs": 1},
                idempotency_key=f"journey_from_project:{created.id}",
            )

    with get_session() as resp_session:
        journey = resp_session.get(
            Journey,
            created.id,
            options=[
                joinedload(Journey.phases).joinedload(JourneyPhase.elements),
                joinedload(Journey.phases).joinedload(JourneyPhase.expectations),
            ],
        )
        if not journey:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Journey created but could not be loaded")
        return to_journey_response(journey)


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: str,
    payload: ProjectMemberAddRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> ProjectMemberResponse:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    email = payload.email.strip().lower()
    user = session.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    role_value = payload.role or ProjectRole.member.value
    try:
        role = ProjectRole(role_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role") from exc

    existing = session.scalar(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .where(ProjectMember.user_id == user.id)
    )
    if existing:
        existing.role = role
        existing.status = ProjectMemberStatus.active
        existing.updated_at = datetime.utcnow()
        session.commit()
        return _member_response(existing, user)

    new_member = ProjectMember(
        id=uuid4(),
        project_id=project.id,
        user_id=user.id,
        role=role,
        status=ProjectMemberStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(new_member)
    session.commit()
    return _member_response(new_member, user)


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> None:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    try:
        member_uuid = UUID(member_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member id") from exc

    member = session.get(ProjectMember, member_uuid)
    if not member or member.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role == ProjectRole.owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner cannot be removed")

    session.delete(member)
    session.commit()
