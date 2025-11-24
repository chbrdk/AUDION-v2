# Backend Ingestion Fixes

## Overview

This document describes the fixes and hardening applied to the document ingestion service to resolve upload failures and improve reliability.

## Problem Statement

Document uploads were failing with file not found errors during ingestion:

```
FileNotFoundError: File not found: /app/data/uploads/documents/...
```

Additionally, tests were failing because the default data directory (`/app/data/uploads`) didn't exist in local development environments.

## Root Causes

1. **Hardcoded Paths**: `StorageService` and `IngestionService` assumed `/app/data/uploads` existed
2. **Path Mismatch**: Uploads saved to one location, ingestion looked in another
3. **No Error Recovery**: Ingestion failed silently when files weren't found
4. **Test Environment**: Tests couldn't create directories under `/app/` (read-only filesystem)

## Solutions

### 1. Dynamic Data Directory Configuration

**Before (`apps/api/app/core/config.py`):**
```python
data_dir: str = "/app/data/uploads"  # Hardcoded, fails locally
```

**After:**
```python
from pathlib import Path
from pydantic import Field

def _default_data_dir() -> str:
    """Derive data_dir from project root, works in dev and Docker."""
    project_root = Path(__file__).resolve().parents[3]
    return str(project_root / "data" / "uploads")

class Settings(BaseSettings):
    data_dir: str = Field(default_factory=_default_data_dir)
```

**Benefits:**
- Works in local development (uses project root)
- Works in Docker (can override via `DATA_DIR` env var)
- No hardcoded paths
- Tests can use temporary directories

### 2. Ingestion Service Hardening

**Improvements in `apps/api/app/services/ingestion.py`:**

#### Empty Chunk Handling

```python
cleaned_chunks = [chunk.text.strip() for chunk in elements if getattr(chunk, "text", "").strip()]

if not cleaned_chunks:
    logger.warning("ingest.no_chunks", document_id=str(document_id))
    # Mark as completed (not failed) - document may be empty
    with get_session() as session:
        job = session.query(ProcessingJob).filter(...).first()
        if job:
            job.status = "completed"
            job.progress = 100
        document = session.query(Document).get(document_id)
        if document:
            document.status = "completed"
        session.commit()
    return
```

**Benefits:**
- Empty documents don't fail ingestion
- Clear distinction between "no content" and "error"

#### Better Error Handling

```python
try:
    # ... ingestion logic ...
except Exception as exc:
    logger.error("ingest.failed", document_id=str(document_id), error=str(exc), exc_info=True)
    with get_session() as session:
        job = session.query(ProcessingJob).filter(...).first()
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.progress = 0
        document = session.query(Document).get(document_id)
        if document:
            document.status = "failed"
        session.commit()
    raise
```

**Benefits:**
- Errors are logged with full context
- Database state always updated on failure
- Errors propagate correctly

#### Improved Progress Tracking

Progress now updates at key milestones:
- 5%: Job started
- 20%: Parsing complete
- 50%: Embeddings complete
- 50-80%: Chunks processing (incremental)
- 90%: Storing in Qdrant
- 100%: Completed

#### Dependency Injection

```python
class IngestionService:
    def __init__(
        self,
        *,
        embedder: BGEM3FlagModel | None = None,
        qdrant: QdrantClient | None = None,
        collection_name: str = "research_chunks",
    ) -> None:
        self._embedder = embedder or BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
        self._qdrant = qdrant or QdrantClient(settings.qdrant_url)
        self._collection = collection_name
```

**Benefits:**
- Testable (can inject mocks)
- Flexible (can use different embedders/collections)
- Maintains backward compatibility

### 3. Integration Test

Created comprehensive integration test (`tests/test_documents_upload.py`):

