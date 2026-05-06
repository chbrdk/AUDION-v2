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

# Delay at the *start* of each step so the viewer sees the current state before the action runs ("action lead-in")
STEP_START_DELAY_SECONDS = float(os.environ.get("UX_JOURNEY_STEP_START_DELAY_SECONDS", "2.5"))
# Delay at the *end* of each step (after action + red circle) before the next step
STEP_DELAY_SECONDS = float(os.environ.get("UX_JOURNEY_STEP_DELAY_SECONDS", "2.0"))
# How long the red click circle stays visible (seconds); increase to slow down and make actions more visible
CLICK_CIRCLE_VISIBLE_SECONDS = float(os.environ.get("UX_JOURNEY_CLICK_CIRCLE_VISIBLE_SECONDS", "2.5"))
# After a scroll action: run a slow step-based scroll so the live stream captures it (duration per direction in seconds)
SCROLL_VISIBLE_SECONDS = float(os.environ.get("UX_JOURNEY_SCROLL_VISIBLE_SECONDS", "5.0"))
# Live viewport screenshot interval (seconds); lower = higher fps (0.04 = 25 fps)
LIVE_FRAME_INTERVAL = float(os.environ.get("UX_JOURNEY_LIVE_FRAME_INTERVAL", "0.04"))

# ---------------------------------------------------------------------------
# Job store (in-memory; replace with Redis/DB for multi-instance)
# ---------------------------------------------------------------------------

@dataclass
class JobState:
    job_id: str
    status: str  # "running" | "complete" | "error"
    url: str
    task: str
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

class RunResponse(BaseModel):
    jobId: str

# ---------------------------------------------------------------------------
# Browser-use agent runner (async, one job at a time per process)
# ---------------------------------------------------------------------------

