# Attribution

`checkion-agent` is a soft fork of [browser-use](https://github.com/browser-use/browser-use)
at tag **`0.12.6`** (commit `329c67f069427e928ff81ad52415efdca7692007`,
released 2026-04-02 by Browser-Use, Inc.).

## License

The original code is licensed under the MIT License, **Copyright (c) 2024
Gregor Zunic**. The full original license text is preserved in [`LICENSE`](./LICENSE)
and applies to all source files derived from upstream.

Modifications made by CHECKION are released under the same MIT License.

## Why a fork?

We need first-class control over a small number of behaviors that the upstream
agent intentionally generalises across many use-cases:

1. **Tolerant `AgentOutput` validators** — robust against `action`-as-string
   serializations and trailing-character JSON quirks from a wider model matrix
   than upstream targets.
2. **Persona-as-first-class** — instead of stringifying a persona context into
   the task prompt, treat it as a typed input that drives system-prompt
   construction and tool descriptions.
3. **Recording / live-frame hooks** — exposed as official extension points so
   our slow-motion + live-stream pipeline doesn't have to monkey-patch the
   browser session.
4. **Cross-provider fallback** — sharper guarantees about when the fallback
   actually fires (failed validations, not only HTTP errors), and clearer
   logging.
5. **German reasoning + brevity policy** — built into the system prompt
   instead of injected via long German user-message preambles.

These changes are tracked in `CHANGELOG.md`. PRs that make sense for the
broader upstream community will be submitted back as separate patches.

## Tracking upstream

Upstream releases are watched at <https://github.com/browser-use/browser-use/releases>.
Periodic rebase cadence: roughly every 2-3 upstream minor versions, or sooner
if a security advisory requires it.

When rebasing:

1. Clone upstream tag at the new version into a temporary directory.
2. `diff -u` against `apps/ux-journey-agent/checkion-agent/checkion_agent/`
   to spot upstream changes.
3. Re-apply local patches (see `CHANGELOG.md` for the full list).
4. Run the full agent test suite from `apps/ux-journey-agent/` against the
   updated package.

## Original upstream metadata

The unmodified upstream README is preserved at [`UPSTREAM_README.md`](./UPSTREAM_README.md)
for reference. Everything in [`LICENSE`](./LICENSE) is verbatim from upstream.
