from fastapi import FastAPI

from app.api.routes.roads import router as roads_router
from app.core.config import settings

app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.2.0",
    debug=settings.debug,
)

app.include_router(roads_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "rams-api"}
