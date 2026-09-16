"""Train a RAMS road-defect YOLO model.

Prerequisites:
    pip install ultralytics

Prepare the dataset according to ai/road_defect.yaml first.
"""

from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent
DATASET_CONFIG = ROOT / "road_defect.yaml"
OUTPUT_DIR = ROOT / "runs"


def main() -> None:
    model = YOLO("yolo11n.pt")
    model.train(
        data=str(DATASET_CONFIG),
        epochs=100,
        imgsz=640,
        project=str(OUTPUT_DIR),
        name="road_defect",
    )


if __name__ == "__main__":
    main()
