"""Unit tests for the CHECKION fork's tolerant-parsing helpers.

Tests are intentionally self-contained — they exercise the pure-Python helpers
in `checkion_agent.agent._tolerant_parsing` without booting the full Agent /
LLM provider stack. That keeps the suite fast and means the tests run cleanly
without API keys, Playwright, or network access.

Covered failure modes (all observed in production against Claude Sonnet 4.6,
GPT-5.4-mini, GPT-4o):

1. ``action`` is a JSON-encoded *string* containing a list of action dicts
2. ``action`` is a JSON-encoded *string* containing a single dict
3. ``action`` is a single dict (not wrapped in a list)
4. JSON response with trailing characters after the closing brace
5. JSON response wrapped in markdown code fences / preamble
6. The kill-switch ``CHECKION_AGENT_TOLERANT_PARSING=0`` disables coercion
"""

from __future__ import annotations

import json
import os
import unittest
from unittest import mock

from checkion_agent.agent._tolerant_parsing import (
	coerce_action_field,
	extract_balanced_json_object,
	parse_json_with_recovery,
	tolerant_parsing_enabled,
)


class ToleranceFlagTests(unittest.TestCase):
	"""`CHECKION_AGENT_TOLERANT_PARSING` env-flag semantics."""

	def test_default_is_enabled(self):
		with mock.patch.dict(os.environ, {}, clear=False):
			os.environ.pop('CHECKION_AGENT_TOLERANT_PARSING', None)
			self.assertTrue(tolerant_parsing_enabled())

	def test_explicit_off_disables(self):
		with mock.patch.dict(os.environ, {'CHECKION_AGENT_TOLERANT_PARSING': '0'}):
			self.assertFalse(tolerant_parsing_enabled())

	def test_truthy_aliases(self):
		for v in ('1', 'true', 'yes', 'on', 'TRUE', 'On'):
			with mock.patch.dict(os.environ, {'CHECKION_AGENT_TOLERANT_PARSING': v}):
				self.assertTrue(tolerant_parsing_enabled(), msg=f'{v!r} should be truthy')

	def test_falsy_aliases(self):
		for v in ('0', 'false', 'no', 'off', ''):
			with mock.patch.dict(os.environ, {'CHECKION_AGENT_TOLERANT_PARSING': v}):
				self.assertFalse(tolerant_parsing_enabled(), msg=f'{v!r} should be falsy')


class ExtractBalancedJsonObjectTests(unittest.TestCase):
	"""`extract_balanced_json_object` slices the first balanced `{...}` substring."""

	def test_clean_object_passes_through(self):
		s = '{"a": 1, "b": [2, 3]}'
		self.assertEqual(extract_balanced_json_object(s), s)

	def test_with_trailing_characters(self):
		s = '{"a": 1}}}'
		self.assertEqual(extract_balanced_json_object(s), '{"a": 1}')

	def test_with_markdown_preamble(self):
		s = 'Here is the JSON:\n```json\n{"action": []}\n```'
		self.assertEqual(extract_balanced_json_object(s), '{"action": []}')

	def test_braces_inside_strings_are_ignored(self):
		s = '{"action": "[ pretend list ]", "real": [{"k": "v"}]}'
		self.assertEqual(extract_balanced_json_object(s), s)

	def test_escaped_quotes_in_strings(self):
		s = r'{"a": "He said \"hi\"", "b": 1}'
		self.assertEqual(extract_balanced_json_object(s), s)

	def test_no_object_returns_none(self):
		self.assertIsNone(extract_balanced_json_object(''))
		self.assertIsNone(extract_balanced_json_object('plain text without braces'))

	def test_unbalanced_returns_none(self):
		self.assertIsNone(extract_balanced_json_object('{"a": 1'))


