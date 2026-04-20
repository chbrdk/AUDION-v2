from __future__ import annotations

from types import SimpleNamespace

from app.services.openai_chat_content import (
    describe_empty_chat_completion,
    extract_chat_completion_message_text,
    openai_research_completion_extra_kwargs,
)


def test_extract_chat_completion_message_text_str():
    msg = SimpleNamespace(content="hello")
    assert extract_chat_completion_message_text(msg) == "hello"


def test_extract_chat_completion_message_text_list_parts():
    msg = SimpleNamespace(content=[SimpleNamespace(text="a"), SimpleNamespace(text="b")])
    assert extract_chat_completion_message_text(msg) == "a\nb"


def test_openai_research_completion_extra_kwargs_gpt5():
    assert openai_research_completion_extra_kwargs("gpt-5.4-mini") == {"reasoning_effort": "low"}
    assert openai_research_completion_extra_kwargs("gpt-5-mini") == {"reasoning_effort": "low"}
    assert openai_research_completion_extra_kwargs("GPT-5") == {"reasoning_effort": "low"}
    assert openai_research_completion_extra_kwargs("gpt-4o-mini") == {}


def test_describe_empty_chat_completion_includes_finish_reason():
    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason="length",
                message=SimpleNamespace(content=""),
            )
        ],
        usage=SimpleNamespace(completion_tokens=4096, completion_tokens_details=SimpleNamespace(reasoning_tokens=4000)),
    )
    out = describe_empty_chat_completion(completion)
    assert "finish_reason='length'" in out
    assert "reasoning_tokens=4000" in out
    assert "AI_PROJECT_RESEARCH_MAX_COMPLETION_TOKENS" in out
