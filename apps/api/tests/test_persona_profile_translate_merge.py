"""Unit tests for persona enrich bilingual merge (mocked translate)."""

from __future__ import annotations

from copy import deepcopy

from app.services.persona_bilingual_utils import align_profile_de_to_en_profile, json_shape_compatible
from app.services.persona_profile_translate_merge import (
    enrich_profile_patch_json,
    merge_persona_profile_bilingual_enrich,
)


def _mock_translate(from_locale: str, strings: dict[str, str]) -> dict[str, str]:
    if from_locale == "en":
        return {k: f"{v}::de" for k, v in strings.items()}
    return {k: f"{v}::en" for k, v in strings.items()}


def test_merge_en_locale_fills_de_mirror() -> None:
    existing_en = {
        "interests": ["Keep"],
        "traits": {"calm": 1.0},
        "communication_style": {"vocabulary": ["a"], "sentence_structure": "short", "skepticism_level": 0},
    }
    chip = {
        "interests": ["Hello", "World"],
        "traits": {"calm": 1.0},
        "communication_style": {
            "vocabulary": ["w1", "w2"],
            "sentence_structure": "long",
            "skepticism_level": 1,
        },
    }
    next_en, de = merge_persona_profile_bilingual_enrich(
        existing_en=existing_en,
        existing_de={},
        chip_updates=chip,
        from_locale="en",
        translate=_mock_translate,
    )
    assert next_en["interests"] == ["Hello", "World"]
    assert de["interests"] == ["Hello::de", "World::de"]
    assert de["traits"] == next_en["traits"]
    pj = enrich_profile_patch_json(next_en)
    assert "painPoints" not in pj
    assert "communicationStyle" not in pj


def test_merge_de_locale_updates_en_canonical() -> None:
    existing_en = {
        "interests": ["OldEN"],
        "traits": {},
        "communication_style": {"vocabulary": [], "sentence_structure": "", "skepticism_level": 0},
    }
    chip = {
        "interests": ["Hallo", "Welt"],
        "traits": {},
        "communication_style": {"vocabulary": ["x"], "sentence_structure": "kurz", "skepticism_level": 0},
    }
    next_en, de = merge_persona_profile_bilingual_enrich(
        existing_en=existing_en,
        existing_de={},
        chip_updates=chip,
        from_locale="de",
        translate=_mock_translate,
    )
    assert next_en["interests"] == ["Hallo::en", "Welt::en"]
    assert de["interests"] == ["Hallo", "Welt"]
    assert next_en["communication_style"]["vocabulary"] == ["x::en"]


def test_trait_keys_rebuilt_when_de_locale() -> None:
    existing_en = {"interests": [], "traits": {}, "communication_style": {"vocabulary": [], "sentence_structure": "", "skepticism_level": 0}}
    chip = {
        "interests": [],
        "traits": {"ruhig_sein": 2.0},
        "communication_style": {"vocabulary": [], "sentence_structure": "", "skepticism_level": 0},
    }

    def tr(fl: str, s: dict[str, str]) -> dict[str, str]:
        out = dict(s)
        if fl == "de" and "traitk_0" in s:
            out["traitk_0"] = "Calm Mind"
        return out

    next_en, de = merge_persona_profile_bilingual_enrich(
        existing_en=existing_en,
        existing_de={},
        chip_updates=chip,
        from_locale="de",
        translate=tr,
    )
    assert "Calm_Mind" in next_en["traits"]
    assert next_en["traits"] == de["traits"]


def test_enrich_patch_stays_shape_compatible_with_profile_de() -> None:
    """Simulates enrich save: partial profile_json merge + full profile_de patch."""
    existing_en = {
        "pain_points": [{"label": "old", "evidence_count": 1}],
        "goals": [],
        "interests": ["keep"],
        "values": [],
        "traits": {},
        "communication_style": {"vocabulary": [], "sentence_structure": "", "skepticism_level": 0},
        "bio": "bio",
        "age": 30,
        "location": "Berlin",
        "gender": "female",
        "social_media_usage": ["LinkedIn"],
    }
    existing_de = align_profile_de_to_en_profile(
        existing_en,
        {
            "pain_points": [{"label": "alt", "evidence_count": 1}],
            "goals": [],
            "interests": ["behalten"],
            "values": [],
            "traits": {},
            "communication_style": {"vocabulary": [], "sentence_structure": "", "skepticism_level": 0},
            "bio": "bio de",
            "age": 30,
            "location": "Berlin",
            "gender": "female",
            "social_media_usage": ["LinkedIn-de"],
        },
    )
    chip = {
        "pain_points": [{"label": "new pain", "evidence_count": 1}],
        "goals": [{"label": "goal", "priority": 1}],
        "interests": ["a", "b"],
        "values": ["v1"],
        "traits": {"curious": 1.0},
        "communication_style": {
            "vocabulary": ["word"],
            "sentence_structure": "short",
            "skepticism_level": 0,
        },
        "bio": "bio",
        "age": 30,
        "location": "Berlin",
        "gender": "female",
    }
    next_en, aligned_de = merge_persona_profile_bilingual_enrich(
        existing_en=existing_en,
        existing_de=existing_de,
        chip_updates=chip,
        from_locale="en",
        translate=_mock_translate,
    )
    profile_json = enrich_profile_patch_json(next_en)
    merged_profile = deepcopy(existing_en)
    merged_profile.update(profile_json)
    merged_de = deepcopy(existing_de)
    merged_de.update(aligned_de)
    assert json_shape_compatible(merged_profile, merged_de)
