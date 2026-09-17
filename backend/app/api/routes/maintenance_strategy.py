from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity

from pydantic import BaseModel

router = APIRouter(tags=["Maintenance Strategy"])
DbSession = Annotated[Session, Depends(get_db)]


class MaintenanceStrategyItem(BaseModel):
    activity_type: str
    completed_count: int
    measurable_outcomes: int
    average_condition_improvement: float | None = None
    average_estimated_cost: float
    average_actual_cost: float
    average_cost_variance_percent: float | None = None
    condition_improvement_per_1000_cost: float | None = None


class MaintenanceStrategyResponse(BaseModel):
    road_id: int | None
    activity_count: int
    completed_count: int
    strategies: list[MaintenanceStrategyItem]


def _latest_rating(db: Session, section_id: int, before_date=None):
    query = select(Inspection.condition_rating).where(
        Inspection.section_id == section_id,
        Inspection.condition_rating.is_not(None),
    )
    if before_date is not None:
        query = query.where(Inspection.inspection_date <= before_date)
    value = db.scalar(query.order_by(Inspection.inspection_date.desc(), Inspection.inspection_id.desc()).limit(1))
    return None if value is None else float(value)


@router.get("/maintenance-strategy", response_model=MaintenanceStrategyResponse)
def maintenance_strategy(
    db: DbSession,
    current_user: AuthenticatedUser,
    road_id: int | None = None,
):
    query = select(MaintenanceActivity)
    if road_id is not None:
        query = query.where(MaintenanceActivity.road_id == road_id)
    activities = db.scalars(query).all()

    groups: dict[str, dict] = {}
    for activity in activities:
        key = activity.activity_type
        group = groups.setdefault(key, {
            "completed": 0,
            "improvements": [],
            "estimated": [],
            "actual": [],
            "variance_percent": [],
        })
        if activity.status == "completed":
            group["completed"] += 1
            estimated = float(activity.estimated_cost or 0)
            actual = float(activity.actual_cost or 0)
            pre = _latest_rating(db, activity.section_id, activity.planned_date) if activity.section_id else None
            post = _latest_rating(db, activity.section_id, activity.completed_date) if activity.section_id and activity.completed_date else None
            if pre is not None and post is not None:
                group["improvements"].append(post - pre)
            if estimated > 0:
                group["variance_percent"].append(((actual - estimated) / estimated) * 100)
        group["estimated"].append(float(activity.estimated_cost or 0))
        group["actual"].append(float(activity.actual_cost or 0))

    strategies = []
    for activity_type, group in sorted(groups.items()):
        improvements = group["improvements"]
        estimated = group["estimated"]
        actual = group["actual"]
        variance = group["variance_percent"]
        avg_improvement = None if not improvements else sum(improvements) / len(improvements)
        avg_actual = sum(actual) / len(actual) if actual else 0
        efficiency = None if avg_improvement is None or avg_actual <= 0 else (avg_improvement / avg_actual) * 1000
        strategies.append(MaintenanceStrategyItem(
            activity_type=activity_type,
            completed_count=group["completed"],
            measurable_outcomes=len(improvements),
            average_condition_improvement=None if avg_improvement is None else round(avg_improvement, 2),
            average_estimated_cost=round(sum(estimated) / len(estimated), 2) if estimated else 0,
            average_actual_cost=round(avg_actual, 2),
            average_cost_variance_percent=None if not variance else round(sum(variance) / len(variance), 2),
            condition_improvement_per_1000_cost=None if efficiency is None else round(efficiency, 2),
        ))

    return MaintenanceStrategyResponse(
        road_id=road_id,
        activity_count=len(activities),
        completed_count=sum(1 for a in activities if a.status == "completed"),
        strategies=strategies,
    )
