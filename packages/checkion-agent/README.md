# checkion-agent

CHECKION-internal browser-automation library used by `apps/ux-journey-agent/`.
Soft fork of upstream [browser-use](https://github.com/browser-use/browser-use)
at tag `0.12.6`.

> See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for the rationale behind the fork
> and the upstream tracking strategy.

## Install (development, editable from monorepo)

`apps/ux-journey-agent/requirements.txt` references this package via a relative
path:

```
checkion-agent[video] @ file://./../../packages/checkion-agent
```

So a normal `pip install -r requirements.txt` from the agent's directory
installs the local source.

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