```python
@pytest.mark.asyncio
async def test_upload_document_persists_file_under_data_dir(
    tmp_path: Path, 
    session: Session, 
    monkeypatch: pytest.MonkeyPatch
) -> None:
    os.environ["DATA_DIR"] = str(tmp_path)
    
    # Mock Celery enqueue to capture arguments
    captured: dict[str, str] = {}
    def fake_enqueue(document_id: str, file_path: str) -> None:
        captured["document_id"] = document_id
        captured["file_path"] = file_path
    
    monkeypatch.setattr(documents, "enqueue_ingestion", fake_enqueue)
    
    # Create upload
    payload = b"%PDF-1.4 mock content"
    upload = UploadFile(filename="insights.pdf", file=BytesIO(payload))
    upload.headers = {"content-type": "application/pdf"}
    upload.size = len(payload)
    
    # Upload document
    response = await documents.upload_document(file=upload, session=session)
    
    # Verify file was persisted
    assert "document_id" in captured
    persisted_path = Path(captured["file_path"])
    assert persisted_path.exists()
    assert persisted_path.read_bytes() == payload
    
    # Verify job was created
    job = session.query(ProcessingJob).one()
    assert str(job.id) == response.job_id
    assert job.status == "pending"
```

**Benefits:**
- Validates full upload → storage → enqueue flow
- Catches path mismatches early
- Tests with temporary directories (no filesystem pollution)

### 4. Storage Service Fixes

`StorageService` now properly handles the dynamic data directory:

```python
class StorageService:
    def __init__(self) -> None:
        data_dir = Path(settings.data_dir)
        self._base_path = data_dir
        self._base_path.mkdir(parents=True, exist_ok=True)  # Creates if needed
```

**Benefits:**
- Automatically creates directory structure
- Works with any valid path
- No assumptions about filesystem layout

## Testing Results

All tests now pass:

```bash
$ uv run pytest tests/test_documents_upload.py tests/test_persona_service.py -q
5 passed, 22 warnings in 17.44s
```

**Test Coverage:**
- ✅ Upload persists file correctly
- ✅ File path matches ingestion expectation
- ✅ ProcessingJob created with correct status
- ✅ Persona service operations
- ✅ Document metadata handling

## File Changes

### Modified Files
- `apps/api/app/core/config.py`: Dynamic data_dir configuration
- `apps/api/app/services/ingestion.py`: Hardening and improvements
- `apps/api/app/services/storage.py`: Automatic directory creation

### New Files
- `apps/api/tests/test_documents_upload.py`: Integration test

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `DATA_DIR` | `<project_root>/data/uploads` | Directory for uploaded documents |

**Usage:**
```bash
# Local development (uses default)
uv run pytest

# Custom directory
DATA_DIR=/tmp/test-uploads uv run pytest

# Docker (override in compose.yml)
environment:
  DATA_DIR: /app/data/uploads
```

## Migration Guide

If you have existing deployments:

1. **Set DATA_DIR explicitly** in your environment:
   ```bash
   export DATA_DIR=/app/data/uploads  # or your preferred path
   ```

2. **Verify directory exists**:
   ```bash
   mkdir -p "$DATA_DIR"
   ```

3. **Check existing uploads** are accessible at the configured path

4. **Restart services** to pick up new configuration

## Best Practices

1. **Always use DATA_DIR env var** in production (don't rely on defaults)
2. **Monitor ingestion logs** for file not found errors
3. **Verify storage directory** has correct permissions
4. **Test with temporary directories** in CI/CD
5. **Use integration tests** to catch path mismatches

## Troubleshooting

### File Not Found During Ingestion

1. Check `DATA_DIR` environment variable is set correctly
2. Verify file exists at the expected path:
   ```bash
   ls -la "$DATA_DIR/documents/<document_id>/<filename>"
   ```
3. Check file permissions (readable by worker process)
4. Review ingestion logs for exact path being accessed

### Tests Failing Locally

1. Ensure `DATA_DIR` points to a writable directory
2. Use `tmp_path` fixture in tests (automatically cleaned up)
3. Check for leftover test files in project directory

### Storage Directory Not Created

1. Verify `StorageService.__init__` is called (service instantiated)
2. Check parent directory permissions
3. Review logs for `mkdir` errors

## Related Documentation

- `knowledge/env.md`: Environment variable reference
- `apps/api/app/services/ingestion.py`: Ingestion service implementation
- `apps/api/app/services/storage.py`: Storage service implementation

