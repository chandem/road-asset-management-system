"""Object storage for field images.

Backends:
  - local (default): writes under UPLOAD_DIR (survives only as long as the disk)
  - s3: any S3-compatible API (AWS S3, Cloudflare R2, MinIO)

Environment:
  STORAGE_BACKEND=local|s3
  UPLOAD_DIR=uploads/images
  S3_BUCKET=
  S3_REGION=auto
  S3_ENDPOINT_URL=          # required for R2/MinIO, e.g. https://xxx.r2.cloudflarestorage.com
  S3_ACCESS_KEY_ID=
  S3_SECRET_ACCESS_KEY=
  S3_PUBLIC_BASE_URL=       # optional CDN/public URL prefix for stored keys
  S3_PREFIX=rams/images     # key prefix inside the bucket
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from uuid import uuid4


class StorageError(RuntimeError):
    """Raised when an object cannot be stored."""


class ObjectStorage:
    """Store and reference binary objects (field photos)."""

    def __init__(self) -> None:
        self.backend = os.getenv("STORAGE_BACKEND", "local").strip().lower()
        self.upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads/images")).expanduser()
        self.s3_bucket = os.getenv("S3_BUCKET", "").strip()
        self.s3_region = os.getenv("S3_REGION", "auto").strip() or "auto"
        self.s3_endpoint = os.getenv("S3_ENDPOINT_URL", "").strip() or None
        self.s3_access_key = os.getenv("S3_ACCESS_KEY_ID", "").strip() or None
        self.s3_secret_key = os.getenv("S3_SECRET_ACCESS_KEY", "").strip() or None
        self.s3_public_base = os.getenv("S3_PUBLIC_BASE_URL", "").strip().rstrip("/") or None
        self.s3_prefix = os.getenv("S3_PREFIX", "rams/images").strip().strip("/")
        self._client = None

    def status(self) -> dict:
        ready = True
        message = f"Using {self.backend} storage."
        if self.backend == "s3":
            if not self.s3_bucket:
                ready = False
                message = "STORAGE_BACKEND=s3 but S3_BUCKET is not set."
            elif not self.s3_access_key or not self.s3_secret_key:
                ready = False
                message = "S3 credentials missing (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)."
            else:
                try:
                    import boto3  # noqa: F401
                except ImportError:
                    ready = False
                    message = "boto3 is not installed. Run: pip install boto3"
                else:
                    message = (
                        f"S3 storage ready (bucket={self.s3_bucket}, "
                        f"endpoint={self.s3_endpoint or 'default'})."
                    )
        return {
            "backend": self.backend,
            "ready": ready,
            "upload_dir": str(self.upload_dir),
            "s3_bucket": self.s3_bucket or None,
            "s3_prefix": self.s3_prefix,
            "message": message,
        }

    def _s3_client(self):
        if self._client is not None:
            return self._client
        try:
            import boto3
        except ImportError as exc:
            raise StorageError(
                "boto3 is required for S3 storage. pip install boto3"
            ) from exc
        kwargs = {
            "service_name": "s3",
            "region_name": self.s3_region,
            "aws_access_key_id": self.s3_access_key,
            "aws_secret_access_key": self.s3_secret_key,
        }
        if self.s3_endpoint:
            kwargs["endpoint_url"] = self.s3_endpoint
        self._client = boto3.client(**kwargs)
        return self._client

    def store(
        self,
        data: bytes,
        *,
        original_name: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Persist bytes and return a durable reference string for file_path."""
        suffix = Path(original_name or "image.jpg").suffix.lower() or ".jpg"
        key_name = f"{uuid4().hex}{suffix}"

        if self.backend == "s3":
            if not self.s3_bucket:
                raise StorageError("S3_BUCKET is not configured")
            key = f"{self.s3_prefix}/{key_name}" if self.s3_prefix else key_name
            try:
                self._s3_client().put_object(
                    Bucket=self.s3_bucket,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
            except Exception as exc:
                raise StorageError(f"S3 upload failed: {exc}") from exc
            if self.s3_public_base:
                return f"{self.s3_public_base}/{key}"
            return f"s3://{self.s3_bucket}/{key}"

        # local fallback
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        path = self.upload_dir / key_name
        path.write_bytes(data)
        return str(path)

    def delete(self, reference: str) -> None:
        """Best-effort delete; ignores missing objects."""
        if not reference:
            return
        if reference.startswith("s3://") or (
            self.s3_public_base and reference.startswith(self.s3_public_base)
        ):
            if self.backend != "s3":
                return
            try:
                if reference.startswith("s3://"):
                    # s3://bucket/key
                    without = reference[5:]
                    bucket, _, key = without.partition("/")
                else:
                    bucket = self.s3_bucket
                    key = reference[len(self.s3_public_base) :].lstrip("/")
                if bucket and key:
                    self._s3_client().delete_object(Bucket=bucket, Key=key)
            except Exception:
                pass
            return
        path = Path(reference)
        if path.is_file():
            path.unlink(missing_ok=True)


_storage: Optional[ObjectStorage] = None


def get_storage() -> ObjectStorage:
    global _storage
    if _storage is None:
        _storage = ObjectStorage()
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
