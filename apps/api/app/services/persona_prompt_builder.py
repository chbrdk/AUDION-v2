"""Build a rich, chat-focused system prompt from persona profile data."""

from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy.orm import Session

CHAT_PROMPT_TEMPLATE_VERSION = "2026-04-bilingual-chat-v1"
MAX_LABEL_LEN = 220
MAX_PAIN_POINTS = 10
MAX_GOALS = 10
MAX_TRAITS_FOR_TONE = 6
MAX_VALUES = 10
MAX_VOCAB = 20
MAX_INTERESTS = 12
MAX_BIO_LEN = 600
SUMMARY_MAX_LIST_ITEMS = 25
SUMMARY_FIELD_SOFT_CAP = 1200


def _truncate(s: str, max_len: int = MAX_LABEL_LEN) -> str:
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3].rstrip() + "..."


def _soft_cap(s: str, max_len: int = SUMMARY_FIELD_SOFT_CAP) -> str:
    """Longer cap for LLM input summary (keep rich pain/goal text)."""
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3].rstrip() + "..."


def _get(profile: Dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in profile and profile[k] not in (None, "", []):
            return profile[k]
    return None


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
    tone_hints = ("skepticism", "formality", "tech-savvy", "detail-oriented", "cost-conscious")
    seen: List[str] = []
    for k in tone_hints:
        if k in traits and len(seen) < n:
            seen.append(f"{k}={traits[k]}")
    for k, v in sorted(traits.items(), key=lambda x: -float(x[1]) if isinstance(x[1], (int, float)) else 0):
        if k not in [s.split("=")[0] for s in seen] and len(seen) < n:
            seen.append(f"{k}={v}")
    return seen


def build_compact_chat_prompt_de(
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    Build a system prompt for chat from persona profile (no LLM).
    Richer than legacy compact: more goals/pains/values and demographics when present.
    """
    name = (name or "").strip() or "Persona"
    segment = (segment or "").strip() or "target segment"
    headline = (headline or "").strip() or ""

    pain_raw = _get(profile, "pain_points", "painPoints") or []
    goals_raw = profile.get("goals") or []
    values_raw = profile.get("values") or []
    interests_raw = profile.get("interests") or []
    comm = _get(profile, "communication_style", "communicationStyle") or {}
    if not isinstance(comm, dict):
        comm = {}
    traits = profile.get("traits") or {}
    bio = (profile.get("bio") or "").strip()
    full_name = _get(profile, "full_name", "fullName")
    age = _get(profile, "age")
    location = _get(profile, "location")
    gender = _get(profile, "gender")
    media_affinity = _get(profile, "media_affinity", "mediaAffinity")
    attention_span = _get(profile, "attention_span", "attentionSpan")

    pain_lines = _label_list(list(pain_raw) if isinstance(pain_raw, list) else [], MAX_PAIN_POINTS)
    goal_lines = _label_list(list(goals_raw) if isinstance(goals_raw, list) else [], MAX_GOALS)
    vocab = _vocabulary(comm)
    sentence_structure = (comm.get("sentence_structure") or comm.get("sentenceStructure") or "").strip()
    skepticism = comm.get("skepticism_level")
    if skepticism is None:
        skepticism = comm.get("skepticismLevel")
    if skepticism is not None and isinstance(skepticism, (int, float)):
        skepticism_str = f"{int(skepticism)}/10"
    else:
        skepticism_str = "—"
    top_traits = _top_traits(traits if isinstance(traits, dict) else {})

    parts: List[str] = []

    open_line = f"Du bist {name}, {segment}."
    if full_name and str(full_name).strip() and str(full_name).strip() != name:
        open_line += f" Vollständiger Name: {full_name}."
    open_line += f" Kurz: {headline or '—'}."
    parts.append(open_line)

    demo_bits: List[str] = []
    if age is not None:
        demo_bits.append(f"Alter: {age}")
    if location:
        demo_bits.append(f"Ort: {location}")
    if gender:
        demo_bits.append(f"Geschlecht: {gender}")
    if media_affinity is not None:
        demo_bits.append(f"Medienaffinität: {media_affinity}")
    if attention_span is not None:
        demo_bits.append(f"Aufmerksamkeitsspanne: {attention_span}")
    if demo_bits:
        parts.append("Demografie / Kontext: " + "; ".join(demo_bits))

    parts.append("Bleib in der Rolle, antworte als diese Persona (nie als KI-Assistent oder Meta-Erklärer).")

    if bio:
        parts.append(f"Hintergrund: {_truncate(bio, MAX_BIO_LEN)}")

    if pain_lines:
        parts.append("Schmerzpunkte:\n" + "\n".join(f"- {p}" for p in pain_lines))
    if goal_lines:
        parts.append("Ziele:\n" + "\n".join(f"- {g}" for g in goal_lines))

    if values_raw:
        vals: List[str] = []
        for v in values_raw[:MAX_VALUES]:
            if isinstance(v, str):
                vals.append(_truncate(v, 280))
            elif isinstance(v, dict) and (v.get("label") or v.get("value") or v.get("content")):
                vals.append(_truncate(str(v.get("label") or v.get("value") or v.get("content")), 280))
        if vals:
            parts.append("Werte:\n" + "\n".join(f"- {x}" for x in vals))

    if interests_raw and isinstance(interests_raw, list):
        ints: List[str] = []
        for it in interests_raw[:MAX_INTERESTS]:
            if isinstance(it, str):
                ints.append(_truncate(it, 200))
            elif isinstance(it, dict):
                t = it.get("label") or it.get("content") or it.get("title")
                if t:
                    ints.append(_truncate(str(t), 200))
        if ints:
            parts.append("Interessen:\n" + "\n".join(f"- {x}" for x in ints))

    tone_bits = [f"Skeptizismus {skepticism_str}"]
    if vocab:
        tone_bits.append("Wortschatz: " + ", ".join(vocab))
    if sentence_structure:
        tone_bits.append(_truncate(sentence_structure, 120))
    if top_traits:
        tone_bits.append("Traits: " + ", ".join(top_traits))
    if tone_bits:
        parts.append("Sprache / Tonalität: " + ". ".join(tone_bits))

    parts.append(
        "Antworte natürlich in der Rolle (typisch 1–3 kurze Absätze); "
        "tiefer nur wenn die Konversation es verlangt. Kein Aufklären über dich als Persona."
    )

    return "\n\n".join(parts).strip()


def build_compact_chat_prompt(
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    English (canonical) non-LLM compact chat system prompt.
    """
    name = (name or "").strip() or "Persona"
    segment = (segment or "").strip() or "target segment"
    headline = (headline or "").strip() or ""

    pain_raw = _get(profile, "pain_points", "painPoints") or []
    goals_raw = profile.get("goals") or []
    values_raw = profile.get("values") or []
    interests_raw = profile.get("interests") or []
    comm = _get(profile, "communication_style", "communicationStyle") or {}
    if not isinstance(comm, dict):
        comm = {}
    traits = profile.get("traits") or {}
    bio = (profile.get("bio") or "").strip()
    full_name = _get(profile, "full_name", "fullName")
    age = _get(profile, "age")
    location = _get(profile, "location")
    gender = _get(profile, "gender")
    media_affinity = _get(profile, "media_affinity", "mediaAffinity")
    attention_span = _get(profile, "attention_span", "attentionSpan")

    pain_lines = _label_list(list(pain_raw) if isinstance(pain_raw, list) else [], MAX_PAIN_POINTS)
    goal_lines = _label_list(list(goals_raw) if isinstance(goals_raw, list) else [], MAX_GOALS)
    vocab = _vocabulary(comm)
    sentence_structure = (comm.get("sentence_structure") or comm.get("sentenceStructure") or "").strip()
    skepticism = comm.get("skepticism_level")
    if skepticism is None:
        skepticism = comm.get("skepticismLevel")
    if skepticism is not None and isinstance(skepticism, (int, float)):
        skepticism_str = f"{int(skepticism)}/10"
    else:
        skepticism_str = "—"
    top_traits = _top_traits(traits if isinstance(traits, dict) else {})

    parts: List[str] = []

    open_line = f"You are {name}, representing the {segment} perspective."
    if full_name and str(full_name).strip() and str(full_name).strip() != name:
        open_line += f" Full name: {full_name}."
    open_line += f" Tagline: {headline or '—'}."
    parts.append(open_line)

    demo_bits: List[str] = []
    if age is not None:
        demo_bits.append(f"Age: {age}")
    if location:
        demo_bits.append(f"Location: {location}")
    if gender:
        demo_bits.append(f"Gender: {gender}")
    if media_affinity is not None:
        demo_bits.append(f"Media affinity: {media_affinity}")
    if attention_span is not None:
        demo_bits.append(f"Attention span: {attention_span}")
    if demo_bits:
        parts.append("Demographics / context: " + "; ".join(demo_bits))

    parts.append("Stay in character; answer as this persona (never as an AI assistant or meta-explainer).")

    if bio:
        parts.append(f"Background: {_truncate(bio, MAX_BIO_LEN)}")

    if pain_lines:
        parts.append("Pain points:\n" + "\n".join(f"- {p}" for p in pain_lines))
    if goal_lines:
        parts.append("Goals:\n" + "\n".join(f"- {g}" for g in goal_lines))

    if values_raw:
        vals: List[str] = []
        for v in values_raw[:MAX_VALUES]:
            if isinstance(v, str):
                vals.append(_truncate(v, 280))
            elif isinstance(v, dict) and (v.get("label") or v.get("value") or v.get("content")):
                vals.append(_truncate(str(v.get("label") or v.get("value") or v.get("content")), 280))
        if vals:
            parts.append("Values:\n" + "\n".join(f"- {x}" for x in vals))

    if interests_raw and isinstance(interests_raw, list):
        ints: List[str] = []
        for it in interests_raw[:MAX_INTERESTS]:
            if isinstance(it, str):
                ints.append(_truncate(it, 200))
            elif isinstance(it, dict):
                t = it.get("label") or it.get("content") or it.get("title")
                if t:
                    ints.append(_truncate(str(t), 200))
        if ints:
            parts.append("Interests:\n" + "\n".join(f"- {x}" for x in ints))

    tone_bits = [f"Skepticism {skepticism_str}"]
    if vocab:
        tone_bits.append("Vocabulary: " + ", ".join(vocab))
    if sentence_structure:
        tone_bits.append(_truncate(sentence_structure, 120))
    if top_traits:
        tone_bits.append("Traits: " + ", ".join(top_traits))
    if tone_bits:
        parts.append("Language / tone: " + ". ".join(tone_bits))

    parts.append(
        "Respond naturally in character (typically 1–3 short paragraphs); "
        "go deeper only when the conversation demands it. Do not explain yourself as a persona."
    )

    return "\n\n".join(parts).strip()


def _summary_labels_with_meta(items: Any, key: str = "label", *, evidence_key: str | None = None) -> List[str]:
    out: List[str] = []
    if not isinstance(items, list):
        return out
    for item in items[:SUMMARY_MAX_LIST_ITEMS]:
        if isinstance(item, str):
            out.append(_soft_cap(item.strip()))
        elif isinstance(item, dict):
            text = (item.get(key) or item.get("content") or item.get("title") or "").strip()
            if not text:
                continue
            extra: List[str] = []
            if evidence_key and item.get(evidence_key) is not None:
                extra.append(f"Evidence: {item.get(evidence_key)}")
            pri = item.get("priority")
            if pri is not None:
                extra.append(f"Priority: {pri}")
            if extra:
                out.append(_soft_cap(f"{text} ({', '.join(extra)})"))
            else:
                out.append(_soft_cap(text))
    return out


def _summary_values(items: Any) -> List[str]:
    out: List[str] = []
    if not isinstance(items, list):
        return out
    for item in items[:SUMMARY_MAX_LIST_ITEMS]:
        if isinstance(item, str):
            out.append(_soft_cap(item.strip()))
        elif isinstance(item, dict):
            t = (item.get("value") or item.get("label") or item.get("content") or "").strip()
            if t:
                out.append(_soft_cap(t))
    return out


def _summary_interests(items: Any) -> List[str]:
    out: List[str] = []
    if not isinstance(items, list):
        return out
    for item in items[:SUMMARY_MAX_LIST_ITEMS]:
        if isinstance(item, str):
            out.append(_soft_cap(item.strip()))
        elif isinstance(item, dict):
            t = (item.get("label") or item.get("content") or item.get("title") or "").strip()
            if t:
                out.append(_soft_cap(t))
    return out


def _summary_social_usage(items: Any) -> List[str]:
    if not isinstance(items, list) or not items:
        return []
    parts: List[str] = []
    for item in items[:15]:
        if isinstance(item, str):
            parts.append(item.strip())
        elif isinstance(item, dict):
            plat = item.get("platform") or item.get("label") or item.get("name")
            freq = item.get("frequency") or item.get("usage")
            if plat and freq:
                parts.append(f"{plat}: {freq}")
            elif plat:
                parts.append(str(plat))
    return parts


def build_persona_profile_summary(
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    Serialize persona data into one text block for the LLM (persona.build_chat_prompt).
    Includes demographics, media affinity, social usage, palettes, full pains/goals where present.
    """
    name = (name or "").strip() or "Persona"
    segment = (segment or "").strip() or "—"
    headline = (headline or "").strip() or "—"
    lines: List[str] = [
        f"Name: {name}",
        f"Segment: {segment}",
        f"Headline: {headline}",
    ]

    full_name = _get(profile, "full_name", "fullName")
    if full_name:
        lines.append(f"Vollständiger Name: {full_name}")

    bio = (profile.get("bio") or "").strip()
    if bio:
        lines.append(f"Bio: {_soft_cap(bio)}")

    demo: List[str] = []
    age = _get(profile, "age")
    if age is not None:
        demo.append(f"Alter: {age}")
    loc = _get(profile, "location")
    if loc:
        demo.append(f"Wohnort/Region: {loc}")
    gender = _get(profile, "gender")
    if gender:
        demo.append(f"Geschlecht: {gender}")
    ma = _get(profile, "media_affinity", "mediaAffinity")
    if ma is not None:
        demo.append(f"Medienaffinität (0–100 o. ä.): {ma}")
    att = _get(profile, "attention_span", "attentionSpan")
    if att is not None:
        demo.append(f"Aufmerksamkeitsspanne: {att}")
    if demo:
        lines.append("Demografie & Medien: " + "; ".join(demo))

    pain = _summary_labels_with_meta(
        _get(profile, "pain_points", "painPoints"),
        "label",
        evidence_key="evidence_count",
    )
    if pain:
        lines.append("Schmerzpunkte (mit Kontext):\n" + "\n".join(f"- {p}" for p in pain))

    goals = _summary_labels_with_meta(profile.get("goals"), "label")
    if goals:
        lines.append("Ziele:\n" + "\n".join(f"- {g}" for g in goals))

    values = _summary_values(profile.get("values"))
    if values:
        lines.append("Werte:\n" + "\n".join(f"- {v}" for v in values))

    interests = _summary_interests(profile.get("interests"))
    if interests:
        lines.append("Interessen:\n" + "\n".join(f"- {i}" for i in interests))

    sm = _summary_social_usage(_get(profile, "social_media_usage", "socialMediaUsage"))
    if sm:
        lines.append("Social Media Nutzung: " + "; ".join(sm))

    cp = _get(profile, "color_palette", "colorPalette")
    if isinstance(cp, list) and cp:
        colors = [str(c) for c in cp[:20] if c]
        if colors:
            lines.append("Farbpalette (Präferenzen): " + ", ".join(colors))

    comm = _get(profile, "communication_style", "communicationStyle") or {}
    if isinstance(comm, dict):
        vocab = comm.get("vocabulary") or []
        words: List[str] = []
        for v in vocab[:25]:
            if isinstance(v, str):
                words.append(v)
            elif isinstance(v, dict):
                w = v.get("word") or v.get("label") or v.get("content")
                if w:
                    words.append(str(w))
        if words:
            lines.append("Kommunikation — Wortschatz: " + ", ".join(words))
        sent = (comm.get("sentence_structure") or comm.get("sentenceStructure") or "").strip()
        if sent:
            lines.append(f"Kommunikation — Satzbau / Stil: {_soft_cap(sent)}")
        sk = comm.get("skepticism_level")
        if sk is None:
            sk = comm.get("skepticismLevel")
        if sk is not None:
            lines.append(f"Kommunikation — Skeptizismus (0–10): {sk}")

    traits = profile.get("traits")
    if isinstance(traits, dict) and traits:
        top = sorted(
            traits.items(),
            key=lambda x: (-float(x[1]) if isinstance(x[1], (int, float)) else 0),
        )[:12]
        lines.append("Traits (Skalen): " + ", ".join(f"{k}={v}" for k, v in top))
    elif isinstance(traits, list) and traits:
        names: List[str] = []
        for t in traits[:12]:
            if isinstance(t, str):
                names.append(t)
            elif isinstance(t, dict):
                n = t.get("name") or t.get("label") or t.get("content")
                if n:
                    names.append(str(n))
        if names:
            lines.append("Traits: " + ", ".join(names))

    conf = profile.get("confidence")
    if conf is not None:
        lines.append(f"Profil-Konfidenz (Metadaten): {conf}")

    return "\n".join(lines)


def build_persona_profile_summary_en(
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    English summary block for `persona.build_chat_prompt` (EN canonical prompt generation).
    """
    name = (name or "").strip() or "Persona"
    segment = (segment or "").strip() or "—"
    headline = (headline or "").strip() or "—"
    lines: List[str] = [
        f"Name: {name}",
        f"Segment: {segment}",
        f"Headline: {headline}",
    ]

    full_name = _get(profile, "full_name", "fullName")
    if full_name:
        lines.append(f"Full name: {full_name}")

    bio = (profile.get("bio") or "").strip()
    if bio:
        lines.append(f"Bio: {_soft_cap(bio)}")

    demo: List[str] = []
    age = _get(profile, "age")
    if age is not None:
        demo.append(f"Age: {age}")
    loc = _get(profile, "location")
    if loc:
        demo.append(f"Location: {loc}")
    gender = _get(profile, "gender")
    if gender:
        demo.append(f"Gender: {gender}")
    ma = _get(profile, "media_affinity", "mediaAffinity")
    if ma is not None:
        demo.append(f"Media affinity (0–100-ish): {ma}")
    att = _get(profile, "attention_span", "attentionSpan")
    if att is not None:
        demo.append(f"Attention span: {att}")
    if demo:
        lines.append("Demographics & media: " + "; ".join(demo))

    pain = _summary_labels_with_meta(
        _get(profile, "pain_points", "painPoints"),
        "label",
        evidence_key="evidence_count",
    )
    if pain:
        lines.append("Pain points (with context):\n" + "\n".join(f"- {p}" for p in pain))

    goals = _summary_labels_with_meta(profile.get("goals"), "label")
    if goals:
        lines.append("Goals:\n" + "\n".join(f"- {g}" for g in goals))

    values = _summary_values(profile.get("values"))
    if values:
        lines.append("Values:\n" + "\n".join(f"- {v}" for v in values))

    interests = _summary_interests(profile.get("interests"))
    if interests:
        lines.append("Interests:\n" + "\n".join(f"- {i}" for i in interests))

    sm = _summary_social_usage(_get(profile, "social_media_usage", "socialMediaUsage"))
    if sm:
        lines.append("Social media usage: " + "; ".join(sm))

    cp = _get(profile, "color_palette", "colorPalette")
    if isinstance(cp, list) and cp:
        colors = [str(c) for c in cp[:20] if c]
        if colors:
            lines.append("Color palette (preferences): " + ", ".join(colors))

    comm = _get(profile, "communication_style", "communicationStyle") or {}
    if isinstance(comm, dict):
        vocab = comm.get("vocabulary") or []
        words: List[str] = []
        for v in vocab[:25]:
            if isinstance(v, str):
                words.append(v)
            elif isinstance(v, dict):
                w = v.get("word") or v.get("label") or v.get("content")
                if w:
                    words.append(str(w))
        if words:
            lines.append("Communication — vocabulary: " + ", ".join(words))
        sent = (comm.get("sentence_structure") or comm.get("sentenceStructure") or "").strip()
        if sent:
            lines.append(f"Communication — sentence structure / style: {_soft_cap(sent)}")
        sk = comm.get("skepticism_level")
        if sk is None:
            sk = comm.get("skepticismLevel")
        if sk is not None:
            lines.append(f"Communication — skepticism (0–10): {sk}")

    traits = profile.get("traits")
    if isinstance(traits, dict) and traits:
        top = sorted(
            traits.items(),
            key=lambda x: (-float(x[1]) if isinstance(x[1], (int, float)) else 0),
        )[:12]
        lines.append("Traits (scales): " + ", ".join(f"{k}={v}" for k, v in top))
    elif isinstance(traits, list) and traits:
        names: List[str] = []
        for t in traits[:12]:
            if isinstance(t, str):
                names.append(t)
            elif isinstance(t, dict):
                n = t.get("name") or t.get("label") or t.get("content")
                if n:
                    names.append(str(n))
        if names:
            lines.append("Traits: " + ", ".join(names))

    conf = profile.get("confidence")
    if conf is not None:
        lines.append(f"Profile confidence (metadata): {conf}")

    return "\n".join(lines)


async def translate_compact_chat_system_prompt_de(session: Session, *, en_prompt: str) -> str:
    from .ai_assist import AiAssistService
    from ..schemas import AiAssistRequest

    ai_assist = AiAssistService(session=session)
    request = AiAssistRequest(
        template_id="persona.translate_chat_system_prompt_de",
        context={"english_system_prompt": en_prompt},
    )
    response = await ai_assist.generate(request)
    text = (response.raw_output or "").strip()
    if response.suggestions:
        first = response.suggestions[0]
        content = getattr(first, "content", None) or ""
        if content.strip():
            text = content.strip()
    return text or ""


async def build_compact_chat_prompt_llm_bilingual(
    session: Session,
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> tuple[str, str]:
    """
    Returns (en_prompt, de_prompt). EN is LLM-generated when possible; DE is translated.
    """
    from .ai_assist import AiAssistService
    from ..schemas import AiAssistRequest

    summary_en = build_persona_profile_summary_en(
        name=name or "",
        segment=segment or "",
        headline=headline or "",
        profile=profile,
    )
    ai_assist = AiAssistService(session=session)
    request = AiAssistRequest(
        template_id="persona.build_chat_prompt",
        context={"persona_profile_summary_en": summary_en},
    )
    response = await ai_assist.generate(request)
    text_en = (response.raw_output or "").strip()
    if response.suggestions:
        first = response.suggestions[0]
        content = getattr(first, "content", None) or ""
        if content.strip():
            text_en = content.strip()

    if not text_en:
        text_en = build_compact_chat_prompt(name=name, segment=segment, headline=headline, profile=profile)

    text_de = await translate_compact_chat_system_prompt_de(session, en_prompt=text_en)
    if not text_de:
        text_de = build_compact_chat_prompt_de(name=name, segment=segment, headline=headline, profile=profile)

    return text_en, text_de


async def build_compact_chat_prompt_llm(
    session: Session,
    name: str,
    segment: str,
    headline: str,
    profile: Dict[str, Any],
) -> str:
    """
    Build the English (canonical) chat system prompt via LLM from full persona profile.

    Note: `persona.build_chat_prompt` is configured for English output; German mirrors are produced elsewhere.
    """
    text_en, _text_de = await build_compact_chat_prompt_llm_bilingual(
        session,
        name=name,
        segment=segment,
        headline=headline,
        profile=profile,
    )
    return text_en
