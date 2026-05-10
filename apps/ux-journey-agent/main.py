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
import hashlib
import inspect
import json
import os
import re
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

# Phase 4 hook: when the checkion-agent fork fires its `on_screenshot` callback
# at the end of each agent step, we always count the frame for telemetry.
# Setting this flag to 1/true ALSO pushes that base64-PNG step screenshot into
# the live-frame cache used by the MJPEG live-stream endpoint.
#
# Phase 5: default flipped to ON now that the live / step-screenshot endpoints
# sniff the content-type from the first bytes (see `_sniff_image_content_type`).
# Set to 0 to fall back to a JPEG-only live stream (CDP polling loop only).
UX_JOURNEY_LIVE_STEP_FRAMES = (
    os.environ.get("UX_JOURNEY_LIVE_STEP_FRAMES", "1").strip().lower() in ("1", "true", "yes")
)
# Phase 5: optional CDP polling loop. The legacy 25 fps polling loop produces
# the smooth sub-step preview frames at the cost of constant CDP traffic +
# decode CPU. With `UX_JOURNEY_LIVE_STEP_FRAMES=1` the on_screenshot hook
# already pushes a hi-res frame per step, so operators who only need event-
# driven previews can shut off the polling loop here. Default ON to preserve
# the live UX (smooth video while the agent thinks).
UX_JOURNEY_LIVE_POLLING_LOOP = (
    os.environ.get("UX_JOURNEY_LIVE_POLLING_LOOP", "1").strip().lower() in ("1", "true", "yes")
)
# Per-job counter incremented in the `on_screenshot` callback. Surfaced in
# the run result `forkHooks` block so we can verify the fork hook actually
# fires in production runs (not just unit tests).
_step_screenshot_counts: dict[str, int] = {}
# Phase 6 counter: same idea as `_step_screenshot_counts`, but bumped from
# the per-action `on_action_end` hook so we can prove the playback is wired
# correctly when an older fork build slips into production.
_action_hook_counts: dict[str, int] = {}

# Per-job wall-clock alignment between Playwright recording and step publications:
# monotonic time when recording session starts (shortly after Browser launch).
_recording_mono: dict[str, float] = {}
# First time we observed each step index while the agent ran (monotonic), keyed by job_id → step_no.
_step_first_seen_mono: dict[str, dict[int, float]] = {}


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


# Tolerant JSON parsing for AgentOutput is now first-class in checkion-agent
# itself (`apps/ux-journey-agent/checkion-agent/checkion_agent/agent/_tolerant_parsing.py`).
# It runs by default and is gated by `CHECKION_AGENT_TOLERANT_PARSING=1` (env;
# set `=0` to fall back to strict upstream-equivalent parsing for A/B testing).
# The legacy ~300 LOC `_repair_*` / `_maybe_wrap_llm_class` / dynamic-subclass
# stack that used to live here — papering over the same bugs from outside the
# library — was removed in fork-Phase-1.

# Base pacing (seconds). Effective waits = these × UX_JOURNEY_SLOWMO. Defaults are tuned for readable video without extra env.
STEP_START_DELAY_SECONDS = float(os.environ.get("UX_JOURNEY_STEP_START_DELAY_SECONDS", "3.5"))
STEP_DELAY_SECONDS = float(os.environ.get("UX_JOURNEY_STEP_DELAY_SECONDS", "3.0"))
CLICK_CIRCLE_VISIBLE_SECONDS = float(os.environ.get("UX_JOURNEY_CLICK_CIRCLE_VISIBLE_SECONDS", "3.5"))
SCROLL_VISIBLE_SECONDS = float(os.environ.get("UX_JOURNEY_SCROLL_VISIBLE_SECONDS", "7.0"))
# Live viewport screenshot interval (seconds); lower = higher fps (0.04 = 25 fps)
LIVE_FRAME_INTERVAL = float(os.environ.get("UX_JOURNEY_LIVE_FRAME_INTERVAL", "0.04"))

# Global slow-motion factor for *recording*. Default 2 = ~2× longer pacing in the Playwright video at 1× playback.
# Override with UX_JOURNEY_SLOWMO=1 for snappier runs, or higher for more extreme slow-mo.
# Higher values record more *real* frames per action (Playwright captures at constant fps), which
# is what produces a smooth review video. This is the right knob if the final video looks too fast,
# rather than ``UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR`` which only stretches existing frames in time.
UX_JOURNEY_SLOWMO = float(os.environ.get("UX_JOURNEY_SLOWMO", os.environ.get("UX_JOURNEY_SLOWMO_MULTIPLIER", "2")))
if UX_JOURNEY_SLOWMO < 0.25:
    UX_JOURNEY_SLOWMO = 0.25
if UX_JOURNEY_SLOWMO > 32:
    UX_JOURNEY_SLOWMO = 32.0


def _slow(seconds: float) -> float:
    """Scale a pacing delay by UX_JOURNEY_SLOWMO (true slow-motion recording)."""
    return max(0.0, float(seconds) * UX_JOURNEY_SLOWMO)


def _env_truthy(name: str, default: str = "1") -> bool:
    v = (os.environ.get(name, default) or "").strip().lower()
    return v not in ("0", "false", "no", "off", "")


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
    # Wall-clock ISO-8601 timestamp updated whenever the agent shows *any*
    # sign of life — either a new browser-use history entry (counted by the
    # history watcher loop) or a new step screenshot from the fork hook.
    # Read by chat-api's stagnation watchdog so a long mid-step LLM call
    # (no new step yet, but the screenshot hook already fired with a fresh
    # frame) does NOT trip the cancel. Cleared with the rest of the job.
    last_observed_at: str | None = None
    # Same instant as ``last_observed_at`` but in monotonic seconds — used
    # internally to compute idle deltas without timezone math. Not exposed
    # over the API.
    last_observed_mono: float | None = None

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
        from checkion_agent import ChatAnthropic
    except ImportError:
        from checkion_agent.llm.anthropic import ChatAnthropic
    try:
        max_tokens = int(os.environ.get("UX_JOURNEY_CLAUDE_MAX_TOKENS", "16384"))
    except ValueError:
        max_tokens = 16384
    return ChatAnthropic(
        model=os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6"),
        temperature=0,
        max_tokens=max_tokens,
    )


def _build_openai_llm():
    try:
        from checkion_agent import ChatOpenAI
    except ImportError:
        from checkion_agent.llm.openai import ChatOpenAI
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
    return ChatOpenAI(
        model=os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o"),
        temperature=0,
    )


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


def _checkion_tolerant_parsing_enabled() -> bool:
    """Mirror of `checkion_agent.agent._tolerant_parsing.tolerant_parsing_enabled`.

    Read directly from env so the meta endpoint stays decoupled from the
    fork's import path; values must stay in sync with the fork's default
    (`1` / on).
    """
    v = (os.environ.get("CHECKION_AGENT_TOLERANT_PARSING") or "1").strip().lower()
    return v in ("1", "true", "yes", "on")


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
    tolerant = _checkion_tolerant_parsing_enabled()
    if provider == "anthropic":
        return {
            "provider": "anthropic",
            "model": os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6"),
            "max_tokens": os.environ.get("UX_JOURNEY_CLAUDE_MAX_TOKENS", "16384"),
            "tolerantParsing": tolerant,
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
            "tolerantParsing": tolerant,
            "fallback": (
                {
                    "provider": "anthropic",
                    "model": os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6"),
                }
                if has_fallback
                else None
            ),
        }
    return {"provider": "unknown", "model": "unknown", "tolerantParsing": tolerant}


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


# ---------------------------------------------------------------------------
# Per-step UX observations (Phase: scorecard)
# ---------------------------------------------------------------------------
# The persona is asked (see ``CHECKION_OBSERVATIONS`` in the system prompt) to
# optionally append a delimited JSON block to its `thinking` field whenever
# something on the page strikes it as notable — positively or negatively.
# We extract those observations here, validate each entry against a strict
# allow-list (so a malformed LLM payload can't crash the run or pollute the
# scorecard), and strip the block from the visible narration so the
# user-facing reasoning text stays clean.
_OBSERVATIONS_BLOCK_RE = re.compile(
    r"<<OBSERVATIONS>>\s*(?P<json>.*?)\s*<<\/OBSERVATIONS>>",
    flags=re.DOTALL,
)
_OBSERVATION_CATEGORIES: tuple[str, ...] = (
    "layout",
    "visual",
    "typography",
    "copy",
    "affordance",
    "navigation",
    "info_density",
    "trust",
    "performance",
    "persona_fit",
)
_OBSERVATION_SEVERITIES: tuple[str, ...] = ("low", "medium", "high")
_OBSERVATION_POLARITIES: tuple[int, ...] = (-2, -1, 1, 2)
_OBSERVATION_NOTE_LIMIT = 320
_OBSERVATION_FIX_LIMIT = 240
_OBSERVATIONS_PER_STEP_CAP = 2


def _strip_observations_block(text: str) -> str:
    """Remove every ``<<OBSERVATIONS>>...<</OBSERVATIONS>>`` block from ``text``.

    Tolerates multiple blocks in the same string (rare; some models like to
    re-emit them on retries) and collapses any whitespace runs left behind.
    """
    if not text or "<<OBSERVATIONS>>" not in text:
        return text
    cleaned = _OBSERVATIONS_BLOCK_RE.sub("", text)
    # Collapse 3+ consecutive newlines that the strip can produce when the
    # block sat on its own line.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def _coerce_observation_entry(raw: Any) -> dict[str, Any] | None:
    """Validate one parsed observation dict; return ``None`` if it's not usable.

    We're deliberately strict: any unknown category/severity/polarity drops
    the entry. A partially-valid LLM payload should not bleed garbage into
    the scorecard — silent rejection is preferred to a fuzzy half-match.
    """
    if not isinstance(raw, dict):
        return None
    category = str(raw.get("category") or "").strip().lower()
    if category not in _OBSERVATION_CATEGORIES:
        return None
    severity = str(raw.get("severity") or "").strip().lower()
    if severity not in _OBSERVATION_SEVERITIES:
        return None
    pol_raw = raw.get("polarity")
    try:
        polarity = int(pol_raw) if pol_raw is not None else None
    except (TypeError, ValueError):
        polarity = None
    if polarity not in _OBSERVATION_POLARITIES:
        return None
    note = str(raw.get("note") or "").strip()
    if not note:
        return None
    out: dict[str, Any] = {
        "category": category,
        "polarity": polarity,
        "severity": severity,
        "note": _smart_trim(note, limit=_OBSERVATION_NOTE_LIMIT),
    }
    fix = str(raw.get("fix") or "").strip()
    if fix:
        out["fix"] = _smart_trim(fix, limit=_OBSERVATION_FIX_LIMIT)
    return out


def _extract_observations(thinking_text: str) -> tuple[list[dict[str, Any]], int]:
    """Pull validated ``StepObservation`` dicts out of ``thinking_text``.

    Returns ``(observations, invalid_count)`` so the caller can log how many
    entries the LLM emitted vs. how many survived validation. ``observations``
    is capped at ``_OBSERVATIONS_PER_STEP_CAP`` even if the LLM emitted more,
    so a chatty step can't blow up the card UI.
    """
    if not thinking_text or "<<OBSERVATIONS>>" not in thinking_text:
        return ([], 0)
    obs: list[dict[str, Any]] = []
    invalid = 0
    for match in _OBSERVATIONS_BLOCK_RE.finditer(thinking_text):
        payload = (match.group("json") or "").strip()
        if not payload:
            continue
        try:
            decoded = json.loads(payload)
        except json.JSONDecodeError:
            invalid += 1
            continue
        if isinstance(decoded, dict):
            decoded = [decoded]
        if not isinstance(decoded, list):
            invalid += 1
            continue
        for entry in decoded:
            coerced = _coerce_observation_entry(entry)
            if coerced is None:
                invalid += 1
                continue
            obs.append(coerced)
            if len(obs) >= _OBSERVATIONS_PER_STEP_CAP:
                break
        if len(obs) >= _OBSERVATIONS_PER_STEP_CAP:
            break
    return (obs[:_OBSERVATIONS_PER_STEP_CAP], invalid)


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


# Persona handling moved to checkion-agent (Phase 2): the typed PersonaContext +
# derived PersonaPolicy now live in checkion_agent.agent.persona, and Agent
# accepts a `persona=...` kwarg that renders the system-prompt block automatically.
# The 5 helpers that used to live here (_persona_instruction,
# _persona_policy_instruction, _persona_policy, _text_blob_from_persona,
# _score_keywords) are gone — see CHANGELOG.md in the fork.


def _persona_policy_dump(agent: Any) -> dict[str, Any] | None:
    """Best-effort `agent.persona_policy.model_dump()` for the result payload.

    Returns ``None`` when the fork is too old (no `persona_policy` attribute)
    so the legacy clients see the field disappear gracefully — they used to
    read it as the keyword-scored policy and it remains the same shape.
    """
    policy = getattr(agent, "persona_policy", None)
    if policy is None:
        return None
    try:
        return policy.model_dump(by_alias=False)
    except Exception:  # pragma: no cover - defensive
        return None


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
        target = _humanize_action_payload(key, raw.get(key))
        result = _smart_trim(str(res or ""), limit=INTERMEDIATE_RESULT_CAP)
    return (action_label, target, result)


def _humanize_action_payload(action_key: str, payload: Any) -> str:
    """Convert an action's raw payload to a short human-readable string.

    The chat card renders ``step.target`` directly as a bold sentence under
    the step header. Without this humanisation, scroll/keys/input/wait/etc.
    actions produce ugly Python-dict reprs like ``{'down': True, 'pages': 0.3}``
    in the UI. Anything we don't recognise returns ``""`` so the card just
    skips the target row entirely instead of leaking internals.
    """
    if not isinstance(payload, dict):
        return ""
    key = (action_key or "").lower()
    try:
        if "scroll" in key:
            # browser-use 0.12.x emits ``scroll`` with ``{down: bool, pages: float}``;
            # older/legacy ``scroll_down`` / ``scroll_up`` come without the down flag.
            down = payload.get("down")
            if down is None:
                if "down" in key:
                    down = True
                elif "up" in key:
                    down = False
            pages = payload.get("pages")
            direction = "nach unten" if down else "nach oben" if down is False else ""
            if isinstance(pages, (int, float)) and pages > 0:
                p = float(pages)
                if abs(p - round(p)) < 0.05:
                    pages_text = f"{int(round(p))} Seite" + ("n" if round(p) != 1 else "")
                else:
                    pages_text = f"{p:.1f} Seiten"
                return f"{pages_text} {direction}".strip()
            return direction or ""
        if key in ("input_text", "type", "type_text"):
            text = str(payload.get("text") or "").strip()
            return f"„{_smart_trim(text, limit=80)}“" if text else ""
        if key in ("send_keys", "press_key", "keyboard"):
            keys = payload.get("keys") or payload.get("key") or ""
            return str(keys)[:80] if keys else ""
        if key in ("wait",):
            sec = payload.get("seconds") or payload.get("ms")
            if isinstance(sec, (int, float)) and sec > 0:
                if "ms" in payload and not payload.get("seconds"):
                    return f"{int(sec)} ms"
                return f"{float(sec):.1f}s"
            return ""
        if key in ("go_back", "go_forward"):
            return ""
        if key in ("switch_tab",):
            idx = payload.get("page_id") or payload.get("index")
            return f"Tab {idx}" if idx is not None else ""
        if key in ("upload_file",):
            return str(payload.get("path") or "")[:160]
        # Hover / focus / select etc. — fall through to first textual value.
        for v in payload.values():
            if isinstance(v, str) and v.strip():
                return _smart_trim(v.strip(), limit=160)
    except Exception:
        return ""
    return ""


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
                    # Pull out the optional <<OBSERVATIONS>> block BEFORE we
                    # cap or persist `thinking` — otherwise the cap would
                    # truncate a half-block and the parser would silently
                    # drop everything. The cleaned thinking (without the
                    # block) becomes user-facing `reasoning`.
                    observations, invalid_obs = _extract_observations(thinking)
                    cleaned_thinking = _strip_observations_block(thinking)
                    if observations:
                        step_entry["observations"] = observations
                    if observations or invalid_obs:
                        print(
                            f"ux-journey: step {step_num} observations parsed={len(observations)} "
                            f"invalid={invalid_obs}",
                            flush=True,
                        )
                    # Server-side safety net for `thinking`. Generous so we only
                    # trip on real LLM monologues (>3–4 sentences), not on
                    # legitimate dense reasoning. The prompt does the actual
                    # brevity work; this is just a guardrail.
                    step_entry["reasoning"] = _smart_trim(cleaned_thinking, limit=600)
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


def _steps_sidecar_path(job_id: str) -> Path:
    """JSON snapshot of steps (+ reasoning timing) for ffmpeg finalize after restarts."""
    return VIDEO_BASE_DIR / f"{job_id}.steps.json"


def _annotate_steps_with_video_offsets(job_id: str, steps: list[dict[str, Any]]) -> None:
    """Attach ``videoOffsetSec`` for UX finalize timing.

    **Implementation detail:** this is currently ``first_seen_monotonic - recording_mark_monotonic``
    — i.e. wall-ish elapsed time while the agent loop runs, **not** guaranteed to match the
    Playwright encoder's PTS timeline (browser startup skew, bursty steps, container duration
    quirks). Finalize therefore runs :func:`_normalize_steps_video_offsets_for_duration` when
    ``max(offset)`` exceeds ``ffprobe(duration)`` so scene cuts always stay inside the file.
    """
    rec = _recording_mono.get(job_id)
    if rec is None:
        return
    seen = _step_first_seen_mono.get(job_id) or {}
    for st in steps:
        if not isinstance(st, dict):
            continue
        n = st.get("step")
        if not isinstance(n, int):
            continue
        first_mono = seen.get(n)
        if first_mono is not None:
            st["videoOffsetSec"] = max(0.0, float(first_mono - rec))


def _normalize_steps_video_offsets_for_duration(
    steps: list[dict[str, Any]],
    duration_raw_sec: float,
    *,
    job_id: str | None = None,
) -> tuple[list[dict[str, Any]], float]:
    """Linearly rescale ``videoOffsetSec`` into ``[0, duration_raw_sec]`` when needed.

    Sidecar offsets come from monotonic clock deltas (see
    ``_annotate_steps_with_video_offsets``). The raw MP4 duration from
    ``ffprobe`` is the encoder timeline — the two can diverge by orders of
    magnitude (e.g. ``raw=1.27s`` while offsets run to ``~180s``). Without
    scaling, ``_build_scene_plan`` produces ``src_start > src_end`` after
    clamping to the file, ``ffmpeg`` seeks past EOF, and the first segment
    encodes as ~0.36s instead of the requested wall-clock — finalize then
    fails on a later segment or on the concat pass.

    When ``max(videoOffsetSec) <= duration_raw_sec + epsilon``, returns a
    shallow copy of ``steps`` unchanged and factor ``1.0``. Otherwise each
    offset is multiplied by ``duration_raw_sec / max_offset``.
    """
    jid = f" job={job_id}" if job_id else ""
    eps = 0.12
    if duration_raw_sec <= eps or not steps:
        return ([dict(s) if isinstance(s, dict) else s for s in steps], 1.0)
    max_off = 0.0
    for st in steps:
        if not isinstance(st, dict):
            continue
        v = st.get("videoOffsetSec")
        if isinstance(v, (int, float)):
            max_off = max(max_off, float(v))
    if max_off <= 0.0:
        return ([dict(s) if isinstance(s, dict) else s for s in steps], 1.0)
    if max_off <= duration_raw_sec + eps:
        return ([dict(s) if isinstance(s, dict) else s for s in steps], 1.0)
    k = duration_raw_sec / max_off
    out: list[dict[str, Any]] = []
    for st in steps:
        if not isinstance(st, dict):
            out.append(st)
            continue
        cp = dict(st)
        vo = cp.get("videoOffsetSec")
        if isinstance(vo, (int, float)):
            cp["videoOffsetSec"] = float(vo) * k
        out.append(cp)
    print(
        f"ux-journey: videoOffsetSec rescaled by {k:.6f} to match ffprobe duration "
        f"{duration_raw_sec:.2f}s (max_offset was {max_off:.2f}s — monotonic ≠ video){jid}",
        flush=True,
    )
    return (out, k)


