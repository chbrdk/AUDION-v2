from __future__ import annotations

from types import SimpleNamespace

from app.services.anthropic_usage_raw import raw_units_from_anthropic_message


def test_raw_units_from_anthropic_message_empty():
    assert raw_units_from_anthropic_message(SimpleNamespace()) == {}
    assert raw_units_from_anthropic_message(SimpleNamespace(usage=None)) == {}


def test_raw_units_from_anthropic_message_tokens():
    msg = SimpleNamespace(usage=SimpleNamespace(input_tokens=100, output_tokens=40))
    assert raw_units_from_anthropic_message(msg) == {"input_tokens": 100, "output_tokens": 40}
