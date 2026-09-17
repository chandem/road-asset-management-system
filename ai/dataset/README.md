# RAMS AI Dataset Preparation

This folder documents the dataset contract used by the RAMS road-defect detector. **No images or trained weights are stored here.**

## Directory layout

Prepare the actual dataset outside Git (or in approved dataset storage):

```text
rams-road-defect/
├── images/
│   ├── train/
│   └── val/
└── labels/
    ├── train/
    └── val/
```

Every image should have a label file with the same base filename:

```text
images/train/road_0001.jpg
labels/train/road_0001.txt
```

A normal-road/negative image may have an empty `.txt` label file. A missing label file is reported as a warning by the validator so it can be reviewed deliberately.

## Label format

Use one YOLO object-detection record per detected defect:

```text
<class_id> <x_center> <y_center> <width> <height>
```

All coordinates are normalized to **0–1** relative to the image dimensions.

Example:

```text
3 0.512 0.634 0.180 0.120
```

The current example class mapping is defined in `ai/dataset/classes.txt` and must stay synchronized with `ai/road_defect.yaml`:

| ID | Class |
|---:|---|
| 0 | longitudinal_crack |
| 1 | transverse_crack |
| 2 | alligator_crack |
| 3 | pothole |

These are an initial example taxonomy, not a claim that every RAMS defect type has been covered. If the field taxonomy changes, update the class mapping and annotations together.

## Annotation rules

1. Draw a bounding box tightly around the visible defect.
2. Label only defects that are visible enough for a human inspector to justify.
3. Avoid duplicate boxes for the same defect.
4. Keep class IDs consistent across train and validation data.
5. Include difficult examples: shadows, wet pavement, dust, repaired patches, vehicles and low-light images.
6. Include normal-road images so false positives can be measured.
7. Add Ethiopian/local road imagery before operational deployment; public datasets are useful for initial training but are not a substitute for local validation.
8. Do not put personally identifiable information or unrelated sensitive images into the dataset.

## Validation

From the repository root:

```bash
python ai/validate_dataset.py datasets/rdd2022
```

The validator checks:

- supported image files
- matching label/image names
- YOLO row structure
- class IDs within the configured class count
- normalized bounding-box values
- positive width/height
- orphan label files
- train/validation image and label counts

The command exits with a non-zero status when it finds invalid annotations.

## Before training

Run the validator and fix every error. Review warnings, then run:

```bash
python ai/train.py
```

Keep the actual dataset outside Git when it is large. Trained `.pt` weights are also intentionally excluded from Git.