# ---------------------------------------------------------------------------
# Journey scorecard (deterministic aggregation + small end-of-run LLM call)
# ---------------------------------------------------------------------------
UX_JOURNEY_SCORECARD = _env_truthy("UX_JOURNEY_SCORECARD", "1")
try:
    UX_JOURNEY_SCORECARD_QUOTES_MIN = max(0, min(8, int(os.environ.get("UX_JOURNEY_SCORECARD_QUOTES_MIN", "3") or "3")))
except ValueError:
    UX_JOURNEY_SCORECARD_QUOTES_MIN = 3
try:
    UX_JOURNEY_SCORECARD_QUOTES_MAX = max(
        UX_JOURNEY_SCORECARD_QUOTES_MIN,
        min(8, int(os.environ.get("UX_JOURNEY_SCORECARD_QUOTES_MAX", "5") or "5")),
    )
except ValueError:
    UX_JOURNEY_SCORECARD_QUOTES_MAX = 5
_SEVERITY_WEIGHT = {"low": 1, "medium": 2, "high": 3}


def _collect_observations(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flatten ``[{step, observation}, ...]`` from every per-step entry.

    Adds ``step`` (number) and ``stepIndex`` (0-based) to each observation
    so the aggregation can keep a back-reference for "found in step 3"-style
    UI labels without the consumer having to walk both arrays in parallel.
    """
    out: list[dict[str, Any]] = []
    for st in steps or []:
        if not isinstance(st, dict):
            continue
        obs_list = st.get("observations") or []
        if not isinstance(obs_list, list):
            continue
        step_num = st.get("step")
        if not isinstance(step_num, int):
            continue
        for o in obs_list:
            if not isinstance(o, dict):
                continue
            out.append({**o, "step": step_num})
    return out


def _journey_quotes_picker(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pick 3..5 verbatim Think-Aloud sentences as UX-research-style quotes.

    Heuristic: prefer ``reasoning`` entries that contain a justification
    marker (``weil``/``damit``/``deshalb``/``denn``) — those are the lines
    where the persona explains *why* she clicks. Fall back to any non-empty
    reasoning if the heuristic returns too few.
    """
    candidates_strong: list[tuple[int, str]] = []
    candidates_any: list[tuple[int, str]] = []
    for st in steps or []:
        if not isinstance(st, dict):
            continue
        step_num = st.get("step")
        reasoning = str(st.get("reasoning") or "").strip()
        if not isinstance(step_num, int) or not reasoning:
            continue
        first_sent = reasoning.split("\n", 1)[0].strip()
        first_sent = re.split(r"(?<=[.!?])\s+", first_sent, maxsplit=1)[0].strip()
        if not first_sent:
            first_sent = reasoning
        first_sent = _smart_trim(first_sent, limit=240)
        lower = first_sent.lower()
        if any(token in lower for token in (" weil ", " damit ", " deshalb ", " denn ", "weil ich", "damit ich")):
            candidates_strong.append((step_num, first_sent))
        candidates_any.append((step_num, first_sent))

    chosen: list[dict[str, Any]] = []
    seen_steps: set[int] = set()
    for step_num, text in candidates_strong:
        if step_num in seen_steps:
            continue
        chosen.append({"step": step_num, "text": text})
        seen_steps.add(step_num)
        if len(chosen) >= UX_JOURNEY_SCORECARD_QUOTES_MAX:
            break
    if len(chosen) < UX_JOURNEY_SCORECARD_QUOTES_MIN:
        for step_num, text in candidates_any:
            if step_num in seen_steps:
                continue
            chosen.append({"step": step_num, "text": text})
            seen_steps.add(step_num)
            if len(chosen) >= UX_JOURNEY_SCORECARD_QUOTES_MAX:
                break
    return chosen[:UX_JOURNEY_SCORECARD_QUOTES_MAX]


def _per_category_aggregate(observations: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """Build the ``perCategory`` block — keys for ALL known categories so the
    UI can render a complete table even when most categories had no flags.
    """
    out: dict[str, dict[str, float]] = {
        cat: {"flags": 0, "weighted": 0.0, "avgPolarity": 0.0, "positives": 0, "negatives": 0}
        for cat in _OBSERVATION_CATEGORIES
    }
    sums: dict[str, dict[str, float]] = {
        cat: {"polarity": 0.0, "weighted": 0.0} for cat in _OBSERVATION_CATEGORIES
    }
    for obs in observations:
        cat = obs.get("category")
        if cat not in out:
            continue
        polarity = int(obs.get("polarity") or 0)
        sev_w = _SEVERITY_WEIGHT.get(str(obs.get("severity") or ""), 1)
        out[cat]["flags"] = float(out[cat]["flags"]) + 1.0
        sums[cat]["polarity"] += float(polarity)
        sums[cat]["weighted"] += float(polarity) * float(sev_w)
        if polarity > 0:
            out[cat]["positives"] = float(out[cat]["positives"]) + 1.0
        elif polarity < 0:
            out[cat]["negatives"] = float(out[cat]["negatives"]) + 1.0
    for cat, agg in out.items():
        n = max(1.0, float(agg["flags"]))
        agg["avgPolarity"] = round(sums[cat]["polarity"] / n, 3) if agg["flags"] else 0.0
        agg["weighted"] = round(sums[cat]["weighted"] / n, 3) if agg["flags"] else 0.0
        agg["flags"] = int(agg["flags"])
        agg["positives"] = int(agg["positives"])
        agg["negatives"] = int(agg["negatives"])
    return out


def _top_strengths_and_weaknesses(
    observations: list[dict[str, Any]],
    *,
    limit: int = 3,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Pick the most ``severity * |polarity|``-impactful flags, split by sign."""
    def _impact(o: dict[str, Any]) -> float:
        sev_w = _SEVERITY_WEIGHT.get(str(o.get("severity") or ""), 1)
        pol = abs(int(o.get("polarity") or 0))
        return sev_w * pol

    pos = sorted(
        (o for o in observations if int(o.get("polarity") or 0) > 0),
        key=_impact,
        reverse=True,
    )
    neg = sorted(
        (o for o in observations if int(o.get("polarity") or 0) < 0),
        key=_impact,
        reverse=True,
    )

    def _pack(o: dict[str, Any]) -> dict[str, Any]:
        return {
            "category": o.get("category"),
            "polarity": int(o.get("polarity") or 0),
            "severity": o.get("severity"),
            "quote": o.get("note"),
            "fix": o.get("fix"),
            "step": o.get("step"),
        }

    return ([_pack(o) for o in pos[:limit]], [_pack(o) for o in neg[:limit]])


def _scorecard_done_text(steps: list[dict[str, Any]]) -> str:
    """Best-effort extraction of the agent's final ``done.text`` summary."""
    for st in reversed(steps or []):
        if not isinstance(st, dict):
            continue
        if str(st.get("action") or "").lower() == "done":
            text = str(st.get("result") or "").strip()
            if text:
                return text
    return ""


def _aggregate_per_step_ratings(
    per_step_ratings: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Average LLM-emitted per-step `-5..+5` ratings into a per-category roll-up.

    Returns one entry per category (all 10), each carrying:
    - ``score``: ``round(mean, 2)`` clamped to ``[-5, +5]`` — ``None`` if the
      LLM didn't rate that category in any step.
    - ``stepsRated``: how many steps contributed a numeric value. The UI uses
      this to decide whether the row is "real data" vs. a fallback row.

    Robust to malformed entries: missing keys, non-numeric values, and
    out-of-range numbers are silently dropped per cell — we never raise into
    the run loop, only ever omit data.
    """
    samples: dict[str, list[float]] = {cat: [] for cat in _OBSERVATION_CATEGORIES}
    for entry in per_step_ratings or []:
        if not isinstance(entry, dict):
            continue
        ratings = entry.get("ratings")
        if not isinstance(ratings, dict):
            continue
        for cat, val in ratings.items():
            if cat not in samples:
                continue
            try:
                v = float(val)
            except (TypeError, ValueError):
                continue
            if v != v:  # NaN guard
                continue
            samples[cat].append(max(-5.0, min(5.0, v)))
    out: dict[str, dict[str, Any]] = {}
    for cat in _OBSERVATION_CATEGORIES:
        lst = samples[cat]
        if lst:
            out[cat] = {"score": round(sum(lst) / len(lst), 2), "stepsRated": len(lst)}
        else:
            out[cat] = {"score": None, "stepsRated": 0}
    return out


async def _llm_scorecard_extras(
    *,
    persona: dict[str, Any] | None,
    task: str,
    domain: str,
    steps: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    done_text: str,
    quotes: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """End-of-run UX rating call.

    Produces:
    - ``frictionScore`` / ``personaFitScore`` (0..10) — overall KPIs.
    - ``coverage`` ({goalReached, gap}) — task completion check.
    - ``perStepRatings`` — every step rated on every one of the 10 UX
      categories on a `-5..+5` scale. Server-side averaged per category by
      :func:`_aggregate_per_step_ratings` so we always have a defensible
      score per dimension instead of "stayed at zero because nobody flagged
      that category" gaps.
    - ``perCategoryRationale`` — 1 sentence per category explaining the
      aggregated rating; surfaced as a tooltip in the UI.

    Returns ``None`` on any failure (no API key, network, malformed JSON);
    callers fall back to the deterministic observation aggregate so the
    scorecard still renders.
    """
    if not UX_JOURNEY_SCORECARD:
        return None

    # Per-step transcript: action + target + reasoning for the LLM to ground
    # its ratings. Cap to 30 steps and trim long fields to keep the prompt
    # token-budget bounded on long journeys.
    step_brief: list[dict[str, Any]] = []
    for st in (steps or [])[:30]:
        if not isinstance(st, dict):
            continue
        step_brief.append(
            {
                "step": st.get("step"),
                "action": st.get("action"),
                "target": _smart_trim(str(st.get("target") or ""), limit=160),
                "reasoning": _smart_trim(str(st.get("reasoning") or ""), limit=300),
            }
        )

    obs_brief = [
        {
            "step": o.get("step"),
            "category": o.get("category"),
            "polarity": o.get("polarity"),
            "severity": o.get("severity"),
            "note": o.get("note"),
        }
        for o in observations[:30]
    ]
    quote_brief = [{"step": q.get("step"), "text": q.get("text")} for q in quotes]

    persona_summary = ""
    if isinstance(persona, dict):
        bits: list[str] = []
        for key in ("name", "role", "industry", "seniority", "goal"):
            v = persona.get(key)
            if isinstance(v, str) and v.strip():
                bits.append(f"{key}={v.strip()}")
        persona_summary = "; ".join(bits)

    cat_csv = ", ".join(_OBSERVATION_CATEGORIES)
    system_prompt = (
        "Du bist ein UX-Research-Analyst. Du erhaeltst eine Persona, eine Aufgabe, "
        "die komplette Schritt-fuer-Schritt-Journey eines Think-Aloud-Laufs (mit "
        "Aktion + Reasoning pro Schritt), eine Liste validierter Beobachtungen "
        "und 3-5 woertliche Persona-Zitate.\n"
        "\n"
        "AUFGABE: Bewerte die Journey wie ein UX-Researcher.\n"
        "\n"
        "1) Bewerte JEDEN Schritt auf ALLEN 10 UX-Kategorien auf einer Skala -5..+5.\n"
        f"   Kategorien (genau diese Reihenfolge in 'ratings'): {cat_csv}.\n"
        "   Anker:\n"
        "   -5 = blockierend (verhindert Aufgabenziel),\n"
        "   -3 = stoert spuerbar,\n"
        "   -1 = leichtes Negativ,\n"
        "    0 = neutral oder nicht beobachtbar in diesem Schritt,\n"
        "   +1 = leichtes Plus,\n"
        "   +3 = klar positiv,\n"
        "   +5 = vorbildlich (Best-in-Class fuer diese Persona).\n"
        "   Bewerte streng aus Persona-Sicht: was fuer Persona X mittel ist, "
        "   kann fuer Persona Y stark sein. Setze 0 nur wenn die Kategorie auf "
        "   diesem Screenshot wirklich kein Eindruck war.\n"
        "\n"
        "2) Liefere fuer JEDE der 10 Kategorien EINEN Satz Rationale, der die "
        "   ueber alle Schritte aggregierte Bewertung begruendet (verweise ggf. "
        "   auf Schritte/Beobachtungen).\n"
        "\n"
        "3) Liefere die KPIs: frictionScore (0..10, hoeher = mehr Friktion), "
        "   personaFitScore (0..10, hoeher = besserer Fit), "
        "   coverage.goalReached (bool), coverage.gap (1 Satz, was gefehlt hat).\n"
        "\n"
        "STRENG: Antworte AUSSCHLIESSLICH mit kompaktem JSON in genau diesem Format:\n"
        "{"
        '"frictionScore":int,'
        '"personaFitScore":int,'
        '"coverage":{"goalReached":bool,"gap":string},'
        '"perStepRatings":['
        '{"step":int,"ratings":{'
        '"layout":int,"visual":int,"typography":int,"copy":int,"affordance":int,'
        '"navigation":int,"info_density":int,"trust":int,"performance":int,"persona_fit":int'
        "}}"
        "],"
        '"perCategoryRationale":{'
        '"layout":string,"visual":string,"typography":string,"copy":string,"affordance":string,'
        '"navigation":string,"info_density":string,"trust":string,"performance":string,"persona_fit":string'
        "}}\n"
        "Keine Markdown-Codefences, kein zusaetzlicher Text. ALLE 10 Kategorien "
        "muessen in JEDER ratings-Map und in perCategoryRationale vorhanden sein."
    )
    user_payload = json.dumps(
        {
            "persona": persona_summary or None,
            "task": _smart_trim(task or "", limit=500),
            "siteDomain": domain,
            "steps": step_brief,
            "observations": obs_brief,
            "quotes": quote_brief,
            "doneText": _smart_trim(done_text or "", limit=400) or None,
        },
        ensure_ascii=False,
    )

    api_key_openai = (os.environ.get("OPENAI_API_KEY") or "").strip()
    api_key_anthropic = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()

    raw_text: str | None = None
    if api_key_openai:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key_openai)
            model = os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o")
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_payload},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw_text = (resp.choices[0].message.content or "").strip()
        except Exception as exc:  # pragma: no cover - network/quota
            print(f"ux-journey: scorecard LLM (openai) failed err={exc!r}", flush=True)
            raw_text = None
    if raw_text is None and api_key_anthropic:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=api_key_anthropic)
            model = os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-6")
            resp = await client.messages.create(
                model=model,
                # Larger budget than before — perStepRatings + rationale is
                # ~10 categories * (number per step + ~120 chars per rationale).
                max_tokens=2400,
                temperature=0.2,
                system=system_prompt,
                messages=[{"role": "user", "content": user_payload}],
            )
            chunks: list[str] = []
            for block in getattr(resp, "content", []) or []:
                txt = getattr(block, "text", None)
                if isinstance(txt, str):
                    chunks.append(txt)
            raw_text = "".join(chunks).strip()
        except Exception as exc:  # pragma: no cover - network/quota
            print(f"ux-journey: scorecard LLM (anthropic) failed err={exc!r}", flush=True)
            raw_text = None
    if not raw_text:
        return None

    # Strip a possible ```json ... ``` fence the model added in spite of instructions.
    fenced = re.match(r"^```(?:json)?\s*(?P<body>.*?)\s*```$", raw_text, flags=re.DOTALL)
    if fenced:
        raw_text = fenced.group("body")
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        print(f"ux-journey: scorecard LLM JSON decode failed err={exc!r}", flush=True)
        return None
    if not isinstance(parsed, dict):
        return None

    def _clamp_int(value: Any, lo: int, hi: int) -> int | None:
        try:
            v = int(round(float(value)))
        except (TypeError, ValueError):
            return None
        return max(lo, min(hi, v))

    friction = _clamp_int(parsed.get("frictionScore"), 0, 10)
    persona_fit = _clamp_int(parsed.get("personaFitScore"), 0, 10)
    cov_raw = parsed.get("coverage") or {}
    if not isinstance(cov_raw, dict):
        cov_raw = {}
    goal_reached = bool(cov_raw.get("goalReached")) if "goalReached" in cov_raw else None
    gap = str(cov_raw.get("gap") or "").strip()

    per_step_ratings_raw = parsed.get("perStepRatings")
    if not isinstance(per_step_ratings_raw, list):
        per_step_ratings_raw = []
    per_category_agg = _aggregate_per_step_ratings(per_step_ratings_raw)

    rationale_raw = parsed.get("perCategoryRationale")
    if not isinstance(rationale_raw, dict):
        rationale_raw = {}
    rationale_clean: dict[str, str] = {}
    for cat in _OBSERVATION_CATEGORIES:
        v = rationale_raw.get(cat)
        if isinstance(v, str) and v.strip():
            rationale_clean[cat] = _smart_trim(v.strip(), limit=240)

    have_any_score = any(v.get("score") is not None for v in per_category_agg.values())

    if (
        friction is None
        and persona_fit is None
        and goal_reached is None
        and not gap
        and not have_any_score
        and not rationale_clean
    ):
        return None
    print(
        f"ux-journey: scorecard LLM ratings parsed={sum(1 for v in per_category_agg.values() if v.get('score') is not None)}/10 "
        f"steps_rated={len(per_step_ratings_raw)} friction={friction} fit={persona_fit}",
        flush=True,
    )
    return {
        "frictionScore": friction,
        "personaFitScore": persona_fit,
        "coverage": {
            "goalReached": goal_reached,
            "gap": _smart_trim(gap, limit=240) if gap else None,
        },
        "perCategoryLLM": per_category_agg,
        "perCategoryRationale": rationale_clean,
        "perStepRatings": [
            entry for entry in per_step_ratings_raw if isinstance(entry, dict)
        ],
    }


async def _build_scorecard(
    *,
    steps: list[dict[str, Any]],
    persona: dict[str, Any] | None,
    task: str,
    domain: str,
) -> dict[str, Any] | None:
    """Assemble the ``JourneyScorecard`` for ``result['scorecard']``.

    Returns ``None`` when the journey is empty — no steps with reasoning
    AND no done.text. Otherwise we always build a scorecard, even when the
    persona didn't flag any observations: the end-of-run LLM rating call
    fills the per-category roll-up so we don't get a "every category at 0"
    output from a sparse-observation run.
    """
    observations = _collect_observations(steps)
    quotes = _journey_quotes_picker(steps)
    done_text = _scorecard_done_text(steps)
    has_reasoning = any(
        isinstance(s, dict) and (s.get("reasoning") or "").strip() for s in (steps or [])
    )
    if not has_reasoning and not done_text and not observations:
        return None

    per_category = _per_category_aggregate(observations)
    strengths, weaknesses = _top_strengths_and_weaknesses(observations, limit=3)
    extras = await _llm_scorecard_extras(
        persona=persona,
        task=task,
        domain=domain,
        steps=steps,
        observations=observations,
        done_text=done_text,
        quotes=quotes,
    )

    # Merge LLM per-category ratings + rationale into the deterministic block.
    # We keep the `flags`/`weighted`/etc. counts intact so the strengths/
    # weaknesses tables (which are observation-driven) stay accurate, and
    # add `score` (LLM holistic, -5..+5) plus `rationale` so the UI's
    # per-category scale dot reflects a defensible value even when the
    # persona produced zero observations for that category.
    perCategoryLLM = (extras or {}).pop("perCategoryLLM", None) if extras else None
    perCategoryRationale = (extras or {}).pop("perCategoryRationale", None) if extras else None
    if isinstance(perCategoryLLM, dict):
        for cat, llm_agg in perCategoryLLM.items():
            target = per_category.get(cat)
            if not isinstance(target, dict) or not isinstance(llm_agg, dict):
                continue
            score = llm_agg.get("score")
            steps_rated = llm_agg.get("stepsRated")
            if isinstance(score, (int, float)):
                target["score"] = score
            if isinstance(steps_rated, int):
                target["stepsRated"] = steps_rated
    if isinstance(perCategoryRationale, dict):
        for cat, rationale in perCategoryRationale.items():
            target = per_category.get(cat)
            if not isinstance(target, dict) or not isinstance(rationale, str):
                continue
            target["rationale"] = rationale

    scorecard: dict[str, Any] = {
        "perCategory": per_category,
        "topStrengths": strengths,
        "topWeaknesses": weaknesses,
        "quotes": quotes,
        "totalObservations": len(observations),
    }
    if extras:
        # The remaining extras are KPIs + coverage + raw perStepRatings.
        # We forward perStepRatings so a power-user UI can later drill into
        # which step pulled a category up or down.
        scorecard.update(extras)
    return scorecard


def _persist_steps_sidecar(job_id: str, steps: list[dict[str, Any]]) -> None:
    """Persist steps so ``POST /video/finalize`` can burn subtitles without in-memory job state."""
    try:
        VIDEO_BASE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "jobId": job_id,
            "steps": steps,
        }
        _steps_sidecar_path(job_id).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def _load_steps_sidecar(job_id: str) -> list[dict[str, Any]] | None:
    p = _steps_sidecar_path(job_id)
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        steps = raw.get("steps")
        return steps if isinstance(steps, list) else None
    except Exception:
        return None


def _video_lower_third_body(step: dict[str, Any]) -> str:
    """Pick concise on-screen text for the polished video.

    Strict preference for the persona-voice ``reasoning`` field (= the
    ``thinking`` Think-Aloud line written by the prompt). Internal bookkeeping
    (``next_goal``, ``memory``, ``evaluation_previous_goal``) is **not**
    user-facing and only used as a last-ditch fallback for steps where the
    LLM produced no narration at all (very rare, mostly for the implicit
    "navigate to start URL" step).
    """
    r = str(step.get("reasoning") or "").strip()
    if r:
        return _smart_trim(r, limit=320)
    rm = step.get("reasoningMeta")
    if isinstance(rm, dict):
        # Only `next_goal` is shaped as a sentence; the others are internal
        # bookkeeping fragments that often read as bot-speak ("Index 12") and
        # would clash with the Think-Aloud tone of the rest of the video. Use
        # them strictly as a last resort for the very first / very last
        # synthetic steps where no `thinking` was produced.
        for key in ("next_goal", "memory", "evaluation_previous_goal"):
            v = str(rm.get(key) or "").strip()
            if v:
                return _smart_trim(v, limit=320)
    act = str(step.get("action") or "step")
    tgt = str(step.get("target") or "").strip()
    r = f"{act}: {tgt}" if tgt else act
    return _smart_trim(r, limit=320)


def _wrap_ass_lines(text: str, *, max_chars: int = 54, max_lines: int = 4) -> str:
    """Word-wrap for ASS; returns escaped single-line with \\N breaks."""
    words = text.replace("\r\n", "\n").replace("\r", "\n").split()
    lines: list[str] = []
    cur = ""
    for w in words:
        if len(w) > max_chars:
            if cur:
                lines.append(cur)
                cur = ""
            lines.append(_smart_trim(w, limit=max_chars))
            if len(lines) >= max_lines:
                break
            continue
        candidate = w if not cur else f"{cur} {w}"
        if len(candidate) <= max_chars:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) >= max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    elif cur and lines:
        tail = _smart_trim(lines[-1] + " " + cur, limit=max_chars + 24)
        lines[-1] = tail
    return "\\N".join(_escape_ass_chunk(line) for line in lines[:max_lines])


def _escape_ass_chunk(s: str) -> str:
    """Escape user text inside ASS Dialogue bodies."""
    out = (
        s.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
    )
    return out


def _format_ass_timestamp(total_seconds: float) -> str:
    """H:MM:SS.cc used by SSA/ASS."""
    t = max(0.0, float(total_seconds))
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    whole = int(s)
    cs = int(round((s - whole) * 100))
    if cs >= 100:
        cs = 0
        whole += 1
        if whole >= 60:
            whole = 0
            m += 1
    return f"{h}:{m:02d}:{whole:02d}.{cs:02d}"


async def _ffprobe_duration_seconds(path: Path) -> float | None:
    if shutil.which("ffprobe") is None:
        return None
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        out, _ = await proc.communicate()
        if proc.returncode != 0 or not out:
            return None
        return float(out.decode().strip())
    except Exception:
        return None


def _write_reasoning_ass_file(
    *,
    dest_ass: Path,
    steps: list[dict[str, Any]],
    duration_raw_sec: float,
    slowdown_eff: float,
) -> bool:
    """Build an ASS subtitle track timed on the *slowed* output timeline."""
    timed: list[tuple[float, float, str]] = []
    ordered = sorted(
        (s for s in steps if isinstance(s, dict)),
        key=lambda x: int(x.get("step") or 0),
    )
    offsets: list[tuple[float, dict[str, Any]]] = []
    for st in ordered:
        off = st.get("videoOffsetSec")
        if isinstance(off, (int, float)):
            offsets.append((float(off), st))
        else:
            continue
    offsets.sort(key=lambda x: x[0])
    dur_out = max(1.0, duration_raw_sec * slowdown_eff)
    for i, (t_in, st) in enumerate(offsets):
        start_out = max(0.0, t_in * slowdown_eff)
        if i + 1 < len(offsets):
            end_out = max(start_out + 0.35, offsets[i + 1][0] * slowdown_eff)
        else:
            end_out = max(start_out + 1.5, dur_out)
        body = _video_lower_third_body(st)
        if not body:
            continue
        # Title line + wrapped body
        step_n = int(st.get("step") or i + 1)
        title = _escape_ass_chunk(f"Schritt {step_n}")
        wrapped = _wrap_ass_lines(body)
        text = f"{title}\\N\\N{wrapped}"
        timed.append((start_out, end_out, text))

    if not timed:
        return False

    header = (
        "[Script Info]\n"
        "Title: CHECKION reasoning\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 0\n"
        "PlayResX: 1920\n"
        "PlayResY: 1080\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Default,Liberation Sans,20,&H00FFFFFF,&H000000FF,&H00000000,&H60000000,0,0,0,0,100,100,0,0,1,"
        "3,2,2,64,64,54,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines_out = [header]
    for start_out, end_out, text in timed:
        lines_out.append(
            f"Dialogue: 0,{_format_ass_timestamp(start_out)},{_format_ass_timestamp(end_out)},Default,,0,0,0,,{text}\n"
        )
    try:
        dest_ass.write_text("".join(lines_out), encoding="utf-8")
        return True
    except Exception:
        return False


# Magic-byte signatures we sniff for the live / step-screenshot endpoints.
# Order matters only insofar as none of these prefixes overlap; tested in the
# order most likely to hit (PNG first because the Phase 4 fork hook captures
# PNG, JPEG second because the legacy CDP polling loop captures JPEG).
_IMAGE_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
    (b"RIFF", "image/webp", "webp"),  # webp uses RIFF container; we accept it
)


def _sniff_image_content_type(data: bytes | None) -> str:
    """Return the IANA media-type for the bytes, defaulting to image/jpeg.

    This is the single source of truth for the live-frame / step-screenshot
    endpoints; before Phase 5 they all hard-coded ``image/jpeg`` which broke
    when the fork's `on_screenshot` hook started feeding PNG bytes through
    `UX_JOURNEY_LIVE_STEP_FRAMES`. Default-to-jpeg keeps every legacy path
    (CDP polling loop, ffmpeg-derived frames) byte-for-byte compatible.
    """
    if not data:
        return "image/jpeg"
    for sig, mime, _ext in _IMAGE_SIGNATURES:
        if data.startswith(sig):
            return mime
    return "image/jpeg"


def _image_extension_for_bytes(data: bytes | None) -> str:
    """Pick a file extension matching the sniffed bytes ('jpg' fallback)."""
    if not data:
        return "jpg"
    for sig, _mime, ext in _IMAGE_SIGNATURES:
        if data.startswith(sig):
            return ext
    return "jpg"


# Extensions we consider valid step-screenshot files on disk. Includes the
# legacy `.jpg` (always written by the CDP polling loop) and the Phase 4
# `.png` (written by the fork's `on_screenshot` hook when
# `UX_JOURNEY_LIVE_STEP_FRAMES=1`).
_STEP_SCREENSHOT_EXTENSIONS: tuple[str, ...] = ("jpg", "png")


def _step_screenshot_path(job_id: str, step_no: int) -> Path:
    """Path to the latest step screenshot, agnostic of file extension.

    Looks for ``{n}.png`` first (Phase 4 hook output, lossless), then
    ``{n}.jpg`` (legacy CDP polling loop). Returns the legacy `.jpg` path
    even if no file exists yet, so callers that only do existence checks
    or `.write_bytes()` keep working — the caller is responsible for
    writing the right extension via `_step_screenshot_write_path`.
    """
    base = STEP_SCREENSHOTS_BASE / job_id
    for ext in ("png", "jpg"):
        candidate = base / f"{step_no}.{ext}"
        if candidate.is_file():
            return candidate
    return base / f"{step_no}.jpg"


def _step_screenshot_write_path(job_id: str, step_no: int, data: bytes) -> Path:
    """Path to write the step screenshot to, picking the extension from
    the bytes' magic signature so the file extension and content stay in
    sync. Removes any pre-existing copy at the *other* extension to avoid
    a stale file shadowing the fresh one in `_step_screenshot_path`."""
    base = STEP_SCREENSHOTS_BASE / job_id
    ext = _image_extension_for_bytes(data)
    target = base / f"{step_no}.{ext}"
    for other_ext in _STEP_SCREENSHOT_EXTENSIONS:
        if other_ext == ext:
            continue
        stale = base / f"{step_no}.{other_ext}"
        if stale.is_file():
            try:
                stale.unlink()
            except OSError:
                pass
    return target


def _latest_step_screenshot_bytes(job_id: str) -> bytes | None:
    """Newest per-step screenshot on disk, regardless of `.jpg` / `.png`."""
    d = STEP_SCREENSHOTS_BASE / job_id
    if not d.is_dir():
        return None
    best: Path | None = None
    best_n = -1
    for ext in _STEP_SCREENSHOT_EXTENSIONS:
        for p in d.glob(f"*.{ext}"):
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
        mono_now = time.monotonic()
        rec = _recording_mono.get(job_id)
        if rec is not None:
            per_job = _step_first_seen_mono.setdefault(job_id, {})
            for st in steps_now:
                if not isinstance(st, dict):
                    continue
                n = st.get("step")
                if isinstance(n, int) and n not in per_job:
                    per_job[n] = mono_now
        try:
            async with _jobs_lock:
                prev = _jobs.get(job_id).result if job_id in _jobs and _jobs.get(job_id) else None
            prev_steps = prev.get("steps") if isinstance(prev, dict) else None
            if isinstance(prev_steps, list) and prev_steps:
                steps_now = _merge_step_screenshots(base_steps=steps_now, overlay_steps=prev_steps)
        except Exception:
            pass

        # Phase 5: variable name kept as `image_bytes` to avoid the misleading
        # `jpeg` from the pre-PNG era — a Phase 4 hook fed PNG into
        # `_live_frames` is now possible whenever `UX_JOURNEY_LIVE_STEP_FRAMES=1`.
        image_bytes: bytes | None = None
        frame = _live_frames.get(job_id)
        if frame and isinstance(frame, tuple) and len(frame) == 2:
            image_bytes = frame[1]
        if not image_bytes:
            image_bytes = await _capture_live_frame(agent_instance)

        if image_bytes:
            _live_frames[job_id] = (time.monotonic(), image_bytes)

        if image_bytes and steps_now:
            last = steps_now[-1]
            step_num = last.get("step")
            if isinstance(step_num, int):
                out = _step_screenshot_write_path(job_id, step_num, image_bytes)
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(image_bytes)
                rel = f"/run/{job_id}/step/{step_num}/screenshot"
                last["screenshotUrl"] = rel
                if UX_JOURNEY_EMBED_SCREENSHOTS:
                    mime = _sniff_image_content_type(image_bytes)
                    last["screenshot"] = (
                        f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
                    )
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
    """Background task: capture viewport at LIVE_FRAME_INTERVAL and store in _live_frames.

    Also bumps the job heartbeat (``last_observed_at``) on every successful
    capture — so chat-api's stagnation watchdog sees a fresh signal even when
    the agent is wedged inside a single multi-action step (the per-step
    history hook only fires when the *whole* step ends, which can be 60-120s
    later for a multi-action step with a slow LLM plan call).
    """
    while job_id in _live_agents:
        try:
            agent = _live_agents.get(job_id)
            if agent:
                jpeg = await _capture_live_frame(agent)
                if jpeg:
                    _live_frames[job_id] = (time.monotonic(), jpeg)
                    await _bump_heartbeat(job_id)
        except asyncio.CancelledError:
            break
        except Exception:
            pass
        await asyncio.sleep(LIVE_FRAME_INTERVAL * UX_JOURNEY_SLOWMO)


# ---------------------------------------------------------------------------
# Phase 6: per-action playback helpers (red click ring + slow scroll replay).
# These live above `run_agent` because they're pure browser-side animations
# fired from the fork's generic `on_action_end` hook — no agent / job state
# needs to leak in. The CDP send-glue is brittle across browser-use versions
# (older builds expose `cdp.send`, newer ones `cdp.cdp_client.send`), hence
# `_eval_js_via_cdp` is the only place that knows which shape we hit.
# ---------------------------------------------------------------------------


async def _eval_js_via_cdp(agent_instance: Any, js: str) -> bool:
    """Run a one-shot Runtime.evaluate via whatever CDP shape the session
    exposes. Returns True on a successful dispatch (the eval itself is
    fire-and-forget for animation purposes); never raises so callers can
    treat playback as best-effort."""
    try:
        session = await agent_instance.browser_session.get_or_create_cdp_session()
    except Exception:
        return False
    if not session:
        return False
    try:
        if hasattr(session, "cdp_client"):
            send = getattr(session.cdp_client, "send", None)
            if send and hasattr(send, "Runtime"):
                await send.Runtime.evaluate(expression=js, session_id=session.session_id)
                return True
        if hasattr(session, "send") and hasattr(session.send, "Runtime"):
            await session.send.Runtime.evaluate(expression=js, session_id=session.session_id)
            return True
    except Exception:
        return False
    return False


async def _play_click_ring(agent_instance: Any, params: dict[str, Any]) -> None:
    """Render a fading red ring at the click coordinates so the recording
    shows where the agent clicked. We resolve coordinates in this priority:

    1. ``params['coordinate_x']`` / ``coordinate_y`` — `click` action when
       called in coordinate mode (no DOM lookup needed).
    2. ``params['index']`` → look up the bounds in the pre-action selector
       map. The fork freshens this map on every step, so a click at index N
       always maps to the same node the model saw.

    A missing / stale element silently no-ops — UI playback is never
    allowed to degrade run reliability.
    """
    cx: float | None = None
    cy: float | None = None
    cox = params.get("coordinate_x")
    coy = params.get("coordinate_y")
    if isinstance(cox, (int, float)) and isinstance(coy, (int, float)):
        cx, cy = float(cox), float(coy)
    else:
        idx = params.get("index")
        if isinstance(idx, int):
            try:
                summary = agent_instance.browser_session._cached_browser_state_summary
                node = summary.dom_state.selector_map.get(idx) if summary and summary.dom_state else None
                bounds = getattr(node, "bounds", None) if node is not None else None
            except Exception:
                bounds = None
            if bounds is not None:
                bx = float(getattr(bounds, "x", 0))
                by = float(getattr(bounds, "y", 0))
                bw = float(getattr(bounds, "width", 0))
                bh = float(getattr(bounds, "height", 0))
                cx = bx + bw / 2
                cy = by + bh / 2

    if cx is None or cy is None:
        return  # nothing to render — no coordinates and no element bounds

    radius = 24
    circle_hold = _slow(CLICK_CIRCLE_VISIBLE_SECONDS)
    ms = int(circle_hold * 1000)
    js = (
        "(function(){var el=document.getElementById('agent-click-ring');"
        "if(el)el.remove();el=document.createElement('div');el.id='agent-click-ring';"
        f"el.style.cssText='position:fixed;left:{cx - radius}px;top:{cy - radius}px;"
        f"width:{radius * 2}px;height:{radius * 2}px;border-radius:50%;border:4px solid #e53935;"
        "pointer-events:none;z-index:2147483647;box-shadow:0 0 0 2px rgba(229,57,53,0.5);';"
        f"document.body.appendChild(el);setTimeout(function(){{el.remove();}},{ms});}})();"
    )
    if await _eval_js_via_cdp(agent_instance, js):
        await asyncio.sleep(circle_hold)


async def _play_slow_scroll(agent_instance: Any, _params: dict[str, Any]) -> None:
    """Replay a step-based slow scroll (down then back up) so the live
    stream shows movement instead of jumping. Uses the same JS pattern as
    pre-Phase-6 — only the dispatch surface changed."""
    duration_sec = max(1.0, _slow(SCROLL_VISIBLE_SECONDS))
    interval_ms = 40  # 25 fps
    total_px = 80
    steps = max(1, int((duration_sec * 1000) / interval_ms))
    step_px = total_px / steps
    template = (
        "(function(){"
        f"var iv={interval_ms}, n={steps}, step={step_px}, c=0;"
        "function run(){ window.scrollBy(0,DIR*step); c++; if(c<n) setTimeout(run,iv); }"
        "run();"
        "})();"
    )
    forward_js = template.replace("DIR", "1")
    backward_js = template.replace("DIR", "-1")

    if await _eval_js_via_cdp(agent_instance, forward_js):
        await asyncio.sleep(duration_sec)
    if await _eval_js_via_cdp(agent_instance, backward_js):
        await asyncio.sleep(duration_sec)


async def _bump_heartbeat(job_id: str) -> None:
    """Stamp ``JobState.last_observed_at`` with the current wall-clock time.

    Surfaced over ``GET /run/{jobId}`` so chat-api's stagnation watchdog can
    distinguish "agent silently wedged for 3 minutes" from "agent legitimately
    burning real time on a long LLM call mid-step". The latter still ticks the
    heartbeat from the live screenshot hook / live frame cache update, the
    former leaves it frozen.

    The function is intentionally cheap (no I/O, only a dict + datetime)
    so callers can fire it on any pipeline event without budget concerns.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    now_mono = time.monotonic()
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job is not None:
            job.last_observed_at = now_iso
            job.last_observed_mono = now_mono


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

    Doubles as the *heartbeat* source: every time we observe a non-empty
    history (regardless of whether it grew), we bump ``last_observed_at`` so
    chat-api's stagnation watchdog sees a fresh signal even when the agent is
    mid-LLM-call within a single step.
    """
    last_seen = -1
    while job_id in _live_agents:
        try:
            agent = _live_agents.get(job_id)
            if agent is not None:
                # Any sign the agent is alive — even an unchanged history —
                # counts as a heartbeat. The expensive partial-publish branch
                # below only fires when the step count actually grew.
                await _bump_heartbeat(job_id)
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
        from checkion_agent import Agent, Browser
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
        try:
            browser = Browser(record_video_dir=video_dir)
        except TypeError:
            browser = Browser()
        _recording_mono[job_id] = time.monotonic()
        # Prefer initial_url if supported; else bake URL into task. Instruct model to output reasoning in German.
        sig = inspect.signature(Agent.__init__)
        # Prompt-shaping to reduce premature "done" decisions.
        # Note: max_steps only sets an upper bound; the agent can still stop early if it thinks it's done.
        min_steps = int(os.environ.get("UX_JOURNEY_MIN_STEPS", "6"))
        # CHECKION reasoning extension. With checkion-agent Phase 3:
        # - language is set via `Agent(reasoning_language='de')` — clean,
        #   one-line block injected into the system prompt by the fork.
        # - the brevity / format / completion rules below are CHECKION-UI-
        #   specific and stay in the *app*, but they move from the task into
        #   `extend_system_message`. That puts them in the system prompt
        #   (sent every step, naturally cached) instead of the user message.
        # The persona block is automatically rendered last by the fork via
        # `Agent(persona=persona_dict)` — see checkion-agent CHANGELOG Phase 2.
        checkion_brevity_extension = (
            "CHECKION_THINK_ALOUD_UND_INTERNES:\n"
            # The `thinking` field is **the** user-facing artefact: it lands as
            # voice-over (TTS) and lower-third subtitle on the polished review
            # video, AND as the prominent reasoning text in the step card. The
            # other three structured fields are *internal* bookkeeping that the
            # browser-use schema requires; we keep them short so they don't
            # double-bill output tokens or drown the card UI.
            "ROLLENBILD: Du bist die Persona, die in einem moderierten UX-Research-Interview "
            "vor einem Bildschirm sitzt und 'laut denkt' (Think-Aloud). Du erklärst, was du auf "
            "der Seite GERADE SIEHST, was du als Nächstes anklicken/lesen/scrollen willst und WARUM "
            "— aus deiner Perspektive, nicht aus der eines Browsing-Bots.\n"
            "WICHTIG für 'thinking' (= Voice-Over + Untertitel im Review-Video): \n"
            "- 1–3 vollständige Sätze, ERSTE PERSON, PRÄSENS, sprich, als säßest du im Usability-Test.\n"
            "- BENENNE die Aktion, die du gerade ausführst, EXPLIZIT mit aktivem Verb: "
            "'Ich klicke …', 'Ich scrolle …', 'Ich tippe … ein', 'Ich wähle … aus', 'Ich öffne …', "
            "'Ich gehe zurück …'. NICHT 'Ich werde …' / 'Ich möchte …' / 'Als Nächstes …' — "
            "sondern Präsens-Aktion, die das Video gerade zeigt.\n"
            "- Struktur: <was ich sehe> → <was ich tue (mit aktivem Verb)> → <warum>. "
            "'Warum' ist die Begründung aus deiner Sicht (Bedürfnis, Hypothese, Zweifel).\n"
            "- Beispiele für gewünschten Ton (genau dieser Stil):\n"
            "    'Ganz oben fällt mir das Menü Leistungen auf — ich klicke da drauf, weil ich "
            "konkret wissen will, was die anbieten.'\n"
            "    'Die Startseite ist mir zu vage mit Buzzwords wie Transformation; ich scrolle weiter "
            "nach unten, um konkrete Cases oder Branchen zu finden.'\n"
            "    'Im Header sehe ich keinen Karriere-Eintrag, also klicke ich auf das Burger-Menü "
            "rechts oben, weil dort meistens die Sub-Navigation versteckt ist.'\n"
            "    'Ich tippe in die Suche Werkstudent ein und drücke Enter, um zu prüfen, ob "
            "es überhaupt solche Stellen gibt.'\n"
            "- KEINE Bot-Sprache wie 'Ich navigiere zur URL', 'Ich klicke Index 12', 'Element-Selektor', "
            "'Aktion ausführen', 'das DOM-Element …'. Das Index/Selektor-Detail gehört in 'next_goal' "
            "(siehe unten), nicht ins Voice-Over.\n"
            "- Persona-Bezug einfließen lassen, wo er die Entscheidung wirklich treibt "
            "(z. B. 'Als IT-Leitung achte ich darauf, ob DSGVO/On-Prem erwähnt wird…'). Sonst weglassen — "
            "kein Floskel-Anfang wie 'Als <Rolle> mit <Branche>…' bei jedem Schritt.\n"
            "INTERNE FELDER (so kurz wie möglich, NICHT user-facing — landen NICHT im Video, nur im Card-UI als optionales Detail):\n"
            "- 'evaluation_previous_goal': 1 Satz, neutrale Bewertung des letzten Schritts. "
            "Bsp: 'Klick auf Services hat funktioniert; Übersicht ist sichtbar.' / 'Suche liefert 0 Treffer.' "
            "Keine Wiederholung der Aktion. Beim ersten Schritt darf das leer/'-' sein.\n"
            "- 'memory': NUR konkrete, später wieder nutzbare Fakten (Zahlen, Maße, IDs, URLs, "
            "Branchen-Listen, Preise). Stichpunktartig, max. 2 kurze Sätze. KEINE Reflexion, KEINE Persona-Sprache, "
            "KEIN Aufzählen aller bisherigen Schritte. Wenn nichts Neues anfällt: leer lassen.\n"
            "- 'next_goal': 1 Satz im Bot-Stil — konkretes Element + Index/Selektor + erwarteter Effekt, "
            "z. B. 'Auf Service-Tab klicken (Index 12), um Leistungen zu sehen'. Diese Zeile ist die "
            "*Hand-Off*-Anweisung für deine eigene nächste Aktion, NICHT der Persona-Text.\n"
            "WICHTIG für 'done.text' (Final-Reflexion am Ende der Journey): "
            "Erste Person, Persona-Stimme, max. 4 kurze Sätze oder 6 Bulletpoints. "
            "'Was nehme ich aus diesem Besuch mit?' Faktenfokussiert: Was hat überzeugt, was war unklar, "
            "was hätte ich gebraucht. KEINE Zusammenfassung der Schrittreihenfolge.\n"
            # Anti-cliffhanger rule. Without this, the LLM tends to use „neben…",
            # „und mehr…", „etc." as a brevity hack — leaving the user with
            # half-formed thoughts. We require complete sentences within the
            # budget instead, with concrete examples when listing things.
            "WICHTIG: Schreibe in ALLEN Feldern vollständige, abgeschlossene Sätze. "
            "Verwende NIEMALS '…', '...', 'etc.', 'usw.', 'u. a.', 'und mehr' oder ähnliche Auslassungs-Marker als Platzhalter "
            "für unausgesprochene Inhalte. Wenn du Beispiele aufzählst, nenne 2–3 KONKRETE Beispiele "
            "(z. B. 'Automotive, Manufacturing, FinServ') oder lass die Aufzählung weg. "
            "Falls dir der Inhalt zu lang würde, kürze die Begründung — aber NIE die konkreten Fakten.\n"
            "CHECKION_COMPLETION:\n"
            "WICHTIG: Beende die Journey NICHT zu früh. Markiere erst dann als 'done'/'fertig', wenn du das Ziel wirklich erreicht hast "
            "UND es anhand sichtbarer UI-Indikatoren verifiziert hast (z.B. Bestätigungsseite, eindeutiger State, URL, Erfolgsmeldung). "
            f"WICHTIG: Beende NICHT vor mindestens {min_steps} Schritten. Wenn das Ziel früher erreicht wirkt, nutze die restlichen Schritte für "
            "Validierung (zurück/nach vorne, alternative Navigation, erneute Sichtprüfung), statt zu stoppen.\n"
            "CHECKION_NAVIGATION_ONLY:\n"
            "Nutze keine Websuche und keine Suchmaschinen (kein DuckDuckGo, Google, Bing). "
            "Bleibe auf der im Auftrag genannten Ziel-URL und ihren internen Links — keine generischen Web-Suchen.\n"
            "CHECKION_OBSERVATIONS:\n"
            # Optional UX-research flags emitted INSIDE `thinking` as a delimited
            # JSON block. The post-processor extracts these into a structured
            # `step.observations` array and strips the block from the visible
            # narration. We piggyback on `thinking` (vs. forking AgentOutput)
            # so the browser-use schema stays untouched. See main.py
            # `_extract_observations` / `_strip_observations_block` for the
            # parser; see README "Per-step observations & journey scorecard"
            # for product semantics.
            "Wenn dir bei DIESEM Schritt etwas an der Seite WIRKLICH auffaellt — "
            "positiv oder negativ — kannst du am Ende von 'thinking' OPTIONAL einen "
            "abgegrenzten JSON-Block anhaengen. Wenn nichts auffaellig ist: BLOCK WEGLASSEN. "
            "Erfinde keine Beobachtungen, nur damit der Block voll ist.\n"
            "Format (genau diese Marker, JSON-Array, max. 2 Eintraege pro Schritt):\n"
            "<<OBSERVATIONS>>[{\"category\":\"copy\",\"polarity\":-1,\"severity\":\"low\","
            "\"note\":\"Buzzwords wie 'Transformation' ohne konkrete Cases — fuer mich zu vage.\","
            "\"fix\":\"1-2 Beispielprojekte mit Branche und Zahl direkt im Hero.\"}]<</OBSERVATIONS>>\n"
            "Felder pro Eintrag:\n"
            "- 'category' (PFLICHT): einer von 'layout' (Hierarchie/Whitespace/Aufmerksamkeit), "
            "'visual' (Farbe/Bildsprache/Markenlook), 'typography' (Schriftgroessen/Lesbarkeit), "
            "'copy' (Texttiefe/Tonalitaet/Buzzwords), 'affordance' (sieht man wo zu klicken ist?), "
            "'navigation' (finde ich was ich suche?), 'info_density' (zu viel/zu wenig auf einmal), "
            "'trust' (Cases/Logos/DSGVO/Proof Points), 'performance' (Ladegefuehl/Layout-Shift), "
            "'persona_fit' (passt das zu meiner Rolle/Branche?).\n"
            "- 'polarity' (PFLICHT): -2 (klares Negativ), -1 (leichtes Negativ), 1 (leichtes Plus), "
            "2 (klares Plus). KEIN 0 — wenn du keinen Eindruck hast, lass den Eintrag weg.\n"
            "- 'severity' (PFLICHT): 'low' (kosmetisch), 'medium' (bremst Persona aus), "
            "'high' (blockiert das Aufgabenziel).\n"
            "- 'note' (PFLICHT): 1 vollstaendiger Satz aus Persona-Sicht — was du siehst, "
            "warum es dich stoert/begeistert. Persona-Stimme, nicht Bot-Stil.\n"
            "- 'fix' (OPTIONAL): 1 Satz, was du als Persona dir gewuenscht haettest. "
            "Konkret (Inhalt/Element), keine Generalvorschlaege wie 'besseres Design'.\n"
            "Beispiele fuer guten Ton:\n"
            "  {\"category\":\"affordance\",\"polarity\":-1,\"severity\":\"medium\","
            "\"note\":\"Die Karten am Footer sehen wie statische Bilder aus, nicht klickbar — "
            "ich haette das nicht ausprobiert.\",\"fix\":\"Hover-State + 'mehr erfahren'-Pfeil "
            "auf den Karten.\"}\n"
            "  {\"category\":\"trust\",\"polarity\":2,\"severity\":\"medium\","
            "\"note\":\"Drei konkrete Kunden mit Logo und Branche im Hero — das gibt mir "
            "sofort einen Anker als IT-Leitung.\"}\n"
            "Strenge Regeln: gueltiges JSON, KEINE Trailing-Kommas, KEINE Kommentare, "
            "KEINE zusaetzlichen Felder. Bei Format-Zweifeln BLOCK WEGLASSEN — der Parser "
            "verwirft sonst stillschweigend.\n"
        )
        # Task is now JUST the task — no language pinning, no brevity rules,
        # no persona stuffing. Reasoning language is handled by the fork
        # via `reasoning_language='de'`; brevity / completion rules go in
        # via `extend_system_message`; persona via `persona=`.
        task_with_lang = task
        # Per-request override (from chat-api / direct callers) wins over the
        # process-wide env default. Hard cap is configurable via
        # ``UX_JOURNEY_MAX_STEPS_CAP`` (default 150) so deep journeys don't
        # silently get clipped to a tiny window. Lower bound of 3 keeps a
        # confused LLM from triggering a 1-step run.
        try:
            env_default_max_steps = int(os.environ.get("UX_JOURNEY_MAX_STEPS", "50"))
        except ValueError:
            env_default_max_steps = 50
        try:
            max_steps_cap = int(os.environ.get("UX_JOURNEY_MAX_STEPS_CAP", "150"))
        except ValueError:
            max_steps_cap = 150
        if max_steps_cap < 3:
            max_steps_cap = 3
        if isinstance(max_steps_override, int) and max_steps_override > 0:
            max_steps = max(3, min(max_steps_cap, max_steps_override))
        else:
            max_steps = max(3, min(max_steps_cap, env_default_max_steps))
        agent_kw: dict[str, Any] = {"task": task_with_lang, "llm": llm, "browser": browser}
        # checkion-agent Phase 2: hand the typed persona to the Agent. The fork
        # accepts a dict and coerces it via PersonaContext.coerce(); fields it
        # doesn't understand are ignored. We pass it whenever the constructor
        # accepts the kwarg (or **kwargs) so the same code path keeps working
        # if checkion-agent ever drops the parameter.
        if persona and isinstance(persona, dict) and _agent_init_accepts_named_arg(sig, "persona"):
            agent_kw["persona"] = persona
        # checkion-agent Phase 3: pin reasoning language & feed CHECKION-UI brevity
        # rules into the system prompt (instead of the task). Both fall back
        # gracefully when the fork doesn't expose the parameter — `extend_system_message`
        # is a stock browser-use kwarg available since 0.10.x, so the brevity
        # block lands in the right place even on older forks.
        if _agent_init_accepts_named_arg(sig, "reasoning_language"):
            agent_kw["reasoning_language"] = "de"
        if _agent_init_accepts_named_arg(sig, "extend_system_message"):
            agent_kw["extend_system_message"] = checkion_brevity_extension

        # checkion-agent Phase 4: step pacing & screenshot hook. The fork sleeps
        # `step_pacing_seconds * action_slowdown_factor` at the start of each
        # step (same effect as the legacy `_on_step_start` hook) and fires
        # `on_screenshot(agent, b64_png)` right after capture (lets us push a
        # high-quality frame into the live-stream cache without waiting for
        # the polling loop's next tick). Falls back gracefully on older forks.
        if _agent_init_accepts_named_arg(sig, "step_pacing_seconds"):
            agent_kw["step_pacing_seconds"] = STEP_START_DELAY_SECONDS
        if _agent_init_accepts_named_arg(sig, "action_slowdown_factor"):
            agent_kw["action_slowdown_factor"] = UX_JOURNEY_SLOWMO

        # Bind the screenshot callback only if the fork supports it. We close
        # over `job_id` here (vs. reading from `agent.id`) so the cache keys
        # stay aligned with the rest of main.py — the agent's internal id is
        # a separate uuid that nothing else here knows about.
        def _on_screenshot(_agent: Any, screenshot_b64: str) -> None:
            try:
                _step_screenshot_counts[job_id] = _step_screenshot_counts.get(job_id, 0) + 1
                if UX_JOURNEY_LIVE_STEP_FRAMES and screenshot_b64:
                    # browser-use captures PNG; the legacy `_live_frames` cache
                    # is documented as JPEG bytes. Browsers sniff content
                    # regardless, but the MJPEG endpoint (image/jpeg multipart
                    # parts) won't be technically correct. Hence opt-in.
                    raw = base64.b64decode(screenshot_b64)
                    _live_frames[job_id] = (time.monotonic(), raw)
            except Exception as exc:  # pragma: no cover - hook must never break runs
                print(
                    f"ux-journey: job={job_id} on_screenshot hook failed: {exc!r}",
                    flush=True,
                )

        if _agent_init_accepts_named_arg(sig, "on_screenshot"):
            agent_kw["on_screenshot"] = _on_screenshot
        # Phase 6: `on_action_end` is wired *after* `Agent(**agent_kw)` is
        # constructed (search for "agent.on_action_end" further down) — the
        # callback closes over `_play_click_ring` / `_play_slow_scroll`
        # which are module-level, but the closure itself is defined inside
        # the `_on_step_end` / `_on_action_end` block and would otherwise
        # be NameErrored at construction time. Late-attribute-set is also
        # graceful-degradation-friendly: an older fork build that ignores
        # the attribute simply doesn't fire it.
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
        # Persona logging is now done *after* the Agent is constructed, so we
        # can read the canonical PersonaPolicy that the fork derived (instead
        # of re-deriving it locally). See _log_persona_snapshot() below.
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
        # CHECKION runs do not consume browser-use's `Judge` verdict — and on long
        # journeys the judge call sends the entire history + screenshots to the
        # primary LLM, regularly blowing through the 200k/272k context window
        # ("Judge trace failed: Input tokens exceed the configured limit"). The
        # error is caught internally but pollutes logs and burns tokens.
        # Default OFF; flip ``CHECKION_AGENT_USE_JUDGE=1`` to restore upstream.
        if _agent_init_accepts_named_arg(sig, "use_judge"):
            agent_kw["use_judge"] = _env_truthy("CHECKION_AGENT_USE_JUDGE", "0")
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

        # Persona snapshot: read the canonical PersonaPolicy that the fork
        # derived from the persona record. Useful when debugging "is the agent
        # actually role-playing the persona?" — if dimensions are all 0.5 the
        # persona text was too generic for keyword scoring; if heuristics=0 the
        # agent falls back to neutral navigation. With checkion-agent < Phase 2
        # (or when CHECKION_AGENT_PERSONA_INSTRUCTIONS=0) the attributes don't
        # exist, so we fall back gracefully.
        try:
            agent_persona = getattr(agent, "persona", None)
            agent_policy = getattr(agent, "persona_policy", None)
            if agent_persona is not None and agent_policy is not None:
                pname = (getattr(agent_persona, "name", None) or "").strip() or "(unnamed)"
                pid = (getattr(agent_persona, "id", None) or "").strip() or "(no-id)"
                dims_obj = getattr(agent_policy, "dimensions", None)
                hs = getattr(agent_policy, "heuristics", None) or []
                if dims_obj is not None:
                    dim_summary = " ".join(
                        f"{k.split('_')[0]}={getattr(dims_obj, k):.2f}"
                        for k in (
                            "risk_aversion",
                            "time_pressure",
                            "exploration",
                            "detail_orientation",
                            "trust_skepticism",
                            "accessibility_need",
                        )
                        if hasattr(dims_obj, k)
                    )
                else:
                    dim_summary = "(no dimensions)"
                print(
                    f"ux-journey: job={job_id} persona=\"{pname}\" id={pid} "
                    f"dimensions=[{dim_summary}] heuristics={len(hs)}",
                    flush=True,
                )
            else:
                print(
                    f"ux-journey: job={job_id} persona=<none> (no persona context received — "
                    f"agent runs as neutral default user)",
                    flush=True,
                )
        except Exception as exc:  # pragma: no cover - logging must not break runs
            print(f"ux-journey: job={job_id} persona logging failed: {exc!r}", flush=True)
        # Some browser-use builds only expose max_failures as an attribute,
        # not a constructor kwarg — set it after construction as a fallback.
        if max_failures_env > 0 and hasattr(agent, "max_failures"):
            try:
                agent.max_failures = max_failures_env
            except Exception:  # pragma: no cover - defensive
                pass

        # Step pacing is now first-class in checkion-agent (Phase 4) — see
        # `Agent(step_pacing_seconds=..., action_slowdown_factor=...)` set on
        # the constructor above. The hand-rolled `_on_step_start` hook this
        # used to be is gone; the fork sleeps the same `_slow(STEP_START_DELAY_SECONDS)`
        # at the start of every step, before timing / context prep.
        #
        # Phase 6: Click-ring overlay and slow-scroll replay are now per-action
        # work, fired from `on_action_end` directly after the matching tool
        # ran. `_on_step_end` only handles step-level work (settle pause +
        # partial publish). The browser-use ``on_step_end`` hook signature is
        # ``async (agent) -> None``; we keep that contract.
        async def _on_step_end(agent_instance: Any) -> None:
            # Pause so the video clearly shows the post-action state before
            # the next step's pacing sleep kicks in. We subtract the
            # click-ring hold so a click → settle sequence doesn't double-pad.
            await asyncio.sleep(_slow(max(0.5, STEP_DELAY_SECONDS - CLICK_CIRCLE_VISIBLE_SECONDS)))

            # After UI settles, publish steps + screenshot file + lightweight JSON.
            await _publish_partial_steps(
                job_id=job_id,
                agent_instance=agent_instance,
                task=task,
                domain=domain,
                persona=persona,
            )

        async def _on_action_end(
            agent_instance: Any,
            action_name: str,
            action_params: dict[str, Any],
            _result: Any,
        ) -> None:
            """Phase 6: per-action playback helpers wired through the fork's
            generic ``on_action_end`` hook.

            We branch on the registered tool name (``'click'``, ``'scroll'``):
            anything else is a no-op so adding new browser-use tools in a
            future upstream upgrade can never break the agent — the unknown
            action just runs without playback. Each branch wraps its own
            try/except so a failure in one playback (e.g. CDP closed during
            a navigation) never breaks the rest of the run."""
            _action_hook_counts[job_id] = _action_hook_counts.get(job_id, 0) + 1
            try:
                if action_name == "click":
                    await _play_click_ring(agent_instance, action_params)
                elif action_name == "scroll":
                    await _play_slow_scroll(agent_instance, action_params)
            except Exception:  # pragma: no cover - hooks must never break runs
                pass

        # Late-attribute-set wiring for the Phase 6 hook. Falls through silently
        # on older fork builds that don't read `self.on_action_end` from
        # `multi_act` — the `forkHooks.actionHookCalls` field below stays at 0,
        # so an operator can spot the version mismatch in the run result.
        if _agent_init_accepts_named_arg(sig, "on_action_end") or hasattr(agent, "on_action_end"):
            try:
                agent.on_action_end = _on_action_end
            except Exception as exc:  # pragma: no cover - defensive
                print(
                    f"ux-journey: job={job_id} on_action_end wireup failed: {exc!r}",
                    flush=True,
                )

        _live_agents[job_id] = agent
        # Phase 5: gated polling loop. When off, the only source of live frames
        # is the Phase 4 fork hook (one frame per agent step). The MJPEG /live
        # endpoint still works — it just paces at the agent's step cadence
        # instead of 25 fps.
        screenshot_task: asyncio.Task[None] | None = None
        if UX_JOURNEY_LIVE_POLLING_LOOP:
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
                    # Phase 4: `on_step_start` is gone — the fork's
                    # `step_pacing_seconds` parameter (set on the constructor
                    # above) replaces the hand-rolled lead-in sleep. We still
                    # pass `on_step_end` because it does CHECKION-specific work
                    # (red click ring, slow scroll injection, partial-steps
                    # publish) that doesn't fit a generic fork hook yet —
                    # candidate for a future Phase 6 (per-action hooks).
                    history = await agent.run(on_step_end=_on_step_end)
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
            background_tasks: list[asyncio.Task[None]] = [history_watcher_task]
            if screenshot_task is not None:
                background_tasks.append(screenshot_task)
            for bg in background_tasks:
                bg.cancel()
                try:
                    await bg
                except asyncio.CancelledError:
                    pass
            _live_agents.pop(job_id, None)
            _live_frames.pop(job_id, None)
            _step_screenshot_counts.pop(job_id, None)
            _action_hook_counts.pop(job_id, None)

        # CRITICAL: close the browser *before* discovering / moving / transcoding the video.
        # Playwright only finalizes the WebM/MP4 container (header, cues, EOF) when the browser is
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
        _annotate_steps_with_video_offsets(job_id, steps)
        success = _history_success(history)
        screenshots = _history_screenshots(history)

        # Journey scorecard (per-category aggregation + optional end-of-run
        # LLM call for friction/persona-fit/coverage). Best-effort: never
        # raise into the run loop, just log and skip if the LLM step fails.
        scorecard: dict[str, Any] | None = None
        try:
            scorecard = await _build_scorecard(
                steps=steps,
                persona=persona,
                task=task,
                domain=domain,
            )
        except Exception as exc:
            print(f"ux-journey: scorecard build failed for job={job_id} err={exc!r}", flush=True)
            scorecard = None

        # `domain` already computed above for partial progress updates.

        # Wait until Playwright's `[video_recorder]` finishes flushing the file.
        # Empirically the recording is written *after* `await browser.close()`
        # returns — so racing straight into the move yields the infamous 1-sec
        # clip. We poll the byte sum for a quiet window before publishing.
        try:
            stable, recorded_bytes = await _wait_for_recording_stable(video_dir)
        except Exception as exc:
            stable, recorded_bytes = (False, 0)
            print(
                f"video: stability poll crashed for job={job_id}: {exc!r} — moving on best-effort",
                flush=True,
            )
        if not stable:
            print(
                f"video: stability poll timed out for job={job_id} bytes={recorded_bytes} — "
                f"file may be partial; will attempt move anyway",
                flush=True,
            )
        else:
            print(
                f"video: recording stable for job={job_id} bytes={recorded_bytes}",
                flush=True,
            )

        # Move recorded video to a known path.
        # Playwright often writes WebM/MP4 in nested folders; we search recursively and pick the newest file.
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
                    # IMPORTANT: keep the raw recording at `{jobId}.raw.{ext}`,
                    # NOT at `{jobId}.{ext}`. The polished MP4 produced by
                    # ``_finalize_video`` claims `{jobId}.mp4`, and the finalize
                    # endpoint uses presence of that exact path as the
                    # "already_finalized" signal. Without this naming split the
                    # raw Playwright MP4 (browser-use 0.12.6+ writes `.mp4`
                    # natively) shadows the polished one — finalize short-circuits,
                    # slow-mo + lower-third + voice-over never run, and the
                    # browser plays a moov-incomplete clip that looks like
                    # "1 second" even though the file is 2 MB.
                    suffix = found_path.suffix.lower()  # ".mp4" | ".webm"
                    dest = VIDEO_BASE_DIR / f"{job_id}.raw{suffix}"
                    try:
                        VIDEO_BASE_DIR.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(found_path), str(dest))
                        video_path = str(dest)
                        print(
                            f"video: moved raw recording job={job_id} -> {dest.name} "
                            f"size={dest.stat().st_size if dest.is_file() else 0}",
                            flush=True,
                        )
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
            "personaPolicy": _persona_policy_dump(agent),
            # Visibility into the Phase 4 fork hooks. `pacingSeconds` is the
            # *base* (pre-slowmo) value handed to the constructor; effective
            # wait per step = pacingSeconds × slowdownFactor. `screenshotHookCalls`
            # is incremented every time the fork's `on_screenshot` actually fires
            # — a 0 here on a successful run means the fork didn't pick up the
            # hook (older checkion-agent build; check ``CHANGELOG.md``).
            "forkHooks": {
                "pacingSeconds": STEP_START_DELAY_SECONDS,
                "slowdownFactor": UX_JOURNEY_SLOWMO,
                "screenshotHookCalls": _step_screenshot_counts.get(job_id, 0),
                "liveStepFrames": UX_JOURNEY_LIVE_STEP_FRAMES,
                # Phase 5: visibility into which live-frame source(s) ran for
                # this job. `pollingLoop=false, screenshotHookCalls>0` is the
                # Phase 4 hook running solo; both true is the default mixed
                # mode; both false means /live was 404 the whole run.
                "livePollingLoop": UX_JOURNEY_LIVE_POLLING_LOOP,
                # Phase 6: per-action playback hook firings. Should be ≥
                # `len(steps)` for typical click/scroll-heavy journeys; a 0
                # on a successful run means the running fork is older than
                # 0.12.6+checkion.5 (no `on_action_end` in `multi_act`).
                "actionHookCalls": _action_hook_counts.get(job_id, 0),
                "videoSlowdownFactor": VIDEO_SLOWDOWN_FACTOR,
                "videoCompoundSlowmo": UX_JOURNEY_VIDEO_COMPOUND_SLOWMO,
                "effectiveVideoSlowdown": _effective_transcode_slowdown(),
                # Per-scene dynamic pacing: each step's segment in the polished
                # video is time-stretched (or compressed) to match the duration
                # of its TTS clip. Replaces the uniform setpts factor when on.
                "videoDynamicPacing": UX_JOURNEY_VIDEO_DYNAMIC_PACING,
                "videoSceneMinSec": UX_JOURNEY_VIDEO_SCENE_MIN_SEC,
                "videoSceneMaxSec": UX_JOURNEY_VIDEO_SCENE_MAX_SEC,
                "videoSceneVoicePadSec": UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC,
                "videoSceneMinScale": UX_JOURNEY_VIDEO_SCENE_MIN_SCALE,
                "lowerThirdBurnIn": UX_JOURNEY_VIDEO_LOWER_THIRD,
                "voiceoverEnabled": (
                    UX_JOURNEY_VIDEO_VOICEOVER
                    and bool(os.environ.get("OPENAI_API_KEY"))
                ),
                "voiceoverModel": UX_JOURNEY_VOICEOVER_MODEL,
                "voiceoverVoice": UX_JOURNEY_VOICEOVER_VOICE,
                "voiceoverLang": UX_JOURNEY_VOICEOVER_LANG,
                "voiceoverMaxTempo": UX_JOURNEY_VOICEOVER_MAX_TEMPO,
                "useJudge": _env_truthy("CHECKION_AGENT_USE_JUDGE", "0"),
            },
        }
        if persona and isinstance(persona, dict):
            result["persona"] = {
                "id": persona.get("id"),
                "name": persona.get("name"),
            }
        if scorecard:
            result["scorecard"] = scorecard
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
                try:
                    _persist_steps_sidecar(job_id, result["steps"])
                except Exception:
                    pass

        _recording_mono.pop(job_id, None)
        _step_first_seen_mono.pop(job_id, None)

        # Heavy ffmpeg polish (H.264 + slow-motion): defer unless explicitly disabled.
        # Raw recording from Playwright is already on disk — GET /video serves it.
        if video_path and not UX_JOURNEY_DEFER_VIDEO_FINALIZE:

            async def _finalize_bg() -> None:
                await _finalize_video(job_id=job_id, source_path=video_path)

            asyncio.create_task(_finalize_bg())
    except Exception as e:
        _recording_mono.pop(job_id, None)
        _step_first_seen_mono.pop(job_id, None)
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
# fast the agent actually drove the browser. Default base factor 16 (env)
# yields a substantially slower review clip than raw WebM; with compound mode
# (``UX_JOURNEY_VIDEO_COMPOUND_SLOWMO``) the effective stretch also scales with
# ``UX_JOURNEY_SLOWMO``. Clamped per-factor 1..64; effective slowdown capped at 128.
#
# NOTE: this filter only stretches existing frames in time. For a *smoother*
# slow-motion (more real frames per second of content), bump ``UX_JOURNEY_SLOWMO``
# instead, which adds wait time during the actual recording so Playwright
# captures more frames per page-load / scroll / click.
def _parse_slowdown_factor(raw: str | None) -> float:
    try:
        # Default 16: pairs with UX_JOURNEY_SLOWMO≈2 → effective ~32× wall-clock stretch
        # when compound mode is on — strong “review speed” without touching recording pacing alone.
        n = float(raw) if raw not in (None, "") else 16.0
    except (TypeError, ValueError):
        n = 16.0
    if n < 1.0:
        return 1.0
    if n > 64.0:
        return 64.0
    return n


VIDEO_SLOWDOWN_FACTOR = _parse_slowdown_factor(
    os.environ.get("UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR")
)

# Multiply UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR × UX_JOURNEY_SLOWMO for the ffmpeg pass so export
# pacing tracks the same knob used during recording (single mental model). Cap avoids absurd files.
UX_JOURNEY_VIDEO_COMPOUND_SLOWMO = _env_truthy("UX_JOURNEY_VIDEO_COMPOUND_SLOWMO", "1")

# Burn per-step reasoning into the polished MP4 (ASS subtitles in lower third).
UX_JOURNEY_VIDEO_LOWER_THIRD = _env_truthy("UX_JOURNEY_VIDEO_LOWER_THIRD", "1")

# Voice-over: synthesise the same per-step text via OpenAI TTS at finalize time
# and mix it into the polished MP4 with `adelay` + `amix`. Delay per clip is
# `videoOffsetSec × effectiveSlowdown × 1000` ms — identical timing math to the
# lower-third subs, so audio and burnt text track the *same* moment in the
# slowed export. We only enable this when an `OPENAI_API_KEY` is present (the
# TTS endpoint requires it); the env flag is the explicit kill switch.
UX_JOURNEY_VIDEO_VOICEOVER = _env_truthy("UX_JOURNEY_VIDEO_VOICEOVER", "1")
# `gpt-4o-mini-tts` is the current cheap-but-good model; `tts-1` works as a
# fallback if the operator pins an older API key.
UX_JOURNEY_VOICEOVER_MODEL = os.environ.get("UX_JOURNEY_VOICEOVER_MODEL", "gpt-4o-mini-tts")
UX_JOURNEY_VOICEOVER_VOICE = os.environ.get("UX_JOURNEY_VOICEOVER_VOICE", "alloy")
UX_JOURNEY_VOICEOVER_LANG = os.environ.get("UX_JOURNEY_VOICEOVER_LANG", "de")
try:
    UX_JOURNEY_VOICEOVER_MAX_CHARS = max(40, int(os.environ.get("UX_JOURNEY_VOICEOVER_MAX_CHARS", "220") or "220"))
except ValueError:
    UX_JOURNEY_VOICEOVER_MAX_CHARS = 220
try:
    # Single `atempo` filter accepts 0.5..2.0; we keep things conservative so
    # the synthesised speech still sounds natural even when fitted into a tight slot.
    UX_JOURNEY_VOICEOVER_MAX_TEMPO = max(1.0, min(1.8, float(os.environ.get("UX_JOURNEY_VOICEOVER_MAX_TEMPO", "1.4") or "1.4")))
except ValueError:
    UX_JOURNEY_VOICEOVER_MAX_TEMPO = 1.4
# Synthesis-time speed for OpenAI TTS. 1.0 = natural, ~1.15 = noticeably
# brisker but still natural, ~1.3 starts to feel rushed for German vowels.
# Range is the OpenAI-supported 0.25..4.0; we clamp to 0.5..2.0 to stay
# well inside the "still understandable" band. This is applied at synth
# time (so cache keys reflect it via ``_voiceover_text_hash``) — separate
# from the post-synth ``atempo`` filter ``UX_JOURNEY_VOICEOVER_MAX_TEMPO``
# which is only used in the legacy uniform-pacing path to fit a clip into
# its slot.
try:
    UX_JOURNEY_VOICEOVER_SPEED = max(0.5, min(2.0, float(os.environ.get("UX_JOURNEY_VOICEOVER_SPEED", "1.15") or "1.15")))
except ValueError:
    UX_JOURNEY_VOICEOVER_SPEED = 1.15
try:
    UX_JOURNEY_VOICEOVER_CONCURRENCY = max(1, min(16, int(os.environ.get("UX_JOURNEY_VOICEOVER_CONCURRENCY", "6") or "6")))
except ValueError:
    UX_JOURNEY_VOICEOVER_CONCURRENCY = 6
# Minimum gap (sec, output timeline) we leave between consecutive voice clips so
# the next thought doesn't crash into the previous one even when atempo is at the cap.
try:
    UX_JOURNEY_VOICEOVER_MIN_GAP_SEC = max(0.0, float(os.environ.get("UX_JOURNEY_VOICEOVER_MIN_GAP_SEC", "0.25") or "0.25"))
except ValueError:
    UX_JOURNEY_VOICEOVER_MIN_GAP_SEC = 0.25
# Per-job count (set during finalize); surfaced as forkHooks/diagnostics.
_voiceover_clip_counts: dict[str, int] = {}

# ---------------------------------------------------------------------------
# Dynamic per-scene pacing
# ---------------------------------------------------------------------------
# Instead of stretching the *whole* recording uniformly via ``setpts={eff}*PTS``
# (which produced 50-minute review clips for 5-step runs), we slice the raw
# capture at each ``videoOffsetSec`` boundary and re-time every slice
# individually so its output duration matches the per-step TTS clip. Net
# result: scene length ≈ voice length + a small pad. Steps with no voice
# fall back to a min-scene floor so the screen still has a moment of breathing.
UX_JOURNEY_VIDEO_DYNAMIC_PACING = _env_truthy("UX_JOURNEY_VIDEO_DYNAMIC_PACING", "1")
try:
    UX_JOURNEY_VIDEO_SCENE_MIN_SEC = max(0.5, float(os.environ.get("UX_JOURNEY_VIDEO_SCENE_MIN_SEC", "2.5") or "2.5"))
except ValueError:
    UX_JOURNEY_VIDEO_SCENE_MIN_SEC = 2.5
try:
    UX_JOURNEY_VIDEO_SCENE_MAX_SEC = max(5.0, float(os.environ.get("UX_JOURNEY_VIDEO_SCENE_MAX_SEC", "60.0") or "60.0"))
except ValueError:
    UX_JOURNEY_VIDEO_SCENE_MAX_SEC = 60.0
try:
    UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC = max(0.0, float(os.environ.get("UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC", "0.5") or "0.5"))
except ValueError:
    UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC = 0.5
try:
    # Default 0: skip the lead-in slice entirely. The lead-in showed raw
    # `0..videoOffsetSec[step1]` of the recording — historically that captured
    # the bouncing browser-use DVD-screensaver overlay on about:blank (now
    # disabled by default) plus an empty white about:blank tab while the LLM
    # planned step 1. Both are pure noise; the user wants the polished video
    # to start when the agent actually does something. Set a positive value to
    # opt back in (1.5 was the old default).
    UX_JOURNEY_VIDEO_SCENE_LEAD_IN_SEC = max(0.0, float(os.environ.get("UX_JOURNEY_VIDEO_SCENE_LEAD_IN_SEC", "0") or "0"))
except ValueError:
    UX_JOURNEY_VIDEO_SCENE_LEAD_IN_SEC = 0.0
try:
    UX_JOURNEY_VIDEO_SCENE_TAIL_SEC = max(0.0, float(os.environ.get("UX_JOURNEY_VIDEO_SCENE_TAIL_SEC", "2.5") or "2.5"))
except ValueError:
    UX_JOURNEY_VIDEO_SCENE_TAIL_SEC = 2.5
# Empirically, ``videoOffsetSec[N]`` (the moment step N first appears in
# ``agent.history``) is closer to the **start** of step N's pacing/work block
# than to its end — flipping to "end-of-step" produced a clearly visible
# off-by-one in the *opposite* direction (voice/overlay one scene too late
# vs. the visible action). Default OFF; keep the env knob so we can A/B if
# upstream changes its history-commit timing.
#
# - 0 (default, legacy): scene N = ``[offset[N], offset[N+1])`` — captures
#   step N's pacing delay + planning + action + tail. Voice plays at scene
#   start (during the pacing delay) — fine because the pacing delay screen is
#   either the previous step's settled page (which the persona is *now*
#   narrating about) or the page about to be acted on. ``VOICE_DELAY_SEC``
#   (see below) lets you shift voice further into the scene if you want it
#   to align with the visible action instead of the planning beat.
# - 1: scene N = ``[offset[N-1] | 0, offset[N])``.
UX_JOURNEY_VIDEO_SCENE_END_OFFSETS = _env_truthy("UX_JOURNEY_VIDEO_SCENE_END_OFFSETS", "0")
# Output-timeline delay added to every voice clip *inside its own scene*
# (positive = voice starts later in the scene; 0 = voice starts at scene
# start). Use a small positive value to push the voice past the per-step
# pacing-delay screen and onto the visible action — empirically 1.0..1.5 s
# tracks the click/scroll for the default ``UX_JOURNEY_STEP_START_DELAY_SECONDS``
# of 3.5 s × ``UX_JOURNEY_SLOWMO`` of 2.0 (= 7 s of pacing) once the dynamic
# pacing has compressed the slice. The delay is *clamped* to leave at least
# 0.5 s of voice within the scene so a chatty step can't push its voice
# entirely past the next scene boundary.
try:
    UX_JOURNEY_VIDEO_VOICE_DELAY_SEC = max(
        0.0, float(os.environ.get("UX_JOURNEY_VIDEO_VOICE_DELAY_SEC", "0.0") or "0.0")
    )
except ValueError:
    UX_JOURNEY_VIDEO_VOICE_DELAY_SEC = 0.0
# Hard floor on per-segment scale: prevents speeding a scene below 10% of
# real-time (= 10x speedup) where motion becomes a blur. If the voice is short
# but the raw segment is long, we'd otherwise compress, e.g., 30s of scrolling
# into 1.5s. Floor keeps scrolls and clicks visible at the cost of a slight
# voice-vs-scene mismatch (voice ends earlier than the scene).
try:
    UX_JOURNEY_VIDEO_SCENE_MIN_SCALE = max(0.05, min(1.0, float(os.environ.get("UX_JOURNEY_VIDEO_SCENE_MIN_SCALE", "0.1") or "0.1")))
except ValueError:
    UX_JOURNEY_VIDEO_SCENE_MIN_SCALE = 0.1


def _effective_transcode_slowdown() -> float:
    base = float(VIDEO_SLOWDOWN_FACTOR)
    if UX_JOURNEY_VIDEO_COMPOUND_SLOWMO:
        base *= float(UX_JOURNEY_SLOWMO)
    # Final stretch factor applied via setpts; cap keeps scrubbing tolerable on very long runs.
    return max(1.0, min(128.0, base))


# Boot-time confirmation of effective video pacing knobs. These are module-level
# constants — changing the env in Coolify after the container is running has
# *no* effect until the service is restarted. If the values you see here don't
# match what you set in Coolify, the deploy didn't pick up the env change.
print(
    f"ux-journey: video pacing config: SLOWMO={UX_JOURNEY_SLOWMO} "
    f"VIDEO_SLOWDOWN_FACTOR={VIDEO_SLOWDOWN_FACTOR} "
    f"VIDEO_EFFECTIVE_SLOWDOWN={_effective_transcode_slowdown()} "
    f"compound_slowmo={UX_JOURNEY_VIDEO_COMPOUND_SLOWMO} "
    f"lower_third={UX_JOURNEY_VIDEO_LOWER_THIRD} "
    f"voiceover={UX_JOURNEY_VIDEO_VOICEOVER} "
    f"voiceover_model={UX_JOURNEY_VOICEOVER_MODEL} "
    f"voiceover_voice={UX_JOURNEY_VOICEOVER_VOICE} "
    f"voiceover_max_tempo={UX_JOURNEY_VOICEOVER_MAX_TEMPO} "
    f"voiceover_openai_key={'present' if os.environ.get('OPENAI_API_KEY') else 'absent'} "
    f"use_judge={_env_truthy('CHECKION_AGENT_USE_JUDGE', '0')} "
    f"dynamic_pacing={UX_JOURNEY_VIDEO_DYNAMIC_PACING} "
    f"scene_min={UX_JOURNEY_VIDEO_SCENE_MIN_SEC}s "
    f"scene_max={UX_JOURNEY_VIDEO_SCENE_MAX_SEC}s "
    f"scene_voice_pad={UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC}s "
    f"scene_min_scale={UX_JOURNEY_VIDEO_SCENE_MIN_SCALE} "
    f"VIDEO_FPS={VIDEO_TRANSCODE_FPS} "
    f"VIDEO_TRANSCODE_DISABLED={VIDEO_TRANSCODE_DISABLED}",
    flush=True,
)

# When true (default), the heavy ffmpeg pass (H.264 + optional slow-motion) does
# NOT start automatically at the end of a run. The raw WebM/MP4 from Playwright
# is still available via GET /run/{id}/video immediately; the user (or the chat
# UI) triggers ``POST /run/{id}/video/finalize`` to produce the polished MP4.
# Set to false to restore the old fire-and-forget background finalization
# (wastes CPU on every run that nobody watches).

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
        if not await _transcode_to_smooth_mp4(src, smooth, job_id=job_id):
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
            # NOTE: deliberately *do not* unlink the raw recording. ``?force=1``
            # re-finalize needs it to re-render with new pacing / voice / subs
            # settings. Disk cost is one extra MP4 per job; persistence volume
            # is sized for that. Pre-rename legacy jobs (where src == final_dest)
            # are skipped — that's the only path where deleting would corrupt
            # the polished file.
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


# ---------------------------------------------------------------------------
# Voice-over (per-step TTS, mixed into the polished MP4 timeline)
# ---------------------------------------------------------------------------


@dataclass
class _VoiceoverClip:
    """One TTS clip ready for ffmpeg's filter_complex."""

    path: Path
    delay_ms: int
    duration_sec: float
    tempo_applied: float  # 1.0 = unchanged, >1.0 = sped up to fit the slot
    step_no: int


def _voiceover_text_for_step(step: dict[str, Any], *, max_chars: int) -> str:
    """Pick the line(s) we want spoken.

    Same source as the lower third (= persona Think-Aloud ``reasoning``),
    capped harder so synth output reliably fits the per-step slot. We do
    **not** prepend "Schritt N." — that wording fights the UX-research
    interview tone we want and also duplicates the lower-third badge that
    already shows the step number on screen.
    """
    body = _video_lower_third_body(step)
    body = _smart_trim(body, limit=max_chars)
    return body.strip()


def _voiceover_text_hash(text: str) -> str:
    """Stable cache key (model + voice + lang + speed + text).

    Lets ``?force=1`` re-finalize skip TTS calls when the run produced the
    same per-step bodies *and* the same synth parameters. ``speed`` is part
    of the key so flipping ``UX_JOURNEY_VOICEOVER_SPEED`` invalidates the
    cache instead of silently keeping the old-tempo clips.
    """
    h = hashlib.sha256()
    h.update(UX_JOURNEY_VOICEOVER_MODEL.encode("utf-8", errors="ignore"))
    h.update(b"|")
    h.update(UX_JOURNEY_VOICEOVER_VOICE.encode("utf-8", errors="ignore"))
    h.update(b"|")
    h.update(UX_JOURNEY_VOICEOVER_LANG.encode("utf-8", errors="ignore"))
    h.update(b"|")
    h.update(f"speed={UX_JOURNEY_VOICEOVER_SPEED:.4f}".encode("ascii"))
    h.update(b"|")
    h.update(text.encode("utf-8", errors="ignore"))
    return h.hexdigest()[:16]


def _voiceover_cache_dir(job_id: str) -> Path:
    return VIDEO_BASE_DIR / f"{job_id}-voiceover"


async def _synthesize_one_voiceover(text: str, dest_mp3: Path) -> bool:
    """Synthesise `text` to `dest_mp3` via OpenAI TTS. Returns True on success.

    Uses the official `openai` SDK already pulled in by checkion-agent. We stream
    the response straight to disk so big inputs don't sit in RAM.
    """
    api_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not api_key or not text:
        return False
    try:
        from openai import AsyncOpenAI  # local import: keeps cold-start cheap
    except ImportError:
        print("ux-journey: voiceover skipped — `openai` package not installed", flush=True)
        return False

    client = AsyncOpenAI(api_key=api_key)
    dest_mp3.parent.mkdir(parents=True, exist_ok=True)
    # Build the create() kwargs and add ``speed`` only when it differs from
    # 1.0 — older `openai` SDKs that don't yet expose the parameter on
    # ``audio.speech.with_streaming_response.create`` would otherwise fail
    # at import-time with a TypeError.
    create_kwargs: dict[str, Any] = {
        "model": UX_JOURNEY_VOICEOVER_MODEL,
        "voice": UX_JOURNEY_VOICEOVER_VOICE,
        "input": text,
        "response_format": "mp3",
    }
    if abs(UX_JOURNEY_VOICEOVER_SPEED - 1.0) > 0.001:
        create_kwargs["speed"] = float(UX_JOURNEY_VOICEOVER_SPEED)
    try:
        async with client.audio.speech.with_streaming_response.create(**create_kwargs) as response:
            await response.stream_to_file(str(dest_mp3))
        return dest_mp3.is_file() and dest_mp3.stat().st_size > 0
    except TypeError as exc:
        # SDK doesn't support ``speed=`` yet — retry without it. The synth
        # will be at default tempo; surface a one-time warning so operators
        # know the env knob isn't taking effect.
        if "speed" in create_kwargs:
            create_kwargs.pop("speed", None)
            print(
                f"ux-journey: voiceover speed={UX_JOURNEY_VOICEOVER_SPEED} ignored "
                f"(openai SDK does not accept the kwarg): {exc!r}",
                flush=True,
            )
            try:
                async with client.audio.speech.with_streaming_response.create(**create_kwargs) as response:
                    await response.stream_to_file(str(dest_mp3))
                return dest_mp3.is_file() and dest_mp3.stat().st_size > 0
            except Exception as exc2:
                print(
                    f"ux-journey: voiceover synth failed (no-speed retry) model={UX_JOURNEY_VOICEOVER_MODEL} "
                    f"voice={UX_JOURNEY_VOICEOVER_VOICE} err={exc2!r}",
                    flush=True,
                )
                return False
        print(
            f"ux-journey: voiceover synth failed (TypeError) model={UX_JOURNEY_VOICEOVER_MODEL} "
            f"voice={UX_JOURNEY_VOICEOVER_VOICE} err={exc!r}",
            flush=True,
        )
        return False
    except Exception as exc:  # pragma: no cover - network / quota
        print(
            f"ux-journey: voiceover synth failed model={UX_JOURNEY_VOICEOVER_MODEL} "
            f"voice={UX_JOURNEY_VOICEOVER_VOICE} err={exc!r}",
            flush=True,
        )
        return False


def _atempo_chain_filter(ratio: float) -> str:
    """Compose `atempo=` filters for `ratio`. A single `atempo` accepts only
    0.5..2.0 — for our cap (≤1.8) one filter is always enough, but we keep the
    chain composer for safety."""
    if 0.5 <= ratio <= 2.0:
        return f"atempo={ratio:.4f}"
    parts: list[str] = []
    r = float(ratio)
    while r > 2.0:
        parts.append("atempo=2.0")
        r /= 2.0
    while r < 0.5:
        parts.append("atempo=0.5")
        r *= 2.0
    parts.append(f"atempo={r:.4f}")
    return ",".join(parts)


async def _atempo_audio(src_mp3: Path, dest_mp3: Path, tempo: float) -> bool:
    """Re-render `src_mp3` at `tempo`× speed (preserves pitch). Used when the raw
    TTS overflows its slot in the slowed video and we need to fit it back in."""
    if shutil.which("ffmpeg") is None:
        return False
    af = _atempo_chain_filter(tempo)
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-i", str(src_mp3),
        "-filter:a", af,
        "-vn",
        "-acodec", "libmp3lame",
        "-q:a", "3",
        str(dest_mp3),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        if proc.returncode == 0 and dest_mp3.is_file() and dest_mp3.stat().st_size > 0:
            return True
        print(
            f"ux-journey: voiceover atempo failed (rc={proc.returncode}) "
            f"src={src_mp3.name} tempo={tempo:.3f}: {stderr[-512:] if stderr else b''!r}",
            flush=True,
        )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ux-journey: voiceover atempo crashed src={src_mp3.name}: {exc!r}", flush=True)
    return False


async def _synthesize_step_voiceovers(
    *,
    job_id: str,
    steps: list[dict[str, Any]],
    eff_slowdown: float,
    duration_raw_sec: float,
    apply_slot_atempo: bool = True,
) -> list[_VoiceoverClip]:
    """Per-step TTS. Returns clips ready to be fed into ffmpeg.

    ``apply_slot_atempo``:
      - ``True`` (uniform-pacing path): cap each clip's duration by the slot
        length on the *slowed* output timeline, time-stretching the voice with
        ``atempo`` (≤ ``UX_JOURNEY_VOICEOVER_MAX_TEMPO``) so it fits.
      - ``False`` (dynamic-pacing path): leave the voice at natural tempo. The
        scene length will be derived *from* the clip duration in
        ``_build_scene_plan`` — atempo would defeat the whole point.
    """
    if not (UX_JOURNEY_VIDEO_VOICEOVER and steps):
        return []
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        # Surface this exactly once per job so operators see *why* the polished MP4
        # came out silent — easy to confuse with a synth failure otherwise.
        print(
            f"ux-journey: voiceover skipped job={job_id} — UX_JOURNEY_VIDEO_VOICEOVER is on but "
            f"OPENAI_API_KEY is not set. Set it on the agent service container or flip "
            f"UX_JOURNEY_VIDEO_VOICEOVER=0 to silence this message.",
            flush=True,
        )
        return []
    if shutil.which("ffmpeg") is None:
        return []

    ordered_with_offset: list[tuple[float, dict[str, Any]]] = []
    for st in steps:
        if not isinstance(st, dict):
            continue
        off = st.get("videoOffsetSec")
        if isinstance(off, (int, float)):
            ordered_with_offset.append((float(off), st))
    ordered_with_offset.sort(key=lambda pair: pair[0])
    if not ordered_with_offset:
        return []

    dur_out = max(1.0, duration_raw_sec * eff_slowdown)
    cache_dir = _voiceover_cache_dir(job_id)
    cache_dir.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(UX_JOURNEY_VOICEOVER_CONCURRENCY)

    async def _build_clip(idx: int, t_in: float, st: dict[str, Any]) -> _VoiceoverClip | None:
        text = _voiceover_text_for_step(st, max_chars=UX_JOURNEY_VOICEOVER_MAX_CHARS)
        if not text:
            return None
        step_n = int(st.get("step") or idx + 1)
        # Slot in the *output* timeline (after setpts slowdown).
        start_out = max(0.0, t_in * eff_slowdown)
        if idx + 1 < len(ordered_with_offset):
            next_start = ordered_with_offset[idx + 1][0] * eff_slowdown
        else:
            next_start = dur_out
        slot = max(0.5, next_start - start_out - UX_JOURNEY_VOICEOVER_MIN_GAP_SEC)
        cache_key = _voiceover_text_hash(text)
        raw_mp3 = cache_dir / f"step-{step_n:03d}-{cache_key}.raw.mp3"
        if not raw_mp3.is_file() or raw_mp3.stat().st_size == 0:
            async with sem:
                ok = await _synthesize_one_voiceover(text, raw_mp3)
            if not ok:
                return None
        raw_dur = await _ffprobe_duration_seconds(raw_mp3) or 0.0
        if raw_dur <= 0.05:
            return None
        # Decide on tempo. Stay at 1.0 if it already fits OR if dynamic pacing
        # is on (in which case the scene matches the voice, not the other way around).
        tempo = 1.0
        clip_path = raw_mp3
        if apply_slot_atempo and raw_dur > slot:
            tempo = min(UX_JOURNEY_VOICEOVER_MAX_TEMPO, raw_dur / slot)
            if tempo > 1.001:
                fitted_mp3 = cache_dir / f"step-{step_n:03d}-{cache_key}.x{tempo:.3f}.mp3"
                if not fitted_mp3.is_file() or fitted_mp3.stat().st_size == 0:
                    if not await _atempo_audio(raw_mp3, fitted_mp3, tempo):
                        # Atempo failure: accept slight overlap rather than dropping the clip.
                        tempo = 1.0
                if tempo > 1.001 and fitted_mp3.is_file():
                    clip_path = fitted_mp3
        final_dur = await _ffprobe_duration_seconds(clip_path) or raw_dur / max(1.0, tempo)
        return _VoiceoverClip(
            path=clip_path,
            # In dynamic-pacing mode the caller will recompute delay_ms from the
            # cumulative scene plan — this initial value is just a placeholder
            # tied to the (uniform) eff slowdown for backwards compat.
            delay_ms=int(round(start_out * 1000.0)),
            duration_sec=final_dur,
            tempo_applied=tempo,
            step_no=step_n,
        )

    print(
        f"ux-journey: voiceover synth job={job_id} steps={len(ordered_with_offset)} "
        f"model={UX_JOURNEY_VOICEOVER_MODEL} voice={UX_JOURNEY_VOICEOVER_VOICE} "
        f"max_tempo={UX_JOURNEY_VOICEOVER_MAX_TEMPO} concurrency={UX_JOURNEY_VOICEOVER_CONCURRENCY}",
        flush=True,
    )
    tasks = [
        _build_clip(i, t_in, st) for i, (t_in, st) in enumerate(ordered_with_offset)
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)
    clips: list[_VoiceoverClip] = []
    failures = 0
    for r in raw_results:
        if isinstance(r, _VoiceoverClip):
            clips.append(r)
        elif isinstance(r, Exception):
            failures += 1
            print(f"ux-journey: voiceover clip task failed: {r!r}", flush=True)
        else:
            # ``None`` means the step had no spoken text or synth returned False — already logged.
            failures += 1
    clips.sort(key=lambda c: c.delay_ms)
    print(
        f"ux-journey: voiceover synth done job={job_id} ok={len(clips)} skipped_or_failed={failures}",
        flush=True,
    )
    return clips


@dataclass
class _SceneSegment:
    """One contiguous slice of the raw recording with its target output length.

    Built by ``_build_scene_plan`` from the ordered step offsets and (optional)
    per-step voice clips. Consumed by both the dynamic ffmpeg filter graph and
    the dynamic ASS subtitle writer.
    """

    src_start_sec: float
    src_end_sec: float
    target_out_sec: float  # how long this segment should play in the output
    step: dict[str, Any] | None  # None = lead-in / standalone tail
    voice: _VoiceoverClip | None
    label: str  # 'lead-in' | f'step-{n}' | 'tail' — purely for diagnostics

    @property
    def src_dur_sec(self) -> float:
        return max(0.0, self.src_end_sec - self.src_start_sec)

    @property
    def scale(self) -> float:
        d = self.src_dur_sec
        if d <= 0.001:
            return 1.0
        return self.target_out_sec / d


def _build_scene_plan(
    *,
    steps: list[dict[str, Any]],
    voice_clips: list[_VoiceoverClip],
    duration_raw_sec: float,
) -> list[_SceneSegment]:
    """Slice the raw timeline at each ``videoOffsetSec`` boundary and decide,
    per slice, how long it should play in the output.

    Rules per per-step segment:
      * ``target = clamp(MIN, voice_dur + voice_pad, MAX)`` if a voice clip exists
      * ``target = MIN_SCENE`` otherwise (no audio to anchor against)
      * ``scale = target / src_dur`` is *floored* at ``MIN_SCALE`` so even a long
        scrolling sequence with a 2-word voice doesn't compress into invisibility.

    A short lead-in segment (raw 0 → first step offset) is included if non-trivial,
    so the page-load moment is visible. A tail segment (last step offset → raw end)
    is appended when the recording continues past the final step's offset — keeps
    the closing frame on screen briefly.
    """
    voice_by_step = {c.step_no: c for c in voice_clips}

    ordered: list[tuple[float, dict[str, Any]]] = []
    for st in steps:
        if not isinstance(st, dict):
            continue
        off = st.get("videoOffsetSec")
        if isinstance(off, (int, float)):
            ordered.append((float(off), st))
    ordered.sort(key=lambda pair: pair[0])

    segments: list[_SceneSegment] = []
    if not ordered:
        # Pathological case (no offsets at all). Just play the whole raw clip
        # at realtime — at least the user sees something instead of a 50-min
        # unrolled blank.
        return [
            _SceneSegment(
                src_start_sec=0.0,
                src_end_sec=duration_raw_sec,
                target_out_sec=duration_raw_sec,
                step=None,
                voice=None,
                label="full",
            )
        ]

    first_offset = max(0.0, ordered[0][0])
    # Lead-in segment. We only emit one when:
    #   - the legacy "start-of-step" offset interpretation is in force AND
    #   - LEAD_IN_SEC > 0 AND
    #   - there's actually unaccounted raw footage before step 1.
    # In the new "end-of-step" interpretation (default ON), step 1's segment
    # already extends from raw 0 → offset[step1], so a separate lead-in would
    # double-count those frames.
    if (
        not UX_JOURNEY_VIDEO_SCENE_END_OFFSETS
        and first_offset > 0.5
        and UX_JOURNEY_VIDEO_SCENE_LEAD_IN_SEC > 0.05
    ):
        target = min(UX_JOURNEY_VIDEO_SCENE_LEAD_IN_SEC, max(0.5, first_offset))
        segments.append(
            _SceneSegment(
                src_start_sec=0.0,
                src_end_sec=first_offset,
                target_out_sec=target,
                step=None,
                voice=None,
                label="lead-in",
            )
        )

    for i, (t_in, st) in enumerate(ordered):
        if UX_JOURNEY_VIDEO_SCENE_END_OFFSETS:
            # ``offset[N]`` = end of step N (history-grew moment). Segment N
            # spans [offset[N-1] | 0, offset[N]) — the slice the cursor +
            # action of step N is actually visible in.
            src_start = ordered[i - 1][0] if i > 0 else 0.0
            src_end = t_in
        else:
            # Legacy: ``offset[N]`` = start of step N. Segment N spans
            # [offset[N], offset[N+1]).
            src_start = t_in
            src_end = ordered[i + 1][0] if i + 1 < len(ordered) else duration_raw_sec
        if src_end - src_start <= 0.05:
            # Two steps at virtually the same offset — merge by skipping this
            # zero-duration slice. The next step still gets its own scene.
            continue
        step_n = int(st.get("step") or i + 1)
        voice = voice_by_step.get(step_n)
        if voice is not None and voice.duration_sec > 0.1:
            target = max(
                UX_JOURNEY_VIDEO_SCENE_MIN_SEC,
                voice.duration_sec + UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC,
            )
        else:
            target = UX_JOURNEY_VIDEO_SCENE_MIN_SEC
        target = min(UX_JOURNEY_VIDEO_SCENE_MAX_SEC, target)

        # Enforce the speedup floor: if the raw segment is much longer than the
        # target (= heavy speedup), pull the target back up so motion stays
        # readable. This is the only knob that prevents 30s of slow-scrolling
        # being crammed into a 1s blur.
        src_dur = src_end - src_start
        min_target_for_scale = src_dur * UX_JOURNEY_VIDEO_SCENE_MIN_SCALE
        if target < min_target_for_scale:
            target = min(UX_JOURNEY_VIDEO_SCENE_MAX_SEC, min_target_for_scale)

        segments.append(
            _SceneSegment(
                src_start_sec=src_start,
                src_end_sec=src_end,
                target_out_sec=target,
                step=st,
                voice=voice,
                label=f"step-{step_n}",
            )
        )

    # Optional tail (post-last-step).
    #
    # - End-of-step interpretation (default): the per-step loop spans up to
    #   ``offset[lastStep]``, so the slice ``[offset[lastStep], raw_dur]``
    #   (the agent's "after the last action — page settled / done.text"
    #   moment) is uncovered and we add a short tail segment for it.
    # - Legacy (start-of-step): the per-step loop already covers up to
    #   ``raw_dur`` for the last step, so the tail is only added when no
    #   per-step segment touched the end (e.g. the final step had an offset
    #   == raw_dur and got skipped above).
    last_covered_end = segments[-1].src_end_sec if segments else 0.0
    if duration_raw_sec - last_covered_end > 0.5 and UX_JOURNEY_VIDEO_SCENE_TAIL_SEC > 0.0:
        segments.append(
            _SceneSegment(
                src_start_sec=last_covered_end,
                src_end_sec=duration_raw_sec,
                target_out_sec=UX_JOURNEY_VIDEO_SCENE_TAIL_SEC,
                step=None,
                voice=None,
                label="tail",
            )
        )

    return segments


def _segment_cumulative_starts(segments: list[_SceneSegment]) -> list[float]:
    """Return the *output*-timeline start of each segment (segment 0 starts at 0)."""
    out: list[float] = []
    cursor = 0.0
    for seg in segments:
        out.append(cursor)
        cursor += seg.target_out_sec
    return out


def _write_reasoning_ass_file_dynamic(
    *,
    dest_ass: Path,
    segments: list[_SceneSegment],
    cumulative_starts: list[float],
) -> bool:
    """ASS subtitle writer for the dynamic-pacing path. Each segment with an
    attached step gets a Dialogue line spanning the whole segment in the
    *output* timeline. No global slowdown factor needed — segments already
    encode their final duration.
    """
    timed: list[tuple[float, float, dict[str, Any]]] = []
    for seg, start_out in zip(segments, cumulative_starts):
        if seg.step is None:
            continue
        end_out = start_out + seg.target_out_sec
        timed.append((start_out, end_out, seg.step))
    if not timed:
        return False

    header = (
        "[Script Info]\n"
        "Title: CHECKION reasoning (dynamic)\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 0\n"
        "PlayResX: 1920\n"
        "PlayResY: 1080\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Default,Liberation Sans,20,&H00FFFFFF,&H000000FF,&H00000000,&H60000000,0,0,0,0,100,100,0,0,1,"
        "3,2,2,64,64,54,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [header]
    for start_out, end_out, st in timed:
        body = _video_lower_third_body(st)
        if not body:
            continue
        step_n = st.get("step")
        title = _escape_ass_chunk(f"Schritt {int(step_n)}" if isinstance(step_n, int) else "Schritt")
        wrapped = _wrap_ass_lines(body)
        text = f"{title}\\N\\N{wrapped}"
        lines.append(
            f"Dialogue: 0,{_format_ass_timestamp(start_out)},{_format_ass_timestamp(end_out)},Default,,0,0,0,,{text}\n"
        )
    try:
        dest_ass.write_text("".join(lines), encoding="utf-8")
        return True
    except Exception:
        return False


async def _transcode_to_smooth_mp4(src: Path, dest: Path, *, job_id: str | None = None) -> bool:
    """Re-encode ``src`` to a browser-friendly H.264 MP4 at ``dest``.

    Applies ``_effective_transcode_slowdown()`` (not raw ``VIDEO_SLOWDOWN_FACTOR`` alone)
    and optionally burns per-step reasoning subtitles when ``job_id`` resolves to a steps sidecar.

    Returns True on success. On failure (ffmpeg missing / encode error) the caller falls
    back to serving the original recording.
    """
    if VIDEO_TRANSCODE_DISABLED:
        return False
    if shutil.which("ffmpeg") is None:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)

    eff = _effective_transcode_slowdown()
    dur_raw = await _ffprobe_duration_seconds(src)
    steps_sub: list[dict[str, Any]] | None = None
    if job_id:
        steps_sub = _load_steps_sidecar(job_id)

    # Decide between the dynamic per-scene path and the legacy uniform setpts path.
    # Dynamic requires: feature flag on, sidecar steps with offsets, valid raw duration.
    use_dynamic = bool(
        job_id
        and UX_JOURNEY_VIDEO_DYNAMIC_PACING
        and steps_sub
        and dur_raw
        and dur_raw > 0.1
        and any(isinstance(s, dict) and isinstance(s.get("videoOffsetSec"), (int, float)) for s in steps_sub)
    )

    voice_clips: list[_VoiceoverClip] = []
    if job_id and UX_JOURNEY_VIDEO_VOICEOVER and steps_sub and dur_raw and dur_raw > 0.1:
        voice_clips = await _synthesize_step_voiceovers(
            job_id=job_id,
            steps=steps_sub,
            eff_slowdown=eff,
            duration_raw_sec=dur_raw,
            apply_slot_atempo=not use_dynamic,
        )
        if job_id is not None:
            _voiceover_clip_counts[job_id] = len(voice_clips)

    if use_dynamic:
        return await _transcode_dynamic(
            src=src,
            dest=dest,
            job_id=job_id,
            steps=steps_sub or [],
            voice_clips=voice_clips,
            duration_raw_sec=float(dur_raw or 0.0),
        )

    # ----- Legacy uniform path (no dynamic pacing) -----
    ass_path: Path | None = None
    if job_id and UX_JOURNEY_VIDEO_LOWER_THIRD and steps_sub and dur_raw and dur_raw > 0.1:
        ass_tmp = VIDEO_BASE_DIR / f"{job_id}.reasoning.ass"
        if _write_reasoning_ass_file(
            dest_ass=ass_tmp,
            steps=steps_sub,
            duration_raw_sec=dur_raw,
            slowdown_eff=eff,
        ):
            ass_path = ass_tmp

    # Build the *video* filter chain. We compose it once and decide downstream
    # whether to feed it via `-vf` (no audio mux) or `filter_complex` (with TTS).
    video_chain_parts: list[str] = []
    if eff > 1.0:
        video_chain_parts.append(f"setpts={eff:.6f}*PTS")
    video_chain_parts.append(f"fps={VIDEO_TRANSCODE_FPS}")
    video_chain_parts.append("format=yuv420p")
    if ass_path is not None and ass_path.is_file():
        sub_posix = ass_path.resolve().as_posix()
        video_chain_parts.append(f"subtitles={sub_posix}")
    video_chain = ",".join(video_chain_parts)

    print(
        f"ux-journey: transcode src={src.name} -> {dest.name} "
        f"mode=uniform effective_slowdown={eff:.4f} fps={VIDEO_TRANSCODE_FPS} "
        f"video_chain=\"{video_chain}\" "
        f"lower_third={'yes' if ass_path else 'no'} "
        f"voiceover_clips={len(voice_clips)}",
        flush=True,
    )

    cmd: list[str] = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-i", str(src),
    ]

    if voice_clips:
        for clip in voice_clips:
            cmd.extend(["-i", str(clip.path)])
        filter_parts: list[str] = [f"[0:v]{video_chain}[v]"]
        a_labels: list[str] = []
        for i, clip in enumerate(voice_clips):
            in_label = f"[{i + 1}:a]"
            out_label = f"[a{i + 1}]"
            ad = clip.delay_ms
            filter_parts.append(f"{in_label}adelay={ad}|{ad}{out_label}")
            a_labels.append(out_label)
        if len(a_labels) == 1:
            filter_parts.append(f"{a_labels[0]}anull[a]")
        else:
            filter_parts.append(
                "".join(a_labels)
                + f"amix=inputs={len(a_labels)}:duration=longest:dropout_transition=0[a]"
            )
        filter_complex = ";".join(filter_parts)
        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-preset", VIDEO_TRANSCODE_PRESET,
            "-crf", str(VIDEO_TRANSCODE_CRF),
            "-g", str(int(VIDEO_TRANSCODE_FPS * 2)),
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-movflags", "+faststart",
            "-shortest",
            str(dest),
        ])
    else:
        cmd.extend([
            "-vf", video_chain,
            "-c:v", "libx264",
            "-preset", VIDEO_TRANSCODE_PRESET,
            "-crf", str(VIDEO_TRANSCODE_CRF),
            "-g", str(int(VIDEO_TRANSCODE_FPS * 2)),
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-an",
            str(dest),
        ])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        ok = proc.returncode == 0 and dest.is_file() and dest.stat().st_size > 0
        if ok and ass_path is not None:
            try:
                ass_path.unlink(missing_ok=True)
            except Exception:
                pass
        if ok:
            return True
        # Best-effort log; do not raise — caller falls back to source file.
        print(
            f"ffmpeg transcode failed (rc={proc.returncode}) for {src}: {stderr[-1024:] if stderr else b''!r}",
            flush=True,
        )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ffmpeg transcode crashed for {src}: {exc!r}", flush=True)
    return False


async def _encode_dynamic_segment(
    *,
    src: Path,
    dest: Path,
    seg: _SceneSegment,
    raw_dur: float,
) -> tuple[bool, float]:
    """Render one ``_SceneSegment`` to its own intermediate MP4.

    Why a separate ffmpeg pass per segment instead of a giant ``filter_complex``
    with split+trim+concat? On real Playwright captures (variable framerate
    WebM/MP4 with sparse keyframes) the in-graph approach silently produces
    near-empty front segments — the user sees only the last scene because all
    earlier segments collapsed to a few duplicate frames and ffmpeg's audio
    ``amix=duration=longest`` then holds the last video frame to fill the
    audio length. Cutting per-segment with ``-ss / -to`` (+ ``-accurate_seek``)
    forces ffmpeg to decode-and-re-encode the slice cleanly, which makes the
    concat demuxer downstream a no-brainer.

    Returns ``(ok, actual_out_dur_sec)``. ``actual_out_dur_sec`` is queried
    via ffprobe after the encode so the caller can detect drift between the
    planned ``target_out_sec`` and what actually landed on disk (e.g. when the
    last ~30ms of a scene get dropped because the source had no frames there).
    """
    one_frame_sec = 1.0 / float(VIDEO_TRANSCODE_FPS)
    s0 = float(seg.src_start_sec)
    e0 = float(seg.src_end_sec)
    if e0 < s0:
        s0, e0 = e0, s0
    # Clamp to the real file — scene-plan boundaries may still exceed ``raw_dur``
    # before normalization runs on older sidecars.
    s = max(0.0, min(s0, raw_dur))
    e = max(s0, e0)
    e = min(max(e, s + one_frame_sec), raw_dur)
    s = min(s, e - one_frame_sec)
    s = max(0.0, s)
    phys_dur = e - s
    if phys_dur < one_frame_sec * 0.5:
        still_t = min(max(0.0, s0), max(0.0, raw_dur - one_frame_sec))
        return await _encode_still_segment(
            src=src, dest=dest, src_time=still_t, out_dur=seg.target_out_sec
        )

    # CRITICAL: derive setpts scale from the **physical** slice ``phys_dur``,
    # not ``seg.scale``. The plan's scale used logical ``src_end-src_start``
    # before clamping to ``raw_dur``. After clamp, e.g. lead-in ``[0, 5.53)``
    # becomes ``[0, 1.27)`` — re-using the old scale under-stretches (~0.36s out).
    scale_eff = max(0.001, float(seg.target_out_sec) / phys_dur)

    # Target frame count for this segment in the *output* timeline.
    target_frames = max(1, int(round(seg.target_out_sec * VIDEO_TRANSCODE_FPS)))

    cmd: list[str] = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        # Input-side seek with `-accurate_seek` (the default since ffmpeg 2.x):
        # fast-seeks to the nearest keyframe before `s`, then decodes forward
        # and discards frames so the first emitted frame is exactly at PTS=s.
        # Single-step seek is plenty accurate for our cadence and avoids the
        # output-side `-ss` interaction with setpts.
        "-accurate_seek",
        "-ss", f"{s:.4f}",
        "-i", str(src),
        # `(PTS-STARTPTS)*scale` resets each segment's PTS to start at 0 — the
        # concat *demuxer* doesn't strictly require this (it stamps with its
        # own clock), but it does make per-segment ffprobe duration reads
        # match the wall-clock playback length, which is what we use to
        # rebase the audio adelay schedule downstream.
        "-vf",
        f"setpts=(PTS-STARTPTS)*{scale_eff:.6f},fps={VIDEO_TRANSCODE_FPS},format=yuv420p",
        # Bound the output to exactly `target_frames` frames; setpts re-timed
        # them so playback duration = target_frames / VIDEO_TRANSCODE_FPS.
        "-frames:v", str(target_frames),
        "-c:v", "libx264",
        "-preset", VIDEO_TRANSCODE_PRESET,
        "-crf", str(VIDEO_TRANSCODE_CRF),
        "-pix_fmt", "yuv420p",
        # Force CFR — concat-demuxer requires identical timing across segments,
        # any VFR slice would break the join.
        "-vsync", "cfr",
        # Tight GOP per segment: 25-frame keyframes (≈1s) keep concat-demuxer
        # joins clean and let downstream players seek inside short scenes.
        "-g", str(VIDEO_TRANSCODE_FPS),
        "-an",
        str(dest),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0 or not dest.is_file() or dest.stat().st_size == 0:
            print(
                f"ffmpeg segment encode failed (rc={proc.returncode}) seg={seg.label}: "
                f"{stderr[-1024:] if stderr else b''!r}",
                flush=True,
            )
            return (False, 0.0)
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ffmpeg segment encode crashed seg={seg.label}: {exc!r}", flush=True)
        return (False, 0.0)
    actual = await _ffprobe_duration_seconds(dest) or 0.0
    return (True, actual)


async def _encode_still_segment(*, src: Path, dest: Path, src_time: float, out_dur: float) -> tuple[bool, float]:
    """Hold a single frame from ``src`` at ``src_time`` for ``out_dur`` seconds.

    Used when a segment's source slice is degenerate (zero-duration). The
    pipeline still needs *something* concat-able at this position so audio
    timing stays aligned; a still frame is the least-bad fallback.
    """
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-accurate_seek",
        "-ss", f"{max(0.0, src_time - 0.05):.4f}",
        "-i", str(src),
        "-vframes", "1",
        "-vf", f"scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-q:v", "2",
        str(dest.with_suffix(".still.png")),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            return (False, 0.0)
    except Exception:
        return (False, 0.0)
    still_png = dest.with_suffix(".still.png")
    cmd2 = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1",
        "-t", f"{max(0.04, out_dur):.4f}",
        "-i", str(still_png),
        "-vf", f"fps={VIDEO_TRANSCODE_FPS},format=yuv420p",
        "-c:v", "libx264",
        "-preset", VIDEO_TRANSCODE_PRESET,
        "-crf", str(VIDEO_TRANSCODE_CRF),
        "-pix_fmt", "yuv420p",
        "-vsync", "cfr",
        "-an",
        str(dest),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(*cmd2, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
        _, stderr = await proc.communicate()
        ok = proc.returncode == 0 and dest.is_file() and dest.stat().st_size > 0
    except Exception:
        ok = False
    try:
        still_png.unlink(missing_ok=True)
    except Exception:
        pass
    if not ok:
        return (False, 0.0)
    actual = await _ffprobe_duration_seconds(dest) or 0.0
    return (True, actual)


async def _transcode_dynamic(
    *,
    src: Path,
    dest: Path,
    job_id: str | None,
    steps: list[dict[str, Any]],
    voice_clips: list[_VoiceoverClip],
    duration_raw_sec: float,
) -> bool:
    """Per-scene dynamic-pacing transcode using **demuxer concat**.

    Pipeline:

    1. Build a scene plan from step offsets and voice clips
       (``_build_scene_plan``).
    2. For each segment, render it to its own intermediate MP4 with the
       correct ``setpts`` factor — separate ffmpeg invocation per segment so
       seek-accuracy issues on Playwright VFR captures can't corrupt the
       result. Re-probe the actual output duration to detect drift.
    3. Write a concat list (``file 'segment_X.mp4'`` per line).
    4. Final ffmpeg: read the concat list as a single video stream, mix in
       per-segment voice clips at their cumulative output offsets, burn ASS
       subtitles, mux to ``dest``.

    Why not single-pass ``filter_complex`` with split+trim+concat? Tested
    in the wild — on real Playwright captures the in-graph approach silently
    drops the front segments, leaving the user staring at the last scene
    only. Demuxer-concat is bulletproof at the cost of N extra short ffmpeg
    invocations.
    """
    norm_steps, _off_k = _normalize_steps_video_offsets_for_duration(
        steps, duration_raw_sec, job_id=job_id
    )
    plan = _build_scene_plan(
        steps=norm_steps,
        voice_clips=voice_clips,
        duration_raw_sec=duration_raw_sec,
    )
    if not plan:
        return False

    print(
        f"ux-journey: transcode src={src.name} -> {dest.name} "
        f"mode=dynamic segments={len(plan)} "
        f"raw={duration_raw_sec:.2f}s "
        f"voice_clips={len(voice_clips)} ",
        flush=True,
    )
    for i, seg in enumerate(plan):
        v_dur = seg.voice.duration_sec if seg.voice else 0.0
        print(
            f"  seg[{i:02d}] {seg.label:>10s} src=[{seg.src_start_sec:6.2f}..{seg.src_end_sec:6.2f}]"
            f" ({seg.src_dur_sec:5.2f}s) -> out={seg.target_out_sec:5.2f}s"
            f" scale={seg.scale:6.3f} voice={v_dur:5.2f}s",
            flush=True,
        )

    # ---------- per-segment intermediates ----------
    work_dir_base = job_id if job_id else f"adhoc-{int(time.time())}"
    work_dir = VIDEO_BASE_DIR / f".{work_dir_base}.dynamic"
    try:
        # Wipe any leftovers from a previous (possibly crashed) finalize so a
        # stale partial segment can't end up in the new concat list.
        if work_dir.exists():
            for stale in work_dir.iterdir():
                try:
                    stale.unlink()
                except OSError:
                    pass
        work_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"ux-journey: dynamic transcode could not prepare work_dir={work_dir}: {exc!r}", flush=True)
        return False

    seg_paths: list[Path] = []
    actual_durations: list[float] = []
    for i, seg in enumerate(plan):
        seg_path = work_dir / f"seg_{i:03d}.mp4"
        ok, actual = await _encode_dynamic_segment(
            src=src, dest=seg_path, seg=seg, raw_dur=duration_raw_sec
        )
        if not ok:
            _cleanup_work_dir(work_dir)
            return False
        seg_paths.append(seg_path)
        actual_durations.append(actual)
        print(
            f"  seg[{i:02d}] encoded -> {seg_path.name} actual={actual:.3f}s "
            f"(target={seg.target_out_sec:.3f}s, drift={actual - seg.target_out_sec:+.3f}s)",
            flush=True,
        )

    # Re-base the cumulative starts on the *actual* segment durations so audio
    # adelays match what the concat demuxer will produce, not what we asked
    # for. Drift is usually <50ms per segment but adds up across 10+ scenes.
    cumulative_actual: list[float] = []
    cursor = 0.0
    for d in actual_durations:
        cumulative_actual.append(cursor)
        cursor += d
    total_out_sec = cursor

    # ---------- subtitle file (re-timed against actual cumulative starts) ----------
    ass_path: Path | None = None
    if job_id and UX_JOURNEY_VIDEO_LOWER_THIRD:
        ass_tmp = VIDEO_BASE_DIR / f"{job_id}.reasoning.ass"
        # Build a synthetic plan with target_out replaced by actual_out so the
        # subtitle writer's cumulative-start math lines up with the demuxer's
        # output.
        adjusted_plan = [
            _SceneSegment(
                src_start_sec=p.src_start_sec,
                src_end_sec=p.src_end_sec,
                target_out_sec=actual_durations[i],
                step=p.step,
                voice=p.voice,
                label=p.label,
            )
            for i, p in enumerate(plan)
        ]
        if _write_reasoning_ass_file_dynamic(
            dest_ass=ass_tmp,
            segments=adjusted_plan,
            cumulative_starts=cumulative_actual,
        ):
            ass_path = ass_tmp

    # ---------- concat list ----------
    list_file = work_dir / "concat.txt"
    try:
        # ffmpeg concat-demuxer accepts POSIX-style absolute paths; quoting
        # rule: single-quote each path, escape internal single-quotes by
        # closing-and-reopening the quote.
        list_lines = []
        for p in seg_paths:
            posix = p.resolve().as_posix().replace("'", r"'\''")
            list_lines.append(f"file '{posix}'")
        list_file.write_text("\n".join(list_lines) + "\n", encoding="utf-8")
    except OSError as exc:
        print(f"ux-journey: failed to write concat list: {exc!r}", flush=True)
        _cleanup_work_dir(work_dir)
        return False

    # ---------- final pass: concat demuxer + audio mix + subtitles ----------
    cmd: list[str] = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        # Input #0: video stream from the concat demuxer.
        "-f", "concat",
        "-safe", "0",
        "-i", str(list_file),
    ]
    for seg in plan:
        if seg.voice is not None:
            cmd.extend(["-i", str(seg.voice.path)])

    parts: list[str] = []
    if ass_path is not None and ass_path.is_file():
        sub_posix = ass_path.resolve().as_posix()
        parts.append(f"[0:v]subtitles={sub_posix}[v]")
        v_out = "[v]"
    else:
        v_out = "0:v"

    a_labels: list[str] = []
    audio_input_idx = 1
    for i, seg in enumerate(plan):
        if seg.voice is None:
            continue
        # Base anchor: start of segment i in the OUTPUT timeline. We can shift
        # the voice further into its own scene (so it overlaps the visible
        # action instead of the pacing-delay still frame) via
        # ``UX_JOURNEY_VIDEO_VOICE_DELAY_SEC``. The shift is *clamped* to leave
        # at least 0.5 s of voice within this scene so a chatty step can't
        # push its narration past the next scene boundary entirely.
        scene_dur = actual_durations[i] if i < len(actual_durations) else seg.target_out_sec
        v_dur = max(0.0, float(seg.voice.duration_sec))
        max_in_scene_shift = max(0.0, scene_dur - max(0.5, v_dur))
        shift_sec = min(UX_JOURNEY_VIDEO_VOICE_DELAY_SEC, max_in_scene_shift)
        delay_ms = int(round((cumulative_actual[i] + shift_sec) * 1000.0))
        in_label = f"[{audio_input_idx}:a]"
        out_label = f"[a{audio_input_idx}]"
        parts.append(f"{in_label}adelay={delay_ms}|{delay_ms}{out_label}")
        a_labels.append(out_label)
        audio_input_idx += 1
    a_out: str | None = None
    if a_labels:
        if len(a_labels) == 1:
            parts.append(f"{a_labels[0]}anull[a]")
        else:
            parts.append(
                "".join(a_labels)
                + f"amix=inputs={len(a_labels)}:duration=longest:dropout_transition=0[a]"
            )
        a_out = "[a]"

    if parts:
        cmd.extend(["-filter_complex", ";".join(parts)])
    cmd.extend(["-map", v_out])
    if a_out is not None:
        cmd.extend(["-map", a_out])
    cmd.extend([
        "-c:v", "libx264",
        "-preset", VIDEO_TRANSCODE_PRESET,
        "-crf", str(VIDEO_TRANSCODE_CRF),
        "-g", str(int(VIDEO_TRANSCODE_FPS * 2)),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
    ])
    if a_out is not None:
        cmd.extend([
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-shortest",
        ])
    else:
        cmd.append("-an")
    cmd.append(str(dest))

    print(
        f"ux-journey: dynamic concat-demuxer pass -> {dest.name} "
        f"total_planned={total_out_sec:.2f}s segments={len(seg_paths)} "
        f"voice_inputs={audio_input_idx - 1} subtitles={'yes' if ass_path else 'no'}",
        flush=True,
    )

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        ok = proc.returncode == 0 and dest.is_file() and dest.stat().st_size > 0
        if ok and ass_path is not None:
            try:
                ass_path.unlink(missing_ok=True)
            except Exception:
                pass
        if not ok:
            print(
                f"ffmpeg dynamic-final transcode failed (rc={proc.returncode}) for {src}: "
                f"{stderr[-2048:] if stderr else b''!r}",
                flush=True,
            )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"ffmpeg dynamic-final transcode crashed for {src}: {exc!r}", flush=True)
        ok = False
    finally:
        _cleanup_work_dir(work_dir)
    return ok


