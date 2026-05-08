# UX Journey Agent (CHECKION Monorepo)

Browser agent service for CHECKION: runs autonomous navigation tasks (URL + natural language goal) using **`checkion-agent`** — a CHECKION-internal soft fork of [browser-use](https://github.com/browser-use/browser-use) (Playwright + LLM), vendored at [`./checkion-agent/`](./checkion-agent/). See [`./checkion-agent/ATTRIBUTION.md`](./checkion-agent/ATTRIBUTION.md) for the rationale and upstream tracking strategy.

## API

- **POST /run** – Body: `{ "url": "https://example.com", "task": "Find product X and add to cart" }` → `{ "jobId": "uuid" }`
- **GET /run/{jobId}** – Returns `{ "status": "running"|"complete"|"error", "result?: { steps, success, ... }" }`
- **GET /run/{jobId}/video** – Recorded journey video (when available). Serves the raw Playwright WebM (or MP4) immediately after the run.
- **POST /run/{jobId}/video/finalize** – On-demand ffmpeg polish (smooth H.264 MP4 + configured slow-motion). Idempotent; returns JSON `{ "status": "completed"|"skipped"|"already_finalized"|"failed", ... }`. When **`UX_JOURNEY_DEFER_VIDEO_FINALIZE`** is enabled (default), this is the step that performs heavy transcoding instead of doing it automatically at the end of the run.
- **GET /run/{jobId}/live** – Latest viewport frame (JPEG) while the job is running; 404 when no frame.
- **GET /health** – `{ "status": "ok" }`

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | one of these | Claude (recommended) |
| `OPENAI_API_KEY` | one of these | OpenAI fallback |
| `UX_JOURNEY_LLM_REPAIR_JSON` | no | **Default `0` (OFF).** Optional safety net that wraps primary + fallback chat models in a thin post-processor that fixes the two recurring AgentOutput bugs: (a) extracts the first balanced JSON object if the model appended junk after the closing `}` (``trailing characters`` / ``json_invalid``); (b) coerces ``action`` from a JSON-encoded *string* (or a single ``dict``) into the proper ``list[dict]`` Pydantic expects (fixes ``list_type``); (c) normalizes ``tool_calls[].args`` when LangChain delivers them as JSON strings. **Both bugs are fixed upstream in `browser-use==0.12.6`** (PR #4529 et al.) so the wrapper is OFF by default. Set **`1`** to re-enable as a temporary band-aid if you observe the same failure modes from a *new* model variant before upstream catches it. At service start the log prints either ``ux-journey: LLM JSON repair DISABLED ...`` or ``ux-journey: LLM JSON repair ACTIVE — wrapping ChatAnthropic as ChatAnthropicWithJSONRepair``; when active, per-run logs print ``ux-journey: repair_json: coerced action(str) -> list (items=N)`` each time the wrapper actually fixes an output. |
| `UX_JOURNEY_MAX_STEPS` | no | Default max agent steps (default **`50`**) when no per-request override is provided. |
| `UX_JOURNEY_MAX_STEPS_CAP` | no | Hard upper bound for the per-request `max_steps` override (default **`150`**). Per-request values are clamped to `3..cap`; raise this if your journeys legitimately need more steps. |
| `UX_JOURNEY_SLOWMO` | no | Multiplies pacing delays for **real** slow-mo in the recording (default **`2`** in code — no env needed). This is the right knob if the final video looks too fast: higher values record more *real* frames per page-load / scroll / click. Set `1` for faster runs; alias `UX_JOURNEY_SLOWMO_MULTIPLIER` (clamped **0.25–32**). |
| `UX_JOURNEY_CLAUDE_MODEL` | no | Claude model (default `claude-sonnet-4-6` — Anthropic's "best speed/intelligence balance" Sonnet, ~25% faster TTFT than `claude-sonnet-4-20250514` while still solid on browser-use's strict structured-output schema). **Avoid:** Haiku 4.5 (`claude-haiku-4-5-20251001`) — 2–3× faster per step but frequently emits AgentOutput missing the required `action` field. With **`UX_JOURNEY_LLM_FALLBACK=1`** + an `OPENAI_API_KEY` configured, browser-use will retry on the OpenAI fallback when Claude produces invalid AgentOutput; without a fallback the run halts after 6 consecutive validation failures. |
| `UX_JOURNEY_OPENAI_MODEL` | no | OpenAI model used as primary (when `OPENAI_API_KEY` is present and Anthropic is not) or as cross-provider fallback (default **`gpt-4o`**). We deliberately do **not** default to `gpt-5.4-mini` / `gpt-5.4-nano`: in production those newer models occasionally emit AgentOutput JSON with trailing characters (one extra closing brace), which browser-use rejects, defeating the fallback. `gpt-4o` is the canonical example in browser-use's own `fallback_model.py` and reliably produces clean structured output. Override with `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.4`, or `gpt-5.5` if you want to test a newer model — but verify in logs that the fallback actually succeeds. |
| `UX_JOURNEY_LLM_FALLBACK` | no | When **`1`** (default), and both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are configured **on the UX Journey Agent service container** (not only on persona-api), the agent passes the **other** provider as `fallback_llm`. browser-use switches on validation-style `ModelProviderError` as well as HTTP errors. Set `0` to disable. Each run logs `ux-journey: job=… primary=… fallback_llm=…` and `browser-use _fallback_llm=OK` when wiring succeeded. |
| `UX_JOURNEY_MAX_FAILURES` | no | Override browser-use's per-run retry budget for AgentOutput validation errors (default **6**). Useful when the primary occasionally serialises `action` as a JSON-string for one or two consecutive calls but recovers on its own. Try `12` if you see runs halting with the validation error before the fallback kicks in. |
| `UX_JOURNEY_CLAUDE_MAX_TOKENS` | no | Per-step output ceiling for Anthropic (default **16384**). Higher = more elaborate planning headroom; only generated tokens are billed. |
| `UX_JOURNEY_VIDEO_DIR` | no | Directory for video files (default `/tmp/ux-journey-videos`). **Use a path that is mounted as a persistent volume in Docker** (e.g. `/data/journey-videos`) so videos survive container restarts. |
| `UX_JOURNEY_STEP_START_DELAY_SECONDS` | no | Base step lead-in before action (default **3.5** s, then × `UX_JOURNEY_SLOWMO`) |
| `UX_JOURNEY_STEP_DELAY_SECONDS` | no | Base tail pause after step (default **3.0** s, then × slowmo) |
| `UX_JOURNEY_CLICK_CIRCLE_VISIBLE_SECONDS` | no | Base click-ring visibility (default **3.5** s, then × slowmo) |
| `UX_JOURNEY_SCROLL_VISIBLE_SECONDS` | no | Base slow-scroll duration per direction (default **7.0** s, then × slowmo) |
| `UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` | no | Final-video slow-motion multiplier applied during the smooth-MP4 transcode via ffmpeg `setpts=N*PTS` (default **`8`** = play back at 1/8 real-time speed). Slows the saved recording without affecting the agent's actual run time. Clamped **1..64**; `1` disables the filter. NOTE: this only stretches existing frames in time — for a *smoother* slow-motion (more real frames), bump `UX_JOURNEY_SLOWMO` instead. |
| `UX_JOURNEY_DEFER_VIDEO_FINALIZE` | no | When **`1`** (default), the ffmpeg polish pass does **not** run automatically when the journey finishes — call **`POST /run/{jobId}/video/finalize`** when you want the smooth MP4. Set **`0`** to restore background finalization at end of run (uses CPU on every run). |
| `UX_JOURNEY_VIDEO_TRANSCODE` | no | Set **`0`** to disable H.264 transcoding entirely (no ffmpeg polish). Default **`1`** (transcode enabled when ffmpeg is available). |
| `UX_JOURNEY_LIVE_FRAME_INTERVAL` | no | Seconds between live/MJPEG frames (default 0.04 = 25 fps). Lower value = higher fps. |
| `PORT` | no | HTTP port (default 8320) |

## Local run

```bash
cd apps/ux-journey-agent
# Install the vendored checkion-agent fork (editable so local edits picked up)
pip install -e ./checkion-agent[video]
# App-specific deps
pip install -r requirements.txt
python -m playwright install chromium
export ANTHROPIC_API_KEY=sk-ant-...
python main.py
# POST http://localhost:8320/run with { "url", "task" }
```

## Tests

With dependencies installed (see Local run):

```bash
python -m unittest test_live -v
```

## Docker (Coolify)

The `checkion-agent` fork is vendored **inside this app folder**
(`apps/ux-journey-agent/checkion-agent/`), so the Docker build context is
just this folder — no monorepo-aware build setup is required.

Coolify config (defaults work):

- **Base Directory:** `apps/ux-journey-agent`
- **Dockerfile Location:** `Dockerfile`
- **Port:** `8320`
- **Env:** `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`). Optionally
  `UX_JOURNEY_MAX_STEPS`, `UX_JOURNEY_VIDEO_DIR`.

Local equivalent:

```bash
cd apps/ux-journey-agent
docker build -t ux-journey-agent .
```

### Persistent videos (Shared Volume)

So that recorded videos and the possibility to play them survive container rebuilds/restarts:

1. **Volume in Coolify:** Add a **Persistent Storage** volume to the UX Journey Agent service. Mount it at a path inside the container, e.g. **`/data/journey-videos`**.
2. **Env:** Set **`UX_JOURNEY_VIDEO_DIR=/data/journey-videos`** for the agent.

The agent writes all journey recordings into this directory. After a container restart, `GET /run/{jobId}/video` still serves the file from that path if it exists (fallback by job ID). Screenshots from the run are stored in the CHECKION DB (journey history) as base64 in the result; they are not written to disk by the agent.

See [Coolify deployment](../../docs/deployment/coolify-ux-journey-agent.md) for step-by-step.
