from __future__ import annotations

import io

from PIL import Image

from app.services.moodboard_palette import extract_palette_swatches, merge_palette_swatches


def _solid_png(rgb: tuple[int, int, int]) -> bytes:
    img = Image.new("RGB", (48, 48), rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_extract_palette_swatches_from_solid_image() -> None:
    red = _solid_png((180, 40, 50))
    swatches = extract_palette_swatches(red)
    assert swatches
    assert swatches[0]["hex"].startswith("#")


def test_merge_palette_swatches_dedupes_hex() -> None:
    merged = merge_palette_swatches(
        [
            [{"hex": "#aabbcc", "weight": 0.5}],
            [{"hex": "#aabbcc", "weight": 0.3}, {"hex": "#112233", "weight": 0.2}],
        ]
    )
    hexes = [s["hex"] for s in merged]
    assert "#aabbcc" in hexes
    assert len(hexes) == len(set(hexes))
