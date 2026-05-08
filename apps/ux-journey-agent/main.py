"""
UX Journey Agent HTTP API for CHECKION.
Uses browser-use (Playwright + LLM) to run autonomous browser tasks.
POST /run -> { url, task } -> { jobId }; GET /run/{jobId} -> status + result.
Screen recording is attempted for every run; GET /run/{jobId}/video returns the video (when browser-use supports record_video_dir).
"""
from __future__ import annotations

import asyncio
import base64
import glob
import inspect
import json
import os
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel

MJPEG_BOUNDARY = b"frame"

# Directory for recorded videos (per job)
VIDEO_BASE_DIR = Path(os.environ.get("UX_JOURNEY_VIDEO_DIR", "/tmp/ux-journey-videos"))
# Per-step viewport JPEGs (persists across video temp-dir cleanup). Served via GET /run/{jobId}/step/{n}/screenshot
STEP_SCREENSHOTS_BASE = Path(
    os.environ.get("UX_JOURNEY_STEP_SCREENSHOTS_DIR", str(VIDEO_BASE_DIR / "step-shots"))
)
# If true, also embed data:image/jpeg;base64,... in JSON (large; can break proxies / payload limits).
UX_JOURNEY_EMBED_SCREENSHOTS = (os.environ.get("UX_JOURNEY_EMBED_SCREENSHOTS", "0").strip().lower() in ("1", "true", "yes"))


def _agent_init_accepts_named_arg(sig: inspect.Signature, name: str) -> bool:
    """True if ``Agent(**{name: ...})`` is valid: explicit parameter or a ``**kwargs`` bucket."""
    if name in sig.parameters:
        return True
    return any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())


def _env_api_key_log_status(var_name: str) -> str:
    """Non-secret presence check for API keys in env (length only, never the value)."""
    v = (os.environ.get(var_name) or "").strip()
    if not v:
        return "absent"
    return f"present (length {len(v)})"


def _llm_repair_json_enabled() -> bool:
    """Best-effort normalization of browser-use ``AgentOutput`` JSON before Pydantic sees it."""
    v = (os.environ.get("UX_JOURNEY_LLM_REPAIR_JSON") or "0").strip().lower()
    return v in ("1", "true", "yes")


def _extract_balanced_json_object(text: str) -> str | None:
    """
    Return the first top-level `{ ... }` substring with balanced braces,
    respecting JSON double-quoted strings (so `{` inside strings are ignored).
    """
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    i = start
    n = len(text)
    while i < n:
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
        i += 1
    return None


def _repair_agent_output_dict(d: dict[str, Any]) -> dict[str, Any]:
    """
    Common production failure: ``action`` is a JSON *string* containing a list
    (``'[{...}]'``) instead of a real list — Pydantic ``list_type`` error.
    """
    out: dict[str, Any] = dict(d)
    act = out.get("action")
    if isinstance(act, str):
        t = act.strip()
        if t.startswith("["):
            try:
                parsed = json.loads(t)
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
            else:
                if isinstance(parsed, list):
                    out["action"] = parsed
    return out


def _repair_json_text(text: str) -> str:
    """
    Parse browser-use model output as JSON, fix known issues, re-encode.
    If parsing fails, return ``text`` unchanged.
    """
    s = (text or "").strip()
    if not s or not s.lstrip().startswith("{"):
        return text
    obj: Any = None
    try:
        obj = json.loads(s)
    except json.JSONDecodeError:
        chunk = _extract_balanced_json_object(s)
        if not chunk:
            return text
        try:
            obj = json.loads(chunk)
        except (json.JSONDecodeError, TypeError, ValueError):
            return text
    if not isinstance(obj, dict):
        return text
    fixed = _repair_agent_output_dict(obj)
    try:
        return json.dumps(fixed, ensure_ascii=False)
    except (TypeError, ValueError):
        return text


def _message_with_updated_content(msg: Any, new_content: Any) -> Any:
    """Return a copy of ``msg`` with ``content`` replaced (LangChain / Pydantic compatible)."""
    if hasattr(msg, "model_copy"):
        try:
            return msg.model_copy(update={"content": new_content})
        except Exception:
            pass
    if hasattr(msg, "copy"):
        try:
            return msg.copy(update={"content": new_content})  # type: ignore[call-arg]
        except Exception:
            pass
    try:
        clone = type(msg)(content=new_content)  # type: ignore[misc]
        for attr in ("id", "response_metadata", "usage_metadata"):
            if hasattr(msg, attr):
                try:
                    setattr(clone, attr, getattr(msg, attr))
                except Exception:
                    pass
        return clone
    except Exception:
        return msg


def _repair_ai_message(msg: Any) -> Any:
    """Apply `_repair_json_text` to string / text-part assistant content."""
    try:
        content = getattr(msg, "content", None)
        if content is None:
            return msg
        if isinstance(content, str):
            fixed = _repair_json_text(content)
            if fixed == content:
                return msg
            return _message_with_updated_content(msg, fixed)
        if isinstance(content, list):
            out_parts: list[Any] = []
            changed = False
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    t = part.get("text")
                    if isinstance(t, str):
                        ft = _repair_json_text(t)
                        if ft != t:
                            out_parts.append({**part, "text": ft})
                            changed = True
                            continue
                out_parts.append(part)
            if not changed:
                return msg
            return _message_with_updated_content(msg, out_parts)
        return msg
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ux-journey: LLM JSON repair failed (pass-through): {exc!r}", flush=True)
        return msg


class _RepairingLLMWrapper:
    """
    Delegates to a browser-use / LangChain chat model and post-processes assistant
    messages so malformed AgentOutput JSON has a chance to pass validation.
    """

    __slots__ = ("_inner",)

    def __init__(self, inner: Any) -> None:
        object.__setattr__(self, "_inner", inner)

    def __getattr__(self, name: str) -> Any:
        return getattr(object.__getattribute__(self, "_inner"), name)

    def __setattr__(self, name: str, value: Any) -> None:
        if name == "_inner":
            object.__setattr__(self, name, value)
        else:
            setattr(object.__getattribute__(self, "_inner"), name, value)

    async def ainvoke(self, input: Any, config: Any = None, **kwargs: Any) -> Any:
        inner = object.__getattribute__(self, "_inner")
        ainvoke_fn = getattr(inner, "ainvoke", None)
        if ainvoke_fn is not None:
            msg = await ainvoke_fn(input, config=config, **kwargs)
        else:
            import asyncio

            invoke_sync = getattr(inner, "invoke", None)
            if invoke_sync is None:
                raise RuntimeError("inner LLM has neither ainvoke() nor invoke()")
            msg = await asyncio.to_thread(invoke_sync, input, config=config, **kwargs)
        return _repair_ai_message(msg)

    def invoke(self, input: Any, config: Any = None, **kwargs: Any) -> Any:
        inner = object.__getattribute__(self, "_inner")
        fn = getattr(inner, "invoke", None)
        if fn is None:
            raise RuntimeError("inner LLM has no invoke()")
        msg = fn(input, config=config, **kwargs)
        return _repair_ai_message(msg)


def _maybe_wrap_llm_repair(llm: Any) -> Any:
    if not _llm_repair_json_enabled() or llm is None:
        return llm
    return _RepairingLLMWrapper(llm)

# Base pacing (seconds). Effective waits = these × UX_JOURNEY_SLOWMO. Defaults are tuned for readable video without extra env.
STEP_START_DELAY_SECONDS = float(os.environ.get("UX_JOURNEY_STEP_START_DELAY_SECONDS", "3.5"))
STEP_DELAY_SECONDS = float(os.environ.get("UX_JOURNEY_STEP_DELAY_SECONDS", "3.0"))
CLICK_CIRCLE_VISIBLE_SECONDS = float(os.environ.get("UX_JOURNEY_CLICK_CIRCLE_VISIBLE_SECONDS", "3.5"))
SCROLL_VISIBLE_SECONDS = float(os.environ.get("UX_JOURNEY_SCROLL_VISIBLE_SECONDS", "7.0"))
# Live viewport screenshot interval (seconds); lower = higher fps (0.04 = 25 fps)
LIVE_FRAME_INTERVAL = float(os.environ.get("UX_JOURNEY_LIVE_FRAME_INTERVAL", "0.04"))

# Global slow-motion factor for *recording*. Default 2 = ~2× longer pacing in the Playwright video at 1× playback.
# Override with UX_JOURNEY_SLOWMO=1 for snappier runs, or higher for more extreme slow-mo.
UX_JOURNEY_SLOWMO = float(os.environ.get("UX_JOURNEY_SLOWMO", os.environ.get("UX_JOURNEY_SLOWMO_MULTIPLIER", "2")))
if UX_JOURNEY_SLOWMO < 0.25:
    UX_JOURNEY_SLOWMO = 0.25
if UX_JOURNEY_SLOWMO > 12:
    UX_JOURNEY_SLOWMO = 12.0


def _slow(seconds: float) -> float:
    """Scale a pacing delay by UX_JOURNEY_SLOWMO (true slow-motion recording)."""
    return max(0.0, float(seconds) * UX_JOURNEY_SLOWMO)


# ---------------------------------------------------------------------------
# Job store (in-memory; replace with Redis/DB for multi-instance)
# ---------------------------------------------------------------------------

@dataclass
class JobState:
    job_id: str
    status: str  # "running" | "complete" | "error"
    url: str
    task: str
    persona: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    video_path: str | None = None  # path to recorded video file (if any)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Reference to the asyncio.Task running `run_agent` for this job. Stored
    # so a `POST /run/{jobId}/cancel` can `task.cancel()` it without touching
    # internal browser-use state. Cleared after the task settles.
    run_task: Any = None  # asyncio.Task — typed as Any to keep dataclass plain
    # Set to True by the cancel handler so `run_agent` knows the CancelledError
    # it observes is intentional and it should still finalize the recording
    # (instead of bubbling out as a hard failure).
    cancel_requested: bool = False

_jobs: dict[str, JobState] = {}
_jobs_lock = asyncio.Lock()

# Live viewport: agent ref and latest frame per job (only while job is running)
_live_agents: dict[str, Any] = {}
_live_frames: dict[str, tuple[float, bytes]] = {}

# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    url: str
    task: str
    persona: dict[str, Any] | None = None
    # Caller-supplied upper bound on agent steps. We clamp to a sane window
    # because browser-use can otherwise spin for many minutes if the LLM keeps
    # asking for more actions. When omitted, falls back to UX_JOURNEY_MAX_STEPS
    # (or 25). The frontend's `inspect_website` tool definition exposes this to
    # the chat LLM so personas can tighten/loosen the budget per request.
    max_steps: int | None = None

class RunResponse(BaseModel):
    jobId: str

# ---------------------------------------------------------------------------
# Browser-use agent runner (async, one job at a time per process)
# ---------------------------------------------------------------------------

def _resolve_llm_provider() -> str:
    """Effective provider given env vars. One of: ``anthropic`` / ``openai`` / ``unknown``."""
    raw = (os.environ.get("UX_JOURNEY_LLM_PROVIDER") or "auto").strip().lower()
    if raw in ("claude", "anthropic"):
        return "anthropic"
    if raw == "openai":
        return "openai"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    return "unknown"


