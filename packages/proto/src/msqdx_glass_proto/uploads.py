from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class UploadProcessingStatus(BaseModel):
    status: Literal["processing"] = Field("processing", frozen=True)
    progress: int


class UploadCompletedStatus(BaseModel):
    status: Literal["completed"] = Field("completed", frozen=True)
    document_id: str


class UploadFailedStatus(BaseModel):
    status: Literal["failed"] = Field("failed", frozen=True)
    reason: str


UploadJobStatus = UploadProcessingStatus | UploadCompletedStatus | UploadFailedStatus

