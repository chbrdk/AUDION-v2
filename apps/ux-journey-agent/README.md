# UX Journey Agent (CHECKION Monorepo)

Browser agent service for CHECKION: runs autonomous navigation tasks (URL + natural language goal) using **`checkion-agent`** — a CHECKION-internal soft fork of [browser-use](https://github.com/browser-use/browser-use) (Playwright + LLM), vendored at [`./checkion-agent/`](./checkion-agent/). See [`./checkion-agent/ATTRIBUTION.md`](./checkion-agent/ATTRIBUTION.md) for the rationale and upstream tracking strategy.

## API

- **POST /run** – Body: `{ "url": "https://example.com", "task": "Find product X and add to cart" }` → `{ "jobId": "uuid" }`
- **GET /run/{jobId}** – Returns `{ "status": "running"|"complete"|"error", "result?: { steps, success, ... }" }`
- **GET /run/{jobId}/video** – Journey video. Returns the polished MP4 (`{jobId}.mp4`) when finalize has run; otherwise falls back to the raw Playwright capture (`{jobId}.raw.mp4` or `{jobId}.raw.webm`) so the player has *something* to show right after the run. The raw sidecar is kept on disk after finalize so `?force=1` can re-render with new pacing / voice / subtitle settings without re-running the agent.
- **POST /run/{jobId}/video/finalize** – On-demand ffmpeg polish (slow-motion + lower-third subtitles + voice-over). Idempotent; returns JSON `{ "status": "completed"|"skipped"|"already_finalized"|"failed", ... }`. When **`UX_JOURNEY_DEFER_VIDEO_FINALIZE`** is enabled (default), this is the step that performs heavy transcoding instead of doing it automatically at the end of the run. **Important:** this endpoint detects "already polished" by the existence of `{jobId}.mp4` exactly — the raw recording lives at `{jobId}.raw.{ext}` so it never accidentally short-circuits a real transcode (browser-use 0.12.6 writes raw MP4, which previously *masqueraded* as polished and caused 1-second / silent / no-overlay videos). Pass `?force=1` to delete the polished MP4 and re-render from the raw sidecar; refuses (HTTP 409) on legacy jobs without a `.raw.*` sidecar.
- **GET /run/{jobId}/live** – Latest viewport frame while the job is running; 404 when no frame. Content-type is sniffed from the bytes (PNG from the Phase 4 step hook, JPEG from the legacy CDP polling loop).
- **GET /run/{jobId}/live/stream** – MJPEG-style multipart stream (`multipart/x-mixed-replace; boundary=frame`). Each part carries an inline-sniffed content-type so the stream stays RFC-correct when a run mixes PNG step frames with JPEG polling frames.
- **GET /health** – `{ "status": "ok" }`

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | one of these | Claude (recommended) |
| `OPENAI_API_KEY` | one of these | OpenAI fallback |
| `CHECKION_AGENT_TOLERANT_PARSING` | no | **Default `1` (ON).** Tolerant `AgentOutput` parsing baked into our soft-fork `checkion-agent` (Phase 1, see [`./checkion-agent/CHANGELOG.md`](./checkion-agent/CHANGELOG.md)). Covers the three production failure modes that survived the upstream `browser-use==0.12.6` fixes: (a) `action` returned as a JSON-encoded *string-list*, *string-dict*, or single `dict` instead of `list[dict]` — coerced via a `model_validator(mode='before')` directly on `AgentOutput`, so Pydantic never raises `list_type`; (b) `model_validate_json` on the OpenAI adapter failing with `json_invalid` / trailing characters — falls back to extracting the first balanced `{...}` substring; (c) markdown code-fence preamble around the JSON object. The patch replaces the legacy ~300 LOC `_repair_*` + dynamic-LLM-subclass shim that used to live in `main.py`. Set **`0`** for strict upstream-equivalent behaviour (useful for A/B testing whether a model regression is masked by the patch). Reported as `tolerantParsing: true|false` by the `_llm_meta` debug surface. |
| `CHECKION_AGENT_PERSONA_INSTRUCTIONS` | no | **Default `1` (ON).** First-class persona injection in `checkion-agent` (Phase 2, see [`./checkion-agent/CHANGELOG.md`](./checkion-agent/CHANGELOG.md)). When **`1`**, `Agent(persona=persona_dict)` automatically renders a `PERSONA_CONTEXT` + `PERSONA_BEHAVIOR_POLICY` block into the agent's **system** prompt — present at every LLM call, naturally cached by Anthropic's prompt cache. The derived 6-dimension policy (`risk_aversion`, `time_pressure`, `exploration`, `detail_orientation`, `trust_skepticism`, `accessibility_need`) and up to 12 actionable navigation heuristics are produced deterministically from the persona's text fields. Replaces the legacy ~165 LOC `_persona_*` keyword-scoring scaffolding that used to live in `main.py`. Set **`0`** to disable the auto-injection (useful when the caller wants to construct the system-prompt extension themselves via `extend_system_message`). The agent's `personaPolicy` field in the run result is sourced from `agent.persona_policy.model_dump()` and reflects whatever the fork derived — so disabling this var also surfaces as `personaPolicy: null`. |
| `CHECKION_AGENT_WEB_SEARCH` | no | **Default `0` (OFF).** When **`0`**, the fork removes the browser `search` action from the tool registry — the agent cannot navigate to DuckDuckGo, Google, or Bing (`checkion-agent` `0.12.6+checkion.6`, see CHANGELOG). UX Journey stays on the operator-supplied URL and in-site navigation only. Set **`1`** to restore upstream behaviour (rare integrations / debugging). |
| `CHECKION_AGENT_USE_JUDGE` | no | **Default `0` (OFF).** When **`0`**, the agent runs with `Agent(use_judge=False)` so browser-use does **not** trigger its post-run "Judge" verdict pass. The judge sends the entire run history + screenshots to the primary LLM, which on long journeys regularly blows the 200k/272k context window (`Judge trace failed: Input tokens exceed the configured limit`). CHECKION never reads the verdict, so it's pure log noise + token burn. Set **`1`** to opt back in (e.g. for upstream debugging). |
| `UX_JOURNEY_LIVE_STEP_FRAMES` | no | **Default `1` (ON).** Phase 4 hook — when **`1`**, the fork's `on_screenshot` callback pushes the per-step base64-PNG into the live-frame cache used by `GET /run/{jobId}/live` and `GET /run/{jobId}/live/stream` (in addition to incrementing the visibility counter that always runs). The Phase 5 endpoints sniff the content-type from the bytes (PNG vs JPEG vs GIF/WEBP) so this is now safe regardless of which capture path produced the frame. Set **`0`** to fall back to a JPEG-only live stream (useful if a downstream consumer hard-codes `image/jpeg`). |
| `UX_JOURNEY_LIVE_POLLING_LOOP` | no | **Default `1` (ON).** Phase 5 — controls the legacy 25 fps CDP polling loop that produces sub-step preview frames. Set **`0`** to rely solely on the Phase 4 fork hook (one frame per agent step, but lossless PNG, no CDP traffic, no decode CPU). The MJPEG `/live/stream` endpoint still works either way; with the loop off, frames update at the agent's step cadence (every few seconds) instead of 25 fps. The `forkHooks.livePollingLoop` field in the run result reflects the chosen mode for this job. |
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
| `UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` | no | Base ffmpeg slow-motion multiplier during smooth-MP4 transcode via `setpts=N*PTS` (default **`16`** — slower review export than the previous default). The **effective** stretch also applies **`UX_JOURNEY_VIDEO_COMPOUND_SLOWMO`** (see below). Clamped **1..64** for this factor alone; combined effective slowdown is capped at **128**. Set **`1`** to disable `setpts` (only CFR + H.264 polish). NOTE: this only stretches existing frames — for smoother motion with more real frames, raise **`UX_JOURNEY_SLOWMO`**. |
| `UX_JOURNEY_VIDEO_COMPOUND_SLOWMO` | no | **Default `1` (ON).** Multiplies **`UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` × `UX_JOURNEY_SLOWMO`** for the finalize transcode so export pacing tracks the same recording knob (e.g. default **16×2 ≈ 32×** wall-clock length vs raw WebM). Set **`0`** to use only `UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` for ffmpeg. |
| `UX_JOURNEY_VIDEO_LOWER_THIRD` | no | **Default `1` (ON).** Burns per-step **`reasoning`** text into the polished MP4 as ASS subtitles (bottom band: „Schritt N“ + wrapped text), timed from **`videoOffsetSec`** on each step. Requires **`ffprobe`** + **`ffmpeg`** on the container and a `{jobId}.steps.json` sidecar (written automatically at run end). Set **`0`** to disable subtitle burn-in. |
| `UX_JOURNEY_VIDEO_VOICEOVER` | no | **Default `1` (ON, requires `OPENAI_API_KEY`).** During finalize, synthesises the same per-step text used by the lower third via OpenAI TTS and **mixes it into the polished MP4** at `videoOffsetSec × effectiveSlowdown` — so audio, burnt subtitle and on-screen action match the *same* moment. Each clip is cached on disk (per-job folder, hashed by model+voice+lang+text) so `?force=1` re-finalize doesn't re-bill. Set **`0`** to disable the voice-over and produce a silent MP4 like before. |
| `UX_JOURNEY_VOICEOVER_MODEL` | no | OpenAI TTS model (default **`gpt-4o-mini-tts`** — newer + cheap). Fallback options: `tts-1`, `tts-1-hd`. |
| `UX_JOURNEY_VOICEOVER_VOICE` | no | OpenAI voice id (default **`alloy`**). Other valid choices: `echo`, `fable`, `onyx`, `nova`, `shimmer`, `ash`, `coral`, `sage`, `verse`. |
| `UX_JOURNEY_VOICEOVER_LANG` | no | Hint for the TTS model (default **`de`**). Currently only used in the cache hash; the model auto-detects language from the input text. |
| `UX_JOURNEY_VOICEOVER_MAX_CHARS` | no | Hard cap on synthesised text per step (default **`220`**). Shorter than the lower-third cap (320) so spoken output reliably fits the per-step slot. |
| `UX_JOURNEY_VOICEOVER_MAX_TEMPO` | no | Maximum `atempo` factor when an audio clip overflows its slot (default **`1.4`**, clamped 1.0..1.8). Higher = more aggressive speed-up to fit; speech remains pitch-correct (`atempo` preserves pitch). |
| `UX_JOURNEY_VOICEOVER_MIN_GAP_SEC` | no | Minimum gap (output-timeline seconds) we leave between consecutive voice clips so the next thought doesn't crash into the previous one (default **`0.25`**). |
| `UX_JOURNEY_VOICEOVER_CONCURRENCY` | no | Max parallel TTS requests to OpenAI (default **`6`**, clamped 1..16). Lower if you hit rate limits on long runs. |
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
