"""Bilingual merge + translate for persona enrich (aligned with web `persona-profile-bilingual-save`)."""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Callable

from .persona_ai_locale import normalize_output_locale
from .persona_bilingual_utils import align_profile_de_to_en_profile

TOP_STRING_KEYS = ("bio", "location", "full_name")


def trait_human_from_key(key: str) -> str:
    return str(key).replace("_", " ").strip()


def trait_key_from_human(human: str) -> str:
    t = re.sub(r"\s+", "_", str(human).strip())
    return t if t else "trait"


def build_trait_key_translate_chunk(traits: dict[str, Any]) -> dict[str, str]:
    keys = sorted(traits.keys())
    out: dict[str, str] = {}
    for i, k in enumerate(keys):
        h = trait_human_from_key(k)
        if h:
            out[f"traitk_{i}"] = h
    return out


def rebuild_traits_after_de_key_translation(source_traits: dict[str, Any], tr: dict[str, str]) -> dict[str, float]:
    sorted_keys = sorted(source_traits.keys())
    out: dict[str, float] = {}
    for i, orig_key in enumerate(sorted_keys):
        raw = (tr.get(f"traitk_{i}") or "").strip()
        new_key = trait_key_from_human(raw) if raw else orig_key
        v = source_traits[orig_key]
        out[new_key] = float(v) if isinstance(v, (int, float)) else 1.0
    return out


def merge_communication_style(base: dict[str, Any] | None, patch: dict[str, Any] | None) -> dict[str, Any]:
    b = dict(base) if isinstance(base, dict) else {}
    b = {
        "vocabulary": list(b.get("vocabulary") or []) if isinstance(b.get("vocabulary"), list) else [],
        "sentence_structure": str(b.get("sentence_structure") or ""),
        "skepticism_level": int(b.get("skepticism_level") or 0),
    }
    if not isinstance(patch, dict) or not patch:
        return b
    out = {**b, **patch}
    if "vocabulary" in patch:
        out["vocabulary"] = patch["vocabulary"]
    return out


