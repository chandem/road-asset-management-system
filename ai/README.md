# RAMS Road-Defect AI Training

This directory contains the training configuration for the RAMS road-defect computer-vision model.

## Dataset

Use a road-damage dataset such as RDD2022 as the initial training source. Keep downloaded datasets outside Git when they are large.

## Target model

The trained model should be exported as a YOLO `.pt` file and configured in the backend with:

```text
AI_MODEL_PATH=models/road_defect.pt
AI_CONFIDENCE_THRESHOLD=0.25
```

Do not commit large model weights to this repository. Store them in local/server model storage or an appropriate artifact registry.

## Training workflow

1. Download and prepare the dataset.
2. Convert annotations to the YOLO format.
3. Update `road_defect.yaml` with the dataset paths and class names.
4. Run `python ai/train.py`.
5. Evaluate the model on a held-out validation/test set.
6. Copy the selected `.pt` weights to the backend model location.
7. Set `AI_MODEL_PATH` and run RAMS `/api/v1/images/{image_id}/ai-detect`.
8. Validate detections against field observations before operational use.

## Important

The class names in `road_defect.yaml` must exactly match the annotations in the dataset. The RAMS API does not assume that a model can detect a particular defect class unless that class is present in the trained weights.
