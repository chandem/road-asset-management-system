"""Aggregated dashboard metrics and attention items for Overview."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.gps_track import GPSTrack
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_plan import MaintenancePlan
from app.models.road import Road
from app.models.road_asset import RoadAsset
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.models.work_order import WorkOrder
from app.models.work_order_verification import WorkOrderVerification

router = APIRouter(tags=["Dashboard"])
DbSession = Annotated[Session, Depends(get_db)]

HIGH_SEVERITY = ("high", "critical", "severe", "very high")
OPEN_MAINT_STATUSES = ("planned", "approved", "in_progress", "scheduled")
CLOSED_WO = ("completed", "cancelled", "closed", "done")


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


@router.get("/dashboard/summary")
def dashboard_summary(db: DbSession, current_user: AuthenticatedUser) -> dict[str, Any]:
    """Single-call counts + lightweight road/section lists for the shell UI."""
    counts = {
        "roads": _count(db, Road),
        "sections": _count(db, RoadSection),
        "assets": _count(db, RoadAsset),
        "inspections": _count(db, Inspection),
        "defects": _count(db, RoadDefect),
        "maintenance": _count(db, MaintenanceActivity),
        "work_orders": _count(db, WorkOrder),
        "gps_tracks": _count(db, GPSTrack),
    }

    roads = [
        {
            "road_id": r.road_id,
            "road_code": r.road_code,
            "road_name": r.road_name,
            "road_class": r.road_class,
            "surface_type": r.surface_type,
            "total_length_km": float(r.total_length_km) if r.total_length_km is not None else None,
            "status": r.status,
        }
        for r in db.scalars(select(Road).order_by(Road.road_id)).all()
    ]

    sections = [
        {
            "section_id": s.section_id,
            "road_id": s.road_id,
            "section_code": s.section_code,
            "start_chainage": float(s.start_chainage) if s.start_chainage is not None else None,
            "end_chainage": float(s.end_chainage) if s.end_chainage is not None else None,
            "length_km": float(s.length_km) if s.length_km is not None else None,
            "surface_type": s.surface_type,
            "condition_rating": float(s.condition_rating) if s.condition_rating is not None else None,
        }
        for s in db.scalars(select(RoadSection).order_by(RoadSection.section_id)).all()
    ]

    return {"counts": counts, "roads": roads, "sections": sections}


@router.get("/dashboard/attention")
def dashboard_attention(db: DbSession, current_user: AuthenticatedUser) -> dict[str, Any]:
    """Items that need action: overdue work orders, high-severity defects, overdue maintenance, over-budget plans."""
    today = date.today()

    overdue_orders = []
    for wo in db.scalars(
        select(WorkOrder)
        .where(WorkOrder.due_date.is_not(None))
        .where(WorkOrder.due_date < today)
        .where(WorkOrder.status.notin_(CLOSED_WO))
        .order_by(WorkOrder.due_date.asc())
        .limit(25)
    ).all():
        overdue_orders.append(
            {
                "work_order_id": wo.work_order_id,
                "order_number": wo.order_number,
                "due_date": wo.due_date.isoformat() if wo.due_date else None,
                "status": wo.status,
                "assigned_to": wo.assigned_to,
                "maintenance_id": wo.maintenance_id,
            }
        )

    high_defects = []
    for d in db.scalars(
        select(RoadDefect)
        .where(func.lower(RoadDefect.severity).in_(HIGH_SEVERITY))
        .order_by(RoadDefect.defect_id.desc())
        .limit(25)
    ).all():
        high_defects.append(
            {
                "defect_id": d.defect_id,
                "defect_type": d.defect_type,
                "severity": d.severity,
                "section_id": d.section_id,
                "chainage_km": float(d.chainage_km) if d.chainage_km is not None else None,
                "description": d.description,
            }
        )

    overdue_maintenance = []
    for m in db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.planned_date.is_not(None))
        .where(MaintenanceActivity.planned_date < today)
        .where(MaintenanceActivity.status.in_(OPEN_MAINT_STATUSES))
        .order_by(MaintenanceActivity.planned_date.asc())
        .limit(25)
    ).all():
        overdue_maintenance.append(
            {
                "maintenance_id": m.maintenance_id,
                "activity_type": m.activity_type,
                "priority": m.priority,
                "status": m.status,
                "planned_date": m.planned_date.isoformat() if m.planned_date else None,
                "road_id": m.road_id,
                "section_id": m.section_id,
            }
        )

    over_budget_plans = []
    plans = db.scalars(
        select(MaintenancePlan)
        .where(MaintenancePlan.budget.is_not(None))
        .where(MaintenancePlan.status.notin_(("cancelled", "archived")))
        .order_by(MaintenancePlan.plan_year.desc())
        .limit(50)
    ).all()
    for plan in plans:
        spent = db.scalar(
            select(
                func.coalesce(
                    func.sum(
                        func.coalesce(
                            MaintenanceActivity.actual_cost,
                            MaintenanceActivity.estimated_cost,
                        )
                    ),
                    0,
                )
            ).where(MaintenanceActivity.plan_id == plan.plan_id)
        )
        spent_f = float(spent or 0)
        budget_f = float(plan.budget or 0)
        if budget_f > 0 and spent_f > budget_f:
            over_budget_plans.append(
                {
                    "plan_id": plan.plan_id,
                    "name": plan.name,
                    "plan_year": plan.plan_year,
                    "budget": budget_f,
                    "spent": spent_f,
                    "over_by": round(spent_f - budget_f, 2),
                    "status": plan.status,
                }
            )

    return {
        "as_of": today.isoformat(),
        "overdue_work_orders": overdue_orders,
        "high_severity_defects": high_defects,
        "overdue_maintenance": overdue_maintenance,
        "over_budget_plans": over_budget_plans,
        "totals": {
            "overdue_work_orders": len(overdue_orders),
            "high_severity_defects": len(high_defects),
            "overdue_maintenance": len(overdue_maintenance),
            "over_budget_plans": len(over_budget_plans),
        },
    }


@router.get("/dashboard/kpis")
def dashboard_kpis(db: DbSession, current_user: AuthenticatedUser) -> dict[str, Any]:
    """Portfolio KPIs combining maintenance execution, cost, schedule and verification."""
    total_maintenance = _count(db, MaintenanceActivity)
    completed_maintenance = int(db.scalar(
        select(func.count()).select_from(MaintenanceActivity)
        .where(MaintenanceActivity.status == "completed")
    ) or 0)

    estimated = float(db.scalar(
        select(func.coalesce(func.sum(MaintenanceActivity.estimated_cost), 0))
    ) or 0)
    actual = float(db.scalar(
        select(func.coalesce(func.sum(MaintenanceActivity.actual_cost), 0))
    ) or 0)

    overdue = int(db.scalar(
        select(func.count()).select_from(MaintenanceActivity)
        .where(MaintenanceActivity.planned_date.is_not(None))
        .where(MaintenanceActivity.planned_date < date.today())
        .where(MaintenanceActivity.status.in_(OPEN_MAINT_STATUSES))
    ) or 0)

    verified = int(db.scalar(
        select(func.count()).select_from(WorkOrder)
        .join(MaintenanceActivity, MaintenanceActivity.maintenance_id == WorkOrder.maintenance_id)
        .join(WorkOrderVerification,
              WorkOrderVerification.work_order_id == WorkOrder.work_order_id)
    ) or 0)

    return {
        "as_of": date.today().isoformat(),
        "maintenance": {
            "total": total_maintenance,
            "completed": completed_maintenance,
            "completion_rate_percent": None if total_maintenance == 0 else round(completed_maintenance / total_maintenance * 100, 2),
            "overdue": overdue,
        },
        "cost": {
            "estimated": round(estimated, 2),
            "actual": round(actual, 2),
            "variance": round(actual - estimated, 2),
            "variance_percent": None if estimated == 0 else round((actual - estimated) / estimated * 100, 2),
        },
        "work_orders": {
            "total": _count(db, WorkOrder),
            "completed": int(db.scalar(select(func.count()).select_from(WorkOrder).where(WorkOrder.status == "completed")) or 0),
            "verified": verified,
        },
    }
