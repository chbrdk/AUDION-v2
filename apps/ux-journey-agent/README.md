# UX Journey Agent (CHECKION Monorepo)

Browser agent service for CHECKION: runs autonomous navigation tasks (URL + natural language goal) using [browser-use](https://github.com/browser-use/browser-use) (Playwright + LLM).

## API

- **POST /run** – Body: `{ "url": "https://example.com", "task": "Find product X and add to cart" }` → `{ "jobId": "uuid" }`
- **GET /run/{jobId}** – Returns `{ "status": "running"|"complete"|"error", "result?: { steps, success, ... }" }`
- **GET /run/{jobId}/video** – Recorded journey video (when available).
- **GET /run/{jobId}/live** – Latest viewport frame (JPEG) while the job is running; 404 when no frame.
- **GET /health** – `{ "status": "ok" }`

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | one of these | Claude (recommended) |
| `OPENAI_API_KEY` | one of these | OpenAI fallback |
| `UX_JOURNEY_MAX_STEPS` | no | Max agent steps (default 25) |
| `UX_JOURNEY_SLOWMO` | no | Multiplies pacing delays for **real** slow-mo in the recording (default **`2`** in code — no env needed). Set `1` for faster runs; alias `UX_JOURNEY_SLOWMO_MULTIPLIER` (clamped 0.25–12) |
| `UX_JOURNEY_CLAUDE_MODEL` | no | Claude model (default claude-sonnet-4-20250514) |
| `UX_JOURNEY_VIDEO_DIR` | no | Directory for video files (default `/tmp/ux-journey-videos`). **Use a path that is mounted as a persistent volume in Docker** (e.g. `/data/journey-videos`) so videos survive container restarts. |
| `UX_JOURNEY_STEP_START_DELAY_SECONDS` | no | Base step lead-in before action (default **3.5** s, then × `UX_JOURNEY_SLOWMO`) |
| `UX_JOURNEY_STEP_DELAY_SECONDS` | no | Base tail pause after step (default **3.0** s, then × slowmo) |
| `UX_JOURNEY_CLICK_CIRCLE_VISIBLE_SECONDS` | no | Base click-ring visibility (default **3.5** s, then × slowmo) |
| `UX_JOURNEY_SCROLL_VISIBLE_SECONDS` | no | Base slow-scroll duration per direction (default **7.0** s, then × slowmo) |
| `UX_JOURNEY_LIVE_FRAME_INTERVAL` | no | Seconds between live/MJPEG frames (default 0.04 = 25 fps). Lower value = higher fps. |
| `PORT` | no | HTTP port (default 8320) |

## Local run

```bash
cd ux-journey-agent
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

- **Build context:** `ux-journey-agent` (root directory of this service).
- **Dockerfile path:** `Dockerfile`.
- **Port:** 8320.
- **Env:** `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`). Optionally `UX_JOURNEY_MAX_STEPS`, `UX_JOURNEY_VIDEO_DIR`.

### Persistent videos (Shared Volume)

So that recorded videos and the possibility to play them survive container rebuilds/restarts:

1. **Volume in Coolify:** Add a **Persistent Storage** volume to the UX Journey Agent service. Mount it at a path inside the container, e.g. **`/data/journey-videos`**.
2. **Env:** Set **`UX_JOURNEY_VIDEO_DIR=/data/journey-videos`** for the agent.

The agent writes all journey recordings into this directory. After a container restart, `GET /run/{jobId}/video` still serves the file from that path if it exists (fallback by job ID). Screenshots from the run are stored in the CHECKION DB (journey history) as base64 in the result; they are not written to disk by the agent.

See [Coolify deployment](../../docs/deployment/coolify-ux-journey-agent.md) for step-by-step.
