"""Validate a YOLO-format RAMS road-defect dataset.

Usage:
    python ai/validate_dataset.py datasets/rdd2022

The validator intentionally has no third-party dependencies so it can be used
before installing the training stack. It validates annotation structure and
reports warnings for missing label files and orphan labels.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


@dataclass
class DatasetReport:
    split: str
    image_count: int = 0
    label_count: int = 0
    empty_label_count: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def load_classes(classes_file: Path) -> list[str]:
    if not classes_file.exists():
        raise FileNotFoundError(f"Classes file not found: {classes_file}")
    classes = [line.strip() for line in classes_file.read_text(encoding="utf-8").splitlines()]
    classes = [name for name in classes if name and not name.startswith("#")]
    if not classes:
        raise ValueError(f"No classes found in {classes_file}")
    return classes


def _image_index(directory: Path) -> dict[str, Path]:
    return {path.stem: path for path in directory.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS}


def _label_index(directory: Path) -> dict[str, Path]:
    return {path.stem: path for path in directory.iterdir() if path.is_file() and path.suffix.lower() == ".txt"}


def validate_split(
    dataset_root: Path,
    split: str,
    class_count: int,
) -> DatasetReport:
    images_dir = dataset_root / "images" / split
    labels_dir = dataset_root / "labels" / split
    report = DatasetReport(split=split)

    if not images_dir.exists():
        report.errors.append(f"Missing image directory: {images_dir}")
        return report
    if not labels_dir.exists():
        report.errors.append(f"Missing label directory: {labels_dir}")
        return report

    images = _image_index(images_dir)
    labels = _label_index(labels_dir)
    report.image_count = len(images)
    report.label_count = len(labels)

    for stem, image_path in sorted(images.items()):
        label_path = labels.get(stem)
        if label_path is None:
            report.warnings.append(f"Missing label file for image: {image_path}")
            continue

        lines = [line.strip() for line in label_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        if not lines:
            report.empty_label_count += 1
            continue

        for line_number, line in enumerate(lines, start=1):
            parts = line.split()
            if len(parts) != 5:
                report.errors.append(
                    f"{label_path}:{line_number}: expected 5 fields, got {len(parts)}"
                )
                continue
            try:
                class_id = int(parts[0])
                coords = [float(value) for value in parts[1:]]
            except ValueError:
                report.errors.append(f"{label_path}:{line_number}: non-numeric YOLO values")
                continue

            if class_id < 0 or class_id >= class_count:
                report.errors.append(
                    f"{label_path}:{line_number}: class_id {class_id} is outside 0..{class_count - 1}"
                )
            if any(value < 0 or value > 1 for value in coords):
                report.errors.append(
                    f"{label_path}:{line_number}: bounding-box values must be between 0 and 1"
                )
            if coords[2] <= 0 or coords[3] <= 0:
                report.errors.append(
                    f"{label_path}:{line_number}: width and height must be greater than 0"
                )

    for stem, label_path in sorted(labels.items()):
        if stem not in images:
            report.warnings.append(f"Orphan label file without image: {label_path}")

    return report


def validate_dataset(
    dataset_root: Path,
    classes_file: Path | None = None,
    splits: tuple[str, ...] = ("train", "val"),
) -> list[DatasetReport]:
    dataset_root = Path(dataset_root)
    if classes_file is None:
        classes_file = Path(__file__).resolve().parent / "dataset" / "classes.txt"
    classes = load_classes(classes_file)
    if not dataset_root.exists():
        raise FileNotFoundError(f"Dataset root not found: {dataset_root}")

    return [validate_split(dataset_root, split, len(classes)) for split in splits]


def _print_report(reports: list[DatasetReport], classes_file: Path) -> int:
    total_errors = 0
    print(f"Classes: {classes_file}")
    for report in reports:
        total_errors += len(report.errors)
        print(
            f"{report.split}: images={report.image_count}, labels={report.label_count}, "
            f"empty_labels={report.empty_label_count}, warnings={len(report.warnings)}, "
            f"errors={len(report.errors)}"
        )
        for warning in report.warnings:
            print(f"WARNING: {warning}")
        for error in report.errors:
            print(f"ERROR: {error}")
    if total_errors:
        print(f"Dataset validation failed with {total_errors} error(s).")
        return 1
    print("Dataset validation passed. Review warnings before training.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset_root", type=Path)
    parser.add_argument("--classes", type=Path, default=None, help="Path to classes.txt")
    args = parser.parse_args()

    classes_file = args.classes or Path(__file__).resolve().parent / "dataset" / "classes.txt"
    reports = validate_dataset(args.dataset_root, classes_file=classes_file)
    return _print_report(reports, classes_file)


if __name__ == "__main__":
    raise SystemExit(main())
