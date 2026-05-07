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
import json
import os
import shutil
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

class RunResponse(BaseModel):
    jobId: str

# ---------------------------------------------------------------------------
# Browser-use agent runner (async, one job at a time per process)
# ---------------------------------------------------------------------------

def _make_llm():
    """Create LLM from env: Anthropic (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY)."""
    provider = (os.environ.get("UX_JOURNEY_LLM_PROVIDER") or "auto").strip().lower()
    if provider in ("claude", "anthropic") and not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("UX_JOURNEY_LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.")
    if provider in ("openai",) and not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("UX_JOURNEY_LLM_PROVIDER=openai but OPENAI_API_KEY is not set.")

    if provider in ("claude", "anthropic") or (provider == "auto" and os.environ.get("ANTHROPIC_API_KEY")):
        try:
            from browser_use import ChatAnthropic
        except ImportError:
            from browser_use.llm.anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-20250514"),
            temperature=0,
        )
    if provider in ("openai",) or (provider == "auto" and os.environ.get("OPENAI_API_KEY")):
        try:
            from browser_use import ChatOpenAI
        except ImportError:
            from browser_use.llm.openai import ChatOpenAI
        return ChatOpenAI(model=os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o"), temperature=0)
    raise RuntimeError("Set ANTHROPIC_API_KEY or OPENAI_API_KEY for the agent LLM.")


def _llm_meta() -> dict[str, str]:
    """Expose provider/model for debugging (does not include secrets)."""
    provider = (os.environ.get("UX_JOURNEY_LLM_PROVIDER") or "auto").strip().lower()
    if provider in ("claude", "anthropic") or (provider == "auto" and os.environ.get("ANTHROPIC_API_KEY")):
        return {
            "provider": "anthropic",
            "model": os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-20250514"),
        }
    if provider in ("openai",) or (provider == "auto" and os.environ.get("OPENAI_API_KEY")):
        return {
            "provider": "openai",
            "model": os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o"),
        }
    return {"provider": "unknown", "model": "unknown"}


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
                return m.group("v").strip()
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
                return (m.group("v") if m and m.group("v") is not None else "").strip()

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
    if not isinstance(raw, dict):
        # May be an object with __dict__ or attributes
        res = getattr(raw, "result", None) or ""
        result = str(res)[:500]
        return (getattr(raw, "name", str(raw))[:50] if hasattr(raw, "name") else str(raw)[:50], "", result)
    # Keys like 'navigate', 'click', 'done' with payload; plus 'result' or 'interacted_element'
    res = raw.get("result") or ""
    elem = raw.get("interacted_element")
    if "navigate" in raw:
        pl = raw["navigate"] or {}
        url = pl.get("url", "")
        action_label = "navigate"
        target = url
        result = (res or "")[:500]
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
        result = (res or "")[:500]
    elif "done" in raw:
        pl = raw["done"] or {}
        action_label = "done"
        target = "—"
        result = (pl.get("text") or res or "")[:1000]
    else:
        key = next((k for k in raw if k not in ("result", "interacted_element")), "step")
        action_label = str(key)
        target = str(raw.get(key, ""))[:200] if isinstance(raw.get(key), dict) else ""
        result = (res or "")[:500]
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
                    step_entry["reasoning"] = thinking
                structured = thoughts[i].get("structured")
                if isinstance(structured, dict) and any(str(v or "").strip() for v in structured.values()):
                    # Keep only known keys and bound length a bit.
                    step_entry["reasoningMeta"] = {
                        "evaluation_previous_goal": str(structured.get("evaluation_previous_goal") or "")[:4000] or None,
                        "memory": str(structured.get("memory") or "")[:4000] or None,
                        "next_goal": str(structured.get("next_goal") or "")[:4000] or None,
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


async def run_agent(job_id: str, url: str, task: str, persona: dict[str, Any] | None = None) -> None:
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
        try:
            browser = Browser(record_video_dir=video_dir)
        except TypeError:
            browser = Browser()
        # Prefer initial_url if supported; else bake URL into task. Instruct model to output reasoning in German.
        import inspect
        sig = inspect.signature(Agent.__init__)
        # Prompt-shaping to reduce premature "done" decisions.
        # Note: max_steps only sets an upper bound; the agent can still stop early if it thinks it's done.
        min_steps = int(os.environ.get("UX_JOURNEY_MIN_STEPS", "6"))
        german_instruction = (
            "WICHTIG: Formuliere alle deine Überlegungen und Gedanken (thinking/reasoning) ausschließlich auf Deutsch. "
            "WICHTIG: Beende die Journey NICHT zu früh. Markiere erst dann als 'done'/'fertig', wenn du das Ziel wirklich erreicht hast "
            "UND es anhand sichtbarer UI-Indikatoren verifiziert hast (z.B. Bestätigungsseite, eindeutiger State, URL, Erfolgsmeldung). "
            f"WICHTIG: Beende NICHT vor mindestens {min_steps} Schritten. Wenn das Ziel früher erreicht wirkt, nutze die restlichen Schritte für "
            "Validierung (zurück/nach vorne, alternative Navigation, erneute Sichtprüfung), statt zu stoppen. "
        )
        persona_instr = _persona_instruction(persona)
        task_with_lang = german_instruction + persona_instr + task
        max_steps = int(os.environ.get("UX_JOURNEY_MAX_STEPS", "25"))
        agent_kw: dict[str, Any] = {"task": task_with_lang, "llm": llm, "browser": browser}
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
        if hasattr(agent, "max_steps"):
            agent.max_steps = max_steps
        elif hasattr(agent, "max_actions"):
            agent.max_actions = max_steps

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
        try:
            try:
                history = await agent.run(on_step_start=_on_step_start, on_step_end=_on_step_end)
            except TypeError:
                history = await agent.run()
        finally:
            for bg in (screenshot_task, history_watcher_task):
                bg.cancel()
                try:
                    await bg
                except asyncio.CancelledError:
                    pass
            _live_agents.pop(job_id, None)
            _live_frames.pop(job_id, None)

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

        # Transcode to smooth MP4 so the player can seek and avoid VFR-induced judder.
        if video_path:
            try:
                src = Path(video_path)
                smooth = VIDEO_BASE_DIR / f"{job_id}.smooth.mp4"
                if await _transcode_to_smooth_mp4(src, smooth):
                    final_dest = VIDEO_BASE_DIR / f"{job_id}.mp4"
                    try:
                        if final_dest.exists() and final_dest.resolve() != src.resolve():
                            final_dest.unlink()
                    except Exception:
                        pass
                    try:
                        smooth.replace(final_dest)
                        if src != final_dest and src.is_file():
                            src.unlink(missing_ok=True)
                        video_path = str(final_dest)
                    except Exception:
                        # Keep transcoded file at its temporary name if rename fails.
                        video_path = str(smooth)
            except Exception:
                # Transcoding is best-effort; fall back to original recording.
                pass

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
                if video_path:
                    _jobs[job_id].video_path = video_path
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
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-i", str(src),
        "-vf", f"fps={VIDEO_TRANSCODE_FPS},format=yuv420p",
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

    asyncio.create_task(run_agent(job_id, url, task, body.persona))
    return RunResponse(jobId=job_id)

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
