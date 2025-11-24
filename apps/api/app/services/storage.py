from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..core.config import get_settings

settings = get_settings()


@dataclass
class StoredObject:
    key: str
    content_type: str


class StorageService:
    def __init__(self) -> None:
        # Use DATA_DIR from environment or default to /app/data/uploads
        data_dir = Path(settings.data_dir if hasattr(settings, "data_dir") else "/app/data/uploads")
        self._base_path = data_dir
        self._base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, key: str) -> Path:
        """Convert S3-style key to filesystem path."""
        # Remove leading slash if present, then join with base path
        clean_key = key.lstrip("/")
        return self._base_path / clean_key

    def upload(self, *, key: str, data: bytes | bytearray, content_type: str) -> StoredObject:
        """Store file in filesystem."""
        file_path = self._get_file_path(key)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Handle BytesIO or bytes
        if hasattr(data, "read"):
            file_path.write_bytes(data.read())
        elif isinstance(data, (bytes, bytearray)):
            file_path.write_bytes(data)
        else:
            raise TypeError(f"Unsupported data type: {type(data)}")
        
        return StoredObject(key=key, content_type=content_type)

    def stream(self, *, key: str):
        """Stream file from filesystem."""
        file_path = self._get_file_path(key)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {key}")
        
        content_type = "application/octet-stream"
        # Try to infer content type from extension
        suffix = file_path.suffix.lower()
        content_type_map = {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".txt": "text/plain",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        content_type = content_type_map.get(suffix, content_type)
        
        # Return file-like object and content type
        return file_path.open("rb"), content_type

    def generate_presigned_url(self, *, key: str, expires_in: int = 3600) -> str:
        """Generate a direct download URL (not presigned, just the backend route)."""
        # For filesystem storage, we return the backend download route
        base_url = settings.persona_backend_public_url.rstrip("/")
        # Extract document ID from key if it's a document path
        if "/documents/" in key:
            parts = key.split("/")
            if len(parts) >= 3:
                # Format: personas/{persona_id}/documents/{doc_id}/filename
                # or documents/{doc_id}/filename
                if parts[0] == "personas" and len(parts) >= 4:
                    persona_id = parts[1]
                    doc_id = parts[3]
                    return f"{base_url}/personas/{persona_id}/documents/{doc_id}/download"
                elif parts[0] == "documents" and len(parts) >= 2:
                    doc_id = parts[1]
                    # Would need persona_id from document, but for now return a generic route
                    return f"{base_url}/documents/{doc_id}/download"
        return f"{base_url}/files/{key}"

    def delete(self, *, key: str) -> None:
        """Delete file from filesystem."""
        file_path = self._get_file_path(key)
        if file_path.exists():
            file_path.unlink()
            # Try to remove empty parent directories
            try:
                file_path.parent.rmdir()
            except OSError:
                pass  # Directory not empty or doesn't exist