def merge_top_level_profile_patch(next_en: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    out = {**next_en}
    for k, v in updates.items():
        if k == "communication_style":
            continue
        out[k] = v
    if "communication_style" in updates:
        out["communication_style"] = merge_communication_style(
            next_en.get("communication_style") if isinstance(next_en.get("communication_style"), dict) else None,
            updates.get("communication_style") if isinstance(updates.get("communication_style"), dict) else None,
        )
    return out


def merge_de_profile_patch(base_de: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    out = {**base_de}
    if "communication_style" in updates and isinstance(updates.get("communication_style"), dict):
        out["communication_style"] = merge_communication_style(
            base_de.get("communication_style") if isinstance(base_de.get("communication_style"), dict) else None,
            updates["communication_style"],
        )
    for key, val in updates.items():
        if key == "communication_style":
            continue
        out[key] = val
    return out


def build_translate_string_map(updates: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    u = updates

    for k in TOP_STRING_KEYS:
        if k not in u:
            continue
        v = u[k]
        out[k] = v if isinstance(v, str) else ("" if v is None else str(v))

    def push_arr(prefix: str, arr: Any) -> None:
        if not isinstance(arr, list):
            return
        for i, item in enumerate(arr):
            if isinstance(item, str) and item.strip():
                out[f"{prefix}_{i}"] = item

    if "interests" in u:
        push_arr("interest", u.get("interests"))
    if "values" in u:
        push_arr("value", u.get("values"))
    if "social_media_usage" in u:
        push_arr("social", u.get("social_media_usage"))

    cs = u.get("communication_style")
    if isinstance(cs, dict):
        ss = cs.get("sentence_structure")
        if isinstance(ss, str):
            out["sentence_structure"] = ss
        if isinstance(cs.get("vocabulary"), list):
            push_arr("vocab", cs.get("vocabulary"))

    pps = u.get("pain_points")
    if isinstance(pps, list):
        for i, pp in enumerate(pps):
            if isinstance(pp, dict):
                lab = pp.get("label")
                if isinstance(lab, str) and lab.strip():
                    out[f"pp_{i}"] = lab

    goals = u.get("goals")
    if isinstance(goals, list):
        for i, g in enumerate(goals):
            if isinstance(g, dict):
                lab = g.get("label")
                if isinstance(lab, str) and lab.strip():
                    out[f"goal_{i}"] = lab

    return {k: v for k, v in out.items() if isinstance(v, str) and v.strip()}


def _apply_flat_translations_to_arrays(tr: dict[str, str], prefix: str, length: int) -> list[str]:
    return [(tr.get(f"{prefix}_{i}") or "").strip() for i in range(length)]


def apply_translations_to_de_mirror(next_en: dict[str, Any], next_de: dict[str, Any], tr: dict[str, str]) -> None:
    for k in TOP_STRING_KEYS:
        if tr.get(k):
            next_de[k] = tr[k]

    interests = next_en.get("interests")
    if isinstance(interests, list) and len(interests) > 0:
        next_de["interests"] = _apply_flat_translations_to_arrays(tr, "interest", len(interests))

    values = next_en.get("values")
    if isinstance(values, list) and len(values) > 0:
        next_de["values"] = _apply_flat_translations_to_arrays(tr, "value", len(values))

    sm = next_en.get("social_media_usage")
    if isinstance(sm, list) and len(sm) > 0:
        next_de["social_media_usage"] = _apply_flat_translations_to_arrays(tr, "social", len(sm))

    pp = next_en.get("pain_points")
    if isinstance(pp, list) and len(pp) > 0:
        patched: list[Any] = []
        for i, p in enumerate(pp):
            if isinstance(p, dict):
                lab = (tr.get(f"pp_{i}") or "").strip() or str(p.get("label") or "")
                patched.append({**p, "label": lab})
            else:
                patched.append(p)
        next_de["pain_points"] = patched

    goals = next_en.get("goals")
    if isinstance(goals, list) and len(goals) > 0:
        gpatched: list[Any] = []
        for i, g in enumerate(goals):
            if isinstance(g, dict):
                lab = (tr.get(f"goal_{i}") or "").strip() or str(g.get("label") or "")
                gpatched.append({**g, "label": lab})
            else:
                gpatched.append(g)
        next_de["goals"] = gpatched

    cs_en = next_en.get("communication_style")
    if isinstance(cs_en, dict):
        voc = cs_en.get("vocabulary")
        prev_de = next_de.get("communication_style") if isinstance(next_de.get("communication_style"), dict) else {}
        merged_cs = {**cs_en, **prev_de, "skepticism_level": cs_en.get("skepticism_level")}
        ss = tr.get("sentence_structure")
        if isinstance(ss, str) and ss.strip():
            merged_cs["sentence_structure"] = ss.strip()
        if isinstance(voc, list) and len(voc) > 0:
            merged_cs["vocabulary"] = _apply_flat_translations_to_arrays(tr, "vocab", len(voc))
        next_de["communication_style"] = merged_cs


def apply_translations_to_en_mirror(
    next_en: dict[str, Any],
    tr: dict[str, str],
    updates: dict[str, Any],
) -> None:
    for k in TOP_STRING_KEYS:
        if tr.get(k):
            next_en[k] = tr[k]

    ints = updates.get("interests")
    if isinstance(ints, list) and len(ints) > 0:
        next_en["interests"] = _apply_flat_translations_to_arrays(tr, "interest", len(ints))

    vals = updates.get("values")
    if isinstance(vals, list) and len(vals) > 0:
        next_en["values"] = _apply_flat_translations_to_arrays(tr, "value", len(vals))

    sm = updates.get("social_media_usage")
    if isinstance(sm, list) and len(sm) > 0:
        next_en["social_media_usage"] = _apply_flat_translations_to_arrays(tr, "social", len(sm))

    pps = updates.get("pain_points")
    if isinstance(pps, list) and len(pps) > 0:
        patched: list[Any] = []
        for i, p in enumerate(pps):
            if isinstance(p, dict):
                lab = (tr.get(f"pp_{i}") or "").strip() or str(p.get("label") or "")
                patched.append({**p, "label": lab})
            else:
                patched.append(p)
        next_en["pain_points"] = patched

    goals = updates.get("goals")
    if isinstance(goals, list) and len(goals) > 0:
        gpatched: list[Any] = []
        for i, g in enumerate(goals):
            if isinstance(g, dict):
                lab = (tr.get(f"goal_{i}") or "").strip() or str(g.get("label") or "")
                gpatched.append({**g, "label": lab})
            else:
                gpatched.append(g)
        next_en["goals"] = gpatched

    u_cs = updates.get("communication_style")
    if isinstance(u_cs, dict):
        base = merge_communication_style(
            next_en.get("communication_style") if isinstance(next_en.get("communication_style"), dict) else None,
            None,
        )
        voc = u_cs.get("vocabulary")
        if isinstance(voc, list) and len(voc) > 0:
            base["vocabulary"] = _apply_flat_translations_to_arrays(tr, "vocab", len(voc))
        ss = tr.get("sentence_structure")
        if isinstance(ss, str) and ss.strip():
            base["sentence_structure"] = ss.strip()
        if isinstance(u_cs.get("skepticism_level"), (int, float)):
            base["skepticism_level"] = int(u_cs["skepticism_level"])
        next_en["communication_style"] = base


def apply_shared_numeric_fields(next_en: dict[str, Any], next_de: dict[str, Any], updates: dict[str, Any]) -> None:
    if "age" in updates and updates.get("age") is not None:
        next_en["age"] = updates["age"]
        next_de["age"] = updates["age"]
    if "gender" in updates:
        g = updates.get("gender")
        final_g = str(g).strip() if g and str(g).strip() else None
        next_en["gender"] = final_g
        next_de["gender"] = final_g
    if "media_affinity" in updates and updates.get("media_affinity") is not None:
        next_en["media_affinity"] = updates["media_affinity"]
        next_de["media_affinity"] = updates["media_affinity"]


def merge_persona_profile_bilingual_enrich(
    *,
    existing_en: dict[str, Any],
    existing_de: dict[str, Any] | None,
    chip_updates: dict[str, Any],
    from_locale: str,
    translate: Callable[[str, dict[str, str]], dict[str, str]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Returns `(profile_en_canonical, profile_de_mirror)` full profiles after bilingual pass.

    `chip_updates` is the enrich-produced chip payload (same language as `from_locale`).
    """
    from_loc = normalize_output_locale(from_locale)
    base_de = deepcopy(existing_de) if isinstance(existing_de, dict) else {}

    if from_loc == "de":
        next_en = deepcopy(existing_en)
        next_de = merge_de_profile_patch(base_de, chip_updates)
    else:
        next_en = merge_top_level_profile_patch(deepcopy(existing_en), chip_updates)
        next_de = deepcopy(base_de)

    apply_shared_numeric_fields(next_en, next_de, chip_updates)

    traits_u = chip_updates.get("traits")
    if isinstance(traits_u, dict) and len(traits_u) == 0:
        next_en["traits"] = {}
        next_de["traits"] = {}

    filtered = build_translate_string_map(chip_updates)
    if from_loc == "de" and isinstance(chip_updates.get("traits"), dict) and chip_updates["traits"]:
        filtered = {**filtered, **build_trait_key_translate_chunk(chip_updates["traits"])}

    if filtered:
        tr = translate(from_loc, filtered)
        if from_loc == "de":
            apply_translations_to_en_mirror(next_en, tr, chip_updates)
        else:
            apply_translations_to_de_mirror(next_en, next_de, tr)

        if from_loc == "de" and isinstance(chip_updates.get("traits"), dict) and chip_updates["traits"]:
            rebuilt = rebuild_traits_after_de_key_translation(chip_updates["traits"], tr)
            next_en["traits"] = rebuilt
            next_de["traits"] = {**rebuilt}

    if isinstance(next_en.get("traits"), dict):
        next_de["traits"] = {**next_en["traits"]}

    aligned_de = align_profile_de_to_en_profile(next_en, next_de)
    return next_en, aligned_de


def enrich_profile_patch_json(next_en: dict[str, Any]) -> dict[str, Any]:
    """Build `profile_json` for `update_persona` from canonical merged profile (enrich path)."""
    pp = list(next_en.get("pain_points") or [])
    goals = list(next_en.get("goals") or [])
    interests = list(next_en.get("interests") or [])
    values = list(next_en.get("values") or [])
    traits = next_en.get("traits") if isinstance(next_en.get("traits"), dict) else {}
    merged_comm = next_en.get("communication_style") if isinstance(next_en.get("communication_style"), dict) else {}
    # Snake_case only: camelCase aliases (painPoints, communicationStyle) break
    # json_shape_compatible when profile_de is patched in the same enrich request.
    out: dict[str, Any] = {
        "pain_points": pp,
        "goals": goals,
        "interests": interests,
        "values": values,
        "traits": traits,
        "communication_style": merged_comm,
    }
    for key in ("bio", "age", "location", "gender"):
        if key in next_en:
            out[key] = next_en[key]
        else:
            out[key] = "" if key == "bio" else None
    return out
