"""Tolerant parsing helpers for AgentOutput JSON / dict payloads.

CHECKION-fork patch (vs. upstream browser-use 0.12.6).

These helpers are used by:

1. ``checkion_agent.agent.views.AgentOutput`` — a ``model_validator(mode='before')``
   that coerces ``action`` from a JSON-encoded string or a single dict back into
   the ``list[ActionModel]`` that the agent expects.
2. ``checkion_agent.llm.openai.chat`` — an opt-in recovery branch around
   ``output_format.model_validate_json(...)`` that extracts the first balanced
   ``{...}`` object when the model emits trailing characters / markdown
   preamble.

Both behaviours are gated by ``CHECKION_AGENT_TOLERANT_PARSING`` (env var,
default **on**). Set ``=0`` to get strictly upstream-equivalent behaviour for
A/B comparison.

Why a fork patch instead of upstream PR? Upstream browser-use 0.12.6 only
fixes one slice of the problem space (Anthropic tool-use ``input`` with
double-serialized string fields). Production runs in CHECKION still encounter
``action`` returned as a single dict, ``model_validate_json`` failing on
trailing characters, and LangChain-shaped ``tool_calls[].args`` with a JSON
string. We carry these as a single coherent patch and will submit them
upstream as separate, scoped PRs once stable.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def tolerant_parsing_enabled() -> bool:
	"""Toggle for the CHECKION tolerant-parsing patch.

	Default: ``1`` (enabled). Set ``CHECKION_AGENT_TOLERANT_PARSING=0`` to fall
	back to strict upstream behaviour — useful for benchmarking the patch
	against vanilla browser-use 0.12.6 or for triaging whether a model failure
	is masked by the patch.
	"""
	v = (os.environ.get('CHECKION_AGENT_TOLERANT_PARSING') or '1').strip().lower()
	return v in ('1', 'true', 'yes', 'on')


def extract_balanced_json_object(text: str) -> str | None:
	"""Return the first top-level ``{ ... }`` substring with balanced braces.

	Respects JSON double-quoted strings (so braces inside string literals are
	ignored). Returns ``None`` if no balanced object is found.

	This is the recovery for two failure modes:

	- **Markdown preamble**: model emits ``Here is the JSON:\\n\\n```json\\n{...}```\\n``
	  before the actual object.
	- **Trailing characters**: model emits a valid object followed by stray
	  closing braces, commentary, etc.

	Both pass strict ``json.loads`` tests on the *substring*, so we slice it
	out and re-parse just that.
	"""
	start = text.find('{')
	if start < 0:
		return None
	depth = 0
	in_str = False
	esc = False
	i = start
	n = len(text)
	while i < n:
		c = text[i]
		if in_str:
			if esc:
				esc = False
			elif c == '\\':
				esc = True
			elif c == '"':
				in_str = False
			i += 1
			continue
		if c == '"':
			in_str = True
		elif c == '{':
			depth += 1
		elif c == '}':
			depth -= 1
			if depth == 0:
				return text[start : i + 1]
		i += 1
	return None


def coerce_action_field(d: dict[str, Any]) -> dict[str, Any]:
	"""Normalise the ``action`` field of an AgentOutput dict.

	Handles the three production failure modes we've seen across model
	providers (Claude Sonnet 4.6, GPT-5.4-mini, GPT-4o on edge cases):

	1. ``action`` is a JSON-encoded *string* containing a list:
	   ``'[{"done": ...}]'`` → parsed ``list``.
	2. ``action`` is a JSON-encoded *string* containing a single dict:
	   ``'{"done": ...}'`` → ``[parsed_dict]``.
	3. ``action`` is a single ``dict`` not wrapped in a list:
	   ``{"done": ...}`` → ``[dict]``.

	The function returns a *new* dict; the input is not mutated. If ``action``
	is already a list (the canonical shape) or anything we can't interpret,
	the input is returned unchanged so the standard Pydantic validator can
	produce its normal error message.
	"""
	out: dict[str, Any] = dict(d)
	act = out.get('action')

	if isinstance(act, str):
		t = act.strip()
		if t.startswith('['):
			try:
				parsed = json.loads(t)
			except (json.JSONDecodeError, TypeError, ValueError):
				return out
			if isinstance(parsed, list):
				out['action'] = parsed
				logger.debug('checkion_agent: tolerant_parsing: coerced action(str) -> list (items=%d)', len(parsed))
		elif t.startswith('{'):
			try:
				parsed = json.loads(t)
			except (json.JSONDecodeError, TypeError, ValueError):
				return out
			if isinstance(parsed, dict):
				out['action'] = [parsed]
				logger.debug('checkion_agent: tolerant_parsing: coerced action(str-dict) -> [dict]')
	elif isinstance(act, dict):
		out['action'] = [act]
		logger.debug('checkion_agent: tolerant_parsing: coerced action(dict) -> [dict]')

	return out


def parse_json_with_recovery(text: str) -> dict[str, Any] | None:
	"""Best-effort parse of a model-emitted JSON object.

	Tries strict ``json.loads`` first; on failure, falls back to extracting
	the first balanced ``{...}`` block and parsing that (handles preamble,
	trailing characters, code fences). Returns ``None`` if no valid object
	can be recovered — caller is expected to surface the original parse error
	in that case so the operator sees an honest failure.
	"""
	if not text:
		return None
	s = text.strip()
	if s.startswith('{'):
		try:
			obj = json.loads(s)
		except json.JSONDecodeError:
			obj = None
		if isinstance(obj, dict):
			return obj
	chunk = extract_balanced_json_object(s)
	if not chunk:
		return None
	try:
		obj = json.loads(chunk)
	except (json.JSONDecodeError, TypeError, ValueError):
		return None
	if isinstance(obj, dict):
		return obj
	return None
