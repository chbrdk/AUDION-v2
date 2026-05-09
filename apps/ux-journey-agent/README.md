# UX Journey Agent (CHECKION Monorepo)

Browser agent service for CHECKION: runs autonomous navigation tasks (URL + natural language goal) using **`checkion-agent`** — a CHECKION-internal soft fork of [browser-use](https://github.com/browser-use/browser-use) (Playwright + LLM), vendored at [`./checkion-agent/`](./checkion-agent/). See [`./checkion-agent/ATTRIBUTION.md`](./checkion-agent/ATTRIBUTION.md) for the rationale and upstream tracking strategy.

## API

- **POST /run** – Body: `{ "url": "https://example.com", "task": "Find product X and add to cart" }` → `{ "jobId": "uuid" }`
- **GET /run/{jobId}** – Returns `{ "status": "running"|"complete"|"error", "result?: { steps, success, ... }", "lastObservedAt?": "ISO-8601" }`. The `lastObservedAt` field is a wall-clock heartbeat that ticks every ~1s while the agent is alive (history watcher loop + screenshot loop) — chat-api's stagnation watchdog reads it so a slow mid-step LLM plan call (60-120s typical for multi-action steps with `find_elements + extract`) does not get falsely cancelled by the step-count signal alone.
- **POST /run/{jobId}/cancel?reason=...** – Force-cancel a running journey. Optional `reason` query parameter (≤500 chars) is preserved on the job's `error` field so the chat UI can show *why* the cancel happened (stagnation watchdog, hard timeout, manual user cancel, …) instead of the generic "Run was cancelled before completion." default.
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
| `UX_JOURNEY_VIDEO_DYNAMIC_PACING` | no | **Default `1` (ON).** Per-scene pacing instead of a uniform `setpts` over the whole clip: each step's segment is sliced at `videoOffsetSec`, then time-stretched (or compressed) so its **output duration ≈ TTS clip length + `UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC`**. Five-step runs go from ~50 minutes (uniform `setpts=32*PTS`) to ~30–60 seconds (sum of voice clip lengths). Steps without voice fall back to `UX_JOURNEY_VIDEO_SCENE_MIN_SEC`. **Pipeline**: each segment is rendered to its own intermediate MP4 via a fresh ffmpeg call (`-accurate_seek -ss S -i src -vf "setpts=(PTS-STARTPTS)*scale,fps=N,format=yuv420p" -frames:v K`), then glued together with the `concat` demuxer in a final pass that also `adelay`s the per-step voice clips to the *actual* cumulative output offsets (rebased from ffprobe-measured per-segment durations to absorb millisecond drift) and `amix`'s them, plus burns the lower-third ASS. Per-segment intermediates land in `${UX_JOURNEY_VIDEO_DIR}/.${jobId}.dynamic/` and are wiped on success or failure. The earlier in-graph approach (single `filter_complex` with `split + trim + concat`) silently dropped the front segments on real Playwright VFR captures — the user saw only the last scene with the audio holding the freeze. The N+1 ffmpeg invocations cost a few extra seconds but produce a correct video every time. When **`0`**, falls back to the legacy uniform path (`UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` × `UX_JOURNEY_VIDEO_COMPOUND_SLOWMO`). |
| `UX_JOURNEY_VIDEO_SCENE_MIN_SEC` | no | Minimum output length for any per-scene segment (default **`2.5`**). Applies to lead-in / tail / steps without voice. |
| `UX_JOURNEY_VIDEO_SCENE_MAX_SEC` | no | Cap on per-scene output length (default **`60.0`**). Prevents a chatty step (long reasoning → long TTS) from monopolising the polished MP4. |
| `UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC` | no | Extra silence appended to a scene after the voice clip ends (default **`0.5`**). Prevents the next voice line from crashing into the previous one. |
| `UX_JOURNEY_VIDEO_SCENE_LEAD_IN_SEC` | no | Output length of the optional lead-in segment (raw `0..videoOffsetSec[step1]`) when the agent's first action came late. **Default `0` — lead-in skipped.** The lead-in used to capture the bouncing browser-use DVD-screensaver overlay on `about:blank` plus the empty white tab while the LLM planned step 1. The overlay is now disabled by default (`CHECKION_BROWSER_LOADING_OVERLAY=0`), and the lead-in itself is off so the polished video starts at the agent's first real action. Set a positive value (e.g. `1.5`) to opt back in. |
| `CHECKION_BROWSER_LOADING_OVERLAY` | no | Set to `1` to re-enable the upstream browser-use „DVD screensaver" overlay (bouncing `cf.browser-use.com/logo.svg` on every `about:blank` tab). Default **OFF** because in headless recordings the overlay just shows up at the start of every video as a black screen with a bouncing logo until the agent issues its first navigation. |
| `UX_JOURNEY_VIDEO_SCENE_TAIL_SEC` | no | Output length of the optional tail segment (raw `lastStepOffset..rawEnd`) when the recording extends past the final step (default **`2.5`**). |
| `UX_JOURNEY_VIDEO_SCENE_MIN_SCALE` | no | Hard floor on per-segment scale (default **`0.1`**, range 0.05..1.0). When a step's raw segment is much longer than its TTS (e.g. 30 s of slow scrolling but 4 s of voice), the scale would be 0.13 → blurred motion. The floor pulls the target output length back up so motion stays readable, at the cost of the voice ending before the scene does. |
| `UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` | no | Legacy: base ffmpeg slow-motion multiplier during smooth-MP4 transcode via `setpts=N*PTS` (default **`16`**). Used **only** when **`UX_JOURNEY_VIDEO_DYNAMIC_PACING=0`**. The **effective** stretch in the legacy path also applies **`UX_JOURNEY_VIDEO_COMPOUND_SLOWMO`** (see below). Clamped **1..64** for this factor alone; combined effective slowdown is capped at **128**. |
| `UX_JOURNEY_VIDEO_COMPOUND_SLOWMO` | no | Legacy: **Default `1` (ON).** In the uniform-pacing path, multiplies **`UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR` × `UX_JOURNEY_SLOWMO`** for the finalize transcode (e.g. default **16×2 ≈ 32×** wall-clock length vs raw WebM). Ignored when `UX_JOURNEY_VIDEO_DYNAMIC_PACING=1`. |
| `UX_JOURNEY_VIDEO_LOWER_THIRD` | no | **Default `1` (ON).** Burns per-step **`reasoning`** text into the polished MP4 as ASS subtitles (bottom band: „Schritt N“ + wrapped text), timed from **`videoOffsetSec`** on each step. Requires **`ffprobe`** + **`ffmpeg`** on the container and a `{jobId}.steps.json` sidecar (written automatically at run end). Set **`0`** to disable subtitle burn-in. |
| `UX_JOURNEY_VIDEO_VOICEOVER` | no | **Default `1` (ON, requires `OPENAI_API_KEY`).** During finalize, synthesises the same per-step text used by the lower third via OpenAI TTS and **mixes it into the polished MP4**. With **`UX_JOURNEY_VIDEO_DYNAMIC_PACING=1`** (default), each scene's *length is set by* the voice clip — the clip plays at natural tempo and is `adelay`'d to the cumulative output start of its step. With dynamic pacing off, the legacy uniform path places clips at `videoOffsetSec × effectiveSlowdown`. Each clip is cached on disk (per-job folder, hashed by model+voice+lang+text) so `?force=1` re-finalize doesn't re-bill. Set **`0`** to disable the voice-over and produce a silent MP4 like before. |
| `UX_JOURNEY_VOICEOVER_MODEL` | no | OpenAI TTS model (default **`gpt-4o-mini-tts`** — newer + cheap). Fallback options: `tts-1`, `tts-1-hd`. |
| `UX_JOURNEY_VOICEOVER_VOICE` | no | OpenAI voice id (default **`alloy`**). Other valid choices: `echo`, `fable`, `onyx`, `nova`, `shimmer`, `ash`, `coral`, `sage`, `verse`. |
| `UX_JOURNEY_VOICEOVER_LANG` | no | Hint for the TTS model (default **`de`**). Currently only used in the cache hash; the model auto-detects language from the input text. |
| `UX_JOURNEY_VOICEOVER_MAX_CHARS` | no | Hard cap on synthesised text per step (default **`220`**). Shorter than the lower-third cap (320) so spoken output reliably fits the per-step slot. |
| `UX_JOURNEY_VOICEOVER_MAX_TEMPO` | no | Legacy uniform-pacing knob: maximum `atempo` factor when an audio clip overflows its (slowed) slot (default **`1.4`**, clamped 1.0..1.8). Speech remains pitch-correct (`atempo` preserves pitch). **Ignored** when `UX_JOURNEY_VIDEO_DYNAMIC_PACING=1` (the scene matches the voice, not the other way around — clips always play at natural tempo). |
| `UX_JOURNEY_VOICEOVER_MIN_GAP_SEC` | no | Minimum gap (output-timeline seconds) we leave between consecutive voice clips so the next thought doesn't crash into the previous one (default **`0.25`**). |
| `UX_JOURNEY_VOICEOVER_CONCURRENCY` | no | Max parallel TTS requests to OpenAI (default **`6`**, clamped 1..16). Lower if you hit rate limits on long runs. |
| `UX_JOURNEY_DEFER_VIDEO_FINALIZE` | no | When **`1`** (default), the ffmpeg polish pass does **not** run automatically when the journey finishes — call **`POST /run/{jobId}/video/finalize`** when you want the smooth MP4. Set **`0`** to restore background finalization at end of run (uses CPU on every run). |
| `UX_JOURNEY_VIDEO_TRANSCODE` | no | Set **`0`** to disable H.264 transcoding entirely (no ffmpeg polish). Default **`1`** (transcode enabled when ffmpeg is available). |
| `UX_JOURNEY_LIVE_FRAME_INTERVAL` | no | Seconds between live/MJPEG frames (default 0.04 = 25 fps). Lower value = higher fps. |
| `PORT` | no | HTTP port (default 8320) |

## Video finalize: real motion vs. still fallbacks

The polished MP4 is **not** a slideshow of step screenshots. With **`UX_JOURNEY_VIDEO_DYNAMIC_PACING=1`** (default), finalize does **step-by-step work on the real Playwright screen recording** (`{jobId}.raw.*`):

1. **Scene boundaries** come from per-step `videoOffsetSec` in `{jobId}.steps.json` (monotonic “first seen” vs. recording start, linearly rescaled if the raw file’s duration and that clock ever diverge).
2. For each scene, **ffmpeg** cuts a time window from the **same raw file** and re-times it so the on-screen **clicks, scrolls, and page motion** stay visible; output length follows the TTS for that step (plus `UX_JOURNEY_VIDEO_SCENE_VOICE_PAD_SEC` and the min/max scene caps). Voice clips are synthesized per step, then **delayed and mixed** on a final pass after **concat** of the per-scene MP4s.
3. A **single extracted frame** is used only as a **last-resort** when a planned slice is degenerate (no decodable video in that window) — that path exists so concat + audio don’t desync. Normal runs should never “look like PowerPoint”.

With **`UX_JOURNEY_VIDEO_DYNAMIC_PACING=0`**, finalize falls back to the **legacy uniform** path: one `setpts` stretch over the **entire** raw recording (plus subtitle/voice timing derived from that slowdown). That preserves motion too, but long journeys become unwieldy wall-clock length compared to dynamic pacing.

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
