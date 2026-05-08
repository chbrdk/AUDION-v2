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

- **Phase 3 (planned):** Persona-DSL, German-reasoning prompts as built-in,
  structured logging.

See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for upstream rebase notes.
