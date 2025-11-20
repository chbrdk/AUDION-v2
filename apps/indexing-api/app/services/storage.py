from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from ..core.config import get_settings


@dataclass
class StoredFile:
    file_path: Path
    filename: str
    size_bytes: int


class StorageService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._upload_dir = self._settings.upload_dir

    def save(self, *, document_id: UUID, filename: str, content: bytes) -> StoredFile:
        """Save uploaded file to local filesystem."""
        doc_dir = self._upload_dir / str(document_id)
        doc_dir.mkdir(parents=True, exist_ok=True)

        file_path = doc_dir / filename
        file_path.write_bytes(content)

        return StoredFile(
            file_path=file_path,
            filename=filename,
            size_bytes=len(content)
        )

    def get_file_path(self, *, document_id: UUID, filename: str) -> Path:
        """Get the file path for a stored document."""
        return self._upload_dir / str(document_id) / filename

