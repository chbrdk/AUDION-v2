# Changelog (CHECKION fork)

This file tracks changes made by CHECKION on top of the upstream
[browser-use](https://github.com/browser-use/browser-use) base. Each entry
identifies the upstream baseline it was applied against so the fork can be
rebased cleanly.

The version numbers follow the pattern `<upstream>+checkion.<patch>` (e.g.
`0.12.6+checkion.1`). Bumping the upstream baseline resets the patch counter.

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
