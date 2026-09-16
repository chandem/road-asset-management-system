from fastapi import FastAPI

from app.api.routes.chainage_points import router as chainage_points_router
from app.api.routes.road_assets import router as road_assets_router
from app.api.routes.road_sections import router as road_sections_router
from app.api.routes.roads import router as roads_router
from app.core.config import settings

app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.5.0",
    debug=settings.debug,
)

app.include_router(roads_router, prefix="/api/v1")
app.include_router(road_sections_router, prefix="/api/v1")
app.include_router(chainage_points_router, prefix="/api/v1")
app.include_router(road_assets_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "rams-api"}
