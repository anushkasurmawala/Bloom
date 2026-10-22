# Accuracy experiments — 11 October 2026

## Result

A separate eight-input research model reached **98.8449% accuracy (1,198 correct / 1,212 held-out records)** on the expanded maternal-health dataset. This exceeds the requested 97% benchmark target. It does **not** establish clinical accuracy, and the deployed six-input app model has not been replaced.

High-risk recall: **98.30% (404/411)**. Mid-risk recall: **98.26% (395/402)**. Low-risk recall: **100% (399/399)**. Macro F1: **98.84%**. These estimates describe one same-source test partition, not a different hospital or prospective patient cohort.

## How the new benchmark was achieved

Dataset: Hossain's [Maternal health risk data](https://data.mendeley.com/datasets/ckhgtgdg4f/1). Retrieved the CSV supplied with the [associated publication](https://doi.org/10.1186/s12911-026-03343-1).

Downloaded 6,103 rows. Applied predefined quality filters (age at most 100, temperature 95–105°F, heart rate 40–200), leaving 6,059 rows. Removed one duplicate feature/label record, leaving 6,058. The paper's cleaning total also equals 6,058, but our route is explicitly different: 44 quality exclusions plus one duplicate, rather than its reported 45 quality exclusions.

Used eight inputs: age, temperature, heart rate, systolic BP, diastolic BP, BMI, HbA1c and fasting glucose. Excluded patient ID and name from predictors. Patient IDs and identical input vectors were joined into groups before partitioning; every retained ID and vector happened to be unique. IDs cannot establish whether different identifiers represent the same person.

Preselected one 20% held-out fold with seed 20261011: 4,846 training records and 1,212 test records. Compared random forest, extra trees and XGBoost using four-fold grouped cross-validation **inside training only**. Selected the model using training CV accuracy, then evaluated that winner once on the held-out fold. No oversampling, relabeling or test-based tuning was used.

Training CV accuracy: random forest **99.195%**, XGBoost **99.154%**, extra trees **97.586%**. The selected random forest uses 300 trees, unrestricted depth, minimum leaf size 1 and seed 42. Those settings were selected from a small predefined parameter grid. The small CV difference does not establish random forest as universally superior.

The saved research artifact is `expanded-research-model.joblib`. `expanded-benchmark.json` contains the confusion matrix, class metrics, selected parameters and source-file hash. The model retains the original feature order, not personal identifiers. Keep it separate from the app until units and provenance are resolved.

Reproduce using the pinned model requirements, then:

```sh
python model/benchmark_expanded.py /path/to/downloaded-supplementary.csv
```

## Why the app's old dataset did not reach 97%

Additional accuracy-focused tuning compared six model families with 18 parameter configurations per family. Selected XGBoost reached **77.53% (69/89)** on the existing development test set; training CV accuracy was **72.70%**. Its high-risk recall **81.25%** is lower than the deployed random forest's **87.50%**, and its macro F1 is also lower. Increasing overall accuracy alone would therefore worsen important class metrics.

The old six-input data contains only 452 unique feature/label rows, 416 distinct input vectors and 35 vectors with contradictory labels. A deterministic classifier can agree with at most 416/452 labels across this full deduplicated dataset. That 92.04% consistency limit is **not** a bound on any particular test split. Repeated inspection of the existing test set makes these tuning scores exploratory, not fresh validation. Results: `accuracy-tuning.json`; reproducible search: `tune_accuracy.py`.

## Why 98.84% is not enough to deploy

The publication describes automated risk classifications with an expert-reviewed subset. Learning these categories is not the same as forecasting clinically observed complications. The high score may reflect learnable labeling rules; it cannot be attributed solely to larger sample size or two extra inputs without controlled experiments.

The supplied fasting-glucose column is labeled mg/dL but ranges roughly 3.5–8.9. HbA1c values range 30–50 with no clear unit in the header. Do not guess conversions or pass current app inputs directly into this model. The public file also lacks facility identifiers, preventing hospital-held-out evaluation.

Before app integration: obtain reliable unit definitions and label provenance; validate on patients from an independent source with clinician-confirmed outcomes; evaluate high-risk sensitivity, uncertainty, calibration and subgroup performance. This benchmark supports a research demonstration, not medical deployment.

Other research options include NICHD's nuMoM2b cohort through [DASH](https://dash.nichd.nih.gov/), which requires controlled-access steps and a specifically defined outcome. Cardiotocography datasets target fetal monitoring and require different clinical inputs, so they cannot replace a maternal-vitals model directly.
