from __future__ import annotations

from app.services.moodboard_service import _coerce_keywords, build_queries


def test_coerce_keywords_splits_on_commas_and_colons() -> None:
    text = "A, B: C · D"
    out = _coerce_keywords(text, limit=10)
    assert "A" in out
    assert "B" in out
    assert "C" in out
    assert "D" in out


def test_build_queries_stays_short_and_category_specific() -> None:
    keywords = [
        "Leidenschaft für elegante Sportwagen , Wochenend-Ausfahrten",
        "Sammelt hochwertige Uhren und stilvolle Accessoires",
    ]
    qs = build_queries(keywords=keywords, categories=["lifestyle", "colors"])
    assert qs["lifestyle"].startswith("Leidenschaft")
    assert "lifestyle photography" in qs["lifestyle"]
    assert "color palette interior" in qs["colors"]
    assert len(qs["lifestyle"]) < 140
