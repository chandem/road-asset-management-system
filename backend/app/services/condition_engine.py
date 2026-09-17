from collections.abc import Iterable
from dataclasses import dataclass


SEVERITY_PENALTY = {
    "critical": 35.0,
    "high": 25.0,
    "medium": 12.0,
    "low": 5.0,
}

TYPE_WEIGHT = {
    "pothole": 1.00,
    "cracking": 0.85,
    "rutting": 0.90,
    "drainage": 0.80,
    "erosion": 0.75,
}

RECOMMENDATION_BY_PRIORITY = {
    "critical": "Emergency repair / immediate rehabilitation assessment",
    "high": "Prioritize rehabilitation or major maintenance",
    "medium": "Schedule preventive or routine maintenance",
    "low": "Monitor and include in routine maintenance",
}


@dataclass(frozen=True)
class ConditionAssessment:
    score: float
    category: str
    priority: str
    recommendation: str
    defect_impact: float
    defect_count: int


def condition_category(score: float) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Fair"
    if score >= 30:
        return "Poor"
    return "Critical"


def maintenance_priority(score: float, critical_count: int, high_count: int) -> str:
    if score < 30 or critical_count > 0:
        return "critical"
    if score < 50 or high_count >= 2:
        return "high"
    if score < 70 or high_count == 1:
        return "medium"
    return "low"


def assess_condition(
    inspection_rating: float | None,
    defects: Iterable[dict],
) -> ConditionAssessment:
    """Calculate a transparent 0-100 condition score from inspection + defects.

    Inspection rating is the baseline when available; otherwise the baseline is 100.
    Defect impact is capped at 70 points so a single data source cannot produce a
    negative score. Agencies can later replace these constants with configurable
    standards without changing the API contract.
    """
    baseline = 100.0 if inspection_rating is None else max(0.0, min(100.0, float(inspection_rating)))
    impact = 0.0
    critical_count = high_count = 0
    defect_count = 0

    for defect in defects:
        severity = str(defect.get("severity") or "low").strip().lower()
        defect_type = str(defect.get("defect_type") or "").strip().lower()
        penalty = SEVERITY_PENALTY.get(severity, 5.0)
        type_weight = TYPE_WEIGHT.get(defect_type, 0.60)
        quantity_factor = 1.0
        for key in ("length_m", "width_m", "depth_mm"):
            value = defect.get(key)
            if value is not None and float(value) > 0:
                quantity_factor += min(float(value) / (100.0 if key != "depth_mm" else 500.0), 1.0) * 0.25
        impact += penalty * type_weight * quantity_factor
        defect_count += 1
        if severity == "critical":
            critical_count += 1
        elif severity == "high":
            high_count += 1

    defect_impact = min(70.0, impact)
    score = max(0.0, min(100.0, baseline - defect_impact))
    category = condition_category(score)
    priority = maintenance_priority(score, critical_count, high_count)
    recommendation = RECOMMENDATION_BY_PRIORITY[priority]

    return ConditionAssessment(
        score=round(score, 2),
        category=category,
        priority=priority,
        recommendation=recommendation,
        defect_impact=round(defect_impact, 2),
        defect_count=defect_count,
    )
