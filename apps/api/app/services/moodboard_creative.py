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
# Below this score, stock is treated as too generic — hybrid build may use OpenAI for the category.
STOCK_ACCEPT_MIN_SCORE: float = 1.5

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
        "office",
        "businessman",
        "businesswoman",
        "laptop",
        "open space",
        "coworking",
        "boardroom",
        "headshot",
        "portrait studio",
        "generic",
        "smiling business",
        "thumbs up",
        "cheerful",
        "multiracial",
    }
)

# Categories that must not show office / solo portraits in stock or gen.
_NO_PEOPLE_CATEGORIES: frozenset[str] = frozenset(
    {"textures", "colors", "objects", "typography", "ui", "places"}
)
_OFFICE_BLOB_TERMS: frozenset[str] = frozenset(
    {"office", "businessman", "businesswoman", "corporate", "laptop", "meeting", "boardroom", "coworking"}
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


def pack_style_keywords(
    package: MoodboardStylePackage,
    *,
    palette_swatches: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "keywords": package.keywords,
        "moodManifest": package.mood_manifest,
        "paletteHints": package.palette_hints,
        "avoid": package.avoid,
        "categoryDirections": package.category_directions,
    }
    if palette_swatches:
        payload["paletteSwatches"] = palette_swatches
    return payload


def _normalize_palette_swatches(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        hex_val = item.get("hex")
        if not isinstance(hex_val, str) or not hex_val.startswith("#"):
            continue
        weight = item.get("weight")
        entry: dict[str, Any] = {"hex": hex_val.lower()}
        if isinstance(weight, (int, float)):
            entry["weight"] = round(float(weight), 3)
        out.append(entry)
    return out[:8]


def unpack_style_keywords(
    raw: Any,
) -> tuple[list[str], str | None, list[str], dict[str, str], list[dict[str, Any]]]:
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
        swatches = _normalize_palette_swatches(raw.get("paletteSwatches"))
        return keywords, manifest_str, palette, directions, swatches
    if isinstance(raw, list):
        return [s for s in raw if isinstance(s, str)], None, [], {}, []
    return [], None, [], {}, []


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


def _primary_interest(signals: MoodSignals, keywords: list[str]) -> str:
    if signals.interests:
        return signals.interests[0]
    for kw in keywords:
        compact = _compact_phrase(kw, max_words=6, max_chars=48)
        if compact:
            return compact
    return "persönlicher Alltag"


def _secondary_interest(signals: MoodSignals) -> str:
    return signals.interests[1] if len(signals.interests) > 1 else ""


def _trait_phrase(signals: MoodSignals) -> str:
    return signals.traits[0] if signals.traits else (signals.values[0] if signals.values else "")


def _heuristic_category_directions(signals: MoodSignals, keywords: list[str]) -> dict[str, str]:
    interest = _primary_interest(signals, keywords)
    interest2 = _secondary_interest(signals)
    trait = _trait_phrase(signals)
    anchor = keywords[0] if keywords else interest
    return {
        "lifestyle": (
            f"Zeige die Tätigkeit „{interest}“ als Held — Hände, Werkzeug, Bewegung, Ort. "
            f"Kein Büro, keine generische Business-Person."
        ),
        "places": (
            f"Ein konkreter, bewohnter Ort, der zu „{interest}“ oder „{anchor}“ passt — "
            f"Architektur/Interior, keine anonyme Lobby."
        ),
        "colors": (
            f"Abstrakte Farb- und Lichtstudie (Materialflächen, Wand, Himmel) passend zu „{anchor}“ — "
            f"keine Menschen, kein UI-Mockup."
        ),
        "textures": (
            f"Makro eines Materials aus dem Kontext „{interest}“ (Stoff, Metall, Leder, Holz) — "
            f"seichte Tiefenschärfe, Seitenlicht, Fasern sichtbar. Keine Personen."
        ),
        "people": (
            f"Kleine Gruppe (3–6) in Szene zu „{interest}“ — Weitwinkel, Gesichter nicht im Fokus. "
            f"Haltung/Trait „{trait}“ über Raum, Licht, Anordnung andeuten, kein Einzelportrait."
        ),
        "objects": (
            f"Stillleben: das zentrale Objekt von „{interest}“"
            + (f" und „{interest2}“" if interest2 else "")
            + " — Produktfotografie, neutraler Hintergrund."
        ),
        "ui": (
            f"Ruhige Interface-Ästhetik für „{anchor}“ — echte UI-Anmutung, kein generisches Dashboard-Template."
        ),
        "typography": (
            f"Editorial Typografie (Magazin/Poster) zum Ton von „{anchor}“ — Schrift als Form, kein Stock-Text-Bild."
        ),
    }


def category_shot_spec(
    *,
    category: str,
    persona: Persona,
    signals: MoodSignals,
    package: MoodboardStylePackage,
) -> str:
    """English photography brief for image models — category-specific, anti-generic."""
    cat = category.strip().lower()
    interest = _primary_interest(signals, package.keywords)
    interest2 = _secondary_interest(signals)
    trait = _trait_phrase(signals)
    custom = package.category_directions.get(cat, "")

    specs: dict[str, str] = {
        "textures": (
            f"SUBJECT: Extreme close-up macro of a material tied to «{interest}» "
            f"(fabric weave, leather grain, brushed metal, wood pore, ceramic glaze).\n"
            "CAMERA: 85–100mm macro lens, f/2.0–f/2.8, shallow depth of field, focus on surface fibers.\n"
            "LIGHT: Raking sidelight or soft window light to reveal tactile detail.\n"
            "FRAME: No humans, no faces, no screens, no office objects."
        ),
        "lifestyle": (
            f"SUBJECT: Document the actual hobby/interest «{interest}» in action — "
            "the activity, tools, vehicle, food, or environment is the hero.\n"
            "CAMERA: 35mm documentary, natural perspective, candid moment mid-action.\n"
            "LIGHT: Authentic available light (golden hour, workshop lamp, café window).\n"
            "FRAME: No corporate office, no businessman at laptop, no staged handshake."
        ),
        "objects": (
            f"SUBJECT: Hero still-life of the physical object(s) representing «{interest}»"
            + (f" and «{interest2}»" if interest2 else "")
            + " on a clean surface.\n"
            "CAMERA: 50mm product shot, slight angle, crisp focus on object, soft background falloff.\n"
            "LIGHT: Controlled softbox or window light, subtle reflection.\n"
            "FRAME: No people, no office desk clutter."
        ),
        "places": (
            f"SUBJECT: A specific lived-in place where «{interest}» or segment «{persona.segment}» belongs "
            f"(garage, alpine road pull-off, atelier, club lounge — not a generic coworking space).\n"
            "CAMERA: 24mm architectural interior or environmental wide, leading lines.\n"
            "LIGHT: Natural ambient, believable shadows.\n"
            "FRAME: Empty of posed business people."
        ),
        "colors": (
            f"SUBJECT: Abstract color and light study inspired by «{interest}» / mood «{package.mood_manifest[:80]}» — "
            "painted wall, stacked fabrics, sky gradient, or material swatches only.\n"
            "CAMERA: Flat lay or soft telephoto compression.\n"
            "FRAME: No people, no logos, no UI screenshots."
        ),
        "people": (
            f"SUBJECT: Small group (3–6) engaged around «{interest}» — backs, profiles, motion, or distance; "
            f"never a single portrait headshot. Suggest trait «{trait}» via composition "
            "(tight/loose grouping, calm vs energetic spacing, warm vs cool light).\n"
            "CAMERA: 28–35mm environmental wide, documentary street/family-dinner energy.\n"
            "FRAME: No office workers, no isolated smiling professional facing camera."
        ),
        "ui": (
            f"SUBJECT: Tasteful digital UI mood for «{persona.segment}» — sparse layout, real app chrome, "
            "one focal screen state.\n"
            "CAMERA: Straight-on device mock or cropped interface panel.\n"
            "FRAME: No stock dashboard collage, no fake charts spam."
        ),
        "typography": (
            f"SUBJECT: Editorial typography specimen (poster/magazine spread) echoing «{interest}» and tone — "
            "real letterforms, hierarchy, negative space.\n"
            "CAMERA: Flat graphic shot, slight paper texture.\n"
            "FRAME: No watermark, no lorem ipsum wall of text."
        ),
    }
    base = specs.get(cat, f"Editorial photograph for moodboard category {cat}.")
    if custom:
        base += f"\nART DIRECTOR NOTE: {custom}"
    return base


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
            "office worker at laptop",
            "solo business portrait",
            "forced smile handshake",
            "neon startup gradients",
            "empty buzzword poster",
            "watermark or logo",
            "same person in every tile",
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
    "lifestyle": "exact activity from interests — NOT office",
    "places": "specific place tied to interests",
    "colors": "abstract color study — no people",
    "textures": "macro material from interest — camera + DOF specified",
    "people": "group scene only — visualize traits via composition, NO solo portrait",
    "objects": "hero object from primary interest",
    "ui": "tasteful UI mood",
    "typography": "editorial type specimen"
  }},
  "avoid": ["5-10 banned motifs — office, handshake, solo headshot, etc."]
}}

