from __future__ import annotations

from app.services.moodboard_creative import (
    MOODBOARD_CATEGORIES,
    build_category_queries,
    derive_style_keywords,
    extract_mood_signals,
    heuristic_style_package,
    pack_style_keywords,
    pick_best_stock_image,
    score_stock_candidate,
    unpack_style_keywords,
)
from app.services.openverse_client import OpenverseImage


class _Persona:
    def __init__(self) -> None:
        self.name = "Alex"
        self.segment = "Premium mobility"
        self.headline = "Fährt am Wochenende kurvenreiche Strecken"
        self.profile = {
            "gender": "male",
            "interests": ["Sportwagen", "mechanische Uhren"],
            "values": ["Präzision", "Diskretion"],
            "traits": {"analytical": 0.9, "driven": 0.8},
            "pain_points": ["Zu viel generische Werbung"],
            "communication_style": {"tone": "sachlich", "formality": "hoch"},
        }


def test_extract_mood_signals_includes_traits_and_tone() -> None:
    persona = _Persona()
    sig = extract_mood_signals(persona)  # type: ignore[arg-type]
    assert "analytical" in sig.traits or "driven" in sig.traits
    assert sig.tone_words
    assert sig.interests


def test_pack_unpack_style_keywords_roundtrip() -> None:
    persona = _Persona()
    sig = extract_mood_signals(persona)  # type: ignore[arg-type]
    kw = derive_style_keywords(persona, sig)  # type: ignore[arg-type]
    package = heuristic_style_package(persona, sig, kw)  # type: ignore[arg-type]
    packed = pack_style_keywords(package)
    keywords, manifest, palette, directions = unpack_style_keywords(packed)
    assert keywords
    assert manifest
    assert palette
    assert directions.get("lifestyle")


def test_moodboard_has_eight_categories() -> None:
    assert len(MOODBOARD_CATEGORIES) == 8
    assert "places" in MOODBOARD_CATEGORIES
    assert "objects" in MOODBOARD_CATEGORIES


def test_score_stock_penalizes_generic_corporate() -> None:
    persona = _Persona()
    sig = extract_mood_signals(persona)  # type: ignore[arg-type]
    kw = derive_style_keywords(persona, sig)  # type: ignore[arg-type]
    package = heuristic_style_package(persona, sig, kw)  # type: ignore[arg-type]
    good = OpenverseImage(
        image_url="https://img.example/sportscar-weekend-drive.jpg",
        thumb_url=None,
        source_url="https://source.example/1",
        author="A",
        license="by",
        attribution_text="weekend sportscar drive",
    )
    bad = OpenverseImage(
        image_url="https://img.example/corporate-handshake-diverse-team.jpg",
        thumb_url=None,
        source_url="https://source.example/2",
        author="B",
        license="by",
        attribution_text="business handshake diverse team corporate",
    )
    assert score_stock_candidate(good, query="sportscar lifestyle", category="lifestyle", package=package) > score_stock_candidate(
        bad, query="sportscar lifestyle", category="lifestyle", package=package
    )
    picked = pick_best_stock_image([bad, good], query="sportscar lifestyle", category="lifestyle", package=package)
    assert picked is good


def test_build_category_queries_stays_short() -> None:
    persona = _Persona()
    sig = extract_mood_signals(persona)  # type: ignore[arg-type]
    kw = derive_style_keywords(persona, sig)  # type: ignore[arg-type]
    package = heuristic_style_package(persona, sig, kw)  # type: ignore[arg-type]
    qs = build_category_queries(persona=persona, package=package, categories=["lifestyle", "places"])  # type: ignore[arg-type]
    assert len(qs["lifestyle"]) < 100
    assert "lifestyle" in qs["lifestyle"] or "documentary" in qs["lifestyle"]
