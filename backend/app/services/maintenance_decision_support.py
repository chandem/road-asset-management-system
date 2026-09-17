from dataclasses import dataclass


@dataclass(frozen=True)
class DecisionSupportItem:
    maintenance_id: int
    activity_type: str
    priority: str | None
    estimated_cost: float
    actual_cost: float
    condition_improvement: float | None
    cost_variance: float
    cost_per_condition_point: float | None
    efficiency: float | None
    evidence_status: str


def build_decision_support_item(
    *,
    maintenance_id: int,
    activity_type: str,
    priority: str | None,
    estimated_cost: float,
    actual_cost: float,
    condition_improvement: float | None,
) -> DecisionSupportItem:
    estimated_cost = max(0.0, float(estimated_cost))
    actual_cost = max(0.0, float(actual_cost))
    improvement = None if condition_improvement is None else float(condition_improvement)
    variance = round(actual_cost - estimated_cost, 2)

    # Cost efficiency is only measurable when a positive condition improvement
    # was recorded. Negative improvement is retained as evidence, not hidden.
    if improvement is not None and improvement > 0 and actual_cost > 0:
        cost_per_point = round(actual_cost / improvement, 2)
        efficiency = round(improvement / actual_cost * 1000, 4)
    else:
        cost_per_point = None
        efficiency = None

    if improvement is None:
        evidence_status = "no measurable condition outcome"
    elif improvement > 0:
        evidence_status = "measured improvement"
    elif improvement == 0:
        evidence_status = "no measured improvement"
    else:
        evidence_status = "measured deterioration"

    return DecisionSupportItem(
        maintenance_id=maintenance_id,
        activity_type=activity_type,
        priority=priority,
        estimated_cost=estimated_cost,
        actual_cost=actual_cost,
        condition_improvement=None if improvement is None else round(improvement, 2),
        cost_variance=variance,
        cost_per_condition_point=cost_per_point,
        efficiency=efficiency,
        evidence_status=evidence_status,
    )
