from __future__ import annotations

from types import SimpleNamespace

from app.services.anthropic_usage_raw import raw_units_from_anthropic_message


def test_raw_units_empty():
    assert raw_units_from_anthropic_message(SimpleNamespace()) == {}


def test_raw_units_tokens():
    msg = SimpleNamespace(usage=SimpleNamespace(input_tokens=50, output_tokens=25))
    assert raw_units_from_anthropic_message(msg) == {"input_tokens": 50, "output_tokens": 25}
