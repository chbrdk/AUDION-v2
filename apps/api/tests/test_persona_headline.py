from __future__ import annotations

from app.services.persona_headline import HEADLINE_MAX_LENGTH, truncate_headline


def test_truncate_headline_short_unchanged() -> None:
    assert truncate_headline("hi") == "hi"
    assert truncate_headline(None) is None


def test_truncate_headline_long() -> None:
    s = "x" * 400
    out = truncate_headline(s)
    assert out is not None
    assert len(out) == HEADLINE_MAX_LENGTH
    assert out.endswith("...")
