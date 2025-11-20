from __future__ import annotations

import datetime as dt
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional

from pipelines.config import PATHS

try:
    from huggingface_hub import snapshot_download
except ImportError:  # pragma: no cover
    snapshot_download = None


@dataclass
class PersonaSource:
    source_id: str
    platform: str
    url: str
    license: str
    schema_fields: str
    updated_at: str
    trust_score: float
    notes: str


class PersonaSourceRegistry:
    def __init__(self, document_path: Path | None = None):
        self.document_path = document_path or (PATHS.knowledge_dir / "persona_sources.md")
        self.sources: Dict[str, PersonaSource] = {}
        self._load()

    def _load(self) -> None:
        if not self.document_path.exists():
            raise FileNotFoundError(f"Persona source document missing: {self.document_path}")
        rows = [
            line
            for line in self.document_path.read_text().splitlines()
            if line.strip().startswith("| persona")
        ]
        for row in rows:
            cells = [cell.strip() for cell in row.strip("|").split("|")]
            (
                source_id,
                platform,
                url,
                license_,
                schema_fields,
                updated_at,
                trust_score,
                notes,
            ) = cells
            self.sources[source_id] = PersonaSource(
                source_id=source_id,
                platform=platform,
                url=url,
                license=license_,
                schema_fields=schema_fields,
                updated_at=updated_at,
                trust_score=float(trust_score),
                notes=notes,
            )

    def get(self, source_id: str) -> PersonaSource:
        try:
            return self.sources[source_id]
        except KeyError:
            raise KeyError(f"Source {source_id} not registered in {self.document_path}") from None


class BaseConnector:
    def fetch(self, source: PersonaSource, target_dir: Path, *, dry_run: bool = False) -> Path:
        raise NotImplementedError


class HuggingFaceConnector(BaseConnector):
    def fetch(self, source: PersonaSource, target_dir: Path, *, dry_run: bool = False) -> Path:
        if dry_run:
            return self._write_manifest(source, target_dir, {"status": "dry_run"})
        if snapshot_download is None:  # pragma: no cover
            raise RuntimeError("huggingface_hub is not installed.")
        repo_id = source.url.rsplit("/", 1)[-1]
        snapshot_download(repo_id=f"datasets/{repo_id}", local_dir=target_dir)
        return self._write_manifest(source, target_dir, {"status": "downloaded"})

    @staticmethod
    def _write_manifest(source: PersonaSource, target_dir: Path, meta: Dict) -> Path:
        manifest = {
            "source_id": source.source_id,
            "platform": source.platform,
            "url": source.url,
            "downloaded_at": dt.datetime.utcnow().isoformat(),
            **meta,
        }
        manifest_path = target_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))
        return manifest_path


class GitHubConnector(BaseConnector):
    def fetch(self, source: PersonaSource, target_dir: Path, *, dry_run: bool = False) -> Path:
        if dry_run:
            return HuggingFaceConnector._write_manifest(source, target_dir, {"status": "dry_run"})
        subprocess.run(["git", "clone", source.url, str(target_dir)], check=True)
        return HuggingFaceConnector._write_manifest(source, target_dir, {"status": "cloned"})


CONNECTORS = {
    "Hugging Face": HuggingFaceConnector(),
    "GitHub": GitHubConnector(),
}


class PersonaIngestJob:
    def __init__(self, registry: Optional[PersonaSourceRegistry] = None):
        self.registry = registry or PersonaSourceRegistry()
        PATHS.raw_bucket.mkdir(parents=True, exist_ok=True)

    def run(self, source_id: str, *, dry_run: bool = False) -> Path:
        source = self.registry.get(source_id)
        batch_dir = self._batch_dir(source_id)
        connector = self._resolve_connector(source.platform)
        connector.fetch(source, batch_dir, dry_run=dry_run)
        return batch_dir

    def _batch_dir(self, source_id: str) -> Path:
        ts = dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        target = PATHS.raw_bucket / source_id / ts
        target.mkdir(parents=True, exist_ok=True)
        return target

    @staticmethod
    def _resolve_connector(platform: str) -> BaseConnector:
        try:
            return CONNECTORS[platform]
        except KeyError:
            raise ValueError(f"No connector configured for platform {platform}")


def list_sources(registry: Optional[PersonaSourceRegistry] = None) -> Iterable[str]:
    reg = registry or PersonaSourceRegistry()
    return reg.sources.keys()


__all__ = [
    "PersonaSource",
    "PersonaSourceRegistry",
    "PersonaIngestJob",
    "list_sources",
]

