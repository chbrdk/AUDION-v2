"""Heuristics for natural persona turns: length hints, Du/Sie, optional imperfection (session-capped)."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Any, Literal

from ..core.config import get_settings
from .reply_mode import EXTENDED_SYSTEM_ADDENDUM, ReplyMode, has_extended_analytical_signals, infer_reply_mode

FormalityHint = Literal["du", "sie", "neutral"]


@dataclass
class TurnSessionState:
    """Per WebSocket connection (or future HTTP session)."""

    imperfections_used: int = 0
    assistant_turns: int = 0
    formality_locked: FormalityHint | None = None


@dataclass
class TurnNaturalnessSpec:
    """Output of build_turn_naturalness_spec, merged into the system prompt."""

    reply_mode: ReplyMode
    system_addendum_de: str
    allow_imperfection: bool
    imperfection_instruction: str | None = None


# Compact / ack turns (short replies expected)
_ACK_LINE_RE = re.compile(
    r"^(?:\s*(?:ok|okay|ja|nein|danke|thanks|thx|bitte|gern|gerne|tschüss|tschüss|bye|hallo|hi|moin|servus|na|super|alles\s+klar|passt|genau)\s*[!.…]*){1,4}\s*$",
    re.IGNORECASE | re.UNICODE,
)
_CONTINUE_RE = re.compile(
    r"^(?:und\??|weiter|und\s+so|mehr|noch\s*mal|nochmal|erzähl|go on|next)\s*\.?$",
    re.IGNORECASE,
)

# Du/Sie (simple heuristic; avoid matching "Sie" inside words)
_DU_TOKEN_RE = re.compile(
    r"(?:^|[^\w])(?:du|dir|dein|deine|deinem|deinen|euch|euer|euere)(?:[^\w]|$)",
    re.IGNORECASE,
)
_SIE_FORMAL_RE = re.compile(
    r"(?:^|[^\w])(?:Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren)(?:[^\w]|$)",
    re.IGNORECASE,
)


def extract_text_from_openai_content(content: Any) -> str:
    """Flatten OpenAI message content (string or multimodal list) to plain text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(str(block.get("text", "")))
                continue
            if isinstance(block, str):
                parts.append(block)
        return "\n".join(parts).strip()
    return str(content).strip()


def extract_last_two_user_texts(messages: list[dict[str, Any]]) -> tuple[str, str | None]:
    """Return (last_user_text, previous_user_text_or_none)."""
    users: list[str] = []
    for msg in messages:
        if msg.get("role") == "user":
            users.append(extract_text_from_openai_content(msg.get("content")))
    if not users:
        return "", None
    if len(users) == 1:
        return users[-1], None
    return users[-1], users[-2]


