"""Shared upload size limit helper for file uploads."""
from __future__ import annotations

from fastapi import HTTPException, UploadFile


async def read_upload_with_limit(
    file: UploadFile, max_bytes: int, label: str = "File"
) -> bytes:
    """Read upload file up to max_bytes; raise 413 if larger."""
    chunks: list[bytes] = []
    total = 0
    chunk_size = 1024 * 1024  # 1 MB
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"{label} too large; max {max_bytes // (1024 * 1024)} MB",
            )
        chunks.append(chunk)
    return b"".join(chunks)
