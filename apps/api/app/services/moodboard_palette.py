"""Extract dominant palette swatches from moodboard tile images."""

from __future__ import annotations

import io
import structlog
from typing import Any

from PIL import Image

logger = structlog.get_logger(__name__)

_MAX_SWATCHES = 6
_SAMPLE_SIZE = (96, 96)
_NEAR_WHITE = 245
_NEAR_BLACK = 18
_MIN_COLOR_DISTANCE = 28.0


def _rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def _color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def _is_boring(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    if r >= _NEAR_WHITE and g >= _NEAR_WHITE and b >= _NEAR_WHITE:
        return True
    if r <= _NEAR_BLACK and g <= _NEAR_BLACK and b <= _NEAR_BLACK:
        return True
    spread = max(r, g, b) - min(r, g, b)
    if spread < 12 and 40 < (r + g + b) / 3 < 210:
        return True
    return False


def extract_palette_swatches(image_bytes: bytes, *, max_swatches: int = _MAX_SWATCHES) -> list[dict[str, Any]]:
    """Return [{hex, weight}] sorted by prominence (weight 0–1)."""
    if not image_bytes:
        return []
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        logger.debug("moodboard.palette.decode_failed", error=str(e))
        return []

    img.thumbnail(_SAMPLE_SIZE, Image.Resampling.LANCZOS)
    colors = img.getcolors(maxcolors=256 * 256)
    if not colors:
        return []

    total = sum(count for count, _ in colors)
    if total <= 0:
        return []

    ranked = sorted(colors, key=lambda item: item[0], reverse=True)
    picked: list[tuple[tuple[int, int, int], float]] = []

    for count, rgb in ranked:
        if _is_boring(rgb):
            continue
        too_close = any(_color_distance(rgb, existing[0]) < _MIN_COLOR_DISTANCE for existing in picked)
        if too_close:
            continue
        weight = round(count / total, 3)
        picked.append((rgb, weight))
        if len(picked) >= max_swatches:
            break

    return [{"hex": _rgb_to_hex(*rgb), "weight": weight} for rgb, weight in picked]


def merge_palette_swatches(swatches_per_image: list[list[dict[str, Any]]], *, max_swatches: int = _MAX_SWATCHES) -> list[dict[str, Any]]:
    """Aggregate swatches from multiple tiles, dedupe by hex, sum weights."""
    by_hex: dict[str, float] = {}
    for group in swatches_per_image:
        for item in group:
            hex_val = item.get("hex")
            weight = item.get("weight")
            if not isinstance(hex_val, str) or not hex_val.startswith("#"):
                continue
            w = float(weight) if isinstance(weight, (int, float)) else 0.1
            by_hex[hex_val] = by_hex.get(hex_val, 0.0) + w
    if not by_hex:
        return []
    merged = sorted(by_hex.items(), key=lambda kv: kv[1], reverse=True)[:max_swatches]
    total = sum(w for _, w in merged) or 1.0
    return [{"hex": h, "weight": round(w / total, 3)} for h, w in merged]