def _is_compact_ack_turn(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    if len(t) <= 3 and t.lower() in {"ok", "ja", "nein", "hi"}:
        return True
    if _ACK_LINE_RE.match(t):
        return True
    if len(t) <= 24 and _CONTINUE_RE.match(t):
        return True
    return False


def _formality_score(text: str) -> tuple[int, int]:
    """Return (informal_hits, formal_hits) for German du vs Sie."""
    if not text:
        return 0, 0
    informal = len(_DU_TOKEN_RE.findall(text))
    formal = len(_SIE_FORMAL_RE.findall(text))
    return informal, formal


def _resolve_formality(
    last: str,
    prev: str | None,
    session: TurnSessionState | None,
) -> tuple[FormalityHint, str]:
    """Return (hint, German instruction line for system addendum)."""
    combined = f"{prev or ''}\n{last}"
    inf, frm = _formality_score(combined)

    if inf >= 2 and inf > frm:
        hint: FormalityHint = "du"
        if session is not None:
            session.formality_locked = "du"
        return hint, "Der Nutzer spricht dich per Du an — antworte konsequent per Du."

    if frm >= 2 and frm > inf:
        hint = "sie"
        if session is not None:
            session.formality_locked = "sie"
        return hint, "Der Nutzer spricht dich per Sie an — antworte konsequent per Sie."

    if session and session.formality_locked in ("du", "sie"):
        locked = session.formality_locked
        line = (
            "Bleibe bei der zuletzt etablierten Anrede (Du)."
            if locked == "du"
            else "Bleibe bei der zuletzt etablierten Anrede (Sie)."
        )
        return locked, line

    if inf == 1 and frm == 0:
        return "du", "Der Nutzer nutzt Du — spiegeln, wenn es passt."
    if frm == 1 and inf == 0:
        return "sie", "Der Nutzer nutzt Sie — spiegeln, wenn es passt."

    return "neutral", "Keine eindeutige Du/Sie-Präferenz erkennbar — neutral und sachlich bleiben oder die Nutzerform wählen, die zur Persona passt."


def _length_guidance_de(
    *,
    reply_mode: ReplyMode,
    is_compact: bool,
    length_only_extended: bool,
) -> str:
    if is_compact:
        return (
            "Dieser Turn ist sehr kurz (Bestätigung, Dank, „weiter“). "
            "Antworte mit maximal ein bis zwei kurzen Sätzen, kein Vortrag."
        )
    if reply_mode == "extended" and length_only_extended:
        return (
            "Die Nutzerfrage ist lang, aber nicht zwingend tief analytisch. "
            "Antworte strukturiert, aber vermeide lange Wikipedia-artige Textwüsten; "
            "lieber fokussierte Absätze mit dem Wesentlichen."
        )
    if reply_mode == "extended":
        return (
            "Die Nutzerfrage ist anspruchsvoll oder analytisch. "
            "Du darfst ausführlicher antworten (ungefähr bis ~350 Wörter), mit klarer Struktur wo es hilft."
        )
    return (
        "Antworte knapp und natürlich (ungefähr bis ~90 Wörter, höchstens drei kurze Absätze), "
        "es sei denn, der Nutzer fordert ausdrücklich mehr Detail. "
        "Kein unnötiges Markdown (keine fetten Überschriften, keine Bullet-Wände), außer der Nutzer will Struktur."
    )


def build_turn_naturalness_spec(
    *,
    last_user_text: str,
    prev_user_text: str | None = None,
    session: TurnSessionState | None = None,
) -> TurnNaturalnessSpec:
    """
    Build reply mode (standard/extended), German system addendum, and optional imperfection line.
    Mutates ``session`` when imperfection is consumed or formality is locked.
    """
    settings = get_settings()
    last = (last_user_text or "").strip()
    base_mode = infer_reply_mode(last)

    is_compact = _is_compact_ack_turn(last)
    if is_compact:
        effective_mode: ReplyMode = "standard"
    else:
        effective_mode = base_mode

    # "Length-only extended": long text but no analytical keywords / multi-question
    length_only_extended = (
        effective_mode == "extended"
        and not has_extended_analytical_signals(last)
        and len(last) >= settings.chat_extended_min_chars
    )

    _formality_hint, formality_line = _resolve_formality(last, prev_user_text, session)

    lines: list[str] = [
        "\n\n[Antwort-Stil — automatisch, bitte befolgen]",
        _length_guidance_de(
            reply_mode=effective_mode,
            is_compact=is_compact,
            length_only_extended=length_only_extended,
        ),
    ]
    if (
        not is_compact
        and effective_mode == "standard"
        and len(last) >= 4
        and len(last) < 90
    ):
        lines.append(
            "Der Nutzerturn ist kurz — antworte ungefähr in ähnlicher Kürze (kein unnötiger Essay)."
        )
    lines.append(formality_line)

    allow_imperfection = False
    imperfection_instruction: str | None = None
    max_imp = settings.turn_naturalness_max_imperfections_per_session
    used_start = session.imperfections_used if session is not None else 0

    if session is not None and max_imp > 0 and used_start >= max_imp:
        lines.append(
            "Unperfektions-Budget für diese Session ist erschöpft — antworte direkt und flüssig."
        )

    if not is_compact and session is not None:
        p = float(settings.turn_naturalness_imperfection_probability)
        eligible = (
            max_imp > 0
            and used_start < max_imp
            and session.assistant_turns > 0
        )
        if eligible and p > 0:
            roll = 0.0 if p >= 1.0 else random.random()
            if p >= 1.0 or roll < p:
                allow_imperfection = True
                session.imperfections_used += 1
                imperfection_instruction = (
                    "Optional: ein kurzer, natürlicher Einstieg oder eine kleine Denkpause ist erlaubt "
                    "(nicht in jeder Antwort, keine Füllwörter-Schleifen, kein „als KI“). "
                    "Keine künstlichen Stockungen wiederholen."
                )
                lines.append(imperfection_instruction)
    elif not is_compact and session is None:
        lines.append(
            "Keine künstlichen Stockungen, keine übertriebene Unsicherheit, keine Meta-Kommentare zur KI."
        )

    system_addendum_de = "\n".join(lines)

    return TurnNaturalnessSpec(
        reply_mode=effective_mode,
        system_addendum_de=system_addendum_de,
        allow_imperfection=allow_imperfection,
        imperfection_instruction=imperfection_instruction,
    )


def compose_persona_system_prompt(
    base_system_prompt: str,
    *,
    reply_mode: ReplyMode,
    turn_naturalness_addendum: str,
) -> str:
    """Merge extended (English) structure hint and German naturalness addendum into the system prompt."""
    out = base_system_prompt
    if reply_mode == "extended":
        out += EXTENDED_SYSTEM_ADDENDUM
    if turn_naturalness_addendum:
        out += turn_naturalness_addendum
    return out


def finalize_turn_session_after_assistant(session: TurnSessionState | None) -> None:
    """Call after a successful assistant message (e.g. WebSocket) to advance turn counters."""
    if session is None:
        return
    session.assistant_turns += 1
