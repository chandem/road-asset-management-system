import os


class Settings:
    app_name = os.getenv("APP_NAME", "Road Asset Management System")
    debug = os.getenv("DEBUG", "true").lower() == "true"
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://rams_user:change_me@localhost:5432/rams",
    )


settings = Settings()
