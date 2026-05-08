# Changelog (CHECKION fork)

This file tracks changes made by CHECKION on top of the upstream
[browser-use](https://github.com/browser-use/browser-use) base. Each entry
identifies the upstream baseline it was applied against so the fork can be
rebased cleanly.

The version numbers follow the pattern `<upstream>+checkion.<patch>` (e.g.
`0.12.6+checkion.1`). Bumping the upstream baseline resets the patch counter.

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
