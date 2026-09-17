from csv import DictWriter
from io import StringIO
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_plan import MaintenancePlan
from app.models.road import Road
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection

router = APIRouter(tags=["Reports"])
DbSession = Annotated[Session, Depends(get_db)]


def _float(value):
    return float(value) if value is not None else 0.0


@router.get("/reports/maintenance")
def maintenance_report(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
    plan_year: int | None = None,
    status: str | None = None,
):
    query = (
        select(MaintenanceActivity, Road.road_code, Road.road_name)
        .join(Road, Road.road_id == MaintenanceActivity.road_id)
        .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)
    )
    if road_id is not None:
        query = query.where(MaintenanceActivity.road_id == road_id)
    if status:
        query = query.where(MaintenanceActivity.status == status)
    if plan_year is not None:
        query = query.join(
            MaintenancePlan,
            MaintenancePlan.plan_id == MaintenanceActivity.plan_id,
            isouter=True,
        ).where(MaintenancePlan.plan_year == plan_year)

    rows = db.execute(query).all()
    items = []
    estimated = actual = 0.0
    completed = 0
    for activity, road_code, road_name in rows:
        estimated += _float(activity.estimated_cost)
        actual += _float(activity.actual_cost)
        completed += activity.status == "completed"
        items.append({
            "maintenance_id": activity.maintenance_id,
            "road_id": activity.road_id,
            "road_code": road_code,
            "road_name": road_name,
            "section_id": activity.section_id,
            "source_defect_id": activity.source_defect_id,
            "activity_type": activity.activity_type,
            "priority": activity.priority,
            "planned_date": activity.planned_date.isoformat() if activity.planned_date else None,
            "completed_date": activity.completed_date.isoformat() if activity.completed_date else None,
            "estimated_cost": _float(activity.estimated_cost),
            "actual_cost": _float(activity.actual_cost),
            "contractor": activity.contractor,
            "status": activity.status,
            "description": activity.description,
        })
    return {
        "filters": {"road_id": road_id, "plan_year": plan_year, "status": status},
        "summary": {
            "activity_count": len(items),
            "completed_count": completed,
            "estimated_cost": estimated,
            "actual_cost": actual,
            "cost_variance": actual - estimated,
        },
        "items": items,
    }


@router.get("/reports/roads/condition")
def road_condition_report(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
):
    query = (
        select(
            Road.road_id,
            Road.road_code,
            Road.road_name,
            func.count(RoadSection.section_id).label("section_count"),
            func.avg(RoadSection.condition_rating).label("average_condition"),
            func.min(RoadSection.condition_rating).label("minimum_condition"),
            func.max(RoadSection.condition_rating).label("maximum_condition"),
        )
        .join(RoadSection, RoadSection.road_id == Road.road_id, isouter=True)
        .group_by(Road.road_id, Road.road_code, Road.road_name)
        .order_by(Road.road_code)
    )
    if road_id is not None:
        query = query.where(Road.road_id == road_id)

    items = [
        {
            "road_id": row.road_id,
            "road_code": row.road_code,
            "road_name": row.road_name,
            "section_count": row.section_count,
            "average_condition": _float(row.average_condition) if row.average_condition is not None else None,
            "minimum_condition": _float(row.minimum_condition) if row.minimum_condition is not None else None,
            "maximum_condition": _float(row.maximum_condition) if row.maximum_condition is not None else None,
        }
        for row in db.execute(query)
    ]
    return {"items": items}


