"""Build a compact, chat-focused system prompt from persona profile data."""

from __future__ import annotations

from typing import Any, Dict, List

CHAT_PROMPT_TEMPLATE_VERSION = "2025-03-compact"
MAX_LABEL_LEN = 120
MAX_PAIN_POINTS = 5
MAX_GOALS = 5
MAX_TRAITS_FOR_TONE = 3


def _truncate(s: str, max_len: int = MAX_LABEL_LEN) -> str:
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3].rstrip() + "..."


def _label_list(
    items: List[Any],
    max_items: int,
    key: str = "label",
) -> List[str]:
    out: List[str] = []
    for item in items[:max_items]:
        if isinstance(item, str):
            out.append(_truncate(item))
        elif isinstance(item, dict) and key in item and item[key]:
            out.append(_truncate(str(item[key])))
    return out


def _vocabulary(comm: Dict[str, Any]) -> List[str]:
    raw = comm.get("vocabulary") or []
    words: List[str] = []
    for item in raw:
        if isinstance(item, str):
            words.append(item)
        elif isinstance(item, dict):
            w = item.get("word") or item.get("label") or item.get("title") or item.get("content")
            if w:
                words.append(str(w))
    return words[:10]


def _top_traits(traits: Dict[str, Any], n: int = MAX_TRAITS_FOR_TONE) -> List[str]:
    if not isinstance(traits, dict):
        return []
    # Prefer traits that affect tone; fallback to first n by key
    tone_hints = ("skepticism", "formality", "tech-savvy", "detail-oriented", "cost-conscious")
    seen: List[str] = []
    for k in tone_hints:
        if k in traits and len(seen) < n:
            seen.append(k)
    for k, v in sorted(traits.items(), key=lambda x: -float(x[1]) if isinstance(x[1], (int, float)) else 0):
        if k not in seen and len(seen) < n:
            seen.append(k)
    return seen


def build_compact_chat_prompt(
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    Build a shortened system prompt for chat from persona profile.
    No AI calls; purely from existing data. Truncates long labels.
    """
    name = (name or "").strip() or "Persona"
    segment = (segment or "").strip() or "target segment"
    headline = (headline or "").strip() or ""

    pain_raw = profile.get("pain_points") or profile.get("painPoints") or []
    goals_raw = profile.get("goals") or []
    values_raw = profile.get("values") or []
    interests_raw = profile.get("interests") or []
    comm = profile.get("communication_style") or profile.get("communicationStyle") or {}
    traits = profile.get("traits") or {}
    bio = (profile.get("bio") or "").strip()

    pain_lines = _label_list(pain_raw, MAX_PAIN_POINTS)
    goal_lines = _label_list(goals_raw, MAX_GOALS)
    vocab = _vocabulary(comm)
    sentence_structure = (comm.get("sentence_structure") or "").strip()
    skepticism = comm.get("skepticism_level")
    if skepticism is not None and isinstance(skepticism, (int, float)):
        skepticism_str = f"{int(skepticism)}/10"
    else:
        skepticism_str = "—"
    top_traits = _top_traits(traits)

    parts: List[str] = []

    # Identity
    parts.append(f"Du bist {name}, {segment}. Kurz: {headline or '—'}.")

    # Verhalten
    parts.append(
        "Bleib in der Rolle. Antworte immer als diese Persona, nie als Assistent. "
        "Denke und reagiere aus ihrer Sicht."
    )

    # Ansichten
    if pain_lines:
        parts.append("Schmerzpunkte:\n" + "\n".join(f"- {p}" for p in pain_lines))
    if goal_lines:
        parts.append("Ziele:\n" + "\n".join(f"- {g}" for g in goal_lines))
    if values_raw:
        vals = []
        for v in values_raw[:5]:
            if isinstance(v, str):
                vals.append(_truncate(v, 80))
            elif isinstance(v, dict) and (v.get("label") or v.get("value") or v.get("content")):
                vals.append(_truncate(str(v.get("label") or v.get("value") or v.get("content")), 80))
        if vals:
            parts.append("Werte: " + "; ".join(vals))

    # Sprache & Tonalität
    tone_parts = []
    if vocab:
        tone_parts.append(f"Wortschatz: {', '.join(vocab[:8])}")
    if sentence_structure:
        tone_parts.append(f"Satzstruktur: {_truncate(sentence_structure, 80)}")
    tone_parts.append(f"Skeptizismus: {skepticism_str}")
    if top_traits:
        tone_parts.append("Relevante Traits: " + ", ".join(top_traits))
    if tone_parts:
        parts.append("Sprache & Tonalität:\n" + "\n".join(f"- {t}" for t in tone_parts))

    # Qualität
    parts.append(
        "Nutze dieses Profil, um so zu antworten wie die Persona – mit ihren Prioritäten und ihrer Stimme. "
        "Antworte knapp (1–2 kurze Absätze), außer der Nutzer fragt ausdrücklich nach mehr."
    )

    if bio:
        parts.insert(2, f"Hintergrund: {_truncate(bio, 200)}")

    return "\n\n".join(parts).strip()
