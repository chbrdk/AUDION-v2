from __future__ import annotations

from app.services.openverse_client import _normalize_result


def test_normalize_result_extracts_fields() -> None:
    item = {
        "url": "https://example.com/img.jpg",
        "thumbnail": "https://example.com/thumb.jpg",
        "foreign_landing_url": "https://example.com/page",
        "creator": "Alice",
        "license": "by",
        "attribution": "Alice · BY",
    }
    out = _normalize_result(item)
    assert out is not None
    assert out.image_url == "https://example.com/img.jpg"
    assert out.thumb_url == "https://example.com/thumb.jpg"
    assert out.source_url == "https://example.com/page"
    assert out.author == "Alice"
    assert out.license == "by"
    assert out.attribution_text == "Alice · BY"

