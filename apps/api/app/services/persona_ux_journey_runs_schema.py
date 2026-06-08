"""Self-heal persona_ux_journey_runs when Alembic migrations are behind."""

from __future__ import annotations

import structlog
from sqlalchemy.orm import Session

logger = structlog.get_logger(__name__)

PERSONA_UX_JOURNEY_RUNS_DDL = """
CREATE TABLE IF NOT EXISTS audion.persona_ux_journey_runs (
    id UUID PRIMARY KEY,
    persona_id UUID NOT NULL REFERENCES audion.personas(id) ON DELETE CASCADE,
    job_id VARCHAR(80) NOT NULL,
    task TEXT,
    site_url TEXT,
    success BOOLEAN,
    steps_count INTEGER,
    scorecard JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_persona_ux_journey_runs_persona_job UNIQUE (persona_id, job_id)
);
CREATE INDEX IF NOT EXISTS ix_persona_ux_journey_runs_persona_id
    ON audion.persona_ux_journey_runs (persona_id);
ALTER TABLE audion.persona_ux_journey_runs
    ADD COLUMN IF NOT EXISTS derived_journey_id UUID;
CREATE INDEX IF NOT EXISTS ix_persona_ux_journey_runs_derived_journey_id
    ON audion.persona_ux_journey_runs (derived_journey_id);
"""


def is_missing_persona_ux_journey_runs_error(exc: Exception) -> bool:
    """Detect Postgres missing table/column for UX-journey timeline."""
    parts = [str(exc)]
    orig = getattr(exc, "orig", None)
    if orig is not None:
        parts.append(str(orig))
    msg = " ".join(parts).lower()
    if "persona_ux_journey_runs" not in msg:
        return False
    return (
        "does not exist" in msg
        or "undefinedtable" in msg
        or "undefined column" in msg
        or "no such table" in msg
    )


def ensure_persona_ux_journey_runs_table(session: Session) -> bool:
    """Idempotent DDL for legacy DBs. Returns True when DDL ran without raising."""
    bind = session.get_bind()
    if bind is None:
        return False
    try:
        from sqlalchemy import text

        with bind.begin() as conn:
            for stmt in PERSONA_UX_JOURNEY_RUNS_DDL.strip().split(";"):
                cleaned = stmt.strip()
                if cleaned:
                    conn.execute(text(cleaned))
        logger.warning(
            "persona_ux_journey_runs.self_healed",
            hint="Run alembic upgrade head to keep migrations in sync.",
        )
        return True
    except Exception:
        logger.exception("persona_ux_journey_runs.self_heal_ddl.failed")
        return False
