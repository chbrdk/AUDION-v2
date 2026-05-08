"""Unit tests for the CHECKION fork's Phase 6 per-action hooks.

Same minimal mock-LLM pattern as `test_phase4_hooks.py`. The constructor-level
checks here guarantee:

1. ``_agent_init_accepts_named_arg`` in `apps/ux-journey-agent/main.py` sees
   ``on_action_start`` / ``on_action_end`` (the runner relies on this to
   either pass the kwarg or fall back to a late-attribute-set wireup).
2. Hooks are stored verbatim — sync and async bodies — and the agent never
   wraps them in a way that would change their identity.
3. The internal ``_fire_action_hook`` dispatcher swallows hook exceptions
   without breaking the run, mirrors `on_screenshot`'s contract, and
   propagates ``asyncio.CancelledError`` so a hot-cancel still works.

The end-to-end "hook fires N times during a multi_act loop" path lives in
the real-browser CI suite (`tests/ci/test_multi_act_guards.py` is the
right neighbour) — too much mocking to replicate it here.
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


class ActionHookDefaultsTests(unittest.TestCase):
	def test_defaults_to_none(self):
		agent = Agent(task='Test task', llm=_mock_llm())
		self.assertIsNone(agent.on_action_start)
		self.assertIsNone(agent.on_action_end)


class ActionHookStorageTests(unittest.TestCase):
	def test_sync_hooks_stored(self):
		def starthook(_a, _name, _params):
			return None

		def endhook(_a, _name, _params, _result):
			return None

		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			on_action_start=starthook,
			on_action_end=endhook,
		)
		self.assertIs(agent.on_action_start, starthook)
		self.assertIs(agent.on_action_end, endhook)

	def test_async_hooks_stored(self):
		async def starthook(_a, _name, _params):
			return None

		async def endhook(_a, _name, _params, _result):
			return None

		agent = Agent(
			task='Test task',
			llm=_mock_llm(),
			on_action_start=starthook,
			on_action_end=endhook,
		)
		self.assertIs(agent.on_action_start, starthook)
		self.assertIs(agent.on_action_end, endhook)


class FireActionHookDispatcherTests(unittest.IsolatedAsyncioTestCase):
	"""Cover `_fire_action_hook` directly. This is the only piece of new
	logic between `multi_act` and the user-supplied hook — making sure it
	survives sync / async / raising / cancelling hooks is the whole point
	of the test."""

	async def test_none_is_no_op(self):
		agent = Agent(task='Test task', llm=_mock_llm())
		# Should not raise; nothing to assert beyond "it returned cleanly".
		await agent._fire_action_hook(None, 'click', {'index': 1})

	async def test_sync_hook_invoked(self):
		calls: list[tuple] = []

		def hook(*args):
			calls.append(args)

		agent = Agent(task='Test task', llm=_mock_llm())
		await agent._fire_action_hook(hook, agent, 'click', {'index': 1})
		self.assertEqual(len(calls), 1)
		self.assertEqual(calls[0][1], 'click')
		self.assertEqual(calls[0][2], {'index': 1})

	async def test_async_hook_invoked(self):
		calls: list[tuple] = []

		async def hook(*args):
			calls.append(args)

		agent = Agent(task='Test task', llm=_mock_llm())
		await agent._fire_action_hook(hook, agent, 'scroll', {'down': True})
		self.assertEqual(len(calls), 1)
		self.assertEqual(calls[0][1], 'scroll')

	async def test_hook_exception_is_swallowed(self):
		def hook(*_args):
			raise RuntimeError('boom')

		agent = Agent(task='Test task', llm=_mock_llm())
		# No assertion needed — if the exception leaked, the test would
		# fail with the original RuntimeError.
		await agent._fire_action_hook(hook, agent, 'click', {})

	async def test_async_hook_exception_is_swallowed(self):
		async def hook(*_args):
			raise RuntimeError('async boom')

		agent = Agent(task='Test task', llm=_mock_llm())
		await agent._fire_action_hook(hook, agent, 'click', {})

	async def test_cancelled_error_propagates(self):
		"""asyncio.CancelledError must propagate so a `task.cancel()` on a
		hot run still interrupts the in-flight hook (matches Phase 4's
		`on_screenshot` contract)."""

		async def hook(*_args):
			raise asyncio.CancelledError()

		agent = Agent(task='Test task', llm=_mock_llm())
		with self.assertRaises(asyncio.CancelledError):
			await agent._fire_action_hook(hook, agent, 'click', {})


class ConstructorSignatureTests(unittest.TestCase):
	"""Guard the public surface the runner introspects via
	`_agent_init_accepts_named_arg`."""

	def test_phase6_kwargs_in_signature(self):
		params = inspect.signature(Agent.__init__).parameters
		for name in ('on_action_start', 'on_action_end'):
			self.assertIn(name, params, msg=f'Phase 6 kwarg {name!r} missing from Agent.__init__')


if __name__ == '__main__':
	unittest.main()
