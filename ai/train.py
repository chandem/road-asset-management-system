"""Train and package a RAMS road-defect YOLO model.

Prepare a YOLO-format dataset and update ai/road_defect.yaml before training.
Large datasets and model weights must stay outside Git.
"""

import os
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
DATASET_CONFIG = Path(os.getenv("AI_DATASET_CONFIG", str(ROOT / "road_defect.yaml")))
RUNS_DIR = Path(os.getenv("AI_RUNS_DIR", str(ROOT / "runs")))
MODEL_BASE = os.getenv("AI_BASE_MODEL", "yolo11n.pt")
EPOCHS = int(os.getenv("AI_EPOCHS", "100"))
IMAGE_SIZE = int(os.getenv("AI_IMAGE_SIZE", "640"))
MODEL_OUTPUT = Path(os.getenv("AI_MODEL_OUTPUT", "models/road_defect.pt"))


def main() -> None:
    if not DATASET_CONFIG.exists():
        raise FileNotFoundError(f"Dataset config not found: {DATASET_CONFIG}")

    model = YOLO(MODEL_BASE)
    results = model.train(
        data=str(DATASET_CONFIG),
        epochs=EPOCHS,
        imgsz=IMAGE_SIZE,
        project=str(RUNS_DIR),
        name="road_defect",
        exist_ok=True,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    if not best_weights.exists():
        raise FileNotFoundError(f"Training completed without best weights: {best_weights}")

    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_weights, MODEL_OUTPUT)
    print(f"Best model copied to {MODEL_OUTPUT}")


if __name__ == "__main__":
    main()
