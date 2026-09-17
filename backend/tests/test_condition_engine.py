from app.services.condition_engine import assess_condition, condition_category, maintenance_priority


def test_condition_categories():
    assert condition_category(90) == "Excellent"
    assert condition_category(75) == "Good"
    assert condition_category(60) == "Fair"
    assert condition_category(40) == "Poor"
    assert condition_category(20) == "Critical"


def test_priority_uses_score_and_critical_defects():
    assert maintenance_priority(90, 0, 0) == "low"
    assert maintenance_priority(65, 0, 0) == "medium"
    assert maintenance_priority(45, 0, 0) == "high"
    assert maintenance_priority(90, 1, 0) == "critical"


def test_assessment_combines_inspection_and_defects():
    result = assess_condition(
        80,
        [
            {"defect_type": "pothole", "severity": "high", "length_m": 2, "width_m": 1, "depth_mm": 50},
            {"defect_type": "cracking", "severity": "medium"},
        ],
    )

    assert 0 <= result.score <= 100
    assert result.score < 80
    assert result.category in {"Excellent", "Good", "Fair", "Poor", "Critical"}
    assert result.priority in {"low", "medium", "high", "critical"}
    assert result.defect_count == 2
    assert result.defect_impact > 0
    assert result.recommendation


def test_assessment_without_inspection_uses_full_baseline():
    result = assess_condition(None, [])
    assert result.score == 100
    assert result.category == "Excellent"
    assert result.priority == "low"
