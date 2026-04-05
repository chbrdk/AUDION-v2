from __future__ import annotations

from types import SimpleNamespace

from app.services.openai_llm_usage import raw_units_from_openai_chat_completion


def test_raw_units_from_openai_chat_completion_empty():
    assert raw_units_from_openai_chat_completion(None) == {}
    assert raw_units_from_openai_chat_completion(SimpleNamespace()) == {}


def test_raw_units_from_openai_chat_completion_with_tokens():
    chat = SimpleNamespace(usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50))
    assert raw_units_from_openai_chat_completion(chat) == {
        "input_tokens": 100,
        "output_tokens": 50,
    }
