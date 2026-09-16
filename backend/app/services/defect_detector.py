from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Detection:
    defect_type: str
    confidence: float
    bounding_box: dict[str, float]


class DefectDetector:
    """Model interface for road-defect inference.

    The first implementation is deliberately a safe placeholder. A trained
    computer-vision model can later implement `predict()` without changing
    the API/database contract.
    """

    model_name = "road-defect-detector"
    model_version = "0.1.0-placeholder"

    def predict(self, image_path: str | Path) -> list[Detection]:
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")

        # No trained model is bundled yet, so do not invent detections.
        return []


def detection_to_dict(detection: Detection) -> dict[str, Any]:
    return {
        "defect_type": detection.defect_type,
        "confidence": detection.confidence,
        "bounding_box": detection.bounding_box,
    }


def get_detector() -> DefectDetector:
    return DefectDetector()
