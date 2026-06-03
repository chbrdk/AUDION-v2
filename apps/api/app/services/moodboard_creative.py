"""Persona-specific moodboard creative brief, sourcing, and anti-stock-slop heuristics."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterable

import structlog
from openai import OpenAI

from ..core.config import get_settings
from ..models import Persona
from .openverse_client import OpenverseImage

logger = structlog.get_logger(__name__)
settings = get_settings()

# One hero tile per category → 8-tile bento (matches frontend layout).
MOODBOARD_CATEGORIES: tuple[str, ...] = (
    "lifestyle",
    "places",
    "colors",
    "textures",
    "people",
    "objects",
    "ui",
    "typography",
)

_GENERIC_STOCK_TERMS: frozenset[str] = frozenset(
    {
        "stock",
        "shutterstock",
        "getty",
        "istock",
        "handshake",
        "business meeting",
        "corporate",
        "diverse team",
        "teamwork",
        "success",
        "startup",
        "office worker",
        "generic",
        "smiling business",
        "thumbs up",
        "cheerful",
        "multiracial",
        "boardroom",
    }
)

_SPLIT_RE = re.compile(r"[·•\n\r]+|(?:\s[-–—]\s)|[.;,:]+")
_PARENS_RE = re.compile(r"\([^)]*\)")


@dataclass(frozen=True)
class MoodSignals:
    """Structured persona cues for sourcing and copy."""

    interests: list[str] = field(default_factory=list)
    values: list[str] = field(default_factory=list)
    goals: list[str] = field(default_factory=list)
    pain_points: list[str] = field(default_factory=list)
    traits: list[str] = field(default_factory=list)
    tone_words: list[str] = field(default_factory=list)
    social: list[str] = field(default_factory=list)
    keyword_tokens: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MoodboardStylePackage:
    keywords: list[str]
    mood_manifest: str
    palette_hints: list[str]
    category_directions: dict[str, str]
    avoid: list[str]


def _compact_phrase(text: str, *, max_words: int = 6, max_chars: int = 56) -> str:
    cleaned = _PARENS_RE.sub("", text)
    cleaned = cleaned.replace("—", " ").replace("–", " ").replace("‑", "-")
    cleaned = " ".join(cleaned.split()).strip(" -\t")
    if not cleaned:
        return ""
    words = cleaned.split()
    trimmed = " ".join(words[:max_words]).strip()
    if len(trimmed) > max_chars:
        trimmed = trimmed[:max_chars].rstrip()
    return trimmed


def _coerce_string_list(values: Any, *, limit: int = 8) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    if isinstance(values, str):
        parts = [p.strip() for p in _SPLIT_RE.split(values) if p and p.strip()]
        source = parts if parts else [values.strip()]
        for p in source:
            compact = _compact_phrase(p)
            if compact:
                out.append(compact)
    elif isinstance(values, list):
        for v in values:
            if isinstance(v, str) and v.strip():
                compact = _compact_phrase(v.strip())
                if compact:
                    out.append(compact)
            elif isinstance(v, dict):
                label = v.get("label") or v.get("name") or v.get("text")
                if isinstance(label, str) and label.strip():
                    compact = _compact_phrase(label.strip())
                    if compact:
                        out.append(compact)
    return out[:limit]


def _trait_names(profile: dict[str, Any]) -> list[str]:
    raw = profile.get("traits")
    names: list[str] = []
    if isinstance(raw, dict):
        for k, v in raw.items():
            if isinstance(k, str) and k.strip():
                names.append(k.replace("_", " ").strip())
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str) and item.strip():
                names.append(item.strip())
            elif isinstance(item, dict):
                n = item.get("name") or item.get("trait")
                if isinstance(n, str) and n.strip():
                    names.append(n.strip())
    return names[:8]


def _tone_words(profile: dict[str, Any]) -> list[str]:
    comm = profile.get("communication_style") or profile.get("communicationStyle") or {}
    if not isinstance(comm, dict):
        return []
    out: list[str] = []
    for key in ("tone", "voice", "formality", "pace", "register"):
        val = comm.get(key)
        if isinstance(val, str) and val.strip():
            out.append(_compact_phrase(val.strip(), max_words=4))
    vocab = comm.get("vocabulary") or comm.get("preferred_words")
    if isinstance(vocab, list):
        out.extend(_coerce_string_list(vocab, limit=4))
    return [x for x in out if x][:6]


def extract_mood_signals(persona: Persona) -> MoodSignals:
    profile = persona.profile if isinstance(persona.profile, dict) else {}
    interests = _coerce_string_list(profile.get("interests"), limit=8)
    values = _coerce_string_list(profile.get("values"), limit=6)
    goals = _coerce_string_list(profile.get("goals"), limit=6)
    pains = _coerce_string_list(profile.get("pain_points") or profile.get("painPoints"), limit=6)
    traits = _trait_names(profile)
    tone = _tone_words(profile)
    social = _coerce_string_list(profile.get("social_media_usage") or profile.get("socialMediaUsage"), limit=4)

    tokens: list[str] = []
    for bucket in (interests, values, traits, tone, pains):
        for item in bucket:
            for word in item.lower().split():
                if len(word) > 2:
                    tokens.append(word)
    if isinstance(persona.segment, str) and persona.segment.strip():
        tokens.extend(persona.segment.lower().split()[:6])

    seen: set[str] = set()
    deduped: list[str] = []
    for t in tokens:
        if t in seen:
            continue
        seen.add(t)
        deduped.append(t)

    return MoodSignals(
        interests=interests,
        values=values,
        goals=goals,
        pain_points=pains,
        traits=traits,
        tone_words=tone,
        social=social,
        keyword_tokens=deduped[:24],
    )


def derive_style_keywords(persona: Persona, signals: MoodSignals | None = None) -> list[str]:
    """Richer keyword list than MVP: traits, pains, tone, not only interests."""
    sig = signals or extract_mood_signals(persona)
    profile = persona.profile if isinstance(persona.profile, dict) else {}
    keywords: list[str] = []

    if isinstance(profile.get("gender"), str) and profile["gender"].strip():
        keywords.append(profile["gender"].strip())
    if isinstance(profile.get("media_affinity"), str) and profile["media_affinity"].strip():
        keywords.append(profile["media_affinity"].strip())

    keywords.extend(sig.traits[:4])
    keywords.extend(sig.interests[:4])
    keywords.extend(sig.values[:3])
    keywords.extend(sig.pain_points[:2])
    keywords.extend(sig.tone_words[:2])
    keywords.extend(sig.goals[:2])

    if isinstance(persona.segment, str) and persona.segment.strip():
        keywords.append(persona.segment.strip())
    if isinstance(persona.headline, str) and persona.headline.strip():
        keywords.append(_compact_phrase(persona.headline.split(".")[0], max_words=8, max_chars=72))

    seen: set[str] = set()
    deduped: list[str] = []
    for k in keywords:
        k2 = k.strip()
        if not k2:
            continue
        low = k2.lower()
        if low in seen:
            continue
        seen.add(low)
        deduped.append(k2)
    return deduped[:14]


def pack_style_keywords(package: MoodboardStylePackage) -> dict[str, Any]:
    return {
        "keywords": package.keywords,
        "moodManifest": package.mood_manifest,
        "paletteHints": package.palette_hints,
        "avoid": package.avoid,
        "categoryDirections": package.category_directions,
    }


def unpack_style_keywords(raw: Any) -> tuple[list[str], str | None, list[str], dict[str, str]]:
    if isinstance(raw, dict):
        keywords = [s for s in raw.get("keywords") or [] if isinstance(s, str)]
        manifest = raw.get("moodManifest")
        manifest_str = manifest.strip() if isinstance(manifest, str) and manifest.strip() else None
        palette = [s for s in raw.get("paletteHints") or [] if isinstance(s, str)]
        directions_raw = raw.get("categoryDirections")
        directions: dict[str, str] = {}
        if isinstance(directions_raw, dict):
            for k, v in directions_raw.items():
                if isinstance(k, str) and isinstance(v, str) and v.strip():
                    directions[k.strip().lower()] = v.strip()
        return keywords, manifest_str, palette, directions
    if isinstance(raw, list):
        return [s for s in raw if isinstance(s, str)], None, [], {}
    return [], None, [], {}


def _heuristic_manifest(persona: Persona, signals: MoodSignals, keywords: list[str]) -> str:
    name = persona.name.strip() if isinstance(persona.name, str) else "Diese Persona"
    anchor = keywords[0] if keywords else (persona.segment or "Alltag")
    trait = signals.traits[0] if signals.traits else None
    value = signals.values[0] if signals.values else None
    parts = [f"{name} wirkt nicht wie ein Stock-Archetyp, sondern wie jemand mit klarer Haltung: {anchor}."]
    if trait:
        parts.append(f"Prägend: {trait}.")
    if value:
        parts.append(f"Was zählt: {value}.")
    return " ".join(parts)[:420]


def _heuristic_category_directions(signals: MoodSignals, keywords: list[str]) -> dict[str, str]:
    anchor = keywords[0] if keywords else "persönlicher Alltag"
    interest = signals.interests[0] if signals.interests else anchor
    return {
        "lifestyle": f"Alltag und Ritual um {interest} — authentisch, nicht Hochglanz-Werbung.",
        "places": f"Räume und Orte, die zu {anchor} passen — erkennbar, bewohnt, nicht anonym.",
        "colors": f"Farbpalette mit Wärme/Kontrast passend zu {anchor} — keine Neon-Startup-Gradienten.",
        "textures": f"Materialien, die {interest} fühlbar machen — Haptik statt Plastik-Look.",
        "people": "Menschen mit echter Präsenz, passend zur Persona — kein Gruppen-Handshake.",
        "objects": f"Gegenstände und Details, die {interest} symbolisieren — persönlich, nicht generisch.",
        "ui": f"Digitale Oberflächen im Geschmack von {anchor} — ruhig, präzise, ohne Template-UI.",
        "typography": f"Editorial Typografie mit Charakter zu {anchor} — Form statt leerer Buzzwords.",
    }


def _heuristic_palette(keywords: list[str]) -> list[str]:
    # Lightweight palette hints (display only; not computed from images yet).
    base = keywords[0].lower() if keywords else "warm"
    if any(w in base for w in ("tech", "digital", "software", "data")):
        return ["graphite", "cool blue accent", "off-white"]
    if any(w in base for w in ("lux", "premium", "auto", "sport")):
        return ["deep charcoal", "brushed metal", "muted gold"]
    return ["warm neutral", "soft contrast", "natural light"]


def heuristic_style_package(persona: Persona, signals: MoodSignals, keywords: list[str]) -> MoodboardStylePackage:
    return MoodboardStylePackage(
        keywords=keywords,
        mood_manifest=_heuristic_manifest(persona, signals, keywords),
        palette_hints=_heuristic_palette(keywords),
        category_directions=_heuristic_category_directions(signals, keywords),
        avoid=[
            "generic corporate stock",
            "forced smile handshake",
            "neon startup gradients",
            "empty buzzword poster",
            "watermark or logo",
        ],
    )


def try_generate_style_package_llm(persona: Persona, signals: MoodSignals, keywords: list[str]) -> MoodboardStylePackage | None:
    if not (settings.openai_api_key or "").strip():
        return None
    model = settings.ai_openai_model or "gpt-5.4-mini"
    profile = persona.profile if isinstance(persona.profile, dict) else {}
    prompt = f"""You are an art director building a PERSONA moodboard brief (not a generic brand board).

