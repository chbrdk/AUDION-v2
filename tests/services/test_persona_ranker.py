import datetime as dt

from services.persona_ranker import PersonaRanker


def _persona(provenance: str, last_seen_offset: int, trust: float, persona_id: str):
    ts = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=last_seen_offset)).isoformat()
    return {
        "persona_id": persona_id,
        "provenance": provenance,
        "last_seen_at": ts,
        "trust_score": trust,
        "jobs_to_be_done": ["task1"],
    }


def test_internal_persona_outranks_external():
    ranker = PersonaRanker()
    internal = _persona("internal", last_seen_offset=10, trust=0.9, persona_id="p1")
    external = _persona("external", last_seen_offset=1, trust=1.0, persona_id="p2")
    ordered = ranker.rank([external, internal])
    assert ordered[0]["persona_id"] == "p1"


def test_merge_prefers_latest_internal():
    ranker = PersonaRanker()
    older = _persona("internal", last_seen_offset=30, trust=0.9, persona_id="same")
    newer_external = _persona("external", last_seen_offset=5, trust=1.0, persona_id="same")
    merged = ranker.merge_conflicts([older, newer_external])
    assert merged[0]["provenance"] == "internal"

