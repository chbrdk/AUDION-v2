"""Unit tests for the CHECKION fork's first-class persona support.

Tests focus on the pure-function surface (`derive_policy`,
`render_system_prompt_block`, `PersonaContext.coerce`) that doesn't require
booting the agent / browser stack. The Integration test for ``Agent(persona=...)``
lives next to the agent tests because it pulls in the full LLM mock harness.
"""

from __future__ import annotations

import json
import os
import unittest
from unittest import mock

from checkion_agent.agent.persona import (
	PersonaContext,
	PersonaDimensions,
	PersonaPolicy,
	PersonaProfile,
	derive_policy,
	persona_instructions_enabled,
	render_system_prompt_block,
)


class FeatureFlagTests(unittest.TestCase):
	def test_default_is_enabled(self):
		with mock.patch.dict(os.environ, {}, clear=False):
			os.environ.pop('CHECKION_AGENT_PERSONA_INSTRUCTIONS', None)
			self.assertTrue(persona_instructions_enabled())

	def test_explicit_off_disables(self):
		with mock.patch.dict(os.environ, {'CHECKION_AGENT_PERSONA_INSTRUCTIONS': '0'}):
			self.assertFalse(persona_instructions_enabled())

	def test_truthy_aliases(self):
		for v in ('1', 'true', 'yes', 'on', 'TRUE'):
			with mock.patch.dict(os.environ, {'CHECKION_AGENT_PERSONA_INSTRUCTIONS': v}):
				self.assertTrue(persona_instructions_enabled(), msg=f'{v!r} should be truthy')


class PersonaContextCoerceTests(unittest.TestCase):
	def test_none_returns_none(self):
		self.assertIsNone(PersonaContext.coerce(None))
		self.assertIsNone(PersonaContext.coerce({}))  # empty dict → empty model, but coerce returns it

	def test_passthrough_for_existing_instance(self):
		p = PersonaContext(name='Alice')
		self.assertIs(PersonaContext.coerce(p), p)

	def test_dict_with_camelcase_aliases(self):
		raw = {
			'id': 'persona-1',
			'name': 'Bob',
			'headline': 'Skeptical buyer',
			'systemPrompt': 'You are a skeptical buyer.',
			'profile': {
				'bio': 'cautious shopper',
				'painPoints': ['unclear pricing'],
				'communicationStyle': {'tone': 'formal'},
			},
		}
		p = PersonaContext.coerce(raw)
		self.assertIsNotNone(p)
		assert p is not None  # for type narrowing
		self.assertEqual(p.id, 'persona-1')
		self.assertEqual(p.system_prompt, 'You are a skeptical buyer.')
		self.assertEqual(p.profile.pain_points, ['unclear pricing'])  # type: ignore[union-attr]

	def test_unknown_type_returns_none(self):
		self.assertIsNone(PersonaContext.coerce(42))
		self.assertIsNone(PersonaContext.coerce('a string'))
		self.assertIsNone(PersonaContext.coerce(['list']))


class DerivePolicyTests(unittest.TestCase):
	"""`derive_policy` is the deterministic keyword-scoring."""

	def test_none_yields_neutral(self):
		policy = derive_policy(None)
		self.assertEqual(policy.dimensions, PersonaDimensions())  # all 0.5
		self.assertEqual(policy.heuristics, [])

	def test_strong_risk_aversion(self):
		p = PersonaContext(
			name='Vorsichtige Maria',
			headline='vorsichtige skeptische datenschutz-bewusste Käuferin',
			profile=PersonaProfile(
				bio='Sehr genau, gründlich, sicherheit über alles, privacy-first, misstrauisch'
			),
		)
		policy = derive_policy(p)
		self.assertGreaterEqual(policy.dimensions.risk_aversion, 0.66)
		# Heuristics for high risk-aversion include the official-nav rule
		joined = '\n'.join(policy.heuristics).lower()
		self.assertIn('official', joined)

	def test_strong_time_pressure(self):
		p = PersonaContext(
			name='Eilige Lisa',
			headline='Will alles schnell, dringend, sofort, kurz',
			profile=PersonaProfile(bio='effizient, fast, quick, zeitdruck'),
		)
		policy = derive_policy(p)
		self.assertGreaterEqual(policy.dimensions.time_pressure, 0.66)

	def test_neutral_persona_has_neutral_dimensions(self):
		# Plain English text without any of the scoring keywords → all 0.5
		p = PersonaContext(name='John', headline='An average person')
		policy = derive_policy(p)
		# Allow slight drift but expect all dims clearly in the neutral range
		for k in (
			'risk_aversion',
			'time_pressure',
			'exploration',
			'detail_orientation',
			'trust_skepticism',
			'accessibility_need',
		):
			val = getattr(policy.dimensions, k)
			self.assertGreaterEqual(val, 0.34, msg=f'{k}={val} drifted too low')
			self.assertLessEqual(val, 0.66, msg=f'{k}={val} drifted too high')

	def test_dimensions_are_rounded_to_2_dp(self):
		p = PersonaContext(name='X', headline='vorsichtig schnell neugierig')
		policy = derive_policy(p)
		for k in (
			'risk_aversion',
			'time_pressure',
			'exploration',
			'detail_orientation',
			'trust_skepticism',
			'accessibility_need',
		):
			val = getattr(policy.dimensions, k)
			self.assertEqual(round(val, 2), val, msg=f'{k} not rounded: {val}')

	def test_heuristics_capped(self):
		# Even an absolute-extreme persona shouldn't blow past the 12-heuristic cap
		p = PersonaContext(
			name='Extrem',
			headline='vorsichtig sicher schnell dringend neugierig entdecken detail zahlen skept nachweis barriere screenreader',
		)
		policy = derive_policy(p)
		self.assertLessEqual(len(policy.heuristics), 12)