def _cleanup_work_dir(work_dir: Path) -> None:
    """Best-effort wipe of the per-job dynamic-transcode scratch directory."""
    if not work_dir.exists():
        return
    try:
        for p in work_dir.iterdir():
            try:
                p.unlink()
            except OSError:
                pass
        work_dir.rmdir()
    except OSError:
        pass


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


def _scan_recording_total_bytes(video_dir: str) -> tuple[int, int]:
    """Return ``(total_size_bytes, file_count)`` for all `*.mp4` / `*.webm` under ``video_dir``.

    Used by ``_wait_for_recording_stable`` to decide when Playwright finished
    flushing a recording. Even if browser-use writes to a temp file then renames,
    the total byte sum across the dir stops growing once the writer is done.
    """
    base = Path(video_dir)
    if not base.is_dir():
        return (0, 0)
    total = 0
    n = 0
    try:
        for p in base.rglob("*"):
            if not p.is_file():
                continue
            ext = p.suffix.lower()
            if ext not in (".mp4", ".webm"):
                continue
            try:
                total += p.stat().st_size
                n += 1
            except OSError:
                continue
    except Exception:
        return (total, n)
    return (total, n)


async def _wait_for_recording_stable(
    video_dir: str,
    *,
    timeout_sec: float = 20.0,
    poll_interval_sec: float = 0.4,
    quiet_window_sec: float = 1.5,
    min_size_bytes: int = 32 * 1024,
) -> tuple[bool, int]:
    """Poll until the recording dir's byte sum stops growing.

    Playwright's ``[video_recorder]`` finalises the MP4/WebM *after*
    ``Browser.close()`` returns — moving the file too early produces the
    notorious 1-second clip. We watch the dir for `quiet_window_sec` of no-byte-
    delta, gated by `timeout_sec` so a hard hang in Playwright doesn't block
    the run forever.

    Returns ``(stable, last_size_bytes)``. ``stable=False`` means we hit the
    timeout while bytes were still growing — caller can still try the move
    (some file is better than none) but should log a warning.
    """
    deadline = time.monotonic() + timeout_sec
    last_size = -1
    last_change = time.monotonic()
    while True:
        size, _ = _scan_recording_total_bytes(video_dir)
        now = time.monotonic()
        if size != last_size:
            last_size = size
            last_change = now
        elif size >= min_size_bytes and (now - last_change) >= quiet_window_sec:
            return (True, size)
        if now >= deadline:
            return (False, last_size)
        await asyncio.sleep(poll_interval_sec)

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
    now_iso = datetime.now(timezone.utc).isoformat()
    now_mono = time.monotonic()
    async with _jobs_lock:
        _jobs[job_id] = JobState(
            job_id=job_id,
            status="running",
            url=url,
            task=task,
            persona=body.persona,
            # Seed the heartbeat with creation time so chat-api's stagnation
            # watchdog has a non-null reference point even before the first
            # screenshot / history-watcher tick lands (~1s after start).
            last_observed_at=now_iso,
            last_observed_mono=now_mono,
        )

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
async def cancel_run(job_id: str, reason: str | None = None) -> dict[str, Any]:
    """
    Force-cancel a running journey: signals the agent task, waits briefly for
    its `finally` blocks to close the browser (which finalizes the WebM
    recording on disk) and to publish a partial result, then returns the
    current job state.

    Idempotent: calling this on a job that's already terminal (or unknown)
    just reports the current status without doing anything destructive.

    The optional ``reason`` query parameter is preserved on the job's error
    field (replaces the generic "Run was cancelled before completion." message)
    so the chat UI can show *why* the cancel happened: stagnation watchdog,
    hard timeout, manual user cancel from the journey card, etc. Caller is
    responsible for keeping the message short and human-readable — it lands
    verbatim in the chat bubble.
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
    if reason:
        # Stash the caller's explanation now; ``run_agent`` will preserve it
        # over the default cancellation message when it builds the result.
        job.error = reason.strip()[:500]
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
    # Heartbeat: any caller polling this endpoint can use ``lastObservedAt``
    # as a liveness signal that ticks faster than ``status`` transitions.
    # Specifically chat-api's stagnation watchdog reads it to avoid cancelling
    # a run that is mid-LLM-call within a single multi-action step (the
    # step-count granular signal would falsely look stalled for 60-120s).
    if job.last_observed_at is not None:
        out["lastObservedAt"] = job.last_observed_at
    return out


@app.get("/run/{job_id}/step/{step_no}/screenshot")
async def get_step_screenshot(job_id: str, step_no: int) -> FileResponse:
    """Image captured after each agent step (see _publish_partial_steps).

    Phase 5: content-type is sniffed from the file's first bytes so the same
    endpoint serves either the legacy `.jpg` from the CDP polling loop or the
    `.png` from the Phase 4 fork hook. Browsers were tolerant of the old
    hard-coded `image/jpeg` mismatch but devtools / curl / any caching proxy
    were not.
    """
    path = _step_screenshot_path(job_id, step_no)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    head = b""
    try:
        with path.open("rb") as fh:
            head = fh.read(16)
    except OSError:
        pass
    return FileResponse(
        str(path),
        media_type=_sniff_image_content_type(head),
        headers={"Cache-Control": "no-store"},
    )


async def _resolve_recording_path_for_finalize(job_id: str) -> str | None:
    """Return the on-disk *raw* recording path to feed into ffmpeg, or None.

    We deliberately do NOT pick `{jobId}.mp4` here — that's the polished output
    of a previous finalize. Re-feeding it into the transcode loses quality and
    re-applies the slow-motion factor a second time. We only walk the
    `{jobId}.raw.*` siblings (or — for legacy jobs from the pre-`raw` naming
    scheme — accept ``job.video_path`` directly).
    """
    # Legacy: jobs created before the `.raw.*` rename keep video_path pointing
    # to `{jobId}.mp4` / `.webm`. Honor that so historic re-finalize keeps working.
    async with _jobs_lock:
        job = _jobs.get(job_id)
        vp = job.video_path if job else None
    if vp:
        p = Path(vp)
        # Accept anything that ISN'T the canonical polished path.
        if p.is_file() and p.name != f"{job_id}.mp4":
            return vp
    # Preferred sources, newest convention first.
    for ext in ("mp4", "webm"):
        candidate = VIDEO_BASE_DIR / f"{job_id}.raw.{ext}"
        try:
            if candidate.is_file() and candidate.stat().st_size > 1024:
                return str(candidate)
        except OSError:
            continue
    # Legacy fallback (jobs that ran before the rename and never finalized).
    for ext in ("webm",):
        candidate = VIDEO_BASE_DIR / f"{job_id}.{ext}"
        try:
            if candidate.is_file() and candidate.stat().st_size > 1024:
                return str(candidate)
        except OSError:
            continue
    return None


@app.post("/run/{job_id}/video/finalize")
async def post_finalize_run_video(
    job_id: str,
    force: bool = False,
) -> dict[str, Any]:
    """
    On-demand ffmpeg polish: smooth MP4 + slow-motion + lower-third + voice-over.

    File layout (post-run):
      * ``{jobId}.raw.mp4`` / ``{jobId}.raw.webm`` — original Playwright capture.
      * ``{jobId}.mp4``                            — polished output of this endpoint.

    Idempotent by default: if ``{job_id}.mp4`` already exists in
    ``VIDEO_BASE_DIR``, returns ``already_finalized`` immediately so a chat-UI
    button click doesn't burn CPU on every poll. The polished file always lives
    at the ``.mp4`` path *without* the ``.raw.`` segment — that's how we tell
    "Playwright wrote this" apart from "we transcoded this with current
    SLOWMO / SLOWDOWN_FACTOR / VOICEOVER settings".

    Pass ``?force=1`` to delete the existing polished file and re-run the
    transcode against the raw sidecar. This is the operator escape hatch for
    "I changed pacing / voice / subtitles and want the old polished MP4
    regenerated with the new settings" — without forcing a fresh agent run.
    Refuses (HTTP 409) on legacy jobs that have no raw sidecar.

    When transcoding is disabled or ffmpeg is missing, returns ``skipped`` —
    the client should still play the raw recording via GET /run/{jobId}/video.
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
            if force:
                # Refuse to delete the polished MP4 unless we still have a raw
                # sidecar to retry from. Otherwise the request would silently
                # nuke the only recording the user has — happens on legacy jobs
                # from before the `.raw.*` rename.
                has_raw = any(
                    (VIDEO_BASE_DIR / f"{job_id}.raw.{ext}").is_file()
                    for ext in ("mp4", "webm")
                )
                if not has_raw:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Cannot force re-finalize: no raw recording sidecar "
                            "(`{jobId}.raw.{ext}`) found. This is a legacy job from "
                            "before the raw/polished split — re-run the journey "
                            "to produce a new raw recording."
                        ),
                    )
                # Operator wants new pacing settings applied: drop the old MP4
                # and fall through to the regular transcode path. We also clear
                # ``video_path`` so the resolver re-discovers the raw recording.
                try:
                    final_mp4.unlink()
                except Exception as exc:  # pragma: no cover - best effort
                    print(
                        f"ux-journey: force-finalize: could not delete {final_mp4}: {exc!r}",
                        flush=True,
                    )
                async with _jobs_lock:
                    if job_id in _jobs and _jobs[job_id].video_path == str(final_mp4):
                        _jobs[job_id].video_path = None
                print(
                    f"ux-journey: force-finalize job={job_id} — re-transcoding with current settings "
                    f"(effective_slowdown={_effective_transcode_slowdown():.4f})",
                    flush=True,
                )
            else:
                async with _jobs_lock:
                    if job_id in _jobs:
                        _jobs[job_id].video_path = str(final_mp4)
                print(
                    f"ux-journey: finalize job={job_id} already_finalized "
                    f"(file exists, size={final_mp4.stat().st_size}). "
                    f"Pass ?force=1 to re-transcode with current settings.",
                    flush=True,
                )
                return {
                    "status": "already_finalized",
                    "videoUrl": f"/run/{job_id}/video",
                    "mediaType": "video/mp4",
                }

        src = await _resolve_recording_path_for_finalize(job_id)
        if not src:
            raise HTTPException(status_code=404, detail="No recording found for this job")

        if VIDEO_TRANSCODE_DISABLED or shutil.which("ffmpeg") is None:
            print(
                f"ux-journey: finalize job={job_id} skipped — "
                f"VIDEO_TRANSCODE_DISABLED={VIDEO_TRANSCODE_DISABLED} "
                f"ffmpeg_present={shutil.which('ffmpeg') is not None}",
                flush=True,
            )
            return {
                "status": "skipped",
                "reason": "transcode_unavailable",
                "videoUrl": f"/run/{job_id}/video",
                "message": "ffmpeg unavailable or transcoding disabled — use raw recording.",
            }

        print(
            f"ux-journey: finalize job={job_id} starting transcode src={src} "
            f"effective_slowdown={_effective_transcode_slowdown():.4f}",
            flush=True,
        )
        ok = await _finalize_video(job_id=job_id, source_path=src)
        async with _jobs_lock:
            out_path = _jobs[job_id].video_path if job_id in _jobs else None
        suffix = Path(out_path).suffix.lower() if out_path else ""
        media = "video/mp4" if suffix == ".mp4" else "video/webm"
        print(
            f"ux-journey: finalize job={job_id} {'completed' if ok else 'failed'} "
            f"out={out_path} media={media}",
            flush=True,
        )
        return {
            "status": "completed" if ok else "failed",
            "videoUrl": f"/run/{job_id}/video",
            "mediaType": media,
        }


