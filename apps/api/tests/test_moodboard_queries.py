from __future__ import annotations

from app.services.moodboard_service import _coerce_keywords, build_queries


class _FakePersona:
    def __init__(self) -> None:
        self.headline = "Self-confident executive"
        self.segment = "Luxury automotive"
        self.name = "Alex"
        self.profile = {
            "gender": "male",
            "interests": ["Sportwagen", "mechanische Uhren"],
        }


def test_coerce_keywords_splits_on_commas_and_colons() -> None:
    text = "A, B: C · D"
    out = _coerce_keywords(text, limit=10)
    assert "A" in out
    assert "B" in out
    assert "C" in out
    assert "D" in out


def test_build_queries_stays_short_and_category_specific() -> None:
    persona = _FakePersona()
    keywords = [
        "Leidenschaft für elegante Sportwagen , Wochenend-Ausfahrten",
        "Sammelt hochwertige Uhren und stilvolle Accessoires",
    ]
    qs = build_queries(persona=persona, keywords=keywords, categories=["lifestyle", "colors", "people", "textures"])
    assert "Sportwagen" in qs["lifestyle"] or "Leidenschaft" in qs["lifestyle"]
    assert "documentary" in qs["lifestyle"] or "hobby" in qs["lifestyle"]
    assert "macro" in qs["textures"] or "texture" in qs["textures"]
    assert "group" in qs["people"]
    assert "portrait" not in qs["people"]
    assert len(qs["lifestyle"]) < 140
