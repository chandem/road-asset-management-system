from dataclasses import dataclass
from datetime import date
from typing import Iterable

PRIORITY_POINTS = {
    "critical": 100.0,
    "high": 80.0,
    "medium": 60.0,
    "low": 40.0,
}

STATUS_URGENCY = {
    "planned": 0.0,
    "in progress": 10.0,
    "completed": 0.0,
    "cancelled": -100.0,
}


@dataclass(frozen=True)
class OptimizationCandidate:
    maintenance_id: int
    activity_type: str
    priority: str
    condition_score: float | None
    estimated_cost: float
    planned_date: date | None
    score: float
    overdue: bool


@dataclass(frozen=True)
class OptimizationResult:
    recommended: list[OptimizationCandidate]
    excluded: list[OptimizationCandidate]
    total_recommended_cost: float
    budget: float | None
    remaining_budget: float | None


def optimization_score(
    priority: str | None,
    condition_score: float | None,
    planned_date: date | None,
    status: str | None,
    today: date | None = None,
) -> tuple[float, bool]:
    """Return a transparent 0-100+ urgency score and overdue flag.

    Weights are deliberately simple and documented: 55% priority, 30% condition
    deterioration, and 15% timing/status urgency. A lower condition score means
    greater need. Overdue activities receive an additional timing signal.
    """
    today = today or date.today()
    priority_points = PRIORITY_POINTS.get((priority or "low").lower(), 40.0)
    condition_points = 50.0 if condition_score is None else max(0.0, min(100.0, 100.0 - float(condition_score)))
    overdue = planned_date is not None and planned_date < today and status not in {"completed", "cancelled"}
    urgency_points = STATUS_URGENCY.get((status or "planned").lower(), 0.0)
    if overdue:
        urgency_points += 25.0
    score = priority_points * 0.55 + condition_points * 0.30 + max(0.0, min(100.0, urgency_points)) * 0.15
    return round(score, 2), overdue


def optimize_maintenance(
    candidates: Iterable[OptimizationCandidate],
    budget: float | None,
) -> OptimizationResult:
    """Rank activities and select the highest-scoring set that fits the budget.

    The selection is greedy by score, then priority, then lower cost. This keeps
    the recommendation predictable and easy to explain to road engineers.
    """
    ranked = sorted(
        candidates,
        key=lambda item: (-item.score, -PRIORITY_POINTS.get(item.priority, 40.0), item.estimated_cost, item.maintenance_id),
    )

    if budget is None:
        recommended = ranked
        excluded: list[OptimizationCandidate] = []
    else:
        remaining = max(0.0, float(budget))
        recommended = []
        excluded = []
        for item in ranked:
            if item.estimated_cost <= remaining:
                recommended.append(item)
                remaining -= item.estimated_cost
            else:
                excluded.append(item)

    total = round(sum(item.estimated_cost for item in recommended), 2)
    remaining_budget = None if budget is None else round(float(budget) - total, 2)
    return OptimizationResult(
        recommended=recommended,
        excluded=excluded,
        total_recommended_cost=total,
        budget=None if budget is None else float(budget),
        remaining_budget=remaining_budget,
    )
