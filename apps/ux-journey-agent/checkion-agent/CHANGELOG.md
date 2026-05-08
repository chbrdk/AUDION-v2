# Changelog (CHECKION fork)

This file tracks changes made by CHECKION on top of the upstream
[browser-use](https://github.com/browser-use/browser-use) base. Each entry
identifies the upstream baseline it was applied against so the fork can be
rebased cleanly.

The version numbers follow the pattern `<upstream>+checkion.<patch>` (e.g.
`0.12.6+checkion.1`). Bumping the upstream baseline resets the patch counter.

## `0.12.6+checkion.5` (Phase 6 — per-action hooks)

**Upstream baseline:** `browser-use==0.12.6` (commit
`329c67f069427e928ff81ad52415efdca7692007`).

**Goal:** finish moving the per-step CHECKION playback (red click ring +
slow-scroll replay) out of the runner's `on_step_end` hook and into a
generic, granular surface that fires once per *action*. Step-level hooks
are too coarse: a single step can run multiple actions, the playback only
makes sense for some action names (`click`, `scroll`), and the runner
previously had to introspect `agent.history.action_history()` to figure
out which sub-action to replay. A per-action hook handed the same data
the tool just received removes that introspection entirely.

### Added (`Agent.__init__` parameters)

- **`on_action_start: Callable[[Agent, str, dict], Awaitable[None] | None] | None`** —
  fires *before* an action is dispatched to `tools.act`. Receives the
  agent, the registered tool name (e.g. `'click'`, `'scroll'`,
  `'go_to_url'`), and the matching sub-dict from the AgentOutput
  (e.g. `{'index': 5}` or `{'down': True, 'amount': 100}`). Sync or async.
- **`on_action_end: Callable[[Agent, str, dict, ActionResult], Awaitable[None] | None] | None`** —
  fires *after* `tools.act` returns. Receives the same trio plus the
  resulting `ActionResult`, so callers can branch on `result.error`,
  `result.is_done`, etc. Sync or async.

Both hooks are dispatched through a private `Agent._fire_action_hook`
helper that:

- swallows ordinary exceptions (logged at debug; never breaks a run);
- propagates `asyncio.CancelledError` so a hot-cancel still works;
- accepts both sync and async callables via `inspect.iscoroutine`.

### Changed

- **`Agent.multi_act`** now calls
  `self._fire_action_hook(self.on_action_start, ...)` directly before the
  existing `tools.act(...)` call, and
  `self._fire_action_hook(self.on_action_end, ..., result)` directly
  after. Both fire with the *pre-action* `cached_selector_map` still
  populated, so a hook that needs element bounds (e.g. CHECKION's
  click-ring) can resolve them before the DOM mutates.
- The hook fire sites are inside the existing per-action `try/except` in
  `multi_act`. If the action itself raises, `on_action_end` is *skipped*
  (mirrors Phase 4's `on_screenshot` contract: hook fires on success
  paths only). A future caller that wants tear-down on failure can wire
  `on_action_start` and a `result is None` branch in `on_action_end`
  separately.

### Removed (caller side)

- `apps/ux-journey-agent/main.py` lost the ~110 LOC step-end playback
  block from `_on_step_end` (history introspection + click-ring +
  slow-scroll). The runner now defines:

  ```python
  async def _on_action_end(agent, action_name, params, result):
      if action_name == 'click':
          await _play_click_ring(agent, params)
      elif action_name == 'scroll':
          await _play_slow_scroll(agent, params)
  ```

  and wires it via late-attribute-set after `Agent(**agent_kw)` (the
  closure references `_play_*` helpers that have to exist before the
  agent is constructed for older fork builds where `on_action_end` is
  not a constructor kwarg). `_on_step_end` now only handles step-level
  work: settle pause + partial-steps publish.

### How to verify the patch is active

After a run completes, the result payload includes the per-action call
count under `forkHooks.actionHookCalls`:

```json
{
  "forkHooks": {
    "actionHookCalls": 23
  }
}
```

A non-zero value with a successful run confirms the fork's `on_action_end`
hook actually fired during `multi_act`. A 0 (with successful run + visible
clicks) means the running fork is older than `0.12.6+checkion.5`.

## `0.12.6+checkion.4` (Phase 4 — first-class step pacing & screenshot hook)

**Upstream baseline:** `browser-use==0.12.6` (commit
`329c67f069427e928ff81ad52415efdca7692007`).

**Goal:** finish absorbing the ad-hoc `_on_step_start` / live-frame polling
machinery that lived in `apps/ux-journey-agent/main.py` into the agent
itself, and expose a single, typed event-driven hook for per-step screenshots
so callers can stream / persist / annotate frames without owning a polling
loop.

### Added (`Agent.__init__` parameters)

- **`step_pacing_seconds: float = 0.0`** — sleep duration applied at the very
  *start* of each `step()` call, before timing / context preparation. This is
  the dedicated knob for "freeze the screen long enough for the recorder to
  capture the pre-action state". Defaults to `0.0` so upstream-equivalent
  behaviour is preserved when omitted.
- **`action_slowdown_factor: float = 1.0`** — multiplier applied to
  `step_pacing_seconds`. Lets callers pass a base pacing value and a global
  slow-motion factor independently (useful for slow-mo recording: the
  effective wait is `step_pacing_seconds × action_slowdown_factor`). Negative
  / non-numeric values are clamped to a no-op so a typo in a config can never
  freeze the agent.
- **`on_screenshot: Callable[[Agent, str], Awaitable[None] | None] | None`** —
  optional callback that fires immediately after `get_browser_state_summary`
  returns a screenshot, receiving the agent and the base64-encoded PNG (the
  same string that lives on `BrowserStateSummary.screenshot`). Sync or async
  bodies are supported; exceptions are caught and logged at debug — they
  never break the run. This replaces the polling-loop pattern callers used
  to run separately to ship frames into a UI / disk / metrics pipeline.

### Changed

- **`Agent.step()`** sleeps `step_pacing_seconds × action_slowdown_factor`
  at the top of the method, before the existing timing init. The wait does
  *not* count against `step_timeout` — it is wall-clock instrumentation,
  not agent work. `asyncio.CancelledError` propagates so a hot-cancel still
  interrupts the sleep cleanly.
- **`Agent._prepare_context`** invokes the `on_screenshot` callback inline
  with the existing "got browser state with screenshot" branch, so the call
  is fired exactly once per step (no double-fire on retried steps).

### Removed (caller side)

- `apps/ux-journey-agent/main.py` no longer defines a hand-rolled
  `_on_step_start` hook — the constructor wires `STEP_START_DELAY_SECONDS`
  + `UX_JOURNEY_SLOWMO` straight into the fork's pacing parameters. The
  `_live_screenshot_loop` polling task is still in place for sub-step
  preview frames (25 fps via CDP) but the new hook gives operators a
  per-step, high-quality counterpart that fires synchronously with each
  agent action — exposed via `result.forkHooks.screenshotHookCalls` so we
  can verify the hook actually fires in production.

### How to verify the patch is active

After a run completes, the result payload now includes a `forkHooks` block:

```json
{
  "forkHooks": {
    "pacingSeconds": 3.5,
    "slowdownFactor": 2.0,
    "screenshotHookCalls": 14,
    "liveStepFrames": false
  }
}
```

`screenshotHookCalls > 0` confirms the fork's `on_screenshot` hook fired.
`screenshotHookCalls == 0` on a successful run means the running fork didn't
expose `on_screenshot` (older build, or
`Agent.__init__` not accepting it) — `_agent_init_accepts_named_arg`
silently skips unknown kwargs to keep the runner forwards/backwards
compatible.

## `0.12.6+checkion.3` (Phase 3 — persona DSL + reasoning language)

**Upstream baseline:** `browser-use==0.12.6` (commit
`329c67f069427e928ff81ad52415efdca7692007`).

**Goal:** give persona designers explicit knobs (instead of relying on
keyword scoring of free-form prose) and let callers pin the reasoning
language without having to author a German preamble in their task. Together
they finish moving everything that affects *how* the agent reasons out of
the user-message task and into the cacheable system-prompt prefix.

### Added (`PersonaContext` DSL fields)

`PersonaContext` now accepts four new optional fields. All keep the
camelCase aliases CHECKION's persona records use, so coercion from a plain
JSON `dict` still works without remapping.

- **`dimension_overrides`** (alias `dimensionOverrides`): `dict[str, Any]`
  mapping any of the six dimension names (`risk_aversion`, `time_pressure`,
  `exploration`, `detail_orientation`, `trust_skepticism`,
  `accessibility_need`) to a value in `[0, 1]`. Wins over the keyword-scored
  value for the same dimension, and the heuristics are derived from the
  *post-override* dimensions, so an explicit `risk_aversion=0.9` produces
  the high-risk-aversion heuristics even when the prose is neutral.
  Unknown keys / non-numeric values are filtered (logged at debug) instead
  of rejecting the persona record.
- **`dos`**: `list[str]` — explicit `ALWAYS: ...` bullets. Capped at 8.
- **`donts`**: `list[str]` — explicit `NEVER: ...` bullets. Capped at 8.
- **`extra_instructions`** (alias `extraInstructions`): `str` — free-form
  trailing block, capped at 1000 chars.

### Added (`Agent(reasoning_language=...)`)

- New `Agent.__init__(reasoning_language: str | None = None)` parameter.
  Accepts ISO-639 codes (`'de'`, `'en'`, `'fr'`, ...) and human names
  (`'German'`, `'English'`, ...). Renders a small `REASONING_LANGUAGE:`
  block into the system prompt that pins the language for the AgentOutput
  reasoning fields (`thinking`, `evaluation_previous_goal`, `memory`,
  `next_goal`, `done.text`) while explicitly *exempting* selectors / URLs
  / quoted page content (translating those would degrade element
  detection).
- `self.reasoning_language` is stored on the agent instance for telemetry.

### Changed (system-prompt assembly)

`Agent.__init__` now assembles `extend_system_message` in this fixed order
(stable for prompt-cache hashing):

1. Caller-supplied `extend_system_message` (free-form, may change per call).
2. `REASONING_LANGUAGE:` block (small, stable per persona/run).
3. `PERSONA_CONTEXT:` + `PERSONA_BEHAVIOR_POLICY:` + `PERSONA_DSL:` +
   `PERSONA_EXTRA_INSTRUCTIONS:` + `INSTRUCTION:` (large, stable per persona).

The renderer skips empty sections cleanly, so a persona without DSL fields
collapses to the Phase-2 layout.

### Removed (caller side)

- `apps/ux-journey-agent/main.py` lost the German-language pinning line
  from its `german_instruction` block. The block was renamed to
  `checkion_brevity_extension` and is now passed via
  `Agent(extend_system_message=...)` (instead of being prepended to the
  task), so the brevity / completion rules also live in the system prompt.
- `task` is now just the task — language pinning, brevity rules, persona
  context, and reasoning constraints are all owned by the system prompt.

### Compatibility / regression guard

- `Agent.__init__` defaults: `reasoning_language=None` (off),
  all new persona DSL fields `None` (off). Callers that don't pass them get
  the Phase 2 behaviour byte-for-byte.
- `_apply_dimension_overrides` filters bad input silently, so a persona
  record with a typoed override key or a stringified value won't fail
  validation — it just falls back to the keyword score for that dimension.

## `0.12.6+checkion.2` (Phase 2 — first-class persona)

**Upstream baseline:** `browser-use==0.12.6` (commit
`329c67f069427e928ff81ad52415efdca7692007`).

**Goal:** make persona records a typed input that drives the system prompt,
instead of forcing every caller to stringify the persona into the user-side
task. The user-message-stuffing approach worked but was lossy in two ways:
the persona only landed once (the initial task), and the model started
"forgetting" it as the conversation grew. With the persona in the system
prompt, it is sent on *every* step — naturally cached by Anthropic's prompt
cache, and continually present in the model's attention.

### Added

- **`checkion_agent.agent.persona`** — new module:
  - `PersonaProfile`, `PersonaContext` — Pydantic models that accept the
    CHECKION persona JSON shape (camelCase aliases:
    `systemPrompt`, `painPoints`, `communicationStyle`). `PersonaContext.coerce`
    accepts a `dict | PersonaContext | None`.
  - `PersonaDimensions`, `PersonaPolicy` — typed policy: six 0..1 dimensions
    (`risk_aversion`, `time_pressure`, `exploration`, `detail_orientation`,
    `trust_skepticism`, `accessibility_need`) and a list of actionable
    navigation heuristics derived from them.
  - `derive_policy(persona) -> PersonaPolicy` — pure function, no env reads,
    same input → same output.
  - `render_system_prompt_block(persona) -> str` — pure function, returns the
    `PERSONA_CONTEXT` + `PERSONA_BEHAVIOR_POLICY` + `INSTRUCTION` block.
  - `persona_instructions_enabled()` — reads
    `CHECKION_AGENT_PERSONA_INSTRUCTIONS` (default `1` / on); set `=0` to
    disable the auto-injection (caller can still build the block themselves
    via `extend_system_message`).

### Changed

- **`Agent.__init__`** (`checkion_agent/agent/service.py`):
  - Accepts a new keyword-only `persona: PersonaContext | dict | None`.
  - When set, runs `PersonaContext.coerce(...)` and merges
    `render_system_prompt_block(...)` into `extend_system_message`. Caller-
    supplied `extend_system_message` is preserved and rendered *above* the
    persona block.
  - Stores the resolved persona on `self.persona` and the derived policy on
    `self.persona_policy` for telemetry / UI consumers.

### Removed (caller side)

- `apps/ux-journey-agent/main.py` lost ~165 LOC of persona scaffolding:
  `_persona_instruction`, `_persona_policy_instruction`, `_persona_policy`,
  `_text_blob_from_persona`, `_score_keywords`. The agent runner now does:

  ```python
  agent = Agent(task=..., llm=..., persona=persona_dict, ...)
  ```

  …and reads `agent.persona_policy.model_dump()` directly for the result
  payload (instead of re-deriving the policy locally).

### Behavioural change to be aware of

The persona block now lives in the **system prompt**, not the user prompt.
Two consequences:

1. The model sees the persona block *every step*, not just at task setup.
   Expect persona-flavoured reasoning to be more consistent across long
   journeys — this is the change you want.
2. Anthropic's prompt cache will treat the persona as part of the cacheable
   prefix. The first request per persona is slightly longer; subsequent
   requests benefit from cache hits.

### Regression guard

`Agent.persona` and `Agent.persona_policy` are `None` / a neutral default
when no persona is passed, so all existing callers that don't supply a
persona keep their pre-Phase-2 behaviour (`PersonaPolicy(dimensions={...0.5},
heuristics=[])`).

## `0.12.6+checkion.1` (Phase 1 — tolerant AgentOutput parsing)

**Upstream baseline:** `browser-use==0.12.6` (commit
`329c67f069427e928ff81ad52415efdca7692007`).

**Goal:** absorb the ~300 LOC `_repair_*` / `_maybe_wrap_llm_class` /
dynamic-subclass stack from `apps/ux-journey-agent/main.py` into the library
itself, so callers don't need to monkey-patch the LLM class to survive known
model failure modes.

### Added

- **`checkion_agent.agent._tolerant_parsing`** — new module exposing
  - `tolerant_parsing_enabled()` — env-gated kill-switch
    (`CHECKION_AGENT_TOLERANT_PARSING=1` default; `=0` restores strict
    upstream behaviour for A/B testing).
  - `extract_balanced_json_object(text)` — substring slicing that tolerates
    markdown code fences, "Here is the result:" preambles, and trailing
    characters after the closing brace.
  - `coerce_action_field(d)` — normalises `action` from a JSON-encoded string
    (list or single dict) or a single dict back into the canonical
    `list[ActionModel]` shape.
  - `parse_json_with_recovery(text)` — strict `json.loads` first, then
    balanced-object slice as fallback.

### Changed

- **`AgentOutput`** (`checkion_agent/agent/views.py`): added a
  `model_validator(mode='before')` that runs `coerce_action_field` before the
  standard list-of-`ActionModel` validator. Eliminates the `list_type` error
  for the three production failure modes: `action` as JSON-string-list,
  JSON-string-dict, or single dict. The behaviour is gated by
  `CHECKION_AGENT_TOLERANT_PARSING` so it can be turned off cleanly.
- **`ChatOpenAI.ainvoke`** (`checkion_agent/llm/openai/chat.py`): wraps the
  `output_format.model_validate_json(content)` call in a recovery branch. On
  Pydantic `json_invalid` / trailing-character errors, tries to pull the
  first balanced `{...}` object out of the response and validate that
  instead. Re-raises the original exception when the patch is disabled or no
  recoverable substring is present.
- **`ChatAnthropic.ainvoke`** (`checkion_agent/llm/anthropic/chat.py`):
  extends the existing string-`_input` recovery branch to use
  `parse_json_with_recovery` (same fallback as OpenAI). Behaviour unchanged
  when `CHECKION_AGENT_TOLERANT_PARSING=0`.

### Removed (caller side, not in the fork)

- `apps/ux-journey-agent/main.py` lost its 300 LOC `_repair_agent_output_dict`,
  `_repair_json_text`, `_repair_tool_calls`, `_repair_ai_message`,
  `_extract_balanced_json_object`, `_message_with_updated_content`,
  `_build_repairing_chat_model_subclass`, `_maybe_wrap_llm_class`,
  `_REPAIR_SUBCLASS_CACHE`, and `_llm_repair_json_enabled`. The
  corresponding env var `UX_JOURNEY_LLM_REPAIR_JSON` is gone too. All of
  that is now part of the library, so plain `Agent(llm=ChatAnthropic(...))`
  works.

### Why a fork patch instead of upstream PR

Upstream `0.12.6` already fixes one slice of this problem space (Anthropic
tool-use `input` with double-serialised string fields, see PR #4529). The
patch in this changelog covers the residual modes still observed in CHECKION
production:

- `action` as a single dict instead of a list (trivially valid AgentOutput
  shape for the model, but rejected by Pydantic strict `list_type`).
- `model_validate_json` from `ChatOpenAI` failing on trailing characters /
  markdown preamble (one extra `}`, code fences, etc.).
- LangChain-shaped `tool_calls[].args` as JSON string — covered indirectly
  via the `AgentOutput.model_validator(mode='before')`.

The patch is intentionally narrow and should be straightforward to submit
back upstream as separate, scoped PRs once we've collected stability data.

### How to verify the patch is active

The agent meta endpoint reports the flag:

```bash
curl http://localhost:8320/health  # or any debug endpoint that surfaces _llm_meta()
# → "tolerantParsing": true
```

Set `CHECKION_AGENT_TOLERANT_PARSING=0` to disable; run a known-failing input
through the agent; you should see Pydantic's stock `list_type` /
`json_invalid` error surface as a `ModelProviderError` (status 502).
