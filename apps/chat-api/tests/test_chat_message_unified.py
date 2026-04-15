from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.routers.chat import ChatStreamContext, collect_chat_message_response


def _minimal_ctx() -> ChatStreamContext:
    return ChatStreamContext(
        persona_id="00000000-0000-0000-0000-000000000001",
        user_id=None,
        system_prompt="sys",
        anthropic_messages=[{"role": "user", "content": "hi"}],
        retrieval_query="hi",
        user_message_for_logging="hi",
        persona_segment=None,
        use_tools=False,
        tools=None,
    )


def test_collect_merges_deltas_and_sources():
    async def fake_iter(_ctx: ChatStreamContext):
        yield 'data: {"type": "delta", "delta": "Hello"}\n\n'
        yield 'data: {"type": "delta", "delta": " world"}\n\n'
        yield (
            'data: {"type": "sources", "sources": ['
            '{"chunk_id": "c1", "document_id": "d1", "title": "T", "confidence": 0.9, "excerpt": "ex"}'
            "]}\n\n"
        )

    async def run():
        with patch("app.routers.chat.iter_chat_sse", fake_iter):
            return await collect_chat_message_response(_minimal_ctx())

    out = asyncio.run(run())
    assert out.response == "Hello world"
    assert out.persona_id == _minimal_ctx().persona_id
    assert len(out.sources) == 1
    assert out.sources[0].chunk_id == "c1"
    assert out.sources[0].excerpt == "ex"


def test_collect_error_event_raises_http():
    async def fake_iter(_ctx: ChatStreamContext):
        yield 'data: {"type": "delta", "delta": "x"}\n\n'
        yield 'data: {"type": "error", "error": "boom"}\n\n'

    async def run():
        with patch("app.routers.chat.iter_chat_sse", fake_iter):
            return await collect_chat_message_response(_minimal_ctx())

    with pytest.raises(Exception) as exc_info:
        asyncio.run(run())
    err = exc_info.value
    assert getattr(err, "status_code", None) == 502
    assert "boom" in str(getattr(err, "detail", err))
