"""YOLO-based road-defect inference adapter.

Weights live outside Git. Configure with:

  AI_MODEL_PATH=models/road_defect.pt
  AI_CONFIDENCE_THRESHOLD=0.25
  AI_STUB_MODE=false   # true → return empty predictions without a model (demos/CI)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class Detection:
    defect_type: str
    confidence: float
    bounding_box: dict[str, float]


class ModelUnavailableError(RuntimeError):
    """Raised when inference cannot run (missing weights or package)."""


class DefectDetector:
    """Load a YOLO road-defect model and run inference on image files."""

    def __init__(self) -> None:
        self.model_path = Path(
            os.getenv("AI_MODEL_PATH", "models/road_defect.pt")
        ).expanduser()
        self.confidence_threshold = float(os.getenv("AI_CONFIDENCE_THRESHOLD", "0.25"))
        self.stub_mode = os.getenv("AI_STUB_MODE", "false").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        self._model = None

    @property
    def model_name(self) -> str:
        if self.stub_mode:
            return "stub-detector"
        return "YOLO road-defect detector"

    @property
    def model_version(self) -> str:
        if self.stub_mode:
            return "stub"
        return self.model_path.stem

    @property
    def is_available(self) -> bool:
        return self.stub_mode or self.model_path.is_file()

    def status(self) -> dict[str, Any]:
        """Machine-readable readiness for ops and the UI."""
        ultralytics_installed = False
        try:
            import ultralytics  # noqa: F401

            ultralytics_installed = True
        except ImportError:
            pass

        ready = self.is_available and (self.stub_mode or ultralytics_installed)
        message = "AI detection is ready."
        if self.stub_mode:
            message = (
                "Stub mode is enabled: inference returns no detections "
                "and does not load model weights."
            )
        elif not self.model_path.is_file():
            message = (
                f"Model weights not found at {self.model_path}. "
                "Train or place a YOLO .pt file and set AI_MODEL_PATH."
            )
        elif not ultralytics_installed:
            message = (
                "Ultralytics is not installed. "
                "Run: pip install -r backend/requirements.txt"
            )

        return {
            "ready": ready,
            "stub_mode": self.stub_mode,
            "model_path": str(self.model_path),
            "model_exists": self.model_path.is_file(),
            "model_name": self.model_name,
            "model_version": self.model_version,
            "confidence_threshold": self.confidence_threshold,
            "ultralytics_installed": ultralytics_installed,
            "message": message,
        }

    def _load_model(self):
        if self.stub_mode:
            raise ModelUnavailableError(
                "Stub mode is enabled; real inference is disabled."
            )
        if not self.model_path.is_file():
            raise ModelUnavailableError(
                f"AI model weights not found: {self.model_path}. "
                "Set AI_MODEL_PATH to a trained road-defect YOLO .pt file, "
                "or set AI_STUB_MODE=true for demo mode without a model."
            )
        if self._model is None:
            try:
                from ultralytics import YOLO
            except ImportError as exc:
                raise ModelUnavailableError(
                    "Ultralytics is not installed. "
                    "Run: pip install -r backend/requirements.txt"
                ) from exc
            try:
                self._model = YOLO(str(self.model_path))
            except Exception as exc:
                raise ModelUnavailableError(
                    f"Failed to load AI model from {self.model_path}: {exc}"
                ) from exc
        return self._model

    def predict(self, image_path: str | Path) -> list[Detection]:
        path = Path(image_path)
        if not path.is_file():
            raise FileNotFoundError(f"Image file not found on disk: {path.name}")

        if self.stub_mode:
            return []

        model = self._load_model()
        try:
            results = model.predict(
                source=str(path),
                conf=self.confidence_threshold,
                verbose=False,
            )
        except Exception as exc:
            raise RuntimeError(f"AI inference failed: {exc}") from exc

        detections: list[Detection] = []
        for result in results:
            names = result.names or {}
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                class_id = int(box.cls.item())
                confidence = float(box.conf.item())
                xyxy = box.xyxy[0].tolist()
                detections.append(
                    Detection(
                        defect_type=str(names.get(class_id, f"class_{class_id}")),
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


_detector: DefectDetector | None = None


def get_detector() -> DefectDetector:
    """Return a process-wide detector instance (recreated if env paths change is rare)."""
    global _detector
    if _detector is None:
        _detector = DefectDetector()
    return _detector


def reset_detector() -> None:
    """Clear the cached detector (tests / config reload)."""
    global _detector
    _detector = None