Rules (mandatory):
- lifestyle/objects must depict the literal interest (e.g. sportscar, watches), never a random office person.
- textures: macro fabric/material, shallow DOF, NO humans.
- people: groups only, environmental wide — NO single portrait, NO corporate office.
- colors/places: no posed business people.
- Each direction: include camera/lens hint and what must NOT appear."""

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


def _stock_query_for_category(
    *,
    category: str,
    persona: Persona,
    signals: MoodSignals,
    package: MoodboardStylePackage,
) -> str:
    """Category-tuned stock search — avoids office/portrait traps."""
    cat = category.strip().lower()
    interest = _compact_phrase(_primary_interest(signals, package.keywords), max_words=4, max_chars=32)
    templates: dict[str, str] = {
        "textures": f"{interest} fabric macro texture close-up shallow depth",
        "lifestyle": f"{interest} hobby activity documentary authentic",
        "objects": f"{interest} object still life product photography",
        "places": f"{interest} interior architecture environmental wide",
        "colors": f"{interest} color palette material swatch abstract",
        "people": f"{interest} group friends gathering candid wide shot",
        "ui": f"minimal mobile app interface clean {interest}",
        "typography": f"editorial typography poster layout {interest}",
    }
    q = templates.get(cat, f"{interest} editorial photography")
    direction = package.category_directions.get(cat, "")
    if direction:
        hint = _compact_phrase(direction, max_words=3, max_chars=20)
        if hint:
            q = f"{hint} {q}"
    return " ".join(q.split())[:96]


def build_category_queries(
    *,
    persona: Persona,
    package: MoodboardStylePackage,
    categories: Iterable[str] = MOODBOARD_CATEGORIES,
) -> dict[str, str]:
    """Short Openverse/Pexels queries per category."""
    signals = extract_mood_signals(persona)
    return {
        cat: _stock_query_for_category(category=cat, persona=persona, signals=signals, package=package)
        for cat in categories
    }


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
    cat_norm = category.strip().lower()
    if cat_norm in _NO_PEOPLE_CATEGORIES:
        for bad in _OFFICE_BLOB_TERMS:
            if bad in blob:
                score -= 5.0
        if any(x in blob for x in ("portrait", "headshot", "business suit", "necktie")):
            score -= 4.0
    if cat_norm == "people" and any(x in blob for x in ("headshot", "studio portrait", "isolated on white")):
        score -= 5.0
    if cat_norm in {"textures", "colors"} and any(x in blob for x in ("face", "person", "people", "man ", "woman ")):
        score -= 6.0
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
) -> tuple[OpenverseImage | None, float]:
    if not candidates:
        return None, -999.0
    ranked = sorted(
        candidates,
        key=lambda img: score_stock_candidate(img, query=query, category=category, package=package),
        reverse=True,
    )
    best = ranked[0]
    best_score = score_stock_candidate(best, query=query, category=category, package=package)
    if best_score < -2 and len(ranked) > 1:
        alt = ranked[1]
        alt_score = score_stock_candidate(alt, query=query, category=category, package=package)
        if alt_score > best_score:
            return alt, alt_score
    return best, best_score


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
    signals = extract_mood_signals(persona)
    shot = category_shot_spec(category=category, persona=persona, signals=signals, package=package)
    avoid = "; ".join(package.avoid[:8])
    palette = ", ".join(package.palette_hints[:4])
    interests = ", ".join(signals.interests[:4]) or "—"
    traits = ", ".join(signals.traits[:4]) or "—"
    return (
        f"High-end editorial photograph for a persona moodboard (single frame, photorealistic).\n\n"
        f"PERSONA CONTEXT\n"
        f"- Name: {persona.name}\n"
        f"- Segment: {persona.segment}\n"
        f"- Headline: {persona.headline}\n"
        f"- Interests: {interests}\n"
        f"- Traits: {traits}\n"
        f"- Mood brief: {package.mood_manifest}\n"
        f"- Palette hints: {palette}\n\n"
        f"CATEGORY: {category.strip().lower()}\n"
        f"SHOT BRIEF\n{shot}\n\n"
        f"GLOBAL BANS: {avoid}. "
        f"No text overlays, no logos, no watermark, no AI plastic skin, no repeated generic office man. "
        f"Must match category rules exactly — do not default to a person in an office."
    )
