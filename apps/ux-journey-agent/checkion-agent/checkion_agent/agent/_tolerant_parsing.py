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


def _lenient_json_loads(text: str) -> Any | None:
	"""Try increasingly tolerant strategies to parse model-emitted JSON.

	Models frequently emit *structurally* valid JSON whose **string values**
	contain raw control characters (literal ``\\n``, ``\\r``, ``\\t``) or stray
	``"``. Strict ``json.loads`` rejects these even though the intent is
	obvious. We try, in order:

	1. Strict ``json.loads`` (the happy path).
	2. ``json.loads`` after escaping the three most common control chars as
	   their JSON escape sequences. Catches ~95% of the breakage in practice
	   (any production model that mid-emits a multi-line markdown text).
	3. ``json.loads`` with ``strict=False`` — accepts literal control chars
	   inside strings as a last resort. Has been part of the Python stdlib
	   since 3.0 but is less well-known than ``loads(strict=True)`` (the
	   default).

	Returns ``None`` on total failure. Returns the parsed object (list or
	dict) otherwise.
	"""
	try:
		return json.loads(text)
	except (json.JSONDecodeError, TypeError, ValueError):
		pass
	cleaned = text.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
	try:
		return json.loads(cleaned)
	except (json.JSONDecodeError, TypeError, ValueError):
		pass
	# `strict=False`: stdlib JSON accepts unescaped \t/\n/\r inside strings
	# (it does NOT silence other JSON syntax errors — quotes still need to be
	# closed, brackets balanced, etc.). This is the best-effort last attempt
	# before we report the error upstream.
	try:
		return json.loads(text, strict=False)
	except (json.JSONDecodeError, TypeError, ValueError):
		pass
	return None


def coerce_action_field(d: dict[str, Any]) -> dict[str, Any]:
	"""Normalise the ``action`` field of an AgentOutput dict.

	Handles the four production failure modes we've seen across model
	providers (Claude Sonnet 4.6, GPT-5.4-mini, GPT-4o on edge cases):

	1. ``action`` is a JSON-encoded *string* containing a list:
	   ``'[{"done": ...}]'`` → parsed ``list``.
	2. ``action`` is a JSON-encoded *string* containing a single dict:
	   ``'{"done": ...}'`` → ``[parsed_dict]``.
	3. ``action`` is a single ``dict`` not wrapped in a list:
	   ``{"done": ...}`` → ``[dict]``.
	4. ``action`` is a JSON-encoded string but the *inner* JSON has raw
	   ``\\n`` / ``\\t`` / ``\\r`` inside string values (typical when the
	   model writes multi-line markdown into a ``done.text`` field). The
	   string is structurally a list/dict but ``json.loads(strict=True)``
	   refuses it. Handled by ``_lenient_json_loads``'s control-char
	   escaping pass.

	The function returns a *new* dict; the input is not mutated. If ``action``
	is already a list (the canonical shape) or anything we can't interpret,
	the input is returned unchanged so the standard Pydantic validator can
	produce its normal error message. Any *attempted-but-failed* coercion
	emits a WARNING log so the operator sees why the validator falls through
	to the upstream error path.
	"""
	out: dict[str, Any] = dict(d)
	act = out.get('action')

	if isinstance(act, str):
		t = act.strip()
		if t.startswith('['):
			parsed = _lenient_json_loads(t)
			if isinstance(parsed, list):
				out['action'] = parsed
				logger.debug(
					'checkion_agent: tolerant_parsing: coerced action(str) -> list (items=%d)',
					len(parsed),
				)
			else:
				logger.warning(
					'checkion_agent: tolerant_parsing: action(str) starts with [ but json parse failed; '
					'leaving as string for upstream validator. preview=%r',
					t[:120],
				)
		elif t.startswith('{'):
			parsed = _lenient_json_loads(t)
			if isinstance(parsed, dict):
				out['action'] = [parsed]
				logger.debug('checkion_agent: tolerant_parsing: coerced action(str-dict) -> [dict]')
			else:
				logger.warning(
					'checkion_agent: tolerant_parsing: action(str) starts with { but json parse failed; '
					'leaving as string for upstream validator. preview=%r',
					t[:120],
				)
	elif isinstance(act, dict):
		out['action'] = [act]
		logger.debug('checkion_agent: tolerant_parsing: coerced action(dict) -> [dict]')

	return out


def parse_json_with_recovery(text: str) -> dict[str, Any] | None:
	"""Best-effort parse of a model-emitted JSON object.

	Tries strict ``json.loads`` first; on failure, falls back to extracting
	the first balanced ``{...}`` block and parsing that (handles preamble,
	trailing characters, code fences). Both passes go through
	``_lenient_json_loads`` so they tolerate raw control characters inside
	string values. Returns ``None`` if no valid object can be recovered —
	caller is expected to surface the original parse error in that case so
	the operator sees an honest failure.
	"""
	if not text:
		return None
	s = text.strip()
	if s.startswith('{'):
		obj = _lenient_json_loads(s)
		if isinstance(obj, dict):
			return obj
	chunk = extract_balanced_json_object(s)
	if not chunk:
		return None
	obj = _lenient_json_loads(chunk)
	if isinstance(obj, dict):
		return obj
	return None