Persona:
- name: {persona.name}
- segment: {persona.segment}
- headline: {persona.headline}
- interests: {signals.interests}
- values: {signals.values}
- traits: {signals.traits}
- pain_points: {signals.pain_points}
- tone: {signals.tone_words}
- goals: {signals.goals}
- bio excerpt: {_compact_phrase(str(profile.get("bio") or ""), max_words=40, max_chars=200)}

Return ONE JSON object:
{{
  "mood_manifest": "2-3 sentences in German, sensory and specific to THIS persona. No clichés.",
  "keywords": ["max 10 short German/English search anchors"],
  "palette_hints": ["3-5 color/material words, no hex required"],
  "category_directions": {{
    "lifestyle": "specific scene direction",
    "places": "specific place direction",
    "colors": "palette direction",
    "textures": "material direction",
    "people": "who we show, casting direction",
    "objects": "totem objects",
    "ui": "digital taste",
    "typography": "type mood"
  }},
  "avoid": ["5-8 things to avoid in images — stock tropes, AI slop tells"]
}}

Rules: Be concrete (places, rituals, materials). Ban generic office/stock tropes. Match persona gender/segment when relevant."""

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        chat = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Output valid JSON only. No markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_completion_tokens=900,
        )
        raw = (chat.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        if not isinstance(data, dict):
            return None
        manifest = data.get("mood_manifest")
        if not isinstance(manifest, str) or not manifest.strip():
            return None
        kw = data.get("keywords")
        kw_list = [str(x).strip() for x in kw if isinstance(x, (str, int, float)) and str(x).strip()][:12] if isinstance(kw, list) else keywords[:10]
        palette = data.get("palette_hints")
        pal_list = [str(x).strip() for x in palette if isinstance(x, str) and x.strip()][:6] if isinstance(palette, list) else []
        avoid = data.get("avoid")
        avoid_list = [str(x).strip() for x in avoid if isinstance(x, str) and x.strip()][:10] if isinstance(avoid, list) else []
        directions_raw = data.get("category_directions")
        directions: dict[str, str] = {}
        if isinstance(directions_raw, dict):
            for cat in MOODBOARD_CATEGORIES:
                val = directions_raw.get(cat)
                if isinstance(val, str) and val.strip():
                    directions[cat] = val.strip()
        if not directions:
            directions = _heuristic_category_directions(signals, kw_list or keywords)
        return MoodboardStylePackage(
            keywords=kw_list or keywords,
            mood_manifest=manifest.strip()[:500],
            palette_hints=pal_list or _heuristic_palette(keywords),
            category_directions=directions,
            avoid=avoid_list or heuristic_style_package(persona, signals, keywords).avoid,
        )
    except Exception as e:
        logger.warning("moodboard.style_package.llm_failed", error=str(e))
        return None


def build_style_package(persona: Persona) -> MoodboardStylePackage:
    signals = extract_mood_signals(persona)
    keywords = derive_style_keywords(persona, signals)
    llm = try_generate_style_package_llm(persona, signals, keywords)
    if llm:
        return llm
    return heuristic_style_package(persona, signals, keywords)


def build_category_queries(
    *,
    persona: Persona,
    package: MoodboardStylePackage,
    categories: Iterable[str] = MOODBOARD_CATEGORIES,
) -> dict[str, str]:
    """Short Openverse/Pexels queries per category."""
    compacted: list[str] = []
    for k in package.keywords[:12]:
        ck = _compact_phrase(k, max_words=3, max_chars=24)
        if ck:
            compacted.append(ck)
        if len(compacted) >= 4:
            break
    anchor = compacted[0] if compacted else "lifestyle"
    profile = persona.profile if isinstance(persona.profile, dict) else {}
    people_bias = _people_query_bias(persona, profile)
    hints: dict[str, str] = {
        "lifestyle": "documentary lifestyle",
        "places": "interior architecture mood",
        "colors": "color palette still life",
        "textures": "material texture macro",
        "people": people_bias,
        "objects": "still life personal objects",
        "ui": "minimal app interface",
        "typography": "editorial typography poster",
    }
    out: dict[str, str] = {}
    for cat in categories:
        direction = package.category_directions.get(cat, "")
        dir_hint = _compact_phrase(direction, max_words=4, max_chars=28) if direction else ""
        base = hints.get(cat, cat)
        q = f"{anchor} {dir_hint} {base}".strip() if dir_hint else f"{anchor} {base}".strip()
        out[cat] = " ".join(q.split())[:96]
    return out


def _people_query_bias(persona: Persona, profile: dict[str, Any]) -> str:
    gender = profile.get("gender")
    if isinstance(gender, str):
        g = gender.strip().lower()
        if g in {"male", "m", "man", "masculine", "männlich", "mann"}:
            return "candid man portrait natural light"
        if g in {"female", "f", "woman", "feminine", "weiblich", "frau"}:
            return "candid woman portrait natural light"
    blob = f"{persona.headline} {persona.segment}".lower()
    if "männ" in blob or " mann" in blob or " male" in blob:
        return "candid man portrait natural light"
    if "weib" in blob or " frau" in blob or " female" in blob:
        return "candid woman portrait natural light"
    return "candid portrait natural light"


def _candidate_blob(img: OpenverseImage) -> str:
    return " ".join(
        x
        for x in (
            img.image_url or "",
            img.thumb_url or "",
            img.source_url or "",
            img.attribution_text or "",
            img.author or "",
        )
        if x
    ).lower()


def score_stock_candidate(
    img: OpenverseImage,
    *,
    query: str,
    category: str,
    package: MoodboardStylePackage,
) -> float:
    blob = _candidate_blob(img)
    score = 0.0
    for term in query.lower().split():
        if len(term) > 3 and term in blob:
            score += 2.0
    for kw in package.keywords:
        for part in kw.lower().split():
            if len(part) > 3 and part in blob:
                score += 1.2
    direction = package.category_directions.get(category, "")
    for part in direction.lower().split():
        if len(part) > 4 and part in blob:
            score += 0.8
    for bad in _GENERIC_STOCK_TERMS:
        if bad in blob:
            score -= 4.0
    for bad in package.avoid:
        for part in bad.lower().split():
            if len(part) > 4 and part in blob:
                score -= 2.5
    if "watermark" in blob:
        score -= 5.0
    # Slight preference for documentary / flickr / unsplash style paths (often less cheesy).
    if any(x in blob for x in ("flickr", "unsplash", "pexels", "raw", "documentary")):
        score += 0.5
    return score


def pick_best_stock_image(
    candidates: list[OpenverseImage],
    *,
    query: str,
    category: str,
    package: MoodboardStylePackage,
) -> OpenverseImage | None:
    if not candidates:
        return None
    ranked = sorted(
        candidates,
        key=lambda img: score_stock_candidate(img, query=query, category=category, package=package),
        reverse=True,
    )
    best = ranked[0]
    if score_stock_candidate(best, query=query, category=category, package=package) < -2:
        return ranked[1] if len(ranked) > 1 else best
    return best


def stock_tile_caption(*, category: str, package: MoodboardStylePackage) -> str:
    direction = package.category_directions.get(category)
    if direction:
        return direction[:160]
    return f"Stimmung: {category}"


def stock_tile_rationale(*, category: str, package: MoodboardStylePackage, query: str) -> str:
    return (
        f"Curated stock ({category}) for persona mood — query «{query[:48]}». "
        f"Fits brief: {package.mood_manifest[:120]}…"
    )


def openai_image_prompt(*, persona: Persona, category: str, package: MoodboardStylePackage) -> str:
    direction = package.category_directions.get(category, category)
    avoid = "; ".join(package.avoid[:6])
    palette = ", ".join(package.palette_hints[:4])
    return (
        f"Art direction for a persona moodboard tile.\n"
        f"Persona: {persona.name} — {persona.segment}. {persona.headline}\n"
        f"Category: {category}\n"
        f"Direction: {direction}\n"
        f"Palette hints: {palette}\n"
        f"Mood: {package.mood_manifest}\n\n"
        f"Create ONE striking photograph or artwork. Cinematic, authentic, editorial quality.\n"
        f"Avoid: {avoid}. No text, no logos, no watermark, no generic stock poses, no AI gloss overload."
    )