class RenderSystemPromptBlockTests(unittest.TestCase):
	def test_none_yields_empty(self):
		self.assertEqual(render_system_prompt_block(None), '')

	def test_disabled_yields_empty(self):
		p = PersonaContext(name='Alice', headline='careful')
		with mock.patch.dict(os.environ, {'CHECKION_AGENT_PERSONA_INSTRUCTIONS': '0'}):
			self.assertEqual(render_system_prompt_block(p), '')

	def test_render_contains_required_sections(self):
		p = PersonaContext(
			id='persona-1',
			name='Alice',
			headline='Skeptical buyer',
			system_prompt='You are skeptical.',
			profile=PersonaProfile(bio='careful'),
		)
		out = render_system_prompt_block(p)
		# Anchors that downstream prompts / templates / log scrapers might look for
		self.assertIn('PERSONA_CONTEXT:', out)
		self.assertIn('- id: persona-1', out)
		self.assertIn('- name: Alice', out)
		self.assertIn('- headline: Skeptical buyer', out)
		self.assertIn('- systemPrompt: You are skeptical.', out)
		self.assertIn('PERSONA_BEHAVIOR_POLICY:', out)
		self.assertIn('- dimensions:', out)
		self.assertIn('INSTRUCTION:', out)

	def test_profile_serialised_with_camelcase_aliases(self):
		p = PersonaContext(
			id='p',
			name='Alice',
			profile=PersonaProfile(pain_points=['a', 'b'], communication_style={'tone': 't'}),
		)
		out = render_system_prompt_block(p)
		# We dump the profile with `by_alias=True`, so the rendered JSON uses
		# camelCase — matters for prompt stability across upstream consumers.
		self.assertIn('"painPoints"', out)
		self.assertIn('"communicationStyle"', out)
		# Parsing the rendered JSON back gives us the original values
		json_line = next((ln for ln in out.split('\n') if ln.startswith('- profile:')), None)
		self.assertIsNotNone(json_line)
		assert json_line is not None
		profile_json = json_line.removeprefix('- profile:').strip()
		parsed = json.loads(profile_json)
		self.assertEqual(parsed['painPoints'], ['a', 'b'])

	def test_empty_persona_skipped_fields(self):
		# Truly empty PersonaContext: only the headers + neutral policy
		p = PersonaContext()
		out = render_system_prompt_block(p)
		self.assertIn('PERSONA_CONTEXT:', out)
		self.assertNotIn('- id:', out)
		self.assertNotIn('- name:', out)
		self.assertNotIn('- headline:', out)

	def test_systemPrompt_is_truncated(self):
		# Renderer caps at 2000 chars to keep the block cacheable
		long_prompt = 'X' * 5000
		p = PersonaContext(name='X', system_prompt=long_prompt)
		out = render_system_prompt_block(p)
		# Find the exact truncated value. We can't assert on the exact length
		# of the line because there's leading "- systemPrompt: ", but we can
		# bound it.
		line = next((ln for ln in out.split('\n') if ln.startswith('- systemPrompt:')), '')
		self.assertLessEqual(len(line), 2050)  # 2000 + small prefix budget
		# And no extra trailing X past the truncation
		x_count = line.count('X')
		self.assertEqual(x_count, 2000, msg=f'truncation off: {x_count} X chars')


class PolicyModelDumpTests(unittest.TestCase):
	"""Round-trip the typed policy through `model_dump` so callers can
	serialise it for telemetry / API responses."""

	def test_neutral_policy_dump(self):
		p = PersonaPolicy(dimensions=PersonaDimensions())
		dumped = p.model_dump()
		self.assertEqual(dumped['dimensions']['risk_aversion'], 0.5)
		self.assertEqual(dumped['heuristics'], [])

	def test_derived_policy_dump_roundtrip(self):
		persona = PersonaContext(
			name='X',
			headline='vorsichtig skeptisch',
		)
		policy = derive_policy(persona)
		dumped = policy.model_dump()
		# Re-parsing should yield an equal policy
		round_tripped = PersonaPolicy(**dumped)
		self.assertEqual(round_tripped.dimensions, policy.dimensions)
		self.assertEqual(round_tripped.heuristics, policy.heuristics)


if __name__ == '__main__':
	unittest.main()