@app.get("/run/{job_id}/video")
async def get_run_video(job_id: str) -> FileResponse:
    """Return the journey video (polished MP4 if available, else raw recording).

    Serving order:
      1. ``job.video_path`` from the in-memory state (set by run_agent / finalize).
      2. ``{jobId}.mp4`` — the polished output (slow-mo + lower-third + voice-over).
      3. ``{jobId}.raw.mp4`` / ``{jobId}.raw.webm`` — the raw Playwright capture.
         Useful while finalize is still pending or has been disabled.
      4. ``{jobId}.mp4`` / ``{jobId}.webm`` — pre-rename legacy jobs.
    """
    video_path: str | None = None
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job and job.video_path and os.path.isfile(job.video_path):
            video_path = job.video_path
    if not video_path:
        for ext in ("mp4", "webm"):
            polished = VIDEO_BASE_DIR / f"{job_id}.{ext}"
            if polished.is_file():
                video_path = str(polished)
                break
    if not video_path:
        for ext in ("mp4", "webm"):
            raw_candidate = VIDEO_BASE_DIR / f"{job_id}.raw.{ext}"
            if raw_candidate.is_file():
                video_path = str(raw_candidate)
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
    last_observed_at: str | None = None
    last_observed_age_sec: float | None = None
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job is not None:
            job_known = True
            job_status = job.status
            last_observed_at = job.last_observed_at
            if job.last_observed_mono is not None:
                last_observed_age_sec = max(0.0, time.monotonic() - job.last_observed_mono)

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
            collected: list[str] = []
            for ext in _STEP_SCREENSHOT_EXTENSIONS:
                collected.extend(p.name for p in step_dir.glob(f"*.{ext}"))
            step_files = sorted(collected)
        except Exception:
            step_files = []

    diag: dict[str, Any] = {
        "jobKnown": job_known,
        "jobStatus": job_status,
        "hasLiveAgent": has_live_agent,
        "hasCachedFrame": cached_frame is not None,
        "cachedFrameAgeSeconds": cached_age_seconds,
        # Heartbeat — chat-api's stagnation watchdog reads ``lastObservedAt``
        # via /run/{jobId}; this diag endpoint includes the derived "how
        # long ago" so an operator can eyeball whether the agent is wedged.
        "lastObservedAt": last_observed_at,
        "lastObservedAgeSeconds": last_observed_age_sec,
        "stepScreenshotsOnDisk": step_files,
        "stepScreenshotsDir": str(step_dir),
        "envSlowmo": UX_JOURNEY_SLOWMO,
        "videoSlowdownFactor": VIDEO_SLOWDOWN_FACTOR,
        "videoCompoundSlowmo": UX_JOURNEY_VIDEO_COMPOUND_SLOWMO,
        "effectiveVideoSlowdown": _effective_transcode_slowdown(),
        "videoDynamicPacing": UX_JOURNEY_VIDEO_DYNAMIC_PACING,
        "videoSceneMinSec": UX_JOURNEY_VIDEO_SCENE_MIN_SEC,
        "videoSceneMaxSec": UX_JOURNEY_VIDEO_SCENE_MAX_SEC,
        "videoSceneVoicePadSec": UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC,
        "videoSceneMinScale": UX_JOURNEY_VIDEO_SCENE_MIN_SCALE,
        "videoLowerThird": UX_JOURNEY_VIDEO_LOWER_THIRD,
        "videoVoiceover": (
            UX_JOURNEY_VIDEO_VOICEOVER and bool(os.environ.get("OPENAI_API_KEY"))
        ),
        "videoVoiceoverModel": UX_JOURNEY_VOICEOVER_MODEL,
        "videoVoiceoverVoice": UX_JOURNEY_VOICEOVER_VOICE,
        "videoVoiceoverLang": UX_JOURNEY_VOICEOVER_LANG,
        "videoVoiceoverMaxTempo": UX_JOURNEY_VOICEOVER_MAX_TEMPO,
        "videoVoiceoverClips": _voiceover_clip_counts.get(job_id),
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
    """Return the latest live viewport frame while the job is running.

    Phase 5: media-type is sniffed from the first bytes (PNG vs JPEG).
    Source frames come from either the CDP polling loop (always JPEG) or
    the Phase 4 fork hook (always PNG when ``UX_JOURNEY_LIVE_STEP_FRAMES=1``).
    """
    frame = _live_frames.get(job_id)
    frame_bytes: bytes | None = frame[1] if frame else None

    if not frame_bytes:
        agent = _live_agents.get(job_id)
        if agent:
            captured = await _capture_live_frame(agent)
            if captured:
                frame_bytes = captured
                _live_frames[job_id] = (time.monotonic(), captured)

    if not frame_bytes:
        frame_bytes = _latest_step_screenshot_bytes(job_id)

    if not frame_bytes:
        raise HTTPException(status_code=404, detail="No live frame")
    return Response(
        content=frame_bytes,
        media_type=_sniff_image_content_type(frame_bytes),
        headers={"Cache-Control": "no-store"},
    )


async def _mjpeg_stream_generator(job_id: str):
    """Yield multipart/x-mixed-replace parts while the job is running.

    Phase 5: each part carries an inline-sniffed Content-Type, so a stream
    that mixes legacy CDP JPEGs and fork-hook PNGs stays RFC-correct. The
    boundary name is kept as ``frame`` for backwards-compat with any client
    that hard-coded it; only the per-part content-type changes.
    """
    while job_id in _live_agents:
        frame = _live_frames.get(job_id)
        if frame:
            _, frame_bytes = frame
            content_type = _sniff_image_content_type(frame_bytes).encode("ascii")
            part = (
                b"--"
                + MJPEG_BOUNDARY
                + b"\r\nContent-Type: "
                + content_type
                + b"\r\nContent-Length: "
                + str(len(frame_bytes)).encode()
                + b"\r\n\r\n"
                + frame_bytes
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
