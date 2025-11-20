from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import boto3
from botocore.client import Config

from ..core.config import get_settings


@dataclass
class StoredObject:
    bucket: str
    key: str
    content_type: str


class StorageService:
    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
        )

    def upload(self, *, key: str, data: BytesIO, content_type: str) -> StoredObject:
        self._client.upload_fileobj(
            Fileobj=data,
            Bucket=self._bucket,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )
        return StoredObject(bucket=self._bucket, key=key, content_type=content_type)