def _build_anthropic_llm():
    try:
        from browser_use import ChatAnthropic
    except ImportError:
        from browser_use.llm.anthropic import ChatAnthropic
    try:
        max_tokens = int(os.environ.get("UX_JOURNEY_CLAUDE_MAX_TOKENS", "16384"))
    except ValueError:
        max_tokens = 16384
    llm = ChatAnthropic(
        model=os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6"),
        temperature=0,
        max_tokens=max_tokens,
    )
    return _maybe_wrap_llm_repair(llm)


def _build_openai_llm():
    try:
        from browser_use import ChatOpenAI
    except ImportError:
        from browser_use.llm.openai import ChatOpenAI
    # Default: GPT-4o. We deliberately do NOT default to the newer GPT-5.4
    # family (mini/nano/full): in production we observed `gpt-5.4-mini`
    # producing AgentOutput JSON with trailing characters (e.g. one extra
    # closing brace), which browser-use rejects via Pydantic and then halts
    # after 6 consecutive failures — fully defeating the point of the
    # fallback. GPT-4o has been the canonical example in browser-use's own
    # `fallback_model.py` since 2024 and reliably emits clean structured
    # output for the AgentOutput schema. Operators who want to test a newer
    # model can override via `UX_JOURNEY_OPENAI_MODEL` (e.g. `gpt-5.4-mini`,
    # `gpt-5.4-nano`, `gpt-5.4`, `gpt-5.5`).
    llm = ChatOpenAI(
        model=os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o"),
        temperature=0,
    )
    return _maybe_wrap_llm_repair(llm)


def _make_llm():
    """Create the primary LLM from env: Anthropic (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY)."""
    provider_raw = (os.environ.get("UX_JOURNEY_LLM_PROVIDER") or "auto").strip().lower()
    if provider_raw in ("claude", "anthropic") and not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("UX_JOURNEY_LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.")
    if provider_raw == "openai" and not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("UX_JOURNEY_LLM_PROVIDER=openai but OPENAI_API_KEY is not set.")

    provider = _resolve_llm_provider()
    if provider == "anthropic":
        # Default: Sonnet 4.6 (model id `claude-sonnet-4-6`). 4.6 is faster per
        # step than 4.0 and still solid on browser-use's strict structured
        # AgentOutput schema. Failure mode we've seen in production: the model
        # occasionally serialises the `action` field as a JSON-encoded string
        # instead of a list (Pydantic then rejects it as `list_type`). With a
        # different-provider fallback configured below, browser-use retries on
        # the next step against the fallback model and the run continues
        # instead of halting after 6 consecutive validation failures.
        return _build_anthropic_llm()
    if provider == "openai":
        return _build_openai_llm()
    raise RuntimeError("Set ANTHROPIC_API_KEY or OPENAI_API_KEY for the agent LLM.")


def _make_fallback_llm():
    """
    Build a *different-provider* LLM to hand to ``Agent(fallback_llm=...)``.

    Recent ``browser-use`` versions invoke the fallback not only on transient
    HTTP errors but also when the primary keeps producing AgentOutput that
    fails Pydantic validation (e.g. ``action`` returned as a JSON string
    instead of a list). Using the *same* provider as fallback is therefore
    pointless — we deliberately cross over to the other provider, but only if
    the user supplied a key for it. Returns ``None`` to leave fallback off
    (single-provider deployment, or user explicitly opted out via
    ``UX_JOURNEY_LLM_FALLBACK=0``).
    """
    if not _env_truthy("UX_JOURNEY_LLM_FALLBACK", "1"):
        return None
    provider = _resolve_llm_provider()
    try:
        if provider == "anthropic" and os.environ.get("OPENAI_API_KEY"):
            return _build_openai_llm()
        if provider == "openai" and os.environ.get("ANTHROPIC_API_KEY"):
            return _build_anthropic_llm()
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ux-journey: fallback_llm build failed: {exc!r}", flush=True)
    return None


