# RAMS Road-Defect AI Training

This directory contains the training workflow for the RAMS road-defect computer-vision model.

## Current state

RAMS already has the inference adapter and API. The remaining model-specific work is to prepare a labeled road-damage dataset, train/evaluate a detector, and deploy the selected `.pt` weights. The repository intentionally does **not** contain trained weights.

## Dataset

Use YOLO object-detection format:

```text
images/train/
images/val/
labels/train/
labels/val/
```

Each label line is:

```text
<class_id> <x_center> <y_center> <width> <height>
```

Coordinates are normalized to 0–1. `ai/road_defect.yaml` must use exactly the same class IDs and names as the labels.

For an initial experiment, a public road-damage dataset can be used. Before operational use, add Ethiopian/local road images because road surface, lighting, camera angle and defect appearance can differ from public datasets.

## Training

From the repository root:

```bash
python ai/train.py
```

Optional configuration:

```text
AI_DATASET_CONFIG=ai/road_defect.yaml
AI_BASE_MODEL=yolo11n.pt
AI_EPOCHS=100
AI_IMAGE_SIZE=640
AI_MODEL_OUTPUT=models/road_defect.pt
```

The script trains YOLO and copies the best checkpoint to `models/road_defect.pt`. Do not commit that file to Git.

## Evaluation gate

Before deployment, record at least:

- precision
- recall
- mAP50
- mAP50-95
- per-class performance
- false positives on normal road images
- false negatives on representative defects

Do not use AI confidence as a road-condition score. AI detections are inspection evidence and should remain reviewable by an engineer/inspector.

## RAMS integration

Once the trained model is available, set:

```text
AI_MODEL_PATH=models/road_defect.pt
AI_CONFIDENCE_THRESHOLD=0.25
```

The FastAPI endpoint is:

```text
POST /api/v1/images/{image_id}/ai-detect
```

The result is stored in the RAMS AI detection table and can then be connected to defect/condition workflows.
