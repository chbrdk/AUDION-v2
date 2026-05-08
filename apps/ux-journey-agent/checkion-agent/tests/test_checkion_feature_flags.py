"""Unit tests for CHECKION fork feature flags."""

from __future__ import annotations

import os
import unittest
from unittest import mock

from checkion_agent.agent.checkion_feature_flags import web_search_enabled


class WebSearchFlagTests(unittest.TestCase):
	def test_default_is_disabled(self):
		with mock.patch.dict(os.environ, {}, clear=False):
			os.environ.pop('CHECKION_AGENT_WEB_SEARCH', None)
			self.assertFalse(web_search_enabled())

	def test_explicit_on(self):
		with mock.patch.dict(os.environ, {'CHECKION_AGENT_WEB_SEARCH': '1'}):
			self.assertTrue(web_search_enabled())

	def test_truthy_aliases(self):
		for v in ('1', 'true', 'yes', 'on', 'TRUE'):
			with mock.patch.dict(os.environ, {'CHECKION_AGENT_WEB_SEARCH': v}):
				self.assertTrue(web_search_enabled(), msg=v)


if __name__ == '__main__':
	unittest.main()
