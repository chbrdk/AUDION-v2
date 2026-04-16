from __future__ import annotations

from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base, Persona, PersonaMoodboard
from app.services.moodboard_service import MoodboardService
from app.services.openverse_client import OpenverseClient, OpenverseImage


def build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


class StubOpenverse(OpenverseClient):
    def __init__(self) -> None:
        pass

    def search_images(self, *, q: str, page_size: int = 20, license_type: str | None = None, mature: bool = False):
        # Return deterministic results keyed by q.
        base = q.replace(" ", "_")[:30]
        return [
            OpenverseImage(
                image_url=f"https://img.example/{base}/{i}.jpg",
                thumb_url=f"https://thumb.example/{base}/{i}.jpg",
                source_url=f"https://source.example/{base}/{i}",
                author="Author",
                license="by",
                attribution_text="Author · BY · https://source.example",
            )
            for i in range(page_size)
        ]


class StubOpenverseEmpty(OpenverseClient):
    def __init__(self) -> None:
        pass

    def search_images(self, *, q: str, page_size: int = 20, license_type: str | None = None, mature: bool = False):
        return []


def test_build_moodboard_creates_tiles_and_sets_ready() -> None:
    session = build_session()
    persona_id = uuid4()
    project_id = uuid4()
    persona = Persona(
        id=persona_id,
        project_id=project_id,
        name="P",
        segment="Segment",
        headline="Headline",
        profile={"interests": ["coffee", "cycling"], "values": ["clarity"]},
        confidence=0.9,
        version="1.0.0",
    )
    session.add(persona)
    session.commit()

    mb = PersonaMoodboard(persona_id=persona_id, project_id=project_id, title="Moodboard", active=True)
    session.add(mb)
    session.commit()
    session.refresh(mb)

    service = MoodboardService(openverse=StubOpenverse())
    service.build_moodboard(session, moodboard_id=mb.id)

    session.refresh(mb)
    assert mb.status.value == "ready"
    assert isinstance(mb.style_keywords, list)

    from app.models import PersonaMoodboardTile

    tiles = session.query(PersonaMoodboardTile).filter_by(moodboard_id=mb.id).count()
    assert tiles > 0


def test_build_moodboard_marks_failed_when_no_results() -> None:
    session = build_session()
    persona_id = uuid4()
    project_id = uuid4()
    persona = Persona(
        id=persona_id,
        project_id=project_id,
        name="P",
        segment="Segment",
        headline="Headline",
        profile={"interests": ["coffee", "cycling"], "values": ["clarity"]},
        confidence=0.9,
        version="1.0.0",
    )
    session.add(persona)
    session.commit()

    mb = PersonaMoodboard(persona_id=persona_id, project_id=project_id, title="Moodboard", active=True)
    session.add(mb)
    session.commit()
    session.refresh(mb)

    service = MoodboardService(openverse=StubOpenverseEmpty())
    service.build_moodboard(session, moodboard_id=mb.id)

    session.refresh(mb)
    assert mb.status.value == "failed"

