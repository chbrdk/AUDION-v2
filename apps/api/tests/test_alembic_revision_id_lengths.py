"""Every Alembic revision id must fit audion.alembic_version.version_num (VARCHAR(32))."""

from __future__ import annotations

import re
from pathlib import Path


def test_all_alembic_revision_ids_fit_version_column() -> None:
    root = Path(__file__).resolve().parents[1]
    versions = root / "alembic" / "versions"
    rev_re = re.compile(
        r"""^revision(?:\s*:\s*str)?\s*=\s*["']([^"']+)["']""",
        re.MULTILINE,
    )
    for path in sorted(versions.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        m = rev_re.search(text)
        assert m is not None, f"missing revision in {path.name}"
        rev_id = m.group(1)
        assert len(rev_id) <= 32, f"{path.name}: revision {rev_id!r} is {len(rev_id)} chars (max 32)"
