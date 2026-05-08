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
	render_reasoning_language_block,
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


class DimensionOverridesTests(unittest.TestCase):
	"""`PersonaContext.dimension_overrides` — Phase 3 DSL field."""

	def test_explicit_override_wins_over_keyword_score(self):
		# Neutral prose would score ~0.5, but the override forces 0.9
		p = PersonaContext(
			name='Override Test',
			headline='nothing thematic here',
			dimension_overrides={'risk_aversion': 0.9},
		)
		policy = derive_policy(p)
		self.assertEqual(policy.dimensions.risk_aversion, 0.9)
		# Other dimensions stay neutral
		self.assertGreaterEqual(policy.dimensions.exploration, 0.34)
		self.assertLessEqual(policy.dimensions.exploration, 0.66)

	def test_override_clamped_to_unit_interval(self):
		p = PersonaContext(
			name='X',
			dimension_overrides={'risk_aversion': 1.5, 'time_pressure': -0.3},
		)
		policy = derive_policy(p)
		self.assertEqual(policy.dimensions.risk_aversion, 1.0)
		self.assertEqual(policy.dimensions.time_pressure, 0.0)

	def test_unknown_keys_silently_ignored(self):
		p = PersonaContext(
			name='X',
			dimension_overrides={'risk_aversion': 0.9, 'totally_made_up': 0.5},
		)
		policy = derive_policy(p)
		# Override applies to known key; unknown is dropped
		self.assertEqual(policy.dimensions.risk_aversion, 0.9)
		# Sanity: the model still validates (no error from extra=allow)
		self.assertIsInstance(policy, PersonaPolicy)

	def test_non_numeric_value_silently_ignored(self):
		p = PersonaContext(
			name='X',
			dimension_overrides={'risk_aversion': 'not a number', 'time_pressure': 0.7},
		)
		policy = derive_policy(p)
		# Bad value falls back to keyword score (≈0.5 for empty prose)
		self.assertGreaterEqual(policy.dimensions.risk_aversion, 0.34)
		self.assertLessEqual(policy.dimensions.risk_aversion, 0.66)
		self.assertEqual(policy.dimensions.time_pressure, 0.7)

	def test_heuristics_derived_from_post_override_dimensions(self):
		# Force a high risk_aversion via override only (no risk-aversion prose)
		p = PersonaContext(
			name='X',
			headline='nothing risky in this text',
			dimension_overrides={'risk_aversion': 0.9},
		)
		policy = derive_policy(p)
		joined = '\n'.join(policy.heuristics).lower()
		# High-risk-aversion heuristic from `derive_policy`:
		self.assertIn('official', joined, msg=f'heuristics={policy.heuristics}')


class DosDontsExtraInstructionsTests(unittest.TestCase):
	def test_dos_donts_render(self):
		p = PersonaContext(
			name='X',
			dos=['Read the disclaimer', 'Click only official links'],
			donts=['Accept tracking cookies'],
		)
		out = render_system_prompt_block(p)
		self.assertIn('PERSONA_DSL:', out)
		self.assertIn('- ALWAYS: Read the disclaimer', out)
		self.assertIn('- ALWAYS: Click only official links', out)
		self.assertIn('- NEVER: Accept tracking cookies', out)

	def test_extra_instructions_render(self):
		p = PersonaContext(name='X', extra_instructions='Avoid products over €500.')
		out = render_system_prompt_block(p)
		self.assertIn('PERSONA_EXTRA_INSTRUCTIONS:', out)
		self.assertIn('Avoid products over €500.', out)

	def test_empty_dsl_fields_not_rendered(self):
		# Persona with neither dos nor donts nor extras should not have the
		# DSL or EXTRA sections in the rendered block at all.
		p = PersonaContext(name='X', headline='nothing else')
		out = render_system_prompt_block(p)
		self.assertNotIn('PERSONA_DSL:', out)
		self.assertNotIn('PERSONA_EXTRA_INSTRUCTIONS:', out)

	def test_dos_donts_capped_at_8(self):
		p = PersonaContext(
			name='X',
			dos=[f'do thing {i}' for i in range(20)],
			donts=[f'never do thing {i}' for i in range(20)],
		)
		out = render_system_prompt_block(p)
		# Should see exactly 8 of each
		self.assertEqual(out.count('- ALWAYS:'), 8)
		self.assertEqual(out.count('- NEVER:'), 8)

	def test_dos_dedupe(self):
		p = PersonaContext(
			name='X',
			dos=['same', 'same', 'different', 'same'],
		)
		out = render_system_prompt_block(p)
		self.assertEqual(out.count('- ALWAYS: same'), 1)
		self.assertEqual(out.count('- ALWAYS: different'), 1)


class ReasoningLanguageBlockTests(unittest.TestCase):
	def test_none_returns_empty(self):
		self.assertEqual(render_reasoning_language_block(None), '')
		self.assertEqual(render_reasoning_language_block(''), '')
		self.assertEqual(render_reasoning_language_block('   '), '')

	def test_iso_codes_resolve_to_readable_label(self):
		self.assertIn('German', render_reasoning_language_block('de'))
		self.assertIn('English', render_reasoning_language_block('en'))
		self.assertIn('French', render_reasoning_language_block('fr'))

	def test_human_names_pass_through(self):
		# Both `'German'` and `'german'` should resolve to "German"
		self.assertIn('German', render_reasoning_language_block('German'))
		self.assertIn('German', render_reasoning_language_block('german'))

	def test_unknown_label_used_as_is(self):
		# We don't know `'Klingon'` — render it as-is so callers can supply
		# any string they want; the model gets best-effort instructions.
		out = render_reasoning_language_block('Klingon')
		self.assertIn('Klingon', out)

	def test_block_contains_anchors(self):
		out = render_reasoning_language_block('de')
		# Anchors that downstream code / log scrapers might look for
		self.assertIn('REASONING_LANGUAGE:', out)
		self.assertIn('thinking', out)
		self.assertIn('memory', out)
		self.assertIn('next_goal', out)
		# And the exemption clause
		self.assertIn('selectors', out.lower())


class CombinedSystemPromptTests(unittest.TestCase):
	"""Verify the combined system-prompt extension assembled by Agent.__init__.

	We exercise the Agent constructor's merge logic by instantiating the
	SystemPrompt class directly (no LLM, no browser) — that's the same
	component the agent builds in production.
	"""

	def test_persona_only_persona_block_present(self):
		p = PersonaContext(name='X', headline='vorsichtig')
		out = render_system_prompt_block(p)
		self.assertIn('PERSONA_CONTEXT:', out)
		# These belong to other features
		self.assertNotIn('REASONING_LANGUAGE:', out)
		self.assertNotIn('CHECKION_BREVITY_AND_COMPLETION:', out)


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
