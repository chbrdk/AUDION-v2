from __future__ import annotations

from typing import Dict
from uuid import uuid4
from datetime import datetime, timedelta

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..core.config import get_settings

router = APIRouter(prefix="/chat/images", tags=["images"])
logger = structlog.get_logger(__name__)
settings = get_settings()

# In-Memory Storage für temporäre Bilder
# Format: {image_id: {"data_url": str, "uploaded_at": datetime}}
_image_storage: Dict[str, Dict[str, any]] = {}

def _image_cleanup_interval() -> timedelta:
    return timedelta(seconds=get_settings().upload_attachment_ttl_seconds)


def cleanup_old_images():
    """Entfernt Bilder, die älter als upload_attachment_ttl_seconds sind"""
    now = datetime.now()
    interval = _image_cleanup_interval()
    to_remove = [
        image_id for image_id, data in list(_image_storage.items())
        if now - data.get("uploaded_at", now) > interval
    ]
    for image_id in to_remove:
        del _image_storage[image_id]
        logger.info("images.cleanup.removed", image_id=image_id)


class ImageUploadRequest(BaseModel):
    """Request für Image-Upload"""
    image: str = Field(..., description="Base64 data URL (data:image/...;base64,...)")


class ImageUploadResponse(BaseModel):
    """Response nach Image-Upload"""
    image_id: str = Field(..., description="Eindeutige ID für das hochgeladene Bild")
    expires_in_seconds: int = Field(default=3600, description="Gültigkeitsdauer in Sekunden")


class ImageGetResponse(BaseModel):
    """Response für Image-Abruf"""
    image: str = Field(..., description="Base64 data URL")


@router.post("/upload", response_model=ImageUploadResponse)
async def upload_image(request: ImageUploadRequest):
    """
    Lädt ein Bild hoch und gibt eine temporäre ID zurück.
    Das Bild wird für 1 Stunde im Memory gespeichert.
    """
    try:
        # Cleanup alte Bilder
        cleanup_old_images()
        
        # Validiere Data URL Format
        image_data_url = request.image
        
        # Prüfe Größe (vorher um OOM zu vermeiden)
        # Base64 ist ca. 33% größer als Binärdaten, aber wir prüfen die String-Länge
        if len(image_data_url) > settings.upload_max_image_bytes * 1.4: # Grobe Schätzung für Base64
            logger.warning("images.upload.too_large", 
                          data_length=len(image_data_url), 
                          limit=settings.upload_max_image_bytes)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image too large. Max size: {settings.upload_max_image_bytes / 1024 / 1024:.1f}MB"
            )

        if not image_data_url.startswith("data:image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image format. Expected data URL starting with 'data:image/'"
            )
        
        # Extrahiere Media Type
        try:
            parts = image_data_url.split(",", 1)
            if len(parts) < 2:
                 raise ValueError("Missing comma in data URL")
            header = parts[0]
            media_type = header.split(";")[0].split(":")[1]
            if not media_type.startswith("image/"):
                raise ValueError("Invalid media type")
        except (ValueError, IndexError) as e:
            logger.warning("images.upload.invalid_format", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URL format"
            )
        
        # Generiere eindeutige ID
        image_id = str(uuid4())
        
        # Speichere Bild
        _image_storage[image_id] = {
            "data_url": image_data_url,
            "uploaded_at": datetime.now(),
            "media_type": media_type
        }
        
        logger.info("images.upload.success",
                    image_id=image_id,
                    media_type=media_type,
                    data_length=len(image_data_url))
        
        return ImageUploadResponse(
            image_id=image_id,
            expires_in_seconds=3600
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("images.upload.unexpected_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during image upload"
        )


@router.post("/upload-batch", response_model=Dict[str, str])
async def upload_images_batch(request: Dict[str, ImageUploadRequest]):
    """
    Lädt mehrere Bilder hoch und gibt eine Map von Index zu Image-ID zurück.
    Format: {"0": "image-id-1", "1": "image-id-2", ...}
    """
    cleanup_old_images()
    
    result = {}
    
    for index, upload_request in request.items():
        image_data_url = upload_request.image
        if not image_data_url.startswith("data:image/"):
            logger.warning("images.upload_batch.invalid_format", index=index)
            continue
        
        try:
            header = image_data_url.split(",", 1)[0]
            media_type = header.split(";")[0].split(":")[1]
        except (ValueError, IndexError):
            logger.warning("images.upload_batch.invalid_data_url", index=index)
            continue
        
        image_id = str(uuid4())
        _image_storage[image_id] = {
            "data_url": image_data_url,
            "uploaded_at": datetime.now(),
            "media_type": media_type
        }
        
        result[index] = image_id
        
        logger.info("images.upload_batch.item",
                   index=index,
                   image_id=image_id,
                   media_type=media_type)
    
    logger.info("images.upload_batch.success", count=len(result))
    return result


@router.get("/{image_id}", response_model=ImageGetResponse)
async def get_image(image_id: str):
    """
    Ruft ein Bild anhand der ID ab.
    """
    if image_id not in _image_storage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or expired"
        )
    
    image_data = _image_storage[image_id]
    
    # Prüfe ob abgelaufen
    if datetime.now() - image_data["uploaded_at"] > _image_cleanup_interval():
        del _image_storage[image_id]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image expired"
        )
    
    return ImageGetResponse(image=image_data["data_url"])


def get_image_data_url(image_id: str) -> str | None:
    """
    Interne Funktion zum Abrufen eines Bildes anhand der ID.
    Wird vom Chat-Endpoint verwendet.
    """
    if image_id not in _image_storage:
        return None
    
    image_data = _image_storage[image_id]
    
    # Prüfe ob abgelaufen
    if datetime.now() - image_data["uploaded_at"] > _image_cleanup_interval():
        del _image_storage[image_id]
        return None
    
    return image_data["data_url"]

