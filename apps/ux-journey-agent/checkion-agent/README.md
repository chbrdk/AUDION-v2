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

- **Phase B (this commit):** Mechanical rename `browser_use` → `checkion_agent`.
  No behavior changes. Code is byte-for-byte identical to upstream `0.12.6`
  except for the package import path. License and copyright headers are
  preserved.

- **Phase 1 (planned):** Tolerant `AgentOutput` validators for known model
  failure modes (`action`-as-string, trailing chars). Replaces the
  `_repair_*` wrapper currently in `apps/ux-journey-agent/main.py`.

- **Phase 2 (planned):** First-class hooks — `Agent(persona=...)`,
  `Agent(on_step_screenshot=...)`, `Agent(action_slowdown_factor=N)`.

- **Phase 3 (planned):** Persona-DSL, German-reasoning prompts as built-in,
  structured logging.

See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for upstream rebase notes.
