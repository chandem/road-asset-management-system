from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity
from app.models.work_order import WorkOrder
from app.models.work_order_execution import WorkOrderExecution
from app.models.road_section import RoadSection
from pydantic import BaseModel

router = APIRouter(tags=["Maintenance Effectiveness"])
DbSession = Annotated[Session, Depends(get_db)]


class MaintenanceEffectivenessItem(BaseModel):
    maintenance_id: int
    activity_type: str
    priority: str | None = None
    estimated_cost: float
    actual_cost: float
    pre_condition_score: float | None = None
    post_condition_score: float | None = None
    condition_improvement: float | None = None
    cost_variance: float
    cost_variance_percent: float | None = None
    status: str
    planned_quantity: float | None = None
    actual_quantity: float | None = None
    quantity_variance: float | None = None
    quantity_variance_percent: float | None = None
    planned_date: str | None = None
    completed_date: str | None = None
    schedule_delay_days: int | None = None
    verification_result: str | None = None


class MaintenanceEffectivenessResponse(BaseModel):
    road_id: int | None
    activity_count: int
    completed_count: int
    total_estimated_cost: float
    total_actual_cost: float
    total_cost_variance: float
    average_condition_improvement: float | None = None
    measurable_outcomes: int
    activities: list[MaintenanceEffectivenessItem]


def _latest_rating(db: Session, section_id: int | None, exclude_date=None):
    if section_id is None:
        return None
    query = select(Inspection.condition_rating).where(
        Inspection.section_id == section_id,
        Inspection.condition_rating.is_not(None),
    )
    if exclude_date is not None:
        query = query.where(Inspection.inspection_date <= exclude_date)
    query = query.order_by(Inspection.inspection_date.desc(), Inspection.inspection_id.desc()).limit(1)
    value = db.scalar(query)
    return None if value is None else float(value)


@router.get(
    "/roads/{road_id}/maintenance-effectiveness",
    response_model=MaintenanceEffectivenessResponse,
)
def road_maintenance_effectiveness(
    road_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    activities = db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.road_id == road_id)
        .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)
    ).all()

    if not activities:
        return MaintenanceEffectivenessResponse(
            road_id=road_id,
            activity_count=0,
            completed_count=0,
            total_estimated_cost=0,
            total_actual_cost=0,
            total_cost_variance=0,
            average_condition_improvement=None,
            measurable_outcomes=0,
            activities=[],
        )

    rows = []
    for activity in activities:
        estimated = float(activity.estimated_cost or 0)
        actual = float(activity.actual_cost or 0)
        pre = _latest_rating(db, activity.section_id, activity.planned_date)
        post = _latest_rating(db, activity.section_id, activity.completed_date) if activity.completed_date else None
        improvement = None if pre is None or post is None else round(post - pre, 2)
        variance = round(actual - estimated, 2)
        variance_percent = None if estimated == 0 else round((variance / estimated) * 100, 2)
        execution = db.scalar(
            select(WorkOrderExecution)
            .join(WorkOrder, WorkOrder.work_order_id == WorkOrderExecution.work_order_id)
            .where(WorkOrder.maintenance_id == activity.maintenance_id)
            .order_by(WorkOrderExecution.updated_at.desc(), WorkOrderExecution.execution_id.desc())
            .limit(1)
        )
        planned_quantity = None if execution is None or execution.planned_quantity is None else float(execution.planned_quantity)
        actual_quantity = None if execution is None or execution.actual_quantity is None else float(execution.actual_quantity)
        quantity_variance = None if planned_quantity is None or actual_quantity is None else round(actual_quantity - planned_quantity, 3)
        quantity_variance_percent = None if planned_quantity in (None, 0) or quantity_variance is None else round((quantity_variance / planned_quantity) * 100, 2)
        schedule_delay_days = None
        if activity.planned_date and activity.completed_date:
            schedule_delay_days = max((activity.completed_date - activity.planned_date).days, 0)
        rows.append(
            MaintenanceEffectivenessItem(
                maintenance_id=activity.maintenance_id,
                activity_type=activity.activity_type,
                priority=activity.priority,
                estimated_cost=estimated,
                actual_cost=actual,
                pre_condition_score=pre,
                post_condition_score=post,
                condition_improvement=improvement,
                cost_variance=variance,
                cost_variance_percent=variance_percent,
                status=activity.status,
                planned_quantity=planned_quantity,
                actual_quantity=actual_quantity,
                quantity_variance=quantity_variance,
                quantity_variance_percent=quantity_variance_percent,
                planned_date=activity.planned_date.isoformat() if activity.planned_date else None,
                completed_date=activity.completed_date.isoformat() if activity.completed_date else None,
                schedule_delay_days=schedule_delay_days,
            )
        )

    improvements = [row.condition_improvement for row in rows if row.condition_improvement is not None]
    return MaintenanceEffectivenessResponse(
        road_id=road_id,
        activity_count=len(rows),
        completed_count=sum(1 for row in rows if row.status == "completed"),
        total_estimated_cost=round(sum(row.estimated_cost for row in rows), 2),
        total_actual_cost=round(sum(row.actual_cost for row in rows), 2),
        total_cost_variance=round(sum(row.cost_variance for row in rows), 2),
        average_condition_improvement=None if not improvements else round(sum(improvements) / len(improvements), 2),
        measurable_outcomes=len(improvements),
        activities=rows,
    )


@router.get(
    "/maintenance/{maintenance_id}/effectiveness",
    response_model=MaintenanceEffectivenessItem,
)
def maintenance_effectiveness(
    maintenance_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    result = road_maintenance_effectiveness(activity.road_id, db, current_user)
    for item in result.activities:
        if item.maintenance_id == maintenance_id:
            return item
    raise HTTPException(status_code=404, detail="Maintenance effectiveness not found")
