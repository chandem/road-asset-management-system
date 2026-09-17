from fastapi import FastAPI

from app.api.routes.ai_detection import router as ai_detection_router
from app.api.routes.auth import router as auth_router
from app.api.routes.chainage_points import router as chainage_points_router
from app.api.routes.condition_assessment import router as condition_assessment_router
from app.api.routes.gps_tracks import router as gps_tracks_router
from app.api.routes.images import router as images_router
from app.api.routes.inspection_workflow import router as inspection_workflow_router
from app.api.routes.inspections import router as inspections_router
from app.api.routes.maintenance import router as maintenance_router
from app.api.routes.maintenance_plans import router as maintenance_plans_router
from app.api.routes.reports import router as reports_router
from app.api.routes.road_assets import router as road_assets_router
from app.api.routes.road_defects import router as road_defects_router
from app.api.routes.road_sections import router as road_sections_router
from app.api.routes.roads import router as roads_router
from app.api.routes.users import router as users_router
from app.core.config import settings

app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.9.0",
    debug=settings.debug,
)

app.include_router(roads_router, prefix="/api/v1")
app.include_router(road_sections_router, prefix="/api/v1")
app.include_router(chainage_points_router, prefix="/api/v1")
app.include_router(road_assets_router, prefix="/api/v1")
app.include_router(inspections_router, prefix="/api/v1")
app.include_router(inspection_workflow_router, prefix="/api/v1")
app.include_router(road_defects_router, prefix="/api/v1")
app.include_router(maintenance_router, prefix="/api/v1")
app.include_router(maintenance_plans_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(condition_assessment_router, prefix="/api/v1")
app.include_router(gps_tracks_router, prefix="/api/v1")
app.include_router(images_router, prefix="/api/v1")
app.include_router(ai_detection_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "rams-api"}
