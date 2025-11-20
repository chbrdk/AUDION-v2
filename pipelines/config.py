"""
Zentrale Pipeline-Konfiguration.

Alle Pfade werden hier definiert, damit sie nicht im Code verstreut sind.
Env-Overrides:
- PERSONA_WORKSPACE_ROOT
- PERSONA_DATA_ROOT
- PERSONA_RAW_BUCKET
- PERSONA_PROCESSED_BUCKET
- PERSONA_INDEX_ROOT
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Paths:
    workspace: Path
    knowledge_dir: Path
    raw_bucket: Path
    processed_bucket: Path
    storage_root: Path
    audit_dir: Path


def build_paths() -> Paths:
    workspace = Path(
        os.environ.get("PERSONA_WORKSPACE_ROOT", Path(__file__).resolve().parents[1])
    ).resolve()
    knowledge_dir = workspace / "knowledge"
    data_root = Path(os.environ.get("PERSONA_DATA_ROOT", workspace / "data"))
    raw_bucket = Path(os.environ.get("PERSONA_RAW_BUCKET", data_root / "raw"))
    processed_bucket = Path(os.environ.get("PERSONA_PROCESSED_BUCKET", data_root / "processed"))
    storage_root = Path(os.environ.get("PERSONA_INDEX_ROOT", workspace / "storage" / "persona_index"))
    audit_dir = knowledge_dir / "persona_source_audits"
    return Paths(
        workspace=workspace,
        knowledge_dir=knowledge_dir,
        raw_bucket=raw_bucket,
        processed_bucket=processed_bucket,
        storage_root=storage_root,
        audit_dir=audit_dir,
    )


PATHS = build_paths()

