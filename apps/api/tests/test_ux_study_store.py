"""UX study store CRUD tests."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_ux_study_store.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-ux-study-store")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("S3_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("S3_ACCESS_KEY", "test")
os.environ.setdefault("S3_SECRET_KEY", "test")
os.environ.setdefault("S3_BUCKET", "test-bucket")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("CLAUDE_API_KEY", "test-key")
os.environ.setdefault("PERSONA_CONSOLE_BASE_URL", "http://localhost:3000")
os.environ.setdefault("PERSONA_MEDIA_BASE_PATH", "/personas")
os.environ.setdefault("PERSONA_CACHE_TTL_SECONDS", "30")
os.environ.setdefault("PERSONA_BACKEND_PUBLIC_URL", "http://localhost:8000")

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.ux_study_schemas import UxStudyCreate, UxWaveCreate, UxWaveRunItemIn
from app.services import ux_study_store as store


def build_session():
    engine = create_engine(
        "sqlite:///:memory:",
        execution_options={"schema_translate_map": {"audion": None}},
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_conn, _):  # noqa: ANN001
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_store_create_evaluate_compare_self_zero():
    session = build_session()
    study = store.create_study(
        session,
        UxStudyCreate(
            name="EBM Tool",
            status="active",
            target_url_key="bosch.ebike.produktkombinationen",
        ),
    )
    wave = store.create_wave(
        session,
        study.id,
        UxWaveCreate(
            wave_key="audion-2026-07-30-mcp",
            status="complete",
            runs=[
                UxWaveRunItemIn(
                    run_key="B-aufgabe1-nachruesten",
                    url="https://www.bosch-ebike.com/de/service/produktkombinationen",
                    task="Aufgabe 1",
                    segment="owner_upgrade",
                    valid_evidence=True,
                    task_completed=True,
                    goal_reached=True,
                    friction_score=9,
                    persona_fit_score=2,
                ),
                UxWaveRunItemIn(
                    run_key="Nav-home-to-tool",
                    url="https://www.bosch-ebike.com/de/",
                    task="Navigation H3",
                    segment="owner_upgrade",
                    leitfaden_block="4 Navigation",
                ),
            ],
        ),
    )
    assert wave is not None
    assert any(r.run_key == "Nav-home-to-tool" for r in wave.runs)
    evaluated = store.evaluate_wave(session, study.id, wave.id)
    assert evaluated is not None
    assert evaluated.evaluation["aggregate"]["runsValidEvidence"] == 1
    delta = store.compare_waves(session, study.id, wave.id, wave.id)
    assert delta["aggregateDelta"]["validEvidenceRate"]["delta"] == 0
