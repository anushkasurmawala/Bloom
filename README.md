# MaternaCare

Pregnancy companion project, originally developed as Bloom. The interface retains the Bloom name.

## Current model results

The running six-input model is a random forest selected from five methods: test accuracy 75.28%, high-risk recall 87.50% (14/16). A separate eight-input research model achieved 98.84% held-out accuracy on expanded data; it is not integrated into the app and has unresolved source-unit and label-provenance limitations. See [experiment report](model/ACCURACY-EXPERIMENTS.md).

## Run locally

Install `backend/requirements.txt`, then run `python3 backend/server.py --port 8081` and open http://localhost:8081/. See [backend instructions](backend/README.md) for details.

## Development history

The following documentation records earlier stages. For current account storage, follow the backend instructions above.

Model update: version 2 uses a random forest selected after comparing five methods, including XGBoost. See model/README.md and model/comparison.json for results and limitations.

# Bloom — Account-enabled local app

Start with `python3 backend/server.py --port 8081` and open http://localhost:8081. See [backend instructions](backend/README.md) for installation, storage and release limits.

Version 3 adds registration, sign-in/out, encrypted local SQLite journals, account isolation, save status, conflict checks, JSON import and account deletion. Prior localStorage-only documentation below describes earlier versions. No cloud deployment is complete.

# Bloom — Pregnancy companion

Working educational prototype with browser-local storage, real UCI decision-tree inference, profiles, timeline, measurements and BP charts, symptom diary, daily in-app medication reminders, demo appointment requests, sourced educational links, curated rule-based chatbot, visit checklist, printable report, CSV/JSON exports, deletion controls, responsive interface and offline app-shell cache after first successful visit.

## Run locally
From this directory: `python3 -m http.server 8080 --directory dist`
Open http://localhost:8080. Keep the page open for medication alerts.

## Model
Training source: `model/train.py`. Dataset: Marzia Ahmed, UCI Maternal Health Risk, DOI 10.24432/C5DP5D, CC BY 4.0. Download archive into ../../work/maternal.zip to retrain. Dependencies: pandas and scikit-learn. Exact duplicate rows are removed and equal feature vectors grouped across splits. Hyperparameter choice uses grouped cross-validation on the training subset only. The evaluated tree is exported unchanged to dist/model.json; no model probabilities are presented as clinical confidence. See model/metrics.json for full results.

## Limits
Not validated for clinical use. No real appointment delivery, generative AI, cloud accounts, encrypted medical storage, background notifications, multilingual translation, voice, document vault, caregiver sharing or postpartum-specific workflows. App data belongs to one local browser, not authenticated users. NHS links require internet; their contents are not cached. Exported HTML reports can be printed to PDF. Use fictional data during development. Do not infer safety from a low-risk estimate.

## Next stages
Authenticated backend with per-user access; clinic integration and confirmation workflow; reliable notification provider; clinician-reviewed chatbot sources and content; accessibility and language work; independent clinical model validation.

## Added in version 2
Daily wellbeing logs (mood, sleep, weight, water), weekly NHS size guide (weeks 4–41), due-date countdown, birth preferences and bag checklist, sourced food lookup, optional movement observations without health thresholds, persistent contraction timer, postpartum journal/mode, ICS calendar export, opt-in open-app notifications and appointment alerts. All new journals are included in the printable report and full JSON export. Caregiver sharing is deliberately excluded.

Background Web Push and two-way calendar sync remain unconnected. Calendar downloads are a one-way alternative; reminder delivery is controlled by the receiving calendar app. Weekly lengths are reference estimates, with no fetal weight prediction or individual ultrasound assessment. Some weeks have comparison text only. External sources were checked 10 October 2026; content still needs clinical review before patient use.
