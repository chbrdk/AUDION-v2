from __future__ import annotations

from app.utils.text import clean_response_text


def test_clean_response_text_default_caps_paragraphs():
    text = "One.\n\nTwo.\n\nThree."
    out = clean_response_text(text)
    assert out == "One.\n\nTwo."


def test_clean_response_text_unlimited_keeps_all_paragraphs():
    text = "One.\n\nTwo.\n\nThree."
    out = clean_response_text(text, max_paragraphs=None)
    assert out == "One.\n\nTwo.\n\nThree."


def test_streaming_delta_reconstruction_matches_full_clean():
    """How emit_sanitized_delta works: incremental sanitized text must not drop later paragraphs."""

    def emit_deltas(chunks: list[str], max_paragraphs: int | None) -> str:
        response_buffer = ""
        sanitized_sent = ""
        client = ""
        for c in chunks:
            response_buffer += c
            sanitized = clean_response_text(response_buffer, max_paragraphs=max_paragraphs)
            max_len = min(len(sanitized), len(sanitized_sent))
            prefix_len = 0
            while prefix_len < max_len and sanitized[prefix_len] == sanitized_sent[prefix_len]:
                prefix_len += 1
            client += sanitized[prefix_len:]
            sanitized_sent = sanitized
        return client

    chunks = ["First.\n\n", "Second.\n\n", "Third", " part."]
    full = "".join(chunks)
    expected = clean_response_text(full, max_paragraphs=None)

    assert emit_deltas(chunks, max_paragraphs=None) == expected
    # With a 2-paragraph cap, streamed client text cannot match the full cleaned answer.
    assert emit_deltas(chunks, max_paragraphs=2) != expected
    assert "Third" not in emit_deltas(chunks, max_paragraphs=2)
