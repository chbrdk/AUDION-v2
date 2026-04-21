"""Static checks on Alembic revision files (no database required).

Broken graphs (wrong merge parents, dangling down_revision) often surface only
at deploy when `alembic upgrade head` fails and the API container never becomes healthy.
"""

from __future__ import annotations

import ast
from pathlib import Path


def _iter_module_level_assignments(tree: ast.Module) -> list[tuple[str, ast.expr]]:
    out: list[tuple[str, ast.expr]] = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    out.append((target.id, node.value))
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            out.append((node.target.id, node.value))
    return out


def _parse_down_revision(value: ast.expr) -> str | tuple[str, ...] | None:
    if isinstance(value, ast.Constant):
        if value.value is None:
            return None
        if isinstance(value.value, str):
            return value.value
    if isinstance(value, (ast.Tuple, ast.List)):
        items: list[str] = []
        for elt in value.elts:
            if not isinstance(elt, ast.Constant) or not isinstance(elt.value, str):
                raise ValueError(f"Unsupported down_revision element: {ast.dump(elt)}")
            items.append(elt.value)
        return tuple(items)
    raise ValueError(f"Unsupported down_revision shape: {ast.dump(value)}")


_MISSING = object()


def _load_revision_map(versions_dir: Path) -> dict[str, str | tuple[str, ...] | None]:
    rev_to_down: dict[str, str | tuple[str, ...] | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        revision: str | None = None
        down_revision: str | tuple[str, ...] | None | object = _MISSING
        for name, val in _iter_module_level_assignments(tree):
            if name == "revision":
                if not isinstance(val, ast.Constant) or not isinstance(val.value, str):
                    raise AssertionError(f"{path}: revision must be a string constant")
                revision = val.value
            elif name == "down_revision":
                down_revision = _parse_down_revision(val)
        if revision is None:
            raise AssertionError(f"{path}: missing revision")
        if down_revision is _MISSING:
            raise AssertionError(f"{path}: missing down_revision")
        rev_to_down[revision] = down_revision
    return rev_to_down


def _flatten_parents(down: str | tuple[str, ...] | None) -> list[str]:
    if down is None:
        return []
    if isinstance(down, tuple):
        return list(down)
    return [down]


def test_alembic_graph_single_head_and_valid_parents() -> None:
    versions_dir = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    rev_to_down = _load_revision_map(versions_dir)
    all_revs = set(rev_to_down)

    missing_parents: list[tuple[str, str]] = []
    for rev, down in rev_to_down.items():
        for parent in _flatten_parents(down):
            if parent not in all_revs:
                missing_parents.append((rev, parent))

    assert not missing_parents, (
        "down_revision points to unknown revision(s): "
        + ", ".join(f"{r} -> {p}" for r, p in missing_parents)
    )

    referenced = {p for down in rev_to_down.values() for p in _flatten_parents(down)}
    heads = sorted(all_revs - referenced)
    assert len(heads) == 1, (
        "Expected exactly one Alembic head (merge parallel branches or add a merge revision). "
        f"Heads: {heads!r}"
    )
