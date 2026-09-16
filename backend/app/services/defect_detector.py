import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Detection:
    defect_type: str
    confidence: float
    bounding_box: dict[str, float]


class DefectDetector:
    """YOLO-based road-defect inference adapter.

    The model weights are intentionally kept outside Git. Set AI_MODEL_PATH
    to a trained road-defect YOLO `.pt` file before running inference.
    """

    def __init__(self) -> None:
        self.model_path = Path(os.getenv("AI_MODEL_PATH", "models/road_defect.pt"))
        self.confidence_threshold = float(os.getenv("AI_CONFIDENCE_THRESHOLD", "0.25"))
        self._model = None

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"AI model weights not found: {self.model_path}. "
                "Set AI_MODEL_PATH to a trained road-defect YOLO .pt file."
            )

    @property
    def model_name(self) -> str:
        return "YOLO road-defect detector"

    @property
    def model_version(self) -> str:
        return self.model_path.stem

    def _load_model(self):
        if self._model is None:
            try:
                from ultralytics import YOLO
            except ImportError as exc:
                raise RuntimeError(
                    "Ultralytics is not installed. Run: pip install -r backend/requirements.txt"
                ) from exc
            self._model = YOLO(str(self.model_path))
        return self._model

    def predict(self, image_path: str | Path) -> list[Detection]:
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")

        model = self._load_model()
        results = model.predict(
            source=str(path),
            conf=self.confidence_threshold,
            verbose=False,
        )

        detections: list[Detection] = []
        for result in results:
            names = result.names
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                class_id = int(box.cls.item())
                confidence = float(box.conf.item())
                xyxy = box.xyxy[0].tolist()
                detections.append(
                    Detection(
                        defect_type=str(names[class_id]),
                        confidence=confidence,
                        bounding_box={
                            "x_min": float(xyxy[0]),
                            "y_min": float(xyxy[1]),
                            "x_max": float(xyxy[2]),
                            "y_max": float(xyxy[3]),
                        },
                    )
                )

        return detections


def detection_to_dict(detection: Detection) -> dict[str, Any]:
    return {
        "defect_type": detection.defect_type,
        "confidence": detection.confidence,
        "bounding_box": detection.bounding_box,
    }


def get_detector() -> DefectDetector:
    return DefectDetector()
