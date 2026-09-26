import os
from urllib.parse import urlparse


def _csv_env(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def _origin_allowed(origin: str, allowed: list[str]) -> bool:
    """Exact match, or https://*.vercel.app when CORS_ALLOW_VERCEL is enabled."""
    if not origin:
        return False
    if origin in allowed:
        return True
    allow_vercel = os.getenv("CORS_ALLOW_VERCEL", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if allow_vercel:
        try:
            parsed = urlparse(origin)
            host = (parsed.hostname or "").lower()
            if parsed.scheme == "https" and (
                host == "vercel.app" or host.endswith(".vercel.app")
            ):
                return True
        except Exception:
            return False
    return False


class Settings:
    app_name = os.getenv("APP_NAME", "RoadMI — Road Asset Management System")
    debug = os.getenv("DEBUG", "false").lower() == "true"
    database_url = os.getenv("DATABASE_URL")
    cors_allowed_origins = _csv_env(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    trusted_hosts = _csv_env(
        "TRUSTED_HOSTS",
        "localhost,127.0.0.1",
    )

    # Object storage for field photos (see app.services.object_storage)
    storage_backend = os.getenv("STORAGE_BACKEND", "local").strip().lower()
    upload_dir = os.getenv("UPLOAD_DIR", "uploads/images")
    s3_bucket = os.getenv("S3_BUCKET", "")
    s3_endpoint_url = os.getenv("S3_ENDPOINT_URL", "")

    # AI detection (see app.services.defect_detector)
    ai_model_path = os.getenv("AI_MODEL_PATH", "models/road_defect.pt")
    ai_stub_mode = os.getenv("AI_STUB_MODE", "false").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    def is_cors_origin_allowed(self, origin: str) -> bool:
        return _origin_allowed(origin, self.cors_allowed_origins)


settings = Settings()
