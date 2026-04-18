from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db, get_session
from ..models import Journey, JourneyPhase, Project, ProjectMember, ProjectMemberStatus, ProjectRole, TargetGroup, User
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
        suggestions, usage_raw = run_suggest_target_groups(context_text=context_text, max_suggestions=3)
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
    context_text = "\n\n".join(parts) if parts else ""

    max_suggestions = min(max(1, (body.max_suggestions if body else 5)), 10)

    if not context_text.strip():
        return SuggestTargetGroupsResponse(suggestions=[])

    try:
        suggestions, usage_raw = run_suggest_target_groups(
            context_text=context_text,
            max_suggestions=max_suggestions,
            output_locale=body.output_locale if body else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    uid = _user_id_for_usage(current_user)
    if uid and usage_raw:
        report_usage(user_id=uid, event_type="llm_request", raw_units=usage_raw)

    return SuggestTargetGroupsResponse(
        suggestions=[TargetGroupSuggestionItem(name=s.name, segment=s.segment, description=s.description) for s in suggestions],
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