@router.get("/reports/defects")
def defect_report(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
    severity: str | None = None,
    defect_type: str | None = None,
):
    query = (
        select(
            RoadDefect.defect_id,
            RoadDefect.inspection_id,
            RoadDefect.section_id,
            RoadDefect.defect_type,
            RoadDefect.severity,
            RoadDefect.chainage_km,
            RoadDefect.length_m,
            RoadDefect.width_m,
            RoadDefect.depth_mm,
            RoadDefect.detected_by,
            Road.road_id,
            Road.road_code,
            Road.road_name,
        )
        .join(RoadSection, RoadSection.section_id == RoadDefect.section_id, isouter=True)
        .join(Road, Road.road_id == RoadSection.road_id, isouter=True)
        .order_by(RoadDefect.defect_id)
    )
    if road_id is not None:
        query = query.where(Road.road_id == road_id)
    if severity:
        query = query.where(RoadDefect.severity == severity)
    if defect_type:
        query = query.where(RoadDefect.defect_type == defect_type)

    rows = db.execute(query).all()
    items = [
        {
            "defect_id": row.defect_id,
            "inspection_id": row.inspection_id,
            "section_id": row.section_id,
            "road_id": row.road_id,
            "road_code": row.road_code,
            "road_name": row.road_name,
            "defect_type": row.defect_type,
            "severity": row.severity,
            "chainage_km": _float(row.chainage_km) if row.chainage_km is not None else None,
            "length_m": _float(row.length_m) if row.length_m is not None else None,
            "width_m": _float(row.width_m) if row.width_m is not None else None,
            "depth_mm": _float(row.depth_mm) if row.depth_mm is not None else None,
            "detected_by": row.detected_by,
        }
        for row in rows
    ]
    counts = db.execute(
        select(RoadDefect.severity, func.count(RoadDefect.defect_id))
        .join(RoadSection, RoadSection.section_id == RoadDefect.section_id, isouter=True)
        .group_by(RoadDefect.severity)
    ).all()
    return {
        "summary": {"defect_count": len(items), "by_severity": {severity or "unknown": count for severity, count in counts}},
        "items": items,
    }


@router.get("/reports/costs")
def cost_report(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
    plan_year: int | None = None,
):
    query = (
        select(
            MaintenanceActivity.road_id,
            Road.road_code,
            Road.road_name,
            func.coalesce(func.sum(MaintenanceActivity.estimated_cost), 0).label("estimated_cost"),
            func.coalesce(func.sum(MaintenanceActivity.actual_cost), 0).label("actual_cost"),
            func.count(MaintenanceActivity.maintenance_id).label("activity_count"),
        )
        .join(Road, Road.road_id == MaintenanceActivity.road_id)
        .group_by(MaintenanceActivity.road_id, Road.road_code, Road.road_name)
        .order_by(Road.road_code)
    )
    if road_id is not None:
        query = query.where(MaintenanceActivity.road_id == road_id)
    if plan_year is not None:
        query = query.join(MaintenancePlan, MaintenancePlan.plan_id == MaintenanceActivity.plan_id).where(MaintenancePlan.plan_year == plan_year)

    items = []
    total_estimated = total_actual = 0.0
    for row in db.execute(query):
        estimated = _float(row.estimated_cost)
        actual = _float(row.actual_cost)
        total_estimated += estimated
        total_actual += actual
        items.append({
            "road_id": row.road_id,
            "road_code": row.road_code,
            "road_name": row.road_name,
            "activity_count": row.activity_count,
            "estimated_cost": estimated,
            "actual_cost": actual,
            "variance": actual - estimated,
        })

    budget_query = select(func.coalesce(func.sum(MaintenancePlan.budget), 0))
    if plan_year is not None:
        budget_query = budget_query.where(MaintenancePlan.plan_year == plan_year)
    total_budget = _float(db.scalar(budget_query))
    return {
        "summary": {
            "budget": total_budget,
            "estimated_cost": total_estimated,
            "actual_cost": total_actual,
            "remaining_budget": total_budget - total_actual,
            "budget_utilization_percent": (total_actual / total_budget * 100) if total_budget else None,
        },
        "items": items,
    }


@router.get("/reports/maintenance.csv")
def maintenance_report_csv(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
    plan_year: int | None = None,
    status: str | None = None,
):
    report = maintenance_report(db, current_user, road_id, plan_year, status)
    output = StringIO()
    fieldnames = list(report["items"][0].keys()) if report["items"] else ["maintenance_id", "road_id", "road_code", "road_name", "section_id", "source_defect_id", "activity_type", "priority", "planned_date", "completed_date", "estimated_cost", "actual_cost", "contractor", "status", "description"]
    writer = DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(report["items"])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=maintenance-report.csv"},
    )


@router.get("/reports/export.xlsx")
def reports_export_xlsx(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
    plan_year: int | None = None,
    status: str | None = None,
):
    """Multi-sheet Excel workbook: Maintenance, Condition, Defects, Costs."""
    from app.api.routes.excel_export import build_reports_workbook

    maint = maintenance_report(db, current_user, road_id, plan_year, status)
    condition = road_condition_report(db, current_user, road_id)
    defects = defect_report(db, current_user, road_id)
    costs = cost_report(db, current_user, road_id, plan_year)
    return build_reports_workbook(maint, condition, defects, costs)