def _llm_meta() -> dict[str, Any]:
    """Expose provider/model for debugging (does not include secrets)."""
    provider = _resolve_llm_provider()
    has_fallback = (
        _env_truthy("UX_JOURNEY_LLM_FALLBACK", "1")
        and (
            (provider == "anthropic" and bool(os.environ.get("OPENAI_API_KEY")))
            or (provider == "openai" and bool(os.environ.get("ANTHROPIC_API_KEY")))
        )
    )
    if provider == "anthropic":
        return {
            "provider": "anthropic",
            "model": os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6"),
            "max_tokens": os.environ.get("UX_JOURNEY_CLAUDE_MAX_TOKENS", "16384"),
            "repairJson": _llm_repair_json_enabled(),
            "fallback": (
                {"provider": "openai", "model": os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o")}
                if has_fallback
                else None
            ),
        }
    if provider == "openai":
        return {
            "provider": "openai",
            "model": os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o"),
            "repairJson": _llm_repair_json_enabled(),
            "fallback": (
                {
                    "provider": "anthropic",
                    "model": os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6"),
                }
                if has_fallback
                else None
            ),
        }
    return {"provider": "unknown", "model": "unknown", "repairJson": _llm_repair_json_enabled()}


def _decode_repr_escapes(value: str) -> str:
    """
    Values pulled from a Python repr like ``thinking='Foo:\\nBar'`` arrive with
    literal backslash-escape pairs (``\\n``, ``\\t``, ``\\'`` …) instead of the
    real characters. Decode them so the frontend can render proper line breaks
    and Markdown. Falls back to a manual replacement if ``unicode_escape``
    chokes on the input.
    """
    if not value:
        return value
    if "\\" not in value:
        return value
    try:
        # Round-trip via latin-1 to keep non-ASCII characters intact.
        return value.encode("latin-1", "backslashreplace").decode("unicode_escape")
    except Exception:
        return (
            value
            .replace("\\r\\n", "\n")
            .replace("\\n", "\n")
            .replace("\\t", "\t")
            .replace("\\'", "'")
            .replace('\\"', '"')
            .replace("\\\\", "\\")
        )


def _extract_thinking_text(text: str) -> str:
    """
    browser-use sometimes returns a flattened string like:
    thinking='...' evaluation_previous_goal='...' memory='...' next_goal='...'
    We only want the human-readable thinking.
    """
    s = (text or "").strip()
    if not s:
        return ""
    # Fast-path: looks like key='value' pairs and contains thinking=
    if "thinking=" in s:
        try:
            import re

            m = re.search(r"thinking=(?:'|\")(?P<v>.*?)(?:'|\")\s*(?:evaluation_previous_goal=|memory=|next_goal=|$)", s, re.DOTALL)
            if m and m.group("v") is not None:
                return _decode_repr_escapes(m.group("v")).strip()
        except Exception:
            pass
    # Some providers may return {"thought": "..."} like strings
    if s.startswith("{") and s.endswith("}"):
        try:
            obj = json.loads(s)
            if isinstance(obj, dict):
                v = obj.get("thinking") or obj.get("thought") or obj.get("reasoning")
                if isinstance(v, str):
                    return v.strip()
        except Exception:
            pass
    return s


def _extract_structured_model_output(text: str) -> dict[str, str] | None:
    """
    Try to extract structured fields from browser-use flattened outputs.
    Returns None if it doesn't look structured.
    """
    s = (text or "").strip()
    if not s:
        return None
    # Pattern: thinking='...' evaluation_previous_goal='...' memory='...' next_goal='...'
    if "thinking=" in s:
        try:
            import re

            def _pick(key: str) -> str:
                m = re.search(rf"{key}=(?:'|\")(?P<v>.*?)(?:'|\")", s, re.DOTALL)
                raw = m.group("v") if m and m.group("v") is not None else ""
                return _decode_repr_escapes(raw).strip()

            out = {
                "thinking": _pick("thinking"),
                "evaluation_previous_goal": _pick("evaluation_previous_goal"),
                "memory": _pick("memory"),
                "next_goal": _pick("next_goal"),
            }
            if any(v for v in out.values()):
                return out
        except Exception:
            return None
    # JSON-ish dict
    if s.startswith("{") and s.endswith("}"):
        try:
            obj = json.loads(s)
            if isinstance(obj, dict):
                out: dict[str, str] = {}
                for k in ("thinking", "thought", "reasoning", "evaluation_previous_goal", "memory", "next_goal"):
                    v = obj.get(k)
                    if isinstance(v, str) and v.strip():
                        out[k] = v.strip()
                if out:
                    return out
        except Exception:
            return None
    return None


def _persona_instruction(persona: dict[str, Any] | None) -> str:
    """Build a short instruction block from persona context (bounded length)."""
    if not persona or not isinstance(persona, dict):
        return ""
    try:
        persona_id = str(persona.get("id") or "").strip()
        name = str(persona.get("name") or "").strip()
        headline = str(persona.get("headline") or "").strip()
        profile = persona.get("profile")
        system_prompt = str(persona.get("systemPrompt") or "").strip()

        profile_json = ""
        if isinstance(profile, dict):
            slim = {
                k: profile.get(k)
                for k in (
                    "bio",
                    "location",
                    "values",
                    "interests",
                    "traits",
                    "painPoints",
                    "goals",
                    "communicationStyle",
                )
                if k in profile
            }
            profile_json = json.dumps(slim, ensure_ascii=False)[:4000]

        prompt_part = system_prompt[:2000] if system_prompt else ""

        parts = [
            "PERSONA_CONTEXT:",
            f"- id: {persona_id}" if persona_id else None,
            f"- name: {name}" if name else None,
            f"- headline: {headline}" if headline else None,
            f"- systemPrompt: {prompt_part}" if prompt_part else None,
            f"- profile: {profile_json}" if profile_json else None,
            _persona_policy_instruction(persona),
            "INSTRUCTION: Execute the task as if you were this persona. Base choices, attention, and actions on the persona context above.",
        ]
        text = "\n".join([p for p in parts if p])
        return (text.strip() + "\n\n") if text.strip() else ""
    except Exception:
        return ""


def _text_blob_from_persona(persona: dict[str, Any]) -> str:
    """Create a single text blob from persona fields for keyword scoring."""
    chunks: list[str] = []
    for k in ("name", "headline", "systemPrompt"):
        v = persona.get(k)
        if isinstance(v, str) and v.strip():
            chunks.append(v.strip())
    profile = persona.get("profile")
    if isinstance(profile, dict):
        for k in ("bio", "values", "interests", "traits", "painPoints", "goals", "communicationStyle", "location"):
            v = profile.get(k)
            if isinstance(v, str) and v.strip():
                chunks.append(v.strip())
            elif isinstance(v, list):
                chunks.extend([str(x).strip() for x in v if str(x).strip()])
            elif isinstance(v, dict):
                try:
                    chunks.append(json.dumps(v, ensure_ascii=False))
                except Exception:
                    pass
    return "\n".join(chunks).lower()


def _score_keywords(text: str, positives: list[str], negatives: list[str] | None = None) -> float:
    """
    Very small deterministic heuristic score in [0,1].
    positives increase score, negatives decrease score.
    """
    if not text:
        return 0.5
    pos = sum(1 for w in positives if w in text)
    neg = sum(1 for w in (negatives or []) if w in text)
    raw = pos - neg
    # squash into [0,1] without needing numpy
    if raw >= 4:
        return 1.0
    if raw <= -4:
        return 0.0
    return max(0.0, min(1.0, 0.5 + (raw * 0.12)))


def _persona_policy(persona: dict[str, Any] | None) -> dict[str, Any]:
    """
    Derive a navigation behavior policy from persona context.
    Dimensions are intentionally coarse but actionable for navigation choices.
    """
    if not persona or not isinstance(persona, dict):
        return {
            "dimensions": {
                "risk_aversion": 0.5,
                "time_pressure": 0.5,
                "exploration": 0.5,
                "detail_orientation": 0.5,
                "trust_skepticism": 0.5,
                "accessibility_need": 0.5,
            },
            "heuristics": [],
        }

    text = _text_blob_from_persona(persona)

    risk_aversion = _score_keywords(
        text,
        positives=["vorsichtig", "risk", "risiko", "sicher", "sicherheit", "skept", "misstrau", "datenschutz", "privacy", "vermeidet", "genau", "gründlich"],
        negatives=["mutig", "experimentier", "impuls", "spontan", "draufgänger"],
    )
    time_pressure = _score_keywords(
        text,
        positives=["schnell", "zeitdruck", "effizient", "kurz", "sofort", "dringend", "quick", "fast"],
        negatives=["geduldig", "in ruhe", "ausführlich", "genießen", "entspannt", "slow"],
    )
    exploration = _score_keywords(
        text,
        positives=["neugierig", "entdecken", "explor", "inspir", "stöbern", "ausprobieren", "varianten", "vergleich"],
        negatives=["ziel", "goal", "fokuss", "direkt", "straight", "nur das nötigste"],
    )
    detail_orientation = _score_keywords(
        text,
        positives=["detail", "zahlen", "daten", "spezifikation", "belege", "fakten", "gründlich", "analyse", "vergleich", "kriterien"],
        negatives=["oberflächlich", "gefühlt", "intuition", "kurz"],
    )
    trust_skepticism = _score_keywords(
        text,
        positives=["skept", "misstrau", "nachweis", "quelle", "bewertungen", "reviews", "garantie", "agb", "bedingungen", "impressum"],
        negatives=["vertrau", "markenloyal", "loyal", "fan"],
    )
    accessibility_need = _score_keywords(
        text,
        positives=["barriere", "accessib", "screenreader", "seh", "hör", "motor", "einfach", "klar", "groß", "kontrast"],
        negatives=["egal", "unwichtig"],
    )

    dims = {
        "risk_aversion": round(risk_aversion, 2),
        "time_pressure": round(time_pressure, 2),
        "exploration": round(exploration, 2),
        "detail_orientation": round(detail_orientation, 2),
        "trust_skepticism": round(trust_skepticism, 2),
        "accessibility_need": round(accessibility_need, 2),
    }

    heuristics: list[str] = []
    # Risk aversion
    if risk_aversion >= 0.66:
        heuristics.append("Prefer official navigation (menu/footer) over ads or unknown external links.")
        heuristics.append("Avoid suspicious popups; dismiss cookie banners safely; do not sign up unless required.")
    elif risk_aversion <= 0.34:
        heuristics.append("Willing to try alternative paths quickly if the first route is blocked.")

    # Time pressure
    if time_pressure >= 0.66:
        heuristics.append("Optimize for speed: use site search, direct model pages, and shortest path to the answer.")
    elif time_pressure <= 0.34:
        heuristics.append("Take time to scan the page; read labels carefully before clicking.")

    # Exploration vs goal-driven
    if exploration >= 0.66:
        heuristics.append("Explore 2–3 candidate paths before committing; compare options.")
    elif exploration <= 0.34:
        heuristics.append("Stay goal-driven: pick one most likely path and follow it end-to-end.")

    # Detail orientation
    if detail_orientation >= 0.66:
        heuristics.append("Prefer detailed sources (spec sheets, configurator, FAQs) over marketing pages.")
    elif detail_orientation <= 0.34:
        heuristics.append("Prefer summaries; avoid deep dives unless necessary.")

    # Trust / skepticism
    if trust_skepticism >= 0.66:
        heuristics.append("Verify claims via official pages and cross-check key facts when possible.")

    # Accessibility
    if accessibility_need >= 0.66:
        heuristics.append("Prefer simple flows, high-contrast pages, and avoid complex interactions when alternatives exist.")

    return {"dimensions": dims, "heuristics": heuristics[:12]}


def _persona_policy_instruction(persona: dict[str, Any] | None) -> str:
    """
    Insert a concise, actionable policy into the prompt to cause *behavioral* differences
    in navigation based on persona psychology.
    """
    policy = _persona_policy(persona)
    dims = policy.get("dimensions") if isinstance(policy, dict) else None
    heuristics = policy.get("heuristics") if isinstance(policy, dict) else None
    if not isinstance(dims, dict):
        return ""

    dim_line = ", ".join([f"{k}={dims.get(k)}" for k in ("risk_aversion", "time_pressure", "exploration", "detail_orientation", "trust_skepticism", "accessibility_need")])
    hs = [h for h in (heuristics or []) if isinstance(h, str) and h.strip()]
    hs = hs[:8]
    hs_block = "\n".join([f"- {h}" for h in hs]) if hs else ""

    return (
        "PERSONA_BEHAVIOR_POLICY:\n"
        f"- dimensions: {dim_line}\n"
        + ("- navigation_heuristics:\n" + hs_block + "\n" if hs_block else "")
        + "INSTRUCTION: When choosing actions, explicitly let the policy influence your choices. In your thinking, mention which dimension(s) drove the decision (e.g., risk_aversion, time_pressure).\n"
    )


def _smart_trim(text: str, *, limit: int, soft_floor_ratio: float = 0.6) -> str:
    """
    Hard-cap a user-facing reasoning snippet at `limit` chars without breaking
    mid-word when possible. The card UI lays each accordion section out in 1–3
    short lines, so anything beyond this cap is just visual noise.

    `soft_floor_ratio` decides when we're willing to truncate at the last
    whitespace vs. cutting mid-word — only if the whitespace is past
    `soft_floor_ratio * limit`, otherwise we'd produce comically short clips.

    Idempotent w.r.t. ellipsis: if the input already ends in `…` (or the
    LLM-typed three-dot sequence `...`), we never append another one — that
    would produce visually broken `……` / `…...` tails when a verbose model
    output happens to also be over budget.
    """
    if not text:
        return text
    s = text.strip()
    if len(s) <= limit:
        return s
    clipped = s[: max(1, limit - 1)].rstrip()
    last_space = clipped.rfind(" ")
    if last_space > int(limit * soft_floor_ratio):
        clipped = clipped[:last_space]
    clipped = clipped.rstrip(" ,;:.-…")
    if clipped.endswith("..."):
        clipped = clipped[:-3].rstrip(" ,;:.-")
    return clipped + "…"


def _normalize_action_entry(entry: Any) -> tuple[str, str, str]:
    """Extract (action_label, target, result) from one action_history entry. Entry can be dict, list of dicts, or object."""
    action_label = "step"
    target = ""
    result = ""
    raw: Any = entry
    if isinstance(entry, (list, tuple)) and len(entry) > 0:
        raw = entry[0]
    # Handle list of dicts (e.g. [{'navigate': {...}, 'result': '...'}])
    if isinstance(raw, (list, tuple)) and len(raw) > 0:
        raw = raw[0]
    # Caps: most action results are browser-use's own short status strings
    # (e.g. "Navigated to https://…", "Clicked button at index 12"). The one
    # exception is the final `done` step whose `text` IS the LLM's per-journey
    # summary — the prompt now constrains it to ~4 sentences / 6 bullets, but
    # we still safety-net it here. `_smart_trim` keeps word boundaries.
    # Caps were bumped after observing that 220/600 cut legitimate fact-dense
    # results (page-content snippets browser-use captured, multi-line success
    # confirmations, etc.). New values still keep the cards readable but stop
    # truncating mid-list.
    INTERMEDIATE_RESULT_CAP = 480   # browser-use status messages occasionally include captured page content
    DONE_RESULT_CAP = 1200           # final summary — multi-paragraph + bullet lists fit cleanly
    if not isinstance(raw, dict):
        # May be an object with __dict__ or attributes
        res = getattr(raw, "result", None) or ""
        result = _smart_trim(str(res), limit=INTERMEDIATE_RESULT_CAP)
        return (getattr(raw, "name", str(raw))[:50] if hasattr(raw, "name") else str(raw)[:50], "", result)
    # Keys like 'navigate', 'click', 'done' with payload; plus 'result' or 'interacted_element'
    res = raw.get("result") or ""
    elem = raw.get("interacted_element")
    if "navigate" in raw:
        pl = raw["navigate"] or {}
        url = pl.get("url", "")
        action_label = "navigate"
        target = url
        result = _smart_trim(str(res or ""), limit=INTERMEDIATE_RESULT_CAP)
    elif "click" in raw:
        pl = raw["click"] or {}
        action_label = "click"
        if elem is not None:
            attrs = getattr(elem, "attributes", None) or {}
            if isinstance(attrs, dict):
                target = attrs.get("ax_name") or attrs.get("aria-label") or attrs.get("href") or ""
            target = target or getattr(elem, "x_path", "") or str(pl.get("index", ""))
        else:
            target = str(pl.get("index", ""))
        result = _smart_trim(str(res or ""), limit=INTERMEDIATE_RESULT_CAP)
    elif "done" in raw:
        pl = raw["done"] or {}
        action_label = "done"
        target = "—"
        result = _smart_trim(str(pl.get("text") or res or ""), limit=DONE_RESULT_CAP)
    else:
        key = next((k for k in raw if k not in ("result", "interacted_element")), "step")
        action_label = str(key)
        target = str(raw.get(key, ""))[:200] if isinstance(raw.get(key), dict) else ""
        result = _smart_trim(str(res or ""), limit=INTERMEDIATE_RESULT_CAP)
    return (action_label, target, result)


def _get_model_thoughts(history: Any) -> list[dict[str, Any]]:
    """Extract model outputs per step from browser-use history, best-effort structured."""
    out: list[dict[str, Any]] = []
    try:
        if hasattr(history, "model_thoughts") and callable(history.model_thoughts):
            raw = list(history.model_thoughts())
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, str):
                        structured = _extract_structured_model_output(item)
                        out.append({"thinking": _extract_thinking_text(item), "structured": structured, "raw": item})
                    elif item is not None:
                        s = str(item)
                        structured = _extract_structured_model_output(s)
                        out.append({"thinking": _extract_thinking_text(s), "structured": structured, "raw": s})
        if not out and hasattr(history, "model_outputs") and callable(history.model_outputs):
            raw = list(history.model_outputs())
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, str):
                        structured = _extract_structured_model_output(item)
                        out.append({"thinking": _extract_thinking_text(item), "structured": structured, "raw": item})
                    elif isinstance(item, dict) and item.get("thought"):
                        s = str(item["thought"])
                        structured = _extract_structured_model_output(s)
                        out.append({"thinking": _extract_thinking_text(s), "structured": structured, "raw": s})
                    elif item is not None:
                        s = str(item)
                        structured = _extract_structured_model_output(s)
                        out.append({"thinking": _extract_thinking_text(s), "structured": structured, "raw": s})
    except Exception:
        pass
    return out


