from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity
from app.services.maintenance_decision_support import build_decision_support_item

router = APIRouter(tags=["Maintenance Decision Support"])
DbSession = Annotated[Session, Depends(get_db)]


class DecisionSupportActivity(BaseModel):
    maintenance_id: int
    activity_type: str
    priority: str | None = None
    estimated_cost: float
    actual_cost: float
    condition_improvement: float | None = None
    cost_variance: float
    cost_per_condition_point: float | None = None
    efficiency: float | None = None
    evidence_status: str


class MaintenanceDecisionSupportResponse(BaseModel):
    road_id: int
    activity_count: int
    completed_count: int
    measurable_outcomes: int
    total_estimated_cost: float
    total_actual_cost: float
    total_cost_variance: float
    average_condition_improvement: float | None = None
    average_cost_per_condition_point: float | None = None
    activities: list[DecisionSupportActivity]
    by_efficiency: list[DecisionSupportActivity]
    high_cost_low_outcome: list[DecisionSupportActivity]


def _latest_rating(db: Session, section_id: int | None, inspection_date):
    if section_id is None:
        return None
    query = select(Inspection.condition_rating).where(
        Inspection.section_id == section_id,
        Inspection.condition_rating.is_not(None),
    )
    if inspection_date is not None:
        query = query.where(Inspection.inspection_date <= inspection_date)
    query = query.order_by(Inspection.inspection_date.desc(), Inspection.inspection_id.desc()).limit(1)
    value = db.scalar(query)
    return None if value is None else float(value)


@router.get(
    "/roads/{road_id}/maintenance-decision-support",
    response_model=MaintenanceDecisionSupportResponse,
)
def road_maintenance_decision_support(
    road_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    activities = db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.road_id == road_id)
        .order_by(MaintenanceActivity.maintenance_id)
    ).all()

    rows: list[DecisionSupportActivity] = []
    for activity in activities:
        pre = _latest_rating(db, activity.section_id, activity.planned_date)
        post = _latest_rating(db, activity.section_id, activity.completed_date) if activity.completed_date else None
        improvement = None if pre is None or post is None else round(post - pre, 2)
        item = build_decision_support_item(
            maintenance_id=activity.maintenance_id,
            activity_type=activity.activity_type,
            priority=activity.priority,
            estimated_cost=float(activity.estimated_cost or 0),
            actual_cost=float(activity.actual_cost or 0),
            condition_improvement=improvement,
        )
        rows.append(DecisionSupportActivity.model_validate(item.__dict__))

    measurable = [row for row in rows if row.condition_improvement is not None]
    positive_efficiency = [row for row in rows if row.efficiency is not None]
    average_improvement = None if not measurable else round(
        sum(row.condition_improvement for row in measurable) / len(measurable), 2
    )
    average_cost_per_point = None if not positive_efficiency else round(
        sum(row.cost_per_condition_point for row in positive_efficiency) / len(positive_efficiency), 2
    )

    by_efficiency = sorted(
        positive_efficiency,
        key=lambda row: (-row.efficiency, row.actual_cost, row.maintenance_id),
    )
    # Factual flag: actual cost is above estimate and there is no positive measured outcome.
    high_cost_low_outcome = [
        row for row in rows
        if row.actual_cost > row.estimated_cost and (row.condition_improvement is None or row.condition_improvement <= 0)
    ]

    return MaintenanceDecisionSupportResponse(
        road_id=road_id,
        activity_count=len(rows),
        completed_count=sum(1 for activity in activities if activity.status == "completed"),
        measurable_outcomes=len(measurable),
        total_estimated_cost=round(sum(row.estimated_cost for row in rows), 2),
        total_actual_cost=round(sum(row.actual_cost for row in rows), 2),
        total_cost_variance=round(sum(row.cost_variance for row in rows), 2),
        average_condition_improvement=average_improvement,
        average_cost_per_condition_point=average_cost_per_point,
        activities=rows,
        by_efficiency=by_efficiency,
        high_cost_low_outcome=high_cost_low_outcome,
    )
