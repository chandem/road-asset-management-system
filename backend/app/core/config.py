import os


def _csv_env(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    app_name = os.getenv("APP_NAME", "Road Asset Management System")
    debug = os.getenv("DEBUG", "true").lower() == "true"
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://rams_user:change_me@localhost:5432/rams",
    )
    cors_allowed_origins = _csv_env(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    trusted_hosts = _csv_env(
        "TRUSTED_HOSTS",
        "localhost,127.0.0.1",
    )


settings = Settings()
