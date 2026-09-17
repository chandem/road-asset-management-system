from pathlib import Path

from ai.validate_dataset import validate_dataset



def _write_dataset(root: Path) -> None:
    for split in ("train", "val"):
        (root / "images" / split).mkdir(parents=True)
        (root / "labels" / split).mkdir(parents=True)

    (root / "images" / "train" / "road_001.jpg").write_bytes(b"image")
    (root / "labels" / "train" / "road_001.txt").write_text(
        "3 0.5 0.5 0.2 0.1\n", encoding="utf-8"
    )
    (root / "images" / "val" / "road_002.jpg").write_bytes(b"image")
    (root / "labels" / "val" / "road_002.txt").write_text("", encoding="utf-8")


def test_valid_dataset_passes(tmp_path):
    _write_dataset(tmp_path)
    reports = validate_dataset(tmp_path)

    assert all(report.ok for report in reports)
    assert reports[0].image_count == 1
    assert reports[0].label_count == 1
    assert reports[1].empty_label_count == 1


def test_invalid_class_and_coordinates_are_reported(tmp_path):
    _write_dataset(tmp_path)
    label = tmp_path / "labels" / "train" / "road_001.txt"
    label.write_text("9 1.2 0.5 0 0.2\n", encoding="utf-8")

    reports = validate_dataset(tmp_path)

    assert not reports[0].ok
    assert any("class_id 9" in error for error in reports[0].errors)
    assert any("between 0 and 1" in error for error in reports[0].errors)
    assert any("width and height" in error for error in reports[0].errors)


def test_missing_label_is_warning_not_error(tmp_path):
    _write_dataset(tmp_path)
    (tmp_path / "labels" / "train" / "road_001.txt").unlink()

    reports = validate_dataset(tmp_path)

    assert reports[0].ok
    assert any("Missing label file" in warning for warning in reports[0].warnings)
