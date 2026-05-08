# checkion-agent

CHECKION-internal browser-automation library used by `apps/ux-journey-agent/`.
Soft fork of upstream [browser-use](https://github.com/browser-use/browser-use)
at tag `0.12.6`.

> See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for the rationale behind the fork
> and the upstream tracking strategy.

## Layout

The fork is vendored **inside the consuming app** (`apps/ux-journey-agent/`)
because (a) the agent is currently the only consumer, and (b) keeping it under
the app folder lets Coolify build with its default `Base Directory` setting —
the build context already contains everything `pip install` needs.

If a second app starts depending on this fork, hoist it back up to
`packages/checkion-agent/` and update the Dockerfile's `COPY` accordingly.

## Install (development, editable from monorepo)

```
cd apps/ux-journey-agent
pip install -e ./checkion-agent[video]
pip install -r requirements.txt
```

## Usage

```python
from checkion_agent import Agent, ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)
agent = Agent(task="Go to example.com and click 'More information'", llm=llm)
await agent.run()
```

The public surface mirrors upstream `browser-use==0.12.6` 1:1 in **Phase B**
(this commit). All upstream tests should still pass.

## What changes vs. upstream

See [`CHANGELOG.md`](./CHANGELOG.md) for the full per-version diff.

- **Phase B (`0.12.6+checkion.0`):** Mechanical rename `browser_use` →
  `checkion_agent`. No behavior changes. Code is byte-for-byte identical to
  upstream `0.12.6` except for the package import path. License and copyright
  headers are preserved.

- **Phase 1 (`0.12.6+checkion.1`):** Tolerant `AgentOutput` parsing baked in.
  - `model_validator(mode='before')` on `AgentOutput` coerces `action` from
    string-list / string-dict / single-dict into the canonical list shape.
  - `ChatOpenAI.ainvoke` recovers from trailing-character /
    markdown-preamble failures around `model_validate_json`.
  - `ChatAnthropic.ainvoke` extends its existing string-`_input` recovery
    branch with the same balanced-object slicing.
  - All gated by `CHECKION_AGENT_TOLERANT_PARSING` (default `1`).
  - Replaces the ~300 LOC `_repair_*` / `_maybe_wrap_llm_class` stack from
    `apps/ux-journey-agent/main.py`.

- **Phase 2 (`0.12.6+checkion.2`):** First-class persona.
  - New module `checkion_agent.agent.persona` exposes `PersonaContext`,
    `PersonaProfile`, `PersonaDimensions`, `PersonaPolicy`, plus the pure
    functions `derive_policy(persona)` and `render_system_prompt_block(persona)`.
  - `Agent.__init__` accepts a `persona: PersonaContext | dict | None` kwarg.
    The fork renders the typed payload into the **system** prompt (via
    `extend_system_message`), so the persona is sent on every step instead
    of once in the initial task.
  - `agent.persona` and `agent.persona_policy` are accessible after
    construction for telemetry / UI consumers.
  - Gated by `CHECKION_AGENT_PERSONA_INSTRUCTIONS` (default `1`).
  - Replaces the ~165 LOC `_persona_*` keyword-scoring scaffolding from
    `apps/ux-journey-agent/main.py`.

- **Phase 3 (`0.12.6+checkion.3`):** Persona DSL + reasoning language.
  - `PersonaContext` gains four optional DSL fields:
    `dimension_overrides`, `dos`, `donts`, `extra_instructions` — explicit
    knobs that override / extend the keyword-derived behaviour. Persona
    designers can now author behaviour directly instead of hoping the
    German keyword catalogue catches their prose.
  - New `Agent(reasoning_language='de'|'en'|...)` parameter renders a
    small `REASONING_LANGUAGE:` block into the system prompt that pins the
    language for the AgentOutput reasoning fields (selectors, URLs and
    quoted page content stay in their original language).
  - System-prompt extension is now assembled in a fixed, cache-friendly
    order: caller's `extend_system_message` → reasoning-language block →
    persona block.
  - Replaces the German-language pinning line in
    `apps/ux-journey-agent/main.py` and moves the CHECKION-UI brevity
    rules from the task into `extend_system_message`.

- **Phase 4 (`0.12.6+checkion.4`):** First-class step pacing & screenshot
  hook.
  - `Agent.__init__` accepts `step_pacing_seconds: float = 0.0` and
    `action_slowdown_factor: float = 1.0`. The fork sleeps
    `step_pacing_seconds × action_slowdown_factor` at the *start* of each
    `step()` call so a screen recorder always captures the pre-action
    state. Negative / non-numeric values clamp to a safe no-op.
  - `Agent.__init__` accepts
    `on_screenshot: Callable[[Agent, str], Awaitable[None] | None]` —
    a sync-or-async callback that fires immediately after each per-step
    screenshot is captured, receiving the agent and the base64-encoded
    PNG. Hook errors are caught and logged at debug — they never break
    the run.
  - Replaces the hand-rolled `_on_step_start` hook in
    `apps/ux-journey-agent/main.py`. The runner now passes the existing
    `STEP_START_DELAY_SECONDS` and `UX_JOURNEY_SLOWMO` env values
    straight into the constructor.
  - The new `forkHooks` block in the run result payload reports
    `screenshotHookCalls`, `pacingSeconds`, `slowdownFactor`, and
    `liveStepFrames` so the operator can verify the hook fired and the
    pacing matches the expected slow-mo level.

- **Future (planned):** structured logging, browser-side action timing
  hooks for sub-step instrumentation (e.g. per-click vs. per-scroll
  pacing).

See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for upstream rebase notes.