def _history_to_steps(history: Any) -> list[dict[str, Any]]:
    """Map browser-use action_history to CHECKION steps (readable labels, target, result, reasoning)."""
    steps: list[dict[str, Any]] = []
    try:
        actions = list(history.action_history()) if hasattr(history, "action_history") and callable(history.action_history) else []
        thoughts = _get_model_thoughts(history)
        for i, action_item in enumerate(actions):
            step_num = i + 1
            action_label, target, result = _normalize_action_entry(action_item)
            step_entry: dict[str, Any] = {
                "step": step_num,
                "action": action_label,
                "target": target or None,
                "result": result or None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            if i < len(thoughts):
                thinking = str(thoughts[i].get("thinking") or "").strip()
                if thinking:
                    # Server-side safety net for `thinking`. Generous so we only
                    # trip on real LLM monologues (>3–4 sentences), not on
                    # legitimate dense reasoning. The prompt does the actual
                    # brevity work; this is just a guardrail.
                    step_entry["reasoning"] = _smart_trim(thinking, limit=600)
                structured = thoughts[i].get("structured")
                if isinstance(structured, dict) and any(str(v or "").strip() for v in structured.values()):
                    # Caps for the structured sections. Earlier we used 140–180
                    # which was clipping legitimate fact-dense content (specs,
                    # dimensions, element IDs the LLM stored for re-use). New
                    # values give the LLM enough room to capture concrete
                    # evidence without surrendering "Card stays compact" —
                    # all three render as their own accordion that the user
                    # opens on demand.
                    step_entry["reasoningMeta"] = {
                        "evaluation_previous_goal": _smart_trim(
                            str(structured.get("evaluation_previous_goal") or ""), limit=420
                        ) or None,
                        # Memory is the most info-dense field by design — it
                        # accumulates reusable facts across steps. We give it
                        # the most headroom so spec sheets / dimensions / IDs
                        # never get truncated mid-list.
                        "memory": _smart_trim(
                            str(structured.get("memory") or ""), limit=720
                        ) or None,
                        "next_goal": _smart_trim(
                            str(structured.get("next_goal") or ""), limit=360
                        ) or None,
                    }
            steps.append(step_entry)
        if not steps and hasattr(history, "urls") and callable(history.urls):
            for i, u in enumerate(history.urls()):
                steps.append({
                    "step": i + 1,
                    "action": "navigate",
                    "target": u,
                    "result": None,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    except Exception as e:
        steps = [{
            "step": 1,
            "action": "run",
            "target": None,
            "result": str(e)[:500],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }]
    return steps


def _history_success(history: Any) -> bool:
    """Whether the agent run completed successfully."""
    if hasattr(history, "is_done") and callable(history.is_done):
        return bool(history.is_done())
    return True


def _history_screenshots(history: Any) -> list[str]:
    """Extract screenshot base64 strings from history (if any)."""
    if not hasattr(history, "screenshots") or not callable(history.screenshots):
        return []
    try:
        out = list(history.screenshots())
        return out if isinstance(out, list) else []
    except Exception:
        return []

def _merge_step_screenshots(*, base_steps: list[dict[str, Any]], overlay_steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Merge screenshot fields from overlay_steps into base_steps by step number.
    We keep base_steps order/content, and only copy `screenshot` / `screenshotUrl` when present.
    """
    try:
        by_shot: dict[int, str] = {}
        by_url: dict[int, str] = {}
        for s in overlay_steps or []:
            if not isinstance(s, dict):
                continue
            n = s.get("step")
            if not isinstance(n, int):
                continue
            shot = s.get("screenshot")
            if isinstance(shot, str) and shot.strip():
                by_shot[n] = shot
            url = s.get("screenshotUrl")
            if isinstance(url, str) and url.strip():
                by_url[n] = url
        if not by_shot and not by_url:
            return base_steps
        merged: list[dict[str, Any]] = []
        for s in base_steps or []:
            if not isinstance(s, dict):
                merged.append(s)
                continue
            n = s.get("step")
            if isinstance(n, int):
                has_shot = isinstance(s.get("screenshot"), str) and bool(s.get("screenshot", "").strip())
                has_url = isinstance(s.get("screenshotUrl"), str) and bool(s.get("screenshotUrl", "").strip())
                if n in by_shot and not has_shot:
                    s = {**s, "screenshot": by_shot[n]}
                if n in by_url and not has_url:
                    s = {**s, "screenshotUrl": by_url[n]}
            merged.append(s)
        return merged
    except Exception:
        return base_steps


def _step_screenshot_path(job_id: str, step_no: int) -> Path:
    return STEP_SCREENSHOTS_BASE / job_id / f"{step_no}.jpg"


def _latest_step_screenshot_bytes(job_id: str) -> bytes | None:
    """Newest per-step JPEG on disk (same dir as GET .../step/{n}/screenshot)."""
    d = STEP_SCREENSHOTS_BASE / job_id
    if not d.is_dir():
        return None
    best: Path | None = None
    best_n = -1
    for p in d.glob("*.jpg"):
        try:
            n = int(p.stem)
        except ValueError:
            continue
        if n > best_n:
            best_n = n
            best = p
    if best and best.is_file():
        try:
            return best.read_bytes()
        except OSError:
            return None
    return None


async def _publish_partial_steps(
    *,
    job_id: str,
    agent_instance: Any,
    task: str,
    domain: str,
    persona: dict[str, Any] | None,
) -> None:
    """Write latest steps + per-step screenshot file + small JSON (screenshotUrl, not huge base64)."""
    try:
        steps_now = _history_to_steps(agent_instance.history)
        steps_now = steps_now[-60:]
        try:
            async with _jobs_lock:
                prev = _jobs.get(job_id).result if job_id in _jobs and _jobs.get(job_id) else None
            prev_steps = prev.get("steps") if isinstance(prev, dict) else None
            if isinstance(prev_steps, list) and prev_steps:
                steps_now = _merge_step_screenshots(base_steps=steps_now, overlay_steps=prev_steps)
        except Exception:
            pass

        jpeg: bytes | None = None
        frame = _live_frames.get(job_id)
        if frame and isinstance(frame, tuple) and len(frame) == 2:
            jpeg = frame[1]
        if not jpeg:
            jpeg = await _capture_live_frame(agent_instance)

        if jpeg:
            _live_frames[job_id] = (time.monotonic(), jpeg)

        if jpeg and steps_now:
            last = steps_now[-1]
            step_num = last.get("step")
            if isinstance(step_num, int):
                out = _step_screenshot_path(job_id, step_num)
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(jpeg)
                rel = f"/run/{job_id}/step/{step_num}/screenshot"
                last["screenshotUrl"] = rel
                if UX_JOURNEY_EMBED_SCREENSHOTS:
                    last["screenshot"] = f"data:image/jpeg;base64,{base64.b64encode(jpeg).decode('ascii')}"
                else:
                    last.pop("screenshot", None)

        partial: dict[str, Any] = {
            "jobId": job_id,
            "taskDescription": task,
            "siteDomain": domain,
            "steps": steps_now,
            "success": None,
        }
        if persona and isinstance(persona, dict):
            partial["persona"] = {"id": persona.get("id"), "name": persona.get("name")}
        async with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id].result = partial
    except Exception:
        pass


def _decode_b64_image(value: str) -> bytes | None:
    """Decode a possibly data-URL-prefixed base64 string into bytes."""
    if not isinstance(value, str) or not value:
        return None
    raw = value.split(",", 1)[1] if value.startswith("data:") else value
    try:
        return base64.b64decode(raw)
    except Exception:
        return None


def _latest_history_screenshot_bytes(agent: Any) -> bytes | None:
    """Most recent screenshot maintained by browser-use itself (works across 0.11+ versions)."""
    history = getattr(agent, "history", None)
    if history is None:
        return None
    try:
        screenshots = (
            history.screenshots(n_last=1, return_none_if_not_screenshot=False)
            if hasattr(history, "screenshots")
            else None
        )
    except Exception:
        screenshots = None
    if screenshots:
        latest = screenshots[-1] if isinstance(screenshots, list) else screenshots
        decoded = _decode_b64_image(latest) if isinstance(latest, str) else None
        if decoded:
            return decoded
    try:
        paths = (
            history.screenshot_paths(n_last=1, return_none_if_not_screenshot=False)
            if hasattr(history, "screenshot_paths")
            else None
        )
    except Exception:
        paths = None
    if paths:
        path = paths[-1] if isinstance(paths, list) else paths
        if isinstance(path, str) and path:
            try:
                with open(path, "rb") as fh:
                    data = fh.read()
                    if data:
                        return data
            except OSError:
                pass
    return None


async def _capture_live_frame_diag(agent: Any) -> dict[str, Any]:
    """Run all capture paths and report which one (if any) yielded JPEG bytes.

    Returned dict keys:
      ``path``           – first path that succeeded (``history`` | ``page`` | ``cdp`` | ``none``).
      ``bytes``          – the captured JPEG (``bytes``) or ``None``.
      ``size``           – byte length of capture (``int``).
      ``probes``         – per-path probe info (status / error per path).
      ``agent``          – which agent attributes are available (for sanity).
    """
    probes: dict[str, Any] = {}
    captured: bytes | None = None
    path_used: str = "none"

    bs = getattr(agent, "browser_session", None) or getattr(agent, "browser", None)
    agent_info = {
        "has_history": hasattr(agent, "history"),
        "has_browser_session": hasattr(agent, "browser_session"),
        "has_browser": hasattr(agent, "browser"),
        "browser_session_type": type(bs).__name__ if bs is not None else None,
    }

    # 1) browser-use history (preferred)
    try:
        history = getattr(agent, "history", None)
        history_probe: dict[str, Any] = {"available": history is not None}
        if history is not None:
            try:
                raw_history = getattr(history, "history", None)
                history_probe["length"] = (
                    len(raw_history) if isinstance(raw_history, (list, tuple)) else None
                )
            except Exception as exc:
                history_probe["length_error"] = repr(exc)
            try:
                screenshots = (
                    history.screenshots(n_last=1, return_none_if_not_screenshot=False)
                    if hasattr(history, "screenshots")
                    else None
                )
                history_probe["screenshots_n_last"] = (
                    len(screenshots) if isinstance(screenshots, list) else 0
                )
            except Exception as exc:
                screenshots = None
                history_probe["screenshots_error"] = repr(exc)
        history_jpeg = _latest_history_screenshot_bytes(agent)
        history_probe["captured"] = bool(history_jpeg)
        if history_jpeg and not captured:
            captured = history_jpeg
            path_used = "history"
        probes["history"] = history_probe
    except Exception as exc:
        probes["history"] = {"error": repr(exc)}

    # 2) Playwright page.screenshot
    try:
        page = (
            (getattr(bs, "page", None) if bs is not None else None)
            or (getattr(bs, "current_page", None) if bs is not None else None)
            or getattr(agent, "page", None)
        )
        page_probe: dict[str, Any] = {
            "page_available": page is not None,
            "has_screenshot": page is not None and hasattr(page, "screenshot"),
        }
        if not captured and page is not None and hasattr(page, "screenshot"):
            try:
                result = await page.screenshot(type="jpeg", quality=80)
                if isinstance(result, bytes):
                    captured = result
                    path_used = "page"
                    page_probe["captured"] = True
                else:
                    page_probe["captured"] = False
                    page_probe["unexpected_type"] = type(result).__name__
            except Exception as exc:
                page_probe["error"] = repr(exc)
        probes["page"] = page_probe
    except Exception as exc:
        probes["page"] = {"error": repr(exc)}

    # 3) CDP Page.captureScreenshot
    try:
        cdp_probe: dict[str, Any] = {
            "browser_session_available": bs is not None,
            "has_get_or_create_cdp_session": bs is not None
            and hasattr(bs, "get_or_create_cdp_session"),
        }
        if not captured and bs is not None and hasattr(bs, "get_or_create_cdp_session"):
            try:
                cdp = await bs.get_or_create_cdp_session()
                cdp_probe["cdp_session"] = cdp is not None
                if cdp is not None:
                    send = None
                    if hasattr(cdp, "cdp_client"):
                        send = getattr(cdp.cdp_client, "send", None)
                    elif hasattr(cdp, "send"):
                        send = cdp.send
                    cdp_probe["has_send"] = send is not None
                    if send is not None:
                        Page = getattr(send, "Page", None)
                        cdp_probe["has_page_domain"] = Page is not None
                        if Page is not None:
                            capture = getattr(Page, "capture_screenshot", None) or getattr(
                                Page, "captureScreenshot", None
                            )
                            cdp_probe["has_capture"] = capture is not None
                            if capture is not None:
                                kwargs: dict[str, Any] = {"format": "jpeg", "quality": 80}
                                if hasattr(cdp, "session_id") and cdp.session_id is not None:
                                    kwargs["session_id"] = cdp.session_id
                                try:
                                    result = await capture(**kwargs)
                                    if isinstance(result, dict) and result.get("data"):
                                        captured = base64.b64decode(result["data"])
                                        path_used = "cdp"
                                        cdp_probe["captured"] = True
                                    else:
                                        cdp_probe["captured"] = False
                                        cdp_probe["unexpected_response"] = (
                                            type(result).__name__
                                        )
                                except Exception as exc:
                                    cdp_probe["capture_error"] = repr(exc)
            except Exception as exc:
                cdp_probe["session_error"] = repr(exc)
        probes["cdp"] = cdp_probe
    except Exception as exc:
        probes["cdp"] = {"error": repr(exc)}

    return {
        "path": path_used,
        "bytes": captured,
        "size": len(captured) if captured else 0,
        "probes": probes,
        "agent": agent_info,
    }


async def _capture_live_frame(agent: Any) -> bytes | None:
    """Best-effort viewport JPEG.

    Order:
    1. browser-use ``history.screenshots(n_last=1)`` — populated by the agent on every step,
       works across 0.11+ versions where ``browser_session`` is just an alias for ``Browser``.
    2. ``page.screenshot`` (older browser-use that exposed a Playwright page).
    3. CDP ``Page.captureScreenshot`` via ``get_or_create_cdp_session`` (legacy path).
    """
    diag = await _capture_live_frame_diag(agent)
    return diag.get("bytes")


async def _live_screenshot_loop(job_id: str) -> None:
    """Background task: capture viewport at LIVE_FRAME_INTERVAL and store in _live_frames."""
    while job_id in _live_agents:
        try:
            agent = _live_agents.get(job_id)
            if agent:
                jpeg = await _capture_live_frame(agent)
                if jpeg:
                    _live_frames[job_id] = (time.monotonic(), jpeg)
        except asyncio.CancelledError:
            break
        except Exception:
            pass
        await asyncio.sleep(LIVE_FRAME_INTERVAL * UX_JOURNEY_SLOWMO)


async def _history_watcher_loop(
    *,
    job_id: str,
    task: str,
    domain: str,
    persona: dict[str, Any] | None,
) -> None:
    """Publish partial steps whenever the agent's history grows.

    Independent of browser-use's ``on_step_end`` hook (which may not fire on every
    version) – ensures the UI keeps receiving steps + screenshots even when the
    callback API differs.
    """
    last_seen = -1
    while job_id in _live_agents:
        try:
            agent = _live_agents.get(job_id)
            if agent is not None:
                history = getattr(agent, "history", None)
                length: int = 0
                if history is not None:
                    raw_history = getattr(history, "history", None)
                    if isinstance(raw_history, (list, tuple)):
                        length = len(raw_history)
                    elif hasattr(history, "number_of_steps"):
                        try:
                            length = int(history.number_of_steps())
                        except Exception:
                            length = 0
                if length > last_seen:
                    last_seen = length
                    await _publish_partial_steps(
                        job_id=job_id,
                        agent_instance=agent,
                        task=task,
                        domain=domain,
                        persona=persona,
                    )
        except asyncio.CancelledError:
            break
        except Exception:
            pass
        await asyncio.sleep(1.0)


async def run_agent(
    job_id: str,
    url: str,
    task: str,
    persona: dict[str, Any] | None = None,
    *,
    max_steps_override: int | None = None,
) -> None:
    try:
        from browser_use import Agent, Browser
    except ImportError as e:
        async with _jobs_lock:
            j = _jobs.get(job_id)
            if j:
                j.status = "error"
                j.error = f"browser-use not available: {e}"
        return

    async with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].status = "running"

    browser = None
    VIDEO_BASE_DIR.mkdir(parents=True, exist_ok=True)
    video_dir = str(VIDEO_BASE_DIR / job_id)
    os.makedirs(video_dir, exist_ok=True)

    # Stable domain label (also used for partial progress results)
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc or url
    except Exception:
        domain = url

    try:
        llm = _make_llm()
        if _llm_repair_json_enabled():
            print(
                f"ux-journey: job={job_id} UX_JOURNEY_LLM_REPAIR_JSON=1 "
                "(best-effort AgentOutput JSON repair after each LLM call)",
                flush=True,
            )
        try:
            browser = Browser(record_video_dir=video_dir)
        except TypeError:
            browser = Browser()
        # Prefer initial_url if supported; else bake URL into task. Instruct model to output reasoning in German.
        sig = inspect.signature(Agent.__init__)
        # Prompt-shaping to reduce premature "done" decisions.
        # Note: max_steps only sets an upper bound; the agent can still stop early if it thinks it's done.
        min_steps = int(os.environ.get("UX_JOURNEY_MIN_STEPS", "6"))
        german_instruction = (
            "WICHTIG: Formuliere alle deine Überlegungen und Gedanken (thinking/reasoning) ausschließlich auf Deutsch. "
            # Unified brevity rule for ALL per-step LLM-controlled text fields.
            # Without this, browser-use tends to produce 4–8 satzlange Reflexionen
            # pro Step (Persona-Bezug, Beobachtung, Hypothese, Plan, Begründung,
            # Risiko-Abwägung). Im Card-UI ist davon nur das Pointierte nützlich —
            # alles andere macht die Accordion-Tiles unnötig hoch und treibt die
            # Output-Tokens (= Latenz pro Step).
            "WICHTIG: Halte ALLE Reasoning-Felder KOMPAKT und ohne Wiederholung — aber NIE auf Kosten konkreter Fakten. "
            "Wenn du Specs (Zahlen, Maße, IDs, URLs) nennst, sind die wichtiger als Brevity: lieber den vollständigen "
            "Fakten-Satz, als ihn mitten in einer Aufzählung abbrechen. Konkret pro Feld:\n"
            "- 'thinking': 1–3 knackige Sätze. Format "
            "'<beobachtung in halbsatz> → <handlung+begründung in halbsatz>'. "
            "Kein 'Ich sehe…'/'Ich beobachte…'-Geplauder.\n"
            "- 'evaluation_previous_goal': 1–2 Sätze. Knappe Bewertung wie "
            "'Erfolgreich: Cookie-Banner geschlossen' oder 'Teilweise: Suche zeigt 0 Treffer, Filter werden ignoriert'. "
            "Keine erneute Beschreibung der Aktion.\n"
            "- 'memory': Konkrete Fakten für spätere Schritte (1–3 Sätze), inkl. Zahlen/Maße/IDs wenn relevant. "
            "Nur neue/relevante Erkenntnisse — KEIN Aufzählen aller bisherigen Schritte. "
            "Kein Floskel-Auftakt wie 'Bisher habe ich…'.\n"
            "- 'next_goal': 1–2 Sätze. Konkretes nächstes Ziel + erwartetes Element/Selektor, "
            "z.B. 'Auf Service-Tab klicken (Index 12), um Leistungen zu sehen'. Keine Begründung mit 3 Alternativen.\n"
            "- 'done.text' (Final-Resultat): max. 4 kurze Sätze oder 6 Bulletpoints. "
            "Fakten-fokussiert: Was wurde wirklich gesehen/gefunden, was nicht. Keine Zusammenfassung der Schritt-Reihenfolge — "
            "nur das, was die Persona aus dem Besuch mitnimmt.\n"
            "Persona-Bezug NUR, wenn er die Entscheidung tatsächlich beeinflusst — sonst weglassen. "
            # Anti-cliffhanger rule. Without this, the LLM tends to use „neben…",
            # „und mehr…", „etc." as a brevity hack — leaving the user with
            # half-formed thoughts. We require complete sentences within the
            # budget instead, with concrete examples when listing things.
            "WICHTIG: Schreibe in ALLEN Feldern vollständige, abgeschlossene Sätze. "
            "Verwende NIEMALS '…', '...', 'etc.', 'usw.', 'u. a.', 'und mehr' oder ähnliche Auslassungs-Marker als Platzhalter "
            "für unausgesprochene Inhalte. Wenn du Beispiele aufzählst, nenne 2–3 KONKRETE Beispiele "
            "(z. B. 'Automotive, Manufacturing, FinServ') oder lass die Aufzählung weg. "
            "Falls dir der Inhalt zu lang würde, kürze die Begründung oder den Persona-Bezug — aber NIE die konkreten Fakten. "
            "WICHTIG: Beende die Journey NICHT zu früh. Markiere erst dann als 'done'/'fertig', wenn du das Ziel wirklich erreicht hast "
            "UND es anhand sichtbarer UI-Indikatoren verifiziert hast (z.B. Bestätigungsseite, eindeutiger State, URL, Erfolgsmeldung). "
            f"WICHTIG: Beende NICHT vor mindestens {min_steps} Schritten. Wenn das Ziel früher erreicht wirkt, nutze die restlichen Schritte für "
            "Validierung (zurück/nach vorne, alternative Navigation, erneute Sichtprüfung), statt zu stoppen. "
        )
        persona_instr = _persona_instruction(persona)
        task_with_lang = german_instruction + persona_instr + task
        # Per-request override (from chat-api / direct callers) wins over the
        # process-wide env default. Clamp to a sensible 3..30 window — values
        # outside that range usually indicate a confused LLM, not intent.
        env_default_max_steps = int(os.environ.get("UX_JOURNEY_MAX_STEPS", "25"))
        if isinstance(max_steps_override, int) and max_steps_override > 0:
            max_steps = max(3, min(30, max_steps_override))
        else:
            max_steps = env_default_max_steps
        agent_kw: dict[str, Any] = {"task": task_with_lang, "llm": llm, "browser": browser}
        # Cross-provider fallback so a single bad AgentOutput from the primary
        # (e.g. Claude returning `action` as a JSON-encoded string instead of a
        # list — Pydantic rejects it) can switch to the other provider.  We must
        # pass ``fallback_llm`` whenever the constructor accepts it *or* has
        # ``**kwargs`` — some browser-use builds only expose optional params via
        # ``**kwargs``, and ``"fallback_llm" in sig.parameters`` was false.
        fallback_llm_obj: Any = None
        fallback_attached = False
        can_pass_fallback = _agent_init_accepts_named_arg(sig, "fallback_llm")
        if can_pass_fallback:
            try:
                fallback_llm_obj = _make_fallback_llm()
            except Exception as exc:  # pragma: no cover - defensive
                print(f"ux-journey: fallback_llm not configured: {exc!r}", flush=True)
        if fallback_llm_obj is not None:
            agent_kw["fallback_llm"] = fallback_llm_obj
            fallback_attached = True
        # Surface LLM wiring at run start so the operator can spot a missing
        # OPENAI_API_KEY / outdated browser-use without grepping the code.
        # This is the only place we can be sure both `llm` and any fallback
        # have been instantiated successfully.
        meta = _llm_meta()
        primary_label = f"{meta.get('provider')}/{meta.get('model')}"
        if fallback_attached:
            fb = meta.get("fallback") if isinstance(meta, dict) else None
            fb_label = f"{fb.get('provider')}/{fb.get('model')}" if isinstance(fb, dict) else "?"
            fallback_status = f"enabled ({fb_label})"
        else:
            if not can_pass_fallback:
                fallback_status = "disabled (browser-use Agent __init__ has no `fallback_llm` / `**kwargs` — upgrade browser-use)"
            elif _resolve_llm_provider() == "anthropic" and not os.environ.get("OPENAI_API_KEY"):
                fallback_status = "disabled (set OPENAI_API_KEY on *this* service for cross-provider recovery)"
            elif _resolve_llm_provider() == "openai" and not os.environ.get("ANTHROPIC_API_KEY"):
                fallback_status = "disabled (set ANTHROPIC_API_KEY on *this* service for cross-provider recovery)"
            elif not _env_truthy("UX_JOURNEY_LLM_FALLBACK", "1"):
                fallback_status = "disabled (UX_JOURNEY_LLM_FALLBACK=0)"
            else:
                fallback_status = "disabled"
        print(
            f"ux-journey: job={job_id} ANTHROPIC_API_KEY={_env_api_key_log_status('ANTHROPIC_API_KEY')} "
            f"OPENAI_API_KEY={_env_api_key_log_status('OPENAI_API_KEY')}",
            flush=True,
        )
        print(
            f"ux-journey: job={job_id} primary={primary_label} fallback_llm={fallback_status}",
            flush=True,
        )
        # Allow operators to widen browser-use's default retry budget for
        # transient AgentOutput validation hiccups (default 6). Useful when
        # the primary occasionally serialises `action` as a JSON-string for
        # one or two consecutive calls but recovers on its own.
        try:
            max_failures_env = int(os.environ.get("UX_JOURNEY_MAX_FAILURES", "0"))
        except ValueError:
            max_failures_env = 0
        if max_failures_env > 0 and _agent_init_accepts_named_arg(sig, "max_failures"):
            agent_kw["max_failures"] = max_failures_env
        if "initial_url" in sig.parameters:
            agent_kw["initial_url"] = url
        else:
            agent_kw["task"] = f"Go to {url}. Then: {task_with_lang}"
        # Ensure max_steps is applied for different browser-use versions:
        # - Some versions accept it in the constructor
        # - Others expose it as an attribute on the instance
        # - Others use different naming (best-effort)
        if "max_steps" in sig.parameters:
            agent_kw["max_steps"] = max_steps
        elif "max_actions" in sig.parameters:
            agent_kw["max_actions"] = max_steps
        # Force per-step screenshots so history.screenshots() always has data the live preview can serve.
        if "use_vision" in sig.parameters:
            agent_kw["use_vision"] = True
        agent = Agent(**agent_kw)
        # Some deployments swallow unknown kwargs; ensure fallback actually landed.
        if fallback_llm_obj is not None and getattr(agent, "_fallback_llm", None) is None:
            try:
                setattr(agent, "_fallback_llm", fallback_llm_obj)
                print(
                    f"ux-journey: job={job_id} set agent._fallback_llm post-init (constructor did not retain it)",
                    flush=True,
                )
            except Exception as exc:  # pragma: no cover - defensive
                print(f"ux-journey: job={job_id} could not set _fallback_llm: {exc!r}", flush=True)
        if fallback_llm_obj is not None:
            fb_ok = getattr(agent, "_fallback_llm", None) is not None
            print(
                f"ux-journey: job={job_id} browser-use _fallback_llm={'OK' if fb_ok else 'STILL_MISSING'}",
                flush=True,
            )
        if hasattr(agent, "max_steps"):
            agent.max_steps = max_steps
        elif hasattr(agent, "max_actions"):
            agent.max_actions = max_steps
        # Some browser-use builds only expose max_failures as an attribute,
        # not a constructor kwarg — set it after construction as a fallback.
        if max_failures_env > 0 and hasattr(agent, "max_failures"):
            try:
                agent.max_failures = max_failures_env
            except Exception:  # pragma: no cover - defensive
                pass

        async def _on_step_start(agent_instance: Any) -> None:
            # Pause at the beginning of each step so the video shows the current state before the action runs
            await asyncio.sleep(_slow(max(0, STEP_START_DELAY_SECONDS)))

        async def _on_step_end(agent_instance: Any) -> None:
            actions: list[Any] = []
            raw: Any = None
            try:
                actions = list(agent_instance.history.action_history()) if hasattr(agent_instance.history, "action_history") and callable(agent_instance.history.action_history) else []
            except Exception:
                pass
            # 1) Try to show red circle at last click position (visible in the recording)
            try:
                if actions:
                    last_entry = actions[-1]
                    raw = last_entry[0] if isinstance(last_entry, (list, tuple)) and len(last_entry) > 0 else last_entry
                    if isinstance(raw, dict) and raw.get("interacted_element"):
                        elem = raw["interacted_element"]
                        if hasattr(elem, "bounds") and elem.bounds is not None:
                            b = elem.bounds
                            cx = getattr(b, "x", 0) + getattr(b, "width", 0) / 2
                            cy = getattr(b, "y", 0) + getattr(b, "height", 0) / 2
                            radius = 24
                            circle_hold = _slow(CLICK_CIRCLE_VISIBLE_SECONDS)
                            ms = int(circle_hold * 1000)
                            js = (
                                f"(function(){{var el=document.getElementById('agent-click-ring');"
                                f"if(el)el.remove();el=document.createElement('div');el.id='agent-click-ring';"
                                f"el.style.cssText='position:fixed;left:{cx - radius}px;top:{cy - radius}px;"
                                f"width:{radius*2}px;height:{radius*2}px;border-radius:50%;border:4px solid #e53935;"
                                f"pointer-events:none;z-index:2147483647;box-shadow:0 0 0 2px rgba(229,57,53,0.5);';"
                                f"document.body.appendChild(el);setTimeout(function(){{el.remove();}},{ms});}})();"
                            )
                            cdp = await agent_instance.browser_session.get_or_create_cdp_session()
                            if cdp:
                                if hasattr(cdp, "cdp_client"):
                                    send = getattr(cdp.cdp_client, "send", None)
                                    if send and hasattr(send, "Runtime"):
                                        await send.Runtime.evaluate(expression=js, session_id=cdp.session_id)
                                elif hasattr(cdp, "send"):
                                    send = cdp.send
                                    if hasattr(send, "Runtime"):
                                        await send.Runtime.evaluate(expression=js, session_id=cdp.session_id)
                            await asyncio.sleep(circle_hold)
            except Exception:
                pass
            # 2) If last action was scroll, run a very slow step-based scroll so the live stream always captures it
            try:
                if not raw and actions:
                    last_entry = actions[-1]
                    raw = last_entry[0] if isinstance(last_entry, (list, tuple)) and len(last_entry) > 0 else last_entry
                if actions and isinstance(raw, dict) and "scroll" in raw:
                    cdp = await agent_instance.browser_session.get_or_create_cdp_session()
                    if cdp:
                        # Step-based scroll: move in small steps at ~25 fps so each frame shows movement
                        duration_sec = max(1.0, _slow(SCROLL_VISIBLE_SECONDS))
                        interval_ms = 40  # 25 fps
                        total_px = 80
                        steps = max(1, int((duration_sec * 1000) / interval_ms))
                        step_px = total_px / steps
                        js = (
                            "(function(){"
                            "var d=%(duration)s, iv=%(interval)s, total=%(total)s, n=%(steps)s, step=%(step)s, c=0;"
                            "function run(){ window.scrollBy(0,step); c++; if(c<n) setTimeout(run,iv); }"
                            "run();"
                            "})();"
                        ) % {
                            "duration": duration_sec,
                            "interval": interval_ms,
                            "total": total_px,
                            "steps": steps,
                            "step": step_px,
                        }
                        if hasattr(cdp, "cdp_client") and hasattr(cdp.cdp_client, "send") and hasattr(cdp.cdp_client.send, "Runtime"):
                            await cdp.cdp_client.send.Runtime.evaluate(expression=js, session_id=cdp.session_id)
                        elif hasattr(cdp, "send") and hasattr(cdp.send, "Runtime"):
                            await cdp.send.Runtime.evaluate(expression=js, session_id=cdp.session_id)
                        await asyncio.sleep(duration_sec)
                        # Scroll back slowly as well so the stream captures the return
                        js_back = (
                            "(function(){"
                            "var iv=%(interval)s, total=%(total)s, n=%(steps)s, step=%(step)s, c=0;"
                            "function run(){ window.scrollBy(0,-step); c++; if(c<n) setTimeout(run,iv); }"
                            "run();"
                            "})();"
                        ) % {
                            "interval": interval_ms,
                            "total": total_px,
                            "steps": steps,
                            "step": step_px,
                        }
                        if hasattr(cdp, "cdp_client") and hasattr(cdp.cdp_client, "send") and hasattr(cdp.cdp_client.send, "Runtime"):
                            await cdp.cdp_client.send.Runtime.evaluate(expression=js_back, session_id=cdp.session_id)
                        elif hasattr(cdp, "send") and hasattr(cdp.send, "Runtime"):
                            await cdp.send.Runtime.evaluate(expression=js_back, session_id=cdp.session_id)
                        await asyncio.sleep(duration_sec)
            except Exception:
                pass
            # 3) Pause so the video clearly shows the state before the next step
            await asyncio.sleep(_slow(max(0.5, STEP_DELAY_SECONDS - CLICK_CIRCLE_VISIBLE_SECONDS)))

            # After UI settles (circle/scroll/delays), publish steps + screenshot file + lightweight JSON.
            await _publish_partial_steps(
                job_id=job_id,
                agent_instance=agent_instance,
                task=task,
                domain=domain,
                persona=persona,
            )

        _live_agents[job_id] = agent
        screenshot_task = asyncio.create_task(_live_screenshot_loop(job_id))
        history_watcher_task = asyncio.create_task(
            _history_watcher_loop(
                job_id=job_id,
                task=task,
                domain=domain,
                persona=persona,
            )
        )
        cancelled = False
        try:
            try:
                try:
                    history = await agent.run(on_step_start=_on_step_start, on_step_end=_on_step_end)
                except TypeError:
                    history = await agent.run()
            except asyncio.CancelledError:
                # `POST /run/{jobId}/cancel` (or any other task-level cancel)
                # landed while we were awaiting the agent. We DO want the rest
                # of this coroutine to run so the partial recording gets moved
                # into VIDEO_BASE_DIR and the persona / chat sees a usable
                # videoUrl + the steps that did happen.
                cancelled = True
                try:
                    history = getattr(agent, "history", None) or history
                except Exception:
                    pass
        finally:
            for bg in (screenshot_task, history_watcher_task):
                bg.cancel()
                try:
                    await bg
                except asyncio.CancelledError:
                    pass
            _live_agents.pop(job_id, None)
            _live_frames.pop(job_id, None)

        # CRITICAL: close the browser *before* discovering / moving / transcoding the video.
        # Playwright only finalizes the WebM container (header, cues, EOF) when the browser is
        # closed. Moving or feeding ffmpeg a still-open recording produces a 0-second / unplayable
        # file in the UI even though the run looks "complete".
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass
            browser = None  # avoid double-close in the outer finally

        # Map browser-use history to CHECKION result format
        steps = _history_to_steps(history)
        success = _history_success(history)
        screenshots = _history_screenshots(history)

        # `domain` already computed above for partial progress updates.

        # Move recorded video to a known path.
        # Playwright often writes WebM in nested folders; we search recursively and pick the newest file.
        video_path: str | None = None
        try:
            found_path = _find_recorded_video_file(video_dir)
            if found_path and found_path.is_file():
                # Sanity: refuse 0-byte / suspiciously small recordings (would render as 0:00).
                try:
                    size = found_path.stat().st_size
                except Exception:
                    size = 0
                if size <= 1024:
                    print(
                        f"video: refusing to publish suspiciously small recording {found_path} (size={size})",
                        flush=True,
                    )
                else:
                    suffix = found_path.suffix.lower()  # ".mp4" | ".webm"
                    dest = VIDEO_BASE_DIR / f"{job_id}{suffix}"
                    try:
                        VIDEO_BASE_DIR.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(found_path), str(dest))
                        video_path = str(dest)
                    except Exception:
                        # Best-effort: if move fails, fall back to serving from original location.
                        video_path = str(found_path)
        finally:
            # Cleanup temp directory only if we successfully moved it into VIDEO_BASE_DIR.
            if video_path and Path(video_path).parent == VIDEO_BASE_DIR:
                try:
                    shutil.rmtree(video_dir, ignore_errors=True)
                except Exception:
                    pass

        # NOTE: We deliberately set j.status = "complete" BEFORE transcoding.
        # Transcoding to a smooth MP4 (libx264 + CFR re-encode) can take many
        # seconds — sometimes minutes for long runs — and we observed chats
        # appear "still running" for many minutes after the agent was actually
        # done. The video handler at GET /run/{jobId}/video serves whatever
        # file currently exists, so the player works during transcode using
        # the raw move target (.webm / pre-transcode .mp4); once the smooth
        # version is ready we update j.video_path and the next reload picks
        # it up.

        result = {
            "jobId": job_id,
            "taskDescription": task,
            "siteDomain": domain,
            "steps": steps,
            "success": success,
            "screenshots": screenshots[:50],
            "llm": _llm_meta(),
            "personaPolicy": _persona_policy(persona),
        }
        if persona and isinstance(persona, dict):
            result["persona"] = {
                "id": persona.get("id"),
                "name": persona.get("name"),
            }
        if video_path:
            result["videoUrl"] = f"/run/{job_id}/video"
        if cancelled:
            # Surface the cancellation in the result so the chat UI can label
            # the card honestly ("Run was cancelled before completion").
            result["cancelled"] = True

        async with _jobs_lock:
            if job_id in _jobs:
                # Preserve per-step screenshots captured during partial progress updates.
                try:
                    prev = _jobs[job_id].result or {}
                    prev_steps = prev.get("steps") if isinstance(prev, dict) else None
                    if isinstance(prev_steps, list) and prev_steps:
                        result["steps"] = _merge_step_screenshots(base_steps=result["steps"], overlay_steps=prev_steps)
                except Exception:
                    pass
                _jobs[job_id].status = "complete"
                _jobs[job_id].result = result
                if cancelled and not _jobs[job_id].error:
                    _jobs[job_id].error = "Run was cancelled before completion."
                if video_path:
                    _jobs[job_id].video_path = video_path

        # Heavy ffmpeg polish (H.264 + slow-motion): defer unless explicitly disabled.
        # Raw recording from Playwright is already on disk — GET /video serves it.
        if video_path and not UX_JOURNEY_DEFER_VIDEO_FINALIZE:

            async def _finalize_bg() -> None:
                await _finalize_video(job_id=job_id, source_path=video_path)

            asyncio.create_task(_finalize_bg())
    except Exception as e:
        async with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id].status = "error"
                _jobs[job_id].error = str(e)
    finally:
        if browser is not None:
            try:
                # Ensure Playwright flushes the recording to disk before we try to move it.
                await browser.close()
            except Exception:
                pass


# Post-processing: Playwright records WebM with variable framerate and irregular keyframes.
# Browsers (esp. Chrome, mobile Safari) play these jittery and seek poorly. Transcoding to
# H.264 MP4 with constant framerate + +faststart yields smooth playback and instant seek.
VIDEO_TRANSCODE_FPS = float(os.environ.get("UX_JOURNEY_VIDEO_FPS", "25"))
VIDEO_TRANSCODE_CRF = int(os.environ.get("UX_JOURNEY_VIDEO_CRF", "23"))
VIDEO_TRANSCODE_PRESET = os.environ.get("UX_JOURNEY_VIDEO_PRESET", "veryfast")
VIDEO_TRANSCODE_DISABLED = (
    os.environ.get("UX_JOURNEY_VIDEO_TRANSCODE", "1").strip().lower() in ("0", "false", "no")
)

# Final video slow-motion factor applied during the smooth-MP4 transcode.
# Multiplies presentation timestamps via ffmpeg `setpts=N*PTS`, which makes the
# saved recording play back at 1/N of real-time speed *without* affecting how
# fast the agent actually drove the browser. A factor of 8 turns a 30-second
# raw run into a 4-minute review video where every page load, scroll, click
# overlay and transition is visible at a calm pace. Clamped 1..16: at 1.0 the
# filter is skipped entirely (free no-op); above 16 the file just becomes
# tedious to scrub through.
def _parse_slowdown_factor(raw: str | None) -> float:
    try:
        n = float(raw) if raw not in (None, "") else 8.0
    except (TypeError, ValueError):
        n = 8.0
    if n < 1.0:
        return 1.0
    if n > 16.0:
        return 16.0
    return n


VIDEO_SLOWDOWN_FACTOR = _parse_slowdown_factor(
    os.environ.get("UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR")
)

# When true (default), the heavy ffmpeg pass (H.264 + optional slow-motion) does
# NOT start automatically at the end of a run. The raw WebM/MP4 from Playwright
# is still available via GET /run/{id}/video immediately; the user (or the chat
# UI) triggers ``POST /run/{id}/video/finalize`` to produce the polished MP4.
# Set to false to restore the old fire-and-forget background finalization
# (wastes CPU on every run that nobody watches).
def _env_truthy(name: str, default: str = "1") -> bool:
    v = (os.environ.get(name, default) or "").strip().lower()
    return v not in ("0", "false", "no", "off", "")


UX_JOURNEY_DEFER_VIDEO_FINALIZE = _env_truthy("UX_JOURNEY_DEFER_VIDEO_FINALIZE", "1")

_finalize_locks: dict[str, asyncio.Lock] = {}
_finalize_locks_mutex = threading.Lock()


def _get_finalize_lock(job_id: str) -> asyncio.Lock:
    """One asyncio.Lock per job so concurrent POST /video/finalize are serialized."""
    with _finalize_locks_mutex:
        if job_id not in _finalize_locks:
            _finalize_locks[job_id] = asyncio.Lock()
        return _finalize_locks[job_id]


async def _finalize_video(*, job_id: str, source_path: str) -> bool:
    """
    Re-encode the raw recording to a smooth seekable MP4 (+ optional slow-motion).
    On success, swaps `_jobs[job_id].video_path` to the final file.

    Returns True if a playable output file is now referenced by the job; False
    if transcoding was skipped/failed (caller keeps serving the raw recording).

    Does not raise — best-effort polish.
    """
    try:
        src = Path(source_path)
        if not src.is_file():
            return False
        smooth = VIDEO_BASE_DIR / f"{job_id}.smooth.mp4"
        if not await _transcode_to_smooth_mp4(src, smooth):
            return False
        final_dest = VIDEO_BASE_DIR / f"{job_id}.mp4"
        try:
            if final_dest.exists() and final_dest.resolve() != src.resolve():
                final_dest.unlink()
        except Exception:
            pass
        new_path: str
        try:
            smooth.replace(final_dest)
            if src != final_dest and src.is_file():
                src.unlink(missing_ok=True)
            new_path = str(final_dest)
        except Exception:
            # Rename failed — keep the smooth file at its temp name so it's
            # still served instead of the laggy original.
            new_path = str(smooth)
        async with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id].video_path = new_path
        return True
    except Exception as exc:
        # Best-effort polish; log so it surfaces in the structured agent logs
        # but never propagate into the (already-completed) job state.
        print(f"video.finalize: job={job_id} error={exc}", flush=True)
        return False


async def _transcode_to_smooth_mp4(src: Path, dest: Path) -> bool:
    """Re-encode ``src`` to a browser-friendly H.264 MP4 at ``dest``.

    Returns True on success. On failure (ffmpeg missing / encode error) the caller falls
    back to serving the original recording.
    """
    if VIDEO_TRANSCODE_DISABLED:
        return False
    if shutil.which("ffmpeg") is None:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Build the video filter chain. With `VIDEO_SLOWDOWN_FACTOR > 1` we prepend
    # `setpts=N*PTS` which stretches presentation timestamps so the entire clip
    # plays back at 1/N speed. We then re-sample to the target fps so frames
    # get duplicated smoothly (instead of leaving a jittery low-fps stream).
    if VIDEO_SLOWDOWN_FACTOR > 1.0:
        vf = (
            f"setpts={VIDEO_SLOWDOWN_FACTOR:.4f}*PTS,"
            f"fps={VIDEO_TRANSCODE_FPS},format=yuv420p"
        )
    else:
        vf = f"fps={VIDEO_TRANSCODE_FPS},format=yuv420p"
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-i", str(src),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", VIDEO_TRANSCODE_PRESET,
        "-crf", str(VIDEO_TRANSCODE_CRF),
        "-g", str(int(VIDEO_TRANSCODE_FPS * 2)),  # keyframe every ~2s for smooth seeking
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",  # no audio in Playwright recordings
        str(dest),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        if proc.returncode == 0 and dest.is_file() and dest.stat().st_size > 0:
            return True
        # Best-effort log; do not raise — caller falls back to source file.
        print(
            f"ffmpeg transcode failed (rc={proc.returncode}) for {src}: {stderr[-1024:] if stderr else b''!r}",
            flush=True,
        )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ffmpeg transcode crashed for {src}: {exc!r}", flush=True)
    return False


def _pick_latest_file(paths: list[Path]) -> Path | None:
    if not paths:
        return None
    try:
        return max(paths, key=lambda p: p.stat().st_mtime)
    except Exception:
        return paths[0]


def _find_recorded_video_file(video_dir: str) -> Path | None:
    """
    browser-use / Playwright may write recordings into nested folders, and filenames can vary.
    We search recursively and pick the newest MP4/WebM.
    """
    base = Path(video_dir)
    if not base.is_dir():
        return None
    candidates: list[Path] = []
    try:
        candidates.extend([p for p in base.rglob("*.mp4") if p.is_file()])
        candidates.extend([p for p in base.rglob("*.webm") if p.is_file()])
    except Exception:
        return None
    return _pick_latest_file(candidates)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="UX Journey Agent", description="CHECKION browser agent: run tasks via POST /run, poll GET /run/{jobId}")

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.post("/run", response_model=RunResponse)
async def start_run(body: RunRequest) -> RunResponse:
    url = (body.url or "").strip()
    task = (body.task or "").strip()
    if not url or not task:
        raise HTTPException(status_code=400, detail="url and task are required")
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="url must be http(s)")

    job_id = str(uuid.uuid4())
    async with _jobs_lock:
        _jobs[job_id] = JobState(job_id=job_id, status="running", url=url, task=task, persona=body.persona)

    # Keep a reference to the running task so `POST /run/{jobId}/cancel` can
    # signal it. Without this, a stalled browser-use loop is unkillable from
    # outside and the caller has no way to recover the partial recording.
    run_task = asyncio.create_task(
        run_agent(job_id, url, task, body.persona, max_steps_override=body.max_steps)
    )
    async with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].run_task = run_task
    return RunResponse(jobId=job_id)


@app.post("/run/{job_id}/cancel")
async def cancel_run(job_id: str) -> dict[str, Any]:
    """
    Force-cancel a running journey: signals the agent task, waits briefly for
    its `finally` blocks to close the browser (which finalizes the WebM
    recording on disk) and to publish a partial result, then returns the
    current job state.

    Idempotent: calling this on a job that's already terminal (or unknown)
    just reports the current status without doing anything destructive.
    """
    async with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Already terminal — nothing to do.
    if job.status not in ("running", None):
        return {
            "jobId": job_id,
            "status": job.status,
            "alreadyTerminal": True,
        }

    job.cancel_requested = True
    task = job.run_task
    cancel_signalled = False
    if task is not None and not task.done():
        try:
            task.cancel()
            cancel_signalled = True
        except Exception:
            pass

    # Give run_agent up to ~30s to drain its finally blocks (browser close
    # can take a moment, especially when Playwright is mid-frame). We don't
    # propagate the underlying exception — the worst case is the caller sees
    # `status: "running"` and can re-poll.
    if task is not None and cancel_signalled:
        try:
            await asyncio.wait_for(asyncio.shield(_safe_await(task)), timeout=30.0)
        except asyncio.TimeoutError:
            pass

    async with _jobs_lock:
        job_after = _jobs.get(job_id)
    return {
        "jobId": job_id,
        "status": job_after.status if job_after else "unknown",
        "cancelSignalled": cancel_signalled,
        "result": (job_after.result if job_after else None),
    }


async def _safe_await(task: Any) -> None:
    """Await a task, swallowing CancelledError so callers can use `wait_for`
    without having to special-case the cancel they just signalled."""
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception:
        pass

@app.get("/run/{job_id}")
async def get_run(job_id: str) -> dict[str, Any]:
    async with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    out: dict[str, Any] = {
        "status": job.status,
        "jobId": job_id,
    }
    if job.result:
        out["result"] = job.result
    if job.error:
        out["error"] = job.error
    return out


@app.get("/run/{job_id}/step/{step_no}/screenshot")
async def get_step_screenshot(job_id: str, step_no: int) -> FileResponse:
    """JPEG captured after each agent step (see _publish_partial_steps)."""
    path = _step_screenshot_path(job_id, step_no)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(
        str(path),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )


async def _resolve_recording_path_for_finalize(job_id: str) -> str | None:
    """Return an on-disk recording path to feed into ffmpeg, or None."""
    async with _jobs_lock:
        job = _jobs.get(job_id)
        vp = job.video_path if job else None
    if vp and Path(vp).is_file():
        return vp
    for ext in ("webm", "mp4"):
        candidate = VIDEO_BASE_DIR / f"{job_id}.{ext}"
        try:
            if candidate.is_file() and candidate.stat().st_size > 1024:
                return str(candidate)
        except OSError:
            continue
    return None


@app.post("/run/{job_id}/video/finalize")
async def post_finalize_run_video(job_id: str) -> dict[str, Any]:
    """
    On-demand ffmpeg polish: smooth MP4 + configured slow-motion.

    Idempotent: if ``{job_id}.mp4`` already exists in ``VIDEO_BASE_DIR``, returns
    ``already_finalized`` immediately. When transcoding is disabled or ffmpeg is
    missing, returns ``skipped`` — the client should still play the raw WebM via
    GET /run/{jobId}/video.
    """
    lock = _get_finalize_lock(job_id)
    async with lock:
        async with _jobs_lock:
            job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.status == "running":
            raise HTTPException(status_code=400, detail="Job is still running")

        final_mp4 = VIDEO_BASE_DIR / f"{job_id}.mp4"
        if final_mp4.is_file() and final_mp4.stat().st_size > 1024:
            async with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id].video_path = str(final_mp4)
            return {
                "status": "already_finalized",
                "videoUrl": f"/run/{job_id}/video",
                "mediaType": "video/mp4",
            }

        src = await _resolve_recording_path_for_finalize(job_id)
        if not src:
            raise HTTPException(status_code=404, detail="No recording found for this job")

        if VIDEO_TRANSCODE_DISABLED or shutil.which("ffmpeg") is None:
            return {
                "status": "skipped",
                "reason": "transcode_unavailable",
                "videoUrl": f"/run/{job_id}/video",
                "message": "ffmpeg unavailable or transcoding disabled — use raw recording.",
            }

        ok = await _finalize_video(job_id=job_id, source_path=src)
        async with _jobs_lock:
            out_path = _jobs[job_id].video_path if job_id in _jobs else None
        suffix = Path(out_path).suffix.lower() if out_path else ""
        media = "video/mp4" if suffix == ".mp4" else "video/webm"
        return {
            "status": "completed" if ok else "failed",
            "videoUrl": f"/run/{job_id}/video",
            "mediaType": media,
        }


@app.get("/run/{job_id}/video")
async def get_run_video(job_id: str) -> FileResponse:
    """Return the recorded journey video (MP4 or WebM). Serves from memory or from VIDEO_BASE_DIR (persistent volume)."""
    video_path: str | None = None
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job and job.video_path and os.path.isfile(job.video_path):
            video_path = job.video_path
    if not video_path:
        for ext in ("mp4", "webm"):
            candidate = VIDEO_BASE_DIR / f"{job_id}.{ext}"
            if candidate.is_file():
                video_path = str(candidate)
                break
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    media_type = "video/mp4" if video_path.lower().endswith(".mp4") else "video/webm"
    filename = f"journey-{job_id}.mp4" if media_type == "video/mp4" else f"journey-{job_id}.webm"
    return FileResponse(
        video_path,
        media_type=media_type,
        filename=filename,
    )


@app.get("/run/{job_id}/live/diag")
async def get_run_live_diag(job_id: str) -> dict[str, Any]:
    """Diagnostic JSON: which capture path is currently producing frames for this job.

    Use this from devtools / curl when ``/live`` keeps returning 404 to see whether
    history-based, Playwright page or CDP screenshot capture works in the current agent.
    """
    job_known = False
    job_status: str | None = None
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job is not None:
            job_known = True
            job_status = job.status

    has_live_agent = job_id in _live_agents
    cached_frame = _live_frames.get(job_id)
    cached_age_seconds: float | None = None
    if cached_frame is not None:
        try:
            cached_age_seconds = max(0.0, time.monotonic() - float(cached_frame[0]))
        except Exception:
            cached_age_seconds = None

    step_dir = STEP_SCREENSHOTS_BASE / job_id
    step_files: list[str] = []
    if step_dir.is_dir():
        try:
            step_files = sorted(p.name for p in step_dir.glob("*.jpg"))
        except Exception:
            step_files = []

    diag: dict[str, Any] = {
        "jobKnown": job_known,
        "jobStatus": job_status,
        "hasLiveAgent": has_live_agent,
        "hasCachedFrame": cached_frame is not None,
        "cachedFrameAgeSeconds": cached_age_seconds,
        "stepScreenshotsOnDisk": step_files,
        "stepScreenshotsDir": str(step_dir),
        "envSlowmo": UX_JOURNEY_SLOWMO,
        "envLiveFrameInterval": LIVE_FRAME_INTERVAL,
    }

    agent = _live_agents.get(job_id)
    if agent is not None:
        capture = await _capture_live_frame_diag(agent)
        # Drop raw bytes from JSON output, but keep size/path/probes.
        capture.pop("bytes", None)
        diag["captureProbe"] = capture
    else:
        diag["captureProbe"] = {"path": "no-agent", "size": 0, "probes": {}, "agent": {}}

    return diag


@app.get("/run/{job_id}/live")
async def get_run_live(job_id: str) -> Response:
    """Return the latest live viewport frame (JPEG) while the job is running."""
    frame = _live_frames.get(job_id)
    jpeg_bytes: bytes | None = frame[1] if frame else None

    if not jpeg_bytes:
        agent = _live_agents.get(job_id)
        if agent:
            captured = await _capture_live_frame(agent)
            if captured:
                jpeg_bytes = captured
                _live_frames[job_id] = (time.monotonic(), captured)

    if not jpeg_bytes:
        jpeg_bytes = _latest_step_screenshot_bytes(job_id)

    if not jpeg_bytes:
        raise HTTPException(status_code=404, detail="No live frame")
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )


async def _mjpeg_stream_generator(job_id: str):
    """Yield MJPEG parts (boundary + headers + jpeg) while the job is running."""
    while job_id in _live_agents:
        frame = _live_frames.get(job_id)
        if frame:
            _, jpeg_bytes = frame
            part = (
                b"--"
                + MJPEG_BOUNDARY
                + b"\r\nContent-Type: image/jpeg\r\nContent-Length: "
                + str(len(jpeg_bytes)).encode()
                + b"\r\n\r\n"
                + jpeg_bytes
                + b"\r\n"
            )
            yield part
        await asyncio.sleep(LIVE_FRAME_INTERVAL * UX_JOURNEY_SLOWMO)


@app.get("/run/{job_id}/live/stream")
async def get_run_live_stream(job_id: str) -> StreamingResponse:
    """MJPEG stream of the live viewport while the job is running."""
    if job_id not in _live_agents:
        raise HTTPException(status_code=404, detail="Job not running")
    return StreamingResponse(
        _mjpeg_stream_generator(job_id),
        media_type="multipart/x-mixed-replace; boundary=" + MJPEG_BOUNDARY.decode(),
        headers={"Cache-Control": "no-store"},
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8320"))
    uvicorn.run(app, host="0.0.0.0", port=port)
