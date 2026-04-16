from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest


@contextmanager
def _fake_message_stream(**_kwargs):
    class _Stream:
        def get_final_text(self) -> str:
            return '{"name": "Streamed"}'

        def close(self) -> None:
            pass

    yield _Stream()


def test_anthropic_complete_text_uses_messages_stream() -> None:
    from app.services.persona_generation import anthropic_complete_text

    client = MagicMock()
    client.messages.stream = MagicMock(side_effect=_fake_message_stream)

    out = anthropic_complete_text(
        client,
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        temperature=0.5,
        system="sys",
        messages=[{"role": "user", "content": "hi"}],
    )
    assert out == '{"name": "Streamed"}'
    client.messages.stream.assert_called_once()
    call_kw = client.messages.stream.call_args.kwargs
    assert call_kw["model"] == "claude-haiku-4-5-20251001"
    assert call_kw["max_tokens"] == 100
    assert call_kw["temperature"] == 0.5
    assert call_kw["system"] == "sys"


def test_anthropic_complete_text_propagates_runtime_error_from_stream() -> None:
    from app.services.persona_generation import anthropic_complete_text

    @contextmanager
    def boom(**_kwargs):
        class _Stream:
            def get_final_text(self) -> str:
                raise RuntimeError("no text")

            def close(self) -> None:
                pass

        yield _Stream()

    client = MagicMock()
    client.messages.stream = MagicMock(side_effect=boom)
    with pytest.raises(RuntimeError, match="no text"):
        anthropic_complete_text(
            client,
            model="m",
            max_tokens=1,
            temperature=0.0,
            system="s",
            messages=[{"role": "user", "content": "x"}],
        )
