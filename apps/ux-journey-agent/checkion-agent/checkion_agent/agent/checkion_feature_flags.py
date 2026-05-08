"""CHECKION-specific feature flags layered on top of upstream browser-use.

These toggles centralise deployment intent so fork patches stay discoverable
without scattering magic strings across ``service.py``.
"""

from __future__ import annotations

import os


def web_search_enabled() -> bool:
	"""Whether the ``search`` browser action (DuckDuckGo / Google / Bing) is registered.

	Default **off**. UX Journey / CHECKION runs must stay on the operator-supplied
	origin — drifting into generic web search breaks audit reproducibility and
	sends traffic to third-party search engines.

	Set ``CHECKION_AGENT_WEB_SEARCH=1`` to restore upstream behaviour (tests,
	integrations that genuinely need search).
	"""
	v = (os.environ.get('CHECKION_AGENT_WEB_SEARCH') or '0').strip().lower()
	return v in ('1', 'true', 'yes', 'on')
