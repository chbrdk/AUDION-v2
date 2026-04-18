"""Guard: excerpt + session usage stays inside the same `with get_session()` as chunk loading."""

from __future__ import annotations

from pathlib import Path


def test_persona_generate_excerpt_block_nested_under_get_session() -> None:
    root = Path(__file__).resolve().parents[1]
    src = (root / "app" / "services" / "persona_generation.py").read_text(encoding="utf-8")
    lines = src.splitlines()
    prepare_idx = next(i for i, line in enumerate(lines) if "Prepare excerpts (must stay inside session" in line)
    schema_idx = next(
        i
        for i, line in enumerate(lines)
        if i > prepare_idx and line.strip().startswith("schema_instr = persona_llm_schema_instruction")
    )
    excerpt_window = lines[prepare_idx:schema_idx]
    for line in excerpt_window:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if "session." in line or "chunk.content" in line:
            indent = len(line) - len(line.lstrip(" "))
            assert indent >= 12, (
                "session/chunk access after excerpt marker must stay inside generate()'s "
                f"`with get_session()` body (expect >=12 spaces): {line[:100]}"
            )
