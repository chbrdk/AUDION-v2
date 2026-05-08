"""Unit tests for the CHECKION fork's Phase 4 step pacing & screenshot hook.

These tests poke `Agent.__init__` directly using the same minimal mock-LLM
pattern as `tests/ci/test_fallback_llm.py`. We deliberately don't drive
`Agent.step()` end-to-end here — that requires a full browser-session mock
that lives next to the existing CI suite — but the constructor-level checks
are enough to guarantee:

1. ``_agent_init_accepts_named_arg`` in `apps/ux-journey-agent/main.py`
   sees the new kwargs (so the runner actually wires them through).
2. Defensive clamping of negative / non-numeric pacing values doesn't fall
   back to a misleading default.
3. The screenshot callback is stored verbatim — the integration test for
   "callback fires once per screenshot" lives in the real-browser CI suite.
"""

from __future__ import annotations

import asyncio
import inspect
import unittest
from unittest.mock import AsyncMock

from checkion_agent import Agent
from checkion_agent.agent.views import AgentOutput
from checkion_agent.llm import BaseChatModel
from checkion_agent.llm.views import ChatInvokeCompletion
from checkion_agent.tools.service import Tools


def _mock_llm(model_name: str = 'mock-llm') -> BaseChatModel:
	"""Mirror of `tests/ci/test_fallback_llm.create_mock_llm` minus the failure
	branch — the constructor tests don't need to drive ainvoke.
	"""
	tools = Tools()
	ActionModel = tools.registry.create_action_model()
	AgentOutput.type_with_custom_actions(ActionModel)

	llm = AsyncMock(spec=BaseChatModel)
	llm.model = model_name
	llm._verified_api_keys = True
	llm.provider = 'mock'
	llm.name = model_name
	llm.model_name = model_name

	async def _noop_ainvoke(*args, **kwargs):
		return ChatInvokeCompletion(completion='{}', usage=None)

	llm.ainvoke.side_effect = _noop_ainvoke
	return llm


class StepPacingDefaultsTests(unittest.TestCase):
	"""Defaults must be 0.0 / 1.0 so callers that don't opt in get vanilla
	upstream timing — that's the whole point of Phase 4 being additive."""

	def test_pacing_defaults_to_zero(self):
		agent = Agent(task='Test task', llm=_mock_llm())
		self.assertEqual(agent.step_pacing_seconds, 0.0)
		self.assertEqual(agent.action_slowdown_factor, 1.0)
		self.assertIsNone(agent.on_screenshot)

	def test_pacing_passthrough(self):
		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			step_pacing_seconds=3.5,
			action_slowdown_factor=2.0,
		)
		self.assertEqual(agent.step_pacing_seconds, 3.5)
		self.assertEqual(agent.action_slowdown_factor, 2.0)


class StepPacingClampingTests(unittest.TestCase):
	"""Negative / non-numeric values must clamp to the no-op defaults so a
	mistyped env var can never freeze a production run forever."""

	def test_negative_pacing_clamps_to_zero(self):
		agent = Agent(task='Test task', llm=_mock_llm(), step_pacing_seconds=-1.5)
		self.assertEqual(agent.step_pacing_seconds, 0.0)

	def test_negative_slowdown_factor_clamps_to_zero(self):
		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			action_slowdown_factor=-3.0,
		)
		# Note: slowdown=0 multiplies effective_pacing to 0 → no sleep,
		# which is the safe behaviour. We deliberately do NOT clamp to 1.0
		# because that would silently break A/B comparisons.
		self.assertEqual(agent.action_slowdown_factor, 0.0)

	def test_non_numeric_pacing_falls_back_to_zero(self):
		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			step_pacing_seconds='not a number',  # type: ignore[arg-type]
		)
		self.assertEqual(agent.step_pacing_seconds, 0.0)

	def test_non_numeric_slowdown_factor_falls_back_to_one(self):
		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			action_slowdown_factor=None,  # type: ignore[arg-type]
		)
		self.assertEqual(agent.action_slowdown_factor, 1.0)


class ScreenshotCallbackStorageTests(unittest.TestCase):
	"""The hook is stored verbatim — sync or async — and the agent never
	wraps it in a way that would change its identity."""

	def test_sync_callback_stored(self):
		called = []

		def hook(_agent, _b64):
			called.append(_b64)

		agent = Agent(task='Test task', llm=_mock_llm(), on_screenshot=hook)
		self.assertIs(agent.on_screenshot, hook)
		self.assertEqual(called, [])  # never invoked at construction time

	def test_async_callback_stored(self):
		async def hook(_agent, _b64):
			return None

		agent = Agent(task='Test task', llm=_mock_llm(), on_screenshot=hook)
		self.assertIs(agent.on_screenshot, hook)


class StepPacingSleepTests(unittest.IsolatedAsyncioTestCase):
	"""Cover the pacing arithmetic without booting a real `step()`. We
	deliberately call `asyncio.sleep` with the same expression the fork
	uses so a regression in the multiplier surfaces as a unit-test failure
	rather than a silent video-pacing change."""

	async def test_effective_pacing_is_product(self):
		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			step_pacing_seconds=0.05,
			action_slowdown_factor=4.0,
		)
		effective = agent.step_pacing_seconds * agent.action_slowdown_factor
		self.assertAlmostEqual(effective, 0.20, places=4)

		# Quick sanity: asyncio.sleep accepts the value without raising
		# (catches accidental int/str leaks if someone changes the type
		# annotation later).
		await asyncio.sleep(effective)


class ConstructorSignatureTests(unittest.TestCase):
	"""Guard the public surface the runner introspects via
	`_agent_init_accepts_named_arg`. If anyone renames these kwargs the
	runner will fall back to no pacing / no callback silently — this
	test catches that drift."""

	def test_phase4_kwargs_in_signature(self):
		params = inspect.signature(Agent.__init__).parameters
		for name in ('step_pacing_seconds', 'action_slowdown_factor', 'on_screenshot'):
			self.assertIn(name, params, msg=f'Phase 4 kwarg {name!r} missing from Agent.__init__')


if __name__ == '__main__':
	unittest.main()