def _make_llm():
    """Create LLM from env: Anthropic (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY)."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            from browser_use import ChatAnthropic
        except ImportError:
            from browser_use.llm.anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.environ.get("UX_JOURNEY_CLAUDE_MODEL", "claude-sonnet-4-20250514"),
            temperature=0,
        )
    if os.environ.get("OPENAI_API_KEY"):
        try:
            from browser_use import ChatOpenAI
        except ImportError:
            from browser_use.llm.openai import ChatOpenAI
        return ChatOpenAI(model=os.environ.get("UX_JOURNEY_OPENAI_MODEL", "gpt-4o"), temperature=0)
    raise RuntimeError("Set ANTHROPIC_API_KEY or OPENAI_API_KEY for the agent LLM.")


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


def _get_model_thoughts(history: Any) -> list[str]:
    """Extract reasoning/thoughts per step from browser-use history (model_thoughts or model_outputs). No length limit."""
    out: list[str] = []
    try:
        if hasattr(history, "model_thoughts") and callable(history.model_thoughts):
            raw = list(history.model_thoughts())
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, str):
                        out.append(item)
                    elif item is not None:
                        out.append(str(item))
        if not out and hasattr(history, "model_outputs") and callable(history.model_outputs):
            raw = list(history.model_outputs())
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, str):
                        out.append(item)
                    elif isinstance(item, dict) and item.get("thought"):
                        out.append(str(item["thought"]))
                    elif item is not None:
                        out.append(str(item))
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
            if i < len(thoughts) and thoughts[i].strip():
                step_entry["reasoning"] = thoughts[i].strip()
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


async def _capture_live_frame(agent: Any) -> bytes | None:
    """Capture current viewport as JPEG via CDP or Playwright page. Returns None on failure."""
    # Fallback: try Playwright page.screenshot if browser_session exposes a page
    page = getattr(agent.browser_session, "page", None) or getattr(
        agent.browser_session, "current_page", None
    )
    if page is not None and hasattr(page, "screenshot"):
        try:
            result = await page.screenshot(type="jpeg", quality=80)
            if isinstance(result, bytes):
                return result
        except Exception:
            pass

    # Primary: CDP Page.captureScreenshot
    try:
        cdp = await agent.browser_session.get_or_create_cdp_session()
        if not cdp:
            return None
        send = None
        if hasattr(cdp, "cdp_client"):
            send = getattr(cdp.cdp_client, "send", None)
        elif hasattr(cdp, "send"):
            send = cdp.send
        if not send:
            return None
        Page = getattr(send, "Page", None)
        if not Page:
            return None
        capture = getattr(Page, "capture_screenshot", None) or getattr(Page, "captureScreenshot", None)
        if not capture:
            return None
        kwargs: dict[str, Any] = {"format": "jpeg", "quality": 80}
        if hasattr(cdp, "session_id") and cdp.session_id is not None:
            kwargs["session_id"] = cdp.session_id
        result = await capture(**kwargs)
        if isinstance(result, dict) and result.get("data"):
            return base64.b64decode(result["data"])
        return None
    except Exception:
        return None


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
        await asyncio.sleep(LIVE_FRAME_INTERVAL)


async def run_agent(job_id: str, url: str, task: str) -> None:
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

    try:
        llm = _make_llm()
        try:
            browser = Browser(record_video_dir=video_dir)
        except TypeError:
            browser = Browser()
        # Prefer initial_url if supported; else bake URL into task. Instruct model to output reasoning in German.
        import inspect
        sig = inspect.signature(Agent.__init__)
        german_instruction = "WICHTIG: Formuliere alle deine Überlegungen und Gedanken (thinking/reasoning) ausschließlich auf Deutsch. "
        task_with_lang = german_instruction + task
        agent_kw: dict[str, Any] = {"task": task_with_lang, "llm": llm, "browser": browser}
        if "initial_url" in sig.parameters:
            agent_kw["initial_url"] = url
        else:
            agent_kw["task"] = f"Go to {url}. Then: {task_with_lang}"
        agent = Agent(**agent_kw)
        max_steps = int(os.environ.get("UX_JOURNEY_MAX_STEPS", "25"))
        if hasattr(agent, "max_steps"):
            agent.max_steps = max_steps

        async def _on_step_start(agent_instance: Any) -> None:
            # Pause at the beginning of each step so the video shows the current state before the action runs
            await asyncio.sleep(max(0, STEP_START_DELAY_SECONDS))

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
                            ms = int(CLICK_CIRCLE_VISIBLE_SECONDS * 1000)
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
                            await asyncio.sleep(CLICK_CIRCLE_VISIBLE_SECONDS)
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
                        duration_sec = max(1.0, SCROLL_VISIBLE_SECONDS)
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
            await asyncio.sleep(max(0.5, STEP_DELAY_SECONDS - CLICK_CIRCLE_VISIBLE_SECONDS))

        _live_agents[job_id] = agent
        screenshot_task = asyncio.create_task(_live_screenshot_loop(job_id))
        try:
            try:
                history = await agent.run(on_step_start=_on_step_start, on_step_end=_on_step_end)
            except TypeError:
                history = await agent.run()
        finally:
            screenshot_task.cancel()
            try:
                await screenshot_task
            except asyncio.CancelledError:
                pass
            _live_agents.pop(job_id, None)
            _live_frames.pop(job_id, None)

        # Map browser-use history to CHECKION result format
        steps = _history_to_steps(history)
        success = _history_success(history)
        screenshots = _history_screenshots(history)

        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc or url
        except Exception:
            domain = url

        # Move recorded video to a known path (browser-use[video] writes MP4, Playwright can write WebM)
        video_path: str | None = None
        if os.path.isdir(video_dir):
            for ext in ("*.mp4", "*.webm"):
                found = glob.glob(os.path.join(video_dir, ext))
                if found:
                    suffix = ext.replace("*", "")
                    dest = VIDEO_BASE_DIR / f"{job_id}{suffix}"
                    try:
                        shutil.move(found[0], str(dest))
                        video_path = str(dest)
                        break
                    except Exception:
                        pass
            try:
                shutil.rmtree(video_dir, ignore_errors=True)
            except Exception:
                pass

        result = {
            "jobId": job_id,
            "taskDescription": task,
            "siteDomain": domain,
            "steps": steps,
            "success": success,
            "screenshots": screenshots[:50],
        }
        if video_path:
            result["videoUrl"] = f"/run/{job_id}/video"

        async with _jobs_lock:
            if job_id in _jobs:
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
                await browser.close()
            except Exception:
                pass

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
        _jobs[job_id] = JobState(job_id=job_id, status="running", url=url, task=task)

    asyncio.create_task(run_agent(job_id, url, task))
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


@app.get("/run/{job_id}/live")
async def get_run_live(job_id: str) -> Response:
    """Return the latest live viewport frame (JPEG) while the job is running."""
    frame = _live_frames.get(job_id)
    if not frame:
        raise HTTPException(status_code=404, detail="No live frame")
    _, jpeg_bytes = frame
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
        await asyncio.sleep(LIVE_FRAME_INTERVAL)


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
