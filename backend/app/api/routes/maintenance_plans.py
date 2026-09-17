from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_plan import MaintenancePlan
from app.models.road_section import RoadSection
from app.schemas.maintenance_activity import MaintenanceActivityResponse
from app.schemas.maintenance_plan import (
    MaintenanceOptimizationItem,
    MaintenanceOptimizationResponse,
    MaintenancePlanCreate,
    MaintenancePlanResponse,
    MaintenancePlanSummaryResponse,
    MaintenancePlanUpdate,
)
from app.services.maintenance_optimizer import OptimizationCandidate, optimize_maintenance, optimization_score

router = APIRouter(tags=["Maintenance Plans"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/maintenance-plans", response_model=list[MaintenancePlanResponse])
def list_plans(db: DbSession, current_user: AuthenticatedUser):
    return db.scalars(
        select(MaintenancePlan).order_by(
            MaintenancePlan.plan_year.desc(), MaintenancePlan.plan_id.desc()
        )
    ).all()


@router.get("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
def get_plan(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    return plan


@router.get(
    "/maintenance-plans/{plan_id}/activities",
    response_model=list[MaintenanceActivityResponse],
)
def list_plan_activities(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(MaintenancePlan, plan_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    return db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.plan_id == plan_id)
        .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)
    ).all()


@router.get(
    "/maintenance-plans/{plan_id}/summary",
    response_model=MaintenancePlanSummaryResponse,
)
def get_plan_summary(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    rows = db.execute(
        select(
            MaintenanceActivity.status,
            MaintenanceActivity.priority,
            func.count(MaintenanceActivity.maintenance_id),
            func.coalesce(func.sum(MaintenanceActivity.estimated_cost), 0),
            func.coalesce(func.sum(MaintenanceActivity.actual_cost), 0),
        )
        .where(MaintenanceActivity.plan_id == plan_id)
        .group_by(MaintenanceActivity.status, MaintenanceActivity.priority)
    ).all()

    activity_count = 0
    completed_count = 0
    estimated_cost = 0.0
    actual_cost = 0.0
    priority_counts: dict[str, int] = {}

    for status, priority, count, estimated, actual in rows:
        activity_count += count
        if status == "completed":
            completed_count += count
        estimated_cost += float(estimated or 0)
        actual_cost += float(actual or 0)
        priority_key = priority or "unspecified"
        priority_counts[priority_key] = priority_counts.get(priority_key, 0) + count

    remaining_budget = None
    budget_utilization_percent = None
    if plan.budget is not None:
        remaining_budget = float(plan.budget) - actual_cost
        if plan.budget > 0:
            budget_utilization_percent = round((actual_cost / float(plan.budget)) * 100, 2)

    return MaintenancePlanSummaryResponse(
        plan_id=plan_id,
        activity_count=activity_count,
        completed_count=completed_count,
        estimated_cost=estimated_cost,
        actual_cost=actual_cost,
        remaining_budget=remaining_budget,
        budget_utilization_percent=budget_utilization_percent,
        priority_counts=priority_counts,
    )


@router.get(
    "/maintenance-plans/{plan_id}/optimization",
    response_model=MaintenanceOptimizationResponse,
)
def get_plan_optimization(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    activities = db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.plan_id == plan_id)
    ).all()
    section_ids = {activity.section_id for activity in activities if activity.section_id is not None}
    sections = {
        section.section_id: section
        for section in db.scalars(select(RoadSection).where(RoadSection.section_id.in_(section_ids))).all()
    } if section_ids else {}

    candidates: list[OptimizationCandidate] = []
    for activity in activities:
        if activity.status == "cancelled":
            continue
        priority = activity.priority or "low"
        condition_score = None
        if activity.section_id in sections:
            rating = sections[activity.section_id].condition_rating
            condition_score = None if rating is None else float(rating)
        score, overdue = optimization_score(
            priority=priority,
            condition_score=condition_score,
            planned_date=activity.planned_date,
            status=activity.status,
        )
        candidates.append(
            OptimizationCandidate(
                maintenance_id=activity.maintenance_id,
                activity_type=activity.activity_type,
                priority=priority,
                condition_score=condition_score,
                estimated_cost=max(0.0, float(activity.estimated_cost or 0)),
                planned_date=activity.planned_date,
                score=score,
                overdue=overdue,
            )
        )

    result = optimize_maintenance(candidates, plan.budget)

    def serialize(items: list[OptimizationCandidate]) -> list[MaintenanceOptimizationItem]:
        cumulative = 0.0
        output = []
        budget = result.budget
        for item in items:
            cumulative += item.estimated_cost
            output.append(
                MaintenanceOptimizationItem(
                    maintenance_id=item.maintenance_id,
                    activity_type=item.activity_type,
                    priority=item.priority,
                    condition_score=item.condition_score,
                    estimated_cost=item.estimated_cost,
                    planned_date=item.planned_date,
                    score=item.score,
                    overdue=item.overdue,
                    cumulative_cost=round(cumulative, 2),
                    within_budget=budget is None or cumulative <= budget,
                )
            )
        return output

    recommended = serialize(result.recommended)
    excluded = serialize(result.excluded)
    total_candidate_cost = round(sum(item.estimated_cost for item in candidates), 2)

    return MaintenanceOptimizationResponse(
        plan_id=plan_id,
        budget=result.budget,
        total_candidate_cost=total_candidate_cost,
        total_recommended_cost=result.total_recommended_cost,
        remaining_budget=result.remaining_budget,
        recommended_count=len(recommended),
        excluded_count=len(excluded),
        recommended=recommended,
        excluded=excluded,
    )


@router.post("/maintenance-plans", response_model=MaintenancePlanResponse, status_code=201)
def create_plan(payload: MaintenancePlanCreate, db: DbSession, current_user: EngineerUser):
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    plan = MaintenancePlan(
        plan_year=payload.plan_year,
        name=payload.name,
        budget=payload.budget,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        description=payload.description,
    )
    db.add(plan)
    try:
        db.commit()
        db.refresh(plan)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create maintenance plan")
    return plan


@router.patch("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
def update_plan(
    plan_id: int,
    payload: MaintenancePlanUpdate,
    db: DbSession,
    current_user: EngineerUser,
):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(plan, field, value)

    if plan.start_date and plan.end_date and plan.end_date < plan.start_date:
        db.rollback()
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/maintenance-plans/{plan_id}/status", response_model=MaintenancePlanResponse)
def update_plan_status(plan_id: int, status: str, db: DbSession, current_user: EngineerUser):
    allowed = {"draft", "approved", "in progress", "completed", "cancelled"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid maintenance plan status")
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    plan.status = status
    db.commit()
    db.refresh(plan)
    return plan


def _validate_activity_for_plan(plan: MaintenancePlan, activity: MaintenanceActivity) -> None:
    if activity.planned_date is None:
        return
    if plan.start_date and activity.planned_date < plan.start_date:
        raise HTTPException(status_code=400, detail="Activity planned_date is before the plan start_date")
    if plan.end_date and activity.planned_date > plan.end_date:
        raise HTTPException(status_code=400, detail="Activity planned_date is after the plan end_date")


@router.post(
    "/maintenance-plans/{plan_id}/activities/{maintenance_id}",
    response_model=MaintenanceActivityResponse,
)
def assign_activity_to_plan(
    plan_id: int,
    maintenance_id: int,
    db: DbSession,
    current_user: EngineerUser,
):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")

    _validate_activity_for_plan(plan, activity)
    activity.plan_id = plan_id
    db.commit()
    db.refresh(activity)
    return activity


@router.delete(
    "/maintenance-plans/{plan_id}/activities/{maintenance_id}",
    response_model=MaintenanceActivityResponse,
)
def unassign_activity_from_plan(
    plan_id: int,
    maintenance_id: int,
    db: DbSession,
    current_user: EngineerUser,
):
    if db.get(MaintenancePlan, plan_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    if activity.plan_id != plan_id:
        raise HTTPException(status_code=400, detail="Maintenance activity is not assigned to this plan")

    activity.plan_id = None
    db.commit()
    db.refresh(activity)
    return activity