class CoerceActionFieldTests(unittest.TestCase):
	"""`coerce_action_field` normalises the production failure modes for ``action``."""

	def test_canonical_list_passes_through(self):
		d = {'action': [{'click': {'index': 1}}]}
		self.assertEqual(coerce_action_field(d), d)

	def test_action_as_string_list(self):
		raw = '[{"click": {"index": 1}}, {"scroll": {"down": true}}]'
		out = coerce_action_field({'action': raw})
		self.assertEqual(
			out['action'],
			[{'click': {'index': 1}}, {'scroll': {'down': True}}],
		)

	def test_action_as_string_dict(self):
		raw = '{"done": {"text": "all good", "success": true}}'
		out = coerce_action_field({'action': raw})
		self.assertEqual(out['action'], [{'done': {'text': 'all good', 'success': True}}])

	def test_action_as_single_dict(self):
		out = coerce_action_field({'action': {'click': {'index': 5}}})
		self.assertEqual(out['action'], [{'click': {'index': 5}}])

	def test_invalid_string_left_alone(self):
		# Random gibberish: we leave it untouched so the standard Pydantic
		# validator can produce its normal error.
		out = coerce_action_field({'action': 'this is not json at all'})
		self.assertEqual(out['action'], 'this is not json at all')

	def test_other_fields_preserved(self):
		out = coerce_action_field(
			{
				'thinking': 'foo',
				'memory': 'bar',
				'next_goal': 'baz',
				'action': {'done': {}},
			}
		)
		self.assertEqual(out['thinking'], 'foo')
		self.assertEqual(out['memory'], 'bar')
		self.assertEqual(out['next_goal'], 'baz')
		self.assertEqual(out['action'], [{'done': {}}])

	def test_input_dict_not_mutated(self):
		original = {'action': {'click': {'index': 1}}}
		_ = coerce_action_field(original)
		# The function returns a new dict, not a mutation.
		self.assertEqual(original, {'action': {'click': {'index': 1}}})


class ParseJsonWithRecoveryTests(unittest.TestCase):
	"""`parse_json_with_recovery` glues `extract_balanced_json_object` + `json.loads`."""

	def test_clean_json(self):
		self.assertEqual(parse_json_with_recovery('{"a": 1}'), {'a': 1})

	def test_trailing_characters(self):
		self.assertEqual(parse_json_with_recovery('{"a": 1}\n\n}'), {'a': 1})

	def test_markdown_fence(self):
		s = '```json\n{"action": [{"click": 1}]}\n```'
		self.assertEqual(parse_json_with_recovery(s), {'action': [{'click': 1}]})

	def test_empty_returns_none(self):
		self.assertIsNone(parse_json_with_recovery(''))

	def test_no_json_returns_none(self):
		self.assertIsNone(parse_json_with_recovery('totally not json'))

	def test_array_top_level_returns_none(self):
		# We only recover top-level *objects* (AgentOutput is a dict).
		self.assertIsNone(parse_json_with_recovery('[1, 2, 3]'))


class IntegrationWithAgentOutputTests(unittest.TestCase):
	"""End-to-end: the `model_validator` on AgentOutput uses `coerce_action_field`.

	This is the test that proves the patch survives a full Pydantic
	round-trip via the dynamically-built ``AgentOutput`` subclass that
	browser-use uses at runtime (via ``type_with_custom_actions``).
	"""

	def _make_agent_output_class(self):
		from pydantic import BaseModel

		from checkion_agent.agent.views import AgentOutput
		from checkion_agent.tools.registry.views import ActionModel

		# Minimal action shape the strict validator will accept.
		class _DoneAction(BaseModel):
			text: str
			success: bool

		class _CustomActions(ActionModel):
			done: _DoneAction | None = None

		return AgentOutput.type_with_custom_actions(_CustomActions)

	def test_action_string_list_validates(self):
		Cls = self._make_agent_output_class()
		raw = {
			'evaluation_previous_goal': 'ok',
			'memory': 'm',
			'next_goal': 'g',
			'action': json.dumps([{'done': {'text': 'finished', 'success': True}}]),
		}
		obj = Cls.model_validate(raw)
		self.assertEqual(len(obj.action), 1)

	def test_action_single_dict_validates(self):
		Cls = self._make_agent_output_class()
		raw = {
			'evaluation_previous_goal': 'ok',
			'memory': 'm',
			'next_goal': 'g',
			'action': {'done': {'text': 'finished', 'success': True}},
		}
		obj = Cls.model_validate(raw)
		self.assertEqual(len(obj.action), 1)

	def test_strict_mode_rejects_string_list(self):
		# Kill-switch: with the patch disabled, the standard list_type
		# validator must surface the original error. This guards against the
		# patch silently masking a real upstream change in behaviour.
		from pydantic import ValidationError

		Cls = self._make_agent_output_class()
		raw = {
			'evaluation_previous_goal': 'ok',
			'memory': 'm',
			'next_goal': 'g',
			'action': json.dumps([{'done': {'text': 't', 'success': True}}]),
		}
		with mock.patch.dict(os.environ, {'CHECKION_AGENT_TOLERANT_PARSING': '0'}):
			with self.assertRaises(ValidationError):
				Cls.model_validate(raw)


if __name__ == '__main__':
	unittest.main()
