# Model comparison, version 2

The app now uses the evaluated random forest (250 trees, depth 4, minimum leaf size 1, balanced class weights). It is trained on 363 unique records, not refit on its test set. See comparison.json for parameters, class reports, confusion matrices, training CV and nested evaluation.

Compared decision tree, standardized logistic regression, random forest, extra trees, and XGBoost. Grid search selects parameters using grouped training CV macro F1. The original 89-record test set is reused for comparison; it was inspected in version 1, so it is not a new unseen external validation. Identical feature records are grouped; exact duplicate rows are removed before splitting. No patient IDs are provided, so different measurements from the same patient cannot be grouped. No SMOTE, duplicate inflation, test-set fitting, or test-based model selection is used.

Random forest held-out accuracy: 75.28%; macro F1: 0.709; high-risk recall: 87.5%; mid-risk recall: 39.13%. Original decision tree: 71.91%, 0.641, 68.75%, 26.09%. XGBoost: 74.16%, 0.640, 87.5%, 17.39%.

Nested 5-fold grouped CV repeats all family/parameter selection inside each training fold with 3 inner folds. Accuracy 71.24%; macro F1 0.641; high-risk recall 80.36%; mid-risk recall 27.36%. This evaluates the selection procedure, not one fixed random forest model. The whole dataset has been explored during development; external validation remains necessary. 35 feature groups have conflicting labels across the 452 unique labelled records. Claims of clinical safety or 90–99% reliable accuracy are unsupported.

Run `python model/compare.py` with the pinned model dependencies installed to reproduce the comparison and candidate export. This writes dist/model-v2.json; deployment to dist/model.json is deliberately separate. `train.py` reproduces the legacy tree and would overwrite dist/model.json: do not run it unless intentionally reverting.

Browser inference normalizes leaf class votes and averages all trees. The browser classifier was checked against sklearn predictions on all 452 unique inputs using prediction-parity.json. No class probabilities are shown as clinical confidence.

## Additional accuracy experiments

See [ACCURACY-EXPERIMENTS.md](ACCURACY-EXPERIMENTS.md). A separate eight-input research benchmark reached 98.84% on expanded data; it has unresolved units and is not deployed in the app. The existing six-input tuning reached 77.53% with XGBoost but reduced high-risk recall relative to the deployed random forest.
