"""FastAPI router: /ux-studies"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import User
from ..ux_study_schemas import (
    UxStudyCreate,
    UxStudyDetailOut,
    UxStudyListOut,
    UxStudyPatch,
    UxWaveCreate,
    UxWaveDetailOut,
)
from ..services.auth import get_current_user
from ..services import ux_study_store as store
from ..services.ux_study_orchestrate import start_wave_runs, sync_wave_run_statuses

router = APIRouter(prefix="/ux-studies", tags=["ux-studies"])


def get_db(current_user: User = Depends(get_current_user)):
    with get_session() as session:
        session.info["current_user_id"] = current_user.id
        yield session


@router.get("", response_model=UxStudyListOut)
def list_ux_studies(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    project_id: UUID | None = None,
    session: Session = Depends(get_db),
):
    return store.list_studies(session, page=page, page_size=page_size, project_id=project_id)


@router.post("", response_model=UxStudyDetailOut, status_code=201)
def create_ux_study(payload: UxStudyCreate, session: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    return store.create_study(session, payload)


@router.get("/{study_id}", response_model=UxStudyDetailOut)
def get_ux_study(study_id: UUID, session: Session = Depends(get_db)):
    study = store.get_study(session, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    return store._study_detail(study)


@router.patch("/{study_id}", response_model=UxStudyDetailOut)
def patch_ux_study(study_id: UUID, payload: UxStudyPatch, session: Session = Depends(get_db)):
    updated = store.patch_study(session, study_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Study not found")
    return updated


@router.post("/{study_id}/waves", response_model=UxWaveDetailOut, status_code=201)
def create_ux_wave(study_id: UUID, payload: UxWaveCreate, session: Session = Depends(get_db)):
    if not payload.wave_key.strip():
        raise HTTPException(status_code=400, detail="wave_key is required")
    wave = store.create_wave(session, study_id, payload)
    if not wave:
        raise HTTPException(status_code=404, detail="Study not found")
    return wave


@router.get("/{study_id}/waves/{wave_id}", response_model=UxWaveDetailOut)
def get_ux_wave(study_id: UUID, wave_id: UUID, session: Session = Depends(get_db)):
    wave = store.get_wave(session, study_id, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    return wave


@router.post("/{study_id}/waves/{wave_id}/evaluate", response_model=UxWaveDetailOut)
def evaluate_ux_wave(study_id: UUID, wave_id: UUID, session: Session = Depends(get_db)):
    wave = store.evaluate_wave(session, study_id, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    return wave


@router.get("/{study_id}/waves/{wave_id}/compare/{other_wave_id}")
def compare_ux_waves(
    study_id: UUID,
    wave_id: UUID,
    other_wave_id: UUID,
    session: Session = Depends(get_db),
):
    delta = store.compare_waves(session, study_id, wave_id, other_wave_id)
    if not delta:
        raise HTTPException(status_code=404, detail="Wave not found")
    return delta


@router.post("/{study_id}/waves/{wave_id}/start")
async def start_ux_wave(
    study_id: UUID,
    wave_id: UUID,
    sequential: bool = Query(True),
    session: Session = Depends(get_db),
):
    result = await start_wave_runs(session, study_id, wave_id, sequential=sequential)
    if result.get("error") == "wave_not_found":
        raise HTTPException(status_code=404, detail="Wave not found")
    return result


@router.post("/{study_id}/waves/{wave_id}/sync")
async def sync_ux_wave(study_id: UUID, wave_id: UUID, session: Session = Depends(get_db)):
    result = await sync_wave_run_statuses(session, study_id, wave_id)
    if result.get("error") == "wave_not_found":
        raise HTTPException(status_code=404, detail="Wave not found")
    return result
