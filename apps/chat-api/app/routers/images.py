from __future__ import annotations

from typing import Dict
from uuid import uuid4
from datetime import datetime, timedelta

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/chat/images", tags=["images"])
logger = structlog.get_logger(__name__)

# In-Memory Storage für temporäre Bilder
# Format: {image_id: {"data_url": str, "uploaded_at": datetime}}
_image_storage: Dict[str, Dict[str, any]] = {}

# Cleanup: Entferne Bilder älter als 1 Stunde
CLEANUP_INTERVAL = timedelta(hours=1)


def cleanup_old_images():
    """Entfernt Bilder, die älter als CLEANUP_INTERVAL sind"""
    now = datetime.now()
    to_remove = [
        image_id for image_id, data in _image_storage.items()
        if now - data["uploaded_at"] > CLEANUP_INTERVAL
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
    # Cleanup alte Bilder
    cleanup_old_images()
    
    # Validiere Data URL Format
    image_data_url = request.image
    if not image_data_url.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Expected data URL starting with 'data:image/'"
        )
    
    # Extrahiere Media Type
    try:
        header = image_data_url.split(",", 1)[0]
        media_type = header.split(";")[0].split(":")[1]
        if not media_type.startswith("image/"):
            raise ValueError("Invalid media type")
    except (ValueError, IndexError):
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
    if datetime.now() - image_data["uploaded_at"] > CLEANUP_INTERVAL:
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
    if datetime.now() - image_data["uploaded_at"] > CLEANUP_INTERVAL:
        del _image_storage[image_id]
        return None
    
    return image_data["data_url"]

