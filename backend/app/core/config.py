import os


def _csv_env(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    app_name = os.getenv("APP_NAME", "RoadAMS — Road Asset Management System")
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


settings = Settings()
