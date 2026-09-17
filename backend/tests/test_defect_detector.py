"""Unit tests for AI defect detector configuration and status."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.services import defect_detector as dd


@pytest.fixture(autouse=True)
def _reset_detector(monkeypatch):
    dd.reset_detector()
    yield
    dd.reset_detector()


def test_status_reports_missing_model(tmp_path, monkeypatch):
    missing = tmp_path / "missing.pt"
    monkeypatch.setenv("AI_MODEL_PATH", str(missing))
    monkeypatch.setenv("AI_STUB_MODE", "false")
    detector = dd.DefectDetector()
    status = detector.status()

    assert status["ready"] is False
    assert status["stub_mode"] is False
    assert status["model_exists"] is False
    assert "not found" in status["message"].lower()


def test_status_stub_mode_is_ready(monkeypatch):
    monkeypatch.setenv("AI_STUB_MODE", "true")
    monkeypatch.setenv("AI_MODEL_PATH", "/nonexistent/model.pt")
    detector = dd.DefectDetector()
    status = detector.status()

    assert status["ready"] is True
    assert status["stub_mode"] is True
    assert status["model_name"] == "stub-detector"


def test_predict_stub_returns_empty_list(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_STUB_MODE", "true")
    image = tmp_path / "road.jpg"
    image.write_bytes(b"fake-image-bytes")

    detector = dd.DefectDetector()
    assert detector.predict(image) == []


def test_predict_missing_image_raises(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_STUB_MODE", "true")
    detector = dd.DefectDetector()
    with pytest.raises(FileNotFoundError):
        detector.predict(tmp_path / "no-such.jpg")


def test_predict_missing_model_raises_unavailable(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_STUB_MODE", "false")
    monkeypatch.setenv("AI_MODEL_PATH", str(tmp_path / "no-model.pt"))
    image = tmp_path / "road.jpg"
    image.write_bytes(b"x")

    detector = dd.DefectDetector()
    with pytest.raises(dd.ModelUnavailableError) as exc_info:
        detector.predict(image)
    assert "AI_MODEL_PATH" in str(exc_info.value) or "not found" in str(exc_info.value).lower()


def test_get_detector_caches_instance(monkeypatch):
    monkeypatch.setenv("AI_STUB_MODE", "true")
    dd.reset_detector()
    a = dd.get_detector()
    b = dd.get_detector()
    assert a is b
