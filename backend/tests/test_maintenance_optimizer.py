from datetime import date

from app.services.maintenance_optimizer import (
    OptimizationCandidate,
    optimize_maintenance,
    optimization_score,
)


def candidate(maintenance_id, score, cost, priority="medium"):
    return OptimizationCandidate(
        maintenance_id=maintenance_id,
        activity_type="repair",
        priority=priority,
        condition_score=None,
        estimated_cost=cost,
        planned_date=None,
        score=score,
        overdue=False,
    )


def test_optimization_selects_highest_ranked_items_within_budget():
    result = optimize_maintenance(
        [candidate(1, 90, 60), candidate(2, 80, 50), candidate(3, 70, 40)],
        budget=100,
    )

    assert [item.maintenance_id for item in result.recommended] == [1, 3]
    assert [item.maintenance_id for item in result.excluded] == [2]
    assert result.total_recommended_cost == 100
    assert result.remaining_budget == 0


def test_optimization_without_budget_recommends_all():
    result = optimize_maintenance([candidate(1, 50, 100), candidate(2, 40, 200)], None)
    assert len(result.recommended) == 2
    assert not result.excluded
    assert result.remaining_budget is None


def test_optimization_score_marks_overdue_activity():
    score, overdue = optimization_score(
        priority="high",
        condition_score=40,
        planned_date=date(2020, 1, 1),
        status="planned",
        today=date(2026, 1, 1),
    )
    assert overdue is True
    assert score > 50


def test_completed_activity_is_not_marked_overdue():
    _, overdue = optimization_score(
        priority="high",
        condition_score=40,
        planned_date=date(2020, 1, 1),
        status="completed",
        today=date(2026, 1, 1),
    )
    assert overdue is False
