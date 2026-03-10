"""Build a compact, chat-focused system prompt from persona profile data."""

from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy.orm import Session

CHAT_PROMPT_TEMPLATE_VERSION = "2025-03-llm"
MAX_LABEL_LEN = 72
MAX_PAIN_POINTS = 3
MAX_GOALS = 3
MAX_TRAITS_FOR_TONE = 2
MAX_VALUES = 3
MAX_VOCAB = 5
MAX_BIO_LEN = 80


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
    return words[:MAX_VOCAB]


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
    parts.append("Bleib in der Rolle, antworte als diese Persona (nie als Assistent).")

    # Ansichten
    if pain_lines:
        parts.append("Schmerzpunkte:\n" + "\n".join(f"- {p}" for p in pain_lines))
    if goal_lines:
        parts.append("Ziele:\n" + "\n".join(f"- {g}" for g in goal_lines))
    if values_raw:
        vals = []
        for v in values_raw[:MAX_VALUES]:
            if isinstance(v, str):
                vals.append(_truncate(v, 50))
            elif isinstance(v, dict) and (v.get("label") or v.get("value") or v.get("content")):
                vals.append(_truncate(str(v.get("label") or v.get("value") or v.get("content")), 50))
        if vals:
            parts.append("Werte: " + "; ".join(vals))

    # Sprache & Tonalität (eine Zeile)
    tone_bits = [f"Skeptizismus {skepticism_str}"]
    if vocab:
        tone_bits.append("Wortschatz: " + ", ".join(vocab))
    if sentence_structure:
        tone_bits.append(_truncate(sentence_structure, 50))
    if top_traits:
        tone_bits.append("Traits: " + ", ".join(top_traits))
    if tone_bits:
        parts.append("Sprache: " + ". ".join(tone_bits))

    # Qualität
    parts.append("Antworte knapp (1–2 Absätze), nur aus Persona-Sicht.")

    if bio:
        parts.insert(2, f"Hintergrund: {_truncate(bio, MAX_BIO_LEN)}")

    return "\n\n".join(parts).strip()


def build_persona_profile_summary(
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    Serialize persona data into a single text block for the LLM.
    Used as input to persona.build_chat_prompt so the model can smartly condense it.
    """
    name = (name or "").strip() or "Persona"
    segment = (segment or "").strip() or "—"
    headline = (headline or "").strip() or "—"
    lines: List[str] = [
        f"Name: {name}",
        f"Segment: {segment}",
        f"Headline: {headline}",
    ]
    bio = (profile.get("bio") or "").strip()
    if bio:
        lines.append(f"Bio: {bio}")

    def _labels(items: Any, key: str = "label") -> List[str]:
        out: List[str] = []
        for item in (items or [])[:15]:
            if isinstance(item, str):
                out.append(item.strip())
            elif isinstance(item, dict) and (item.get(key) or item.get("content") or item.get("title")):
                out.append(str(item.get(key) or item.get("content") or item.get("title")).strip())
        return out

    pain = _labels(profile.get("pain_points") or profile.get("painPoints"))
    if pain:
        lines.append("Schmerzpunkte: " + "; ".join(pain))
    goals = _labels(profile.get("goals"))
    if goals:
        lines.append("Ziele: " + "; ".join(goals))
    values = _labels(profile.get("values"), "value")
    if values:
        lines.append("Werte: " + "; ".join(values))
    interests = _labels(profile.get("interests"))
    if interests:
        lines.append("Interessen: " + "; ".join(interests))

    comm = profile.get("communication_style") or profile.get("communicationStyle") or {}
    if isinstance(comm, dict):
        vocab = comm.get("vocabulary") or []
        words = []
        for v in vocab[:10]:
            if isinstance(v, str):
                words.append(v)
            elif isinstance(v, dict):
                w = v.get("word") or v.get("label") or v.get("content")
                if w:
                    words.append(str(w))
        if words:
            lines.append("Wortschatz: " + ", ".join(words))
        sent = (comm.get("sentence_structure") or "").strip()
        if sent:
            lines.append(f"Satzbau: {sent}")
        sk = comm.get("skepticism_level")
        if sk is not None:
            lines.append(f"Skeptizismus (0–10): {sk}")

    traits = profile.get("traits")
    if isinstance(traits, dict) and traits:
        top = sorted(
            traits.items(),
            key=lambda x: (-float(x[1]) if isinstance(x[1], (int, float)) else 0),
        )[:8]
        lines.append("Traits: " + ", ".join(f"{k}={v}" for k, v in top))
    elif isinstance(traits, list) and traits:
        names = []
        for t in traits[:8]:
            if isinstance(t, str):
                names.append(t)
            elif isinstance(t, dict):
                n = t.get("name") or t.get("label") or t.get("content")
                if n:
                    names.append(str(n))
        if names:
            lines.append("Traits: " + ", ".join(names))

    return "\n".join(lines)


async def build_compact_chat_prompt_llm(
    session: Session,
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    Build the compact chat system prompt via LLM from full persona profile.
    Uses template persona.build_chat_prompt; returns the generated prompt text.
    """
    from .ai_assist import AiAssistService
    from ..schemas import AiAssistRequest

    summary = build_persona_profile_summary(
        name=name or "",
        segment=segment or "",
        headline=headline or "",
        profile=profile,
    )
    ai_assist = AiAssistService(session=session)
    request = AiAssistRequest(
        template_id="persona.build_chat_prompt",
        context={"persona_profile_summary": summary},
    )
    response = await ai_assist.generate(request)
    text = (response.raw_output or "").strip()
    if response.suggestions:
        first = response.suggestions[0]
        content = getattr(first, "content", None) or ""
        if content.strip():
            text = content.strip()
    return text or ""
