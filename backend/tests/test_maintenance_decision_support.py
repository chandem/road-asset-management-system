from app.services.maintenance_decision_support import build_decision_support_item


def test_positive_condition_improvement_calculates_cost_efficiency():
    item = build_decision_support_item(
        maintenance_id=1,
        activity_type="patching",
        priority="high",
        estimated_cost=100,
        actual_cost=120,
        condition_improvement=10,
    )
    assert item.cost_variance == 20
    assert item.cost_per_condition_point == 12
    assert item.evidence_status == "measured improvement"
    assert item.efficiency == round(10 / 120 * 1000, 4)


def test_missing_or_nonpositive_outcome_has_no_efficiency_measure():
    for improvement, expected in [(None, "no measurable condition outcome"), (0, "no measured improvement"), (-5, "measured deterioration")]:
        item = build_decision_support_item(
            maintenance_id=2,
            activity_type="repair",
            priority="medium",
            estimated_cost=100,
            actual_cost=110,
            condition_improvement=improvement,
        )
        assert item.cost_per_condition_point is None
        assert item.efficiency is None
        assert item.evidence_status == expected
