# Bloom · Pregnancy companion

A pregnancy-companion prototype with a health journal, reminders, educational resources and experimental risk-category estimates. The interface is named **Bloom**.

## Host on Netlify

This project now includes a real hosted account backend: **Netlify Functions + Supabase Auth + PostgreSQL**. Netlify serves `dist/`; serverless functions handle account sessions and encrypted journal storage. The website does not need a Python server running on your laptop.

[Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/anushkasurmawala/Bloom)

Follow **[NETLIFY-SETUP.md](NETLIFY-SETUP.md)**. Import the full repository, not just the dist folder. Configure the environment variables and Supabase email/redirect settings before testing accounts. The prototype is deployed at **[https://bloom-maternacare-anushka.netlify.app](https://bloom-maternacare-anushka.netlify.app)**. The Supabase `bloom` project and journal schema are connected, and the live API has been checked. Real inbox delivery and the complete email-link flow still need a user test. Never commit `.env`, database files or encryption keys.

### Account features

- Sign-in-first interface, sign-up, password confirmation and show/hide password controls.
- Email verification, resend verification, forgot-password email and new-password screen.
- Managed password authentication, expiring sessions and server-side refresh.
- Secure, HttpOnly session cookies; no browser-localStorage access/refresh tokens.
- Per-account journals with PostgreSQL row-level security and AES-256-GCM encryption before storage.
- CSRF/origin checks, stale-write detection, cross-tab account mismatch checks, import/export and account deletion.

## Companion features

Risk-category estimation, health trends, symptom and wellbeing logs, medication schedules, an appointment planner, pregnancy timeline and due-date countdown, sourced educational articles, curated chatbot responses, visit questions and reports, birth preferences, hospital-bag checklist, movement observations, contraction timing, postpartum journal and ICS calendar downloads.

Clinic bookings are plans, not real appointments sent to a clinic. The chatbot is curated, not generative AI. Medication alerts require the app to be open. Background push and automatic calendar synchronization are not connected. These distinctions remain visible in the app.

## Model results

The app uses the original six-input **random forest** selected by grouped training cross-validation macro F1 among Decision Tree, Logistic Regression, Random Forest, Extra Trees and XGBoost. On the exploratory 89-record holdout: **75.28% accuracy**, **0.7091 macro F1** and **87.50% high-risk recall (14/16)**. The initial tree identified 11/16 high-risk records. The holdout had already been inspected, so it is not an independent final test.

The dataset has 452 deduplicated rows, 416 distinct input vectors and 35 groups with conflicting labels. Identical vectors are grouped across splits; patient-level separation cannot be established without patient identifiers.

A separate eight-input research model achieved **98.84% accuracy on 1,212 held-out records** from expanded data. That model is included as a compressed joblib artifact, but **is not integrated into the app**. The source units and automated risk-label provenance need clarification. See the [full experiment report](model/ACCURACY-EXPERIMENTS.md) and [model documentation](model/README.md).

These are educational research estimates, not clinical diagnoses or proof of safety. Use fictional health information when testing this prototype.

## Local preview for earlier accounts

```sh
python3 -m pip install -r backend/requirements.txt
python3 backend/server.py --port 8081
```

Open http://localhost:8081/. This preview keeps earlier encrypted SQLite journals separate from hosted Supabase accounts. It does not send password-reset emails. To move records, export from the local account, create a hosted account, and import the journal intentionally. See [local backend documentation](backend/README.md).

## Checks

Node 22 or newer:

```sh
npm run check
npm test
```

The API tests use a simulated auth transport. Database isolation was additionally tested on the selected Supabase project with synthetic rows inside a rolled-back transaction. The deployed API health, unauthorized access, input validation, cross-origin protection and real Supabase invalid-login response have been checked. Successful email delivery and the full browser email-link flow still require a user test.

## Dataset attribution

Original data: Marzia Ahmed, [UCI Maternal Health Risk](https://archive.ics.uci.edu/dataset/863/maternal+health+risk), DOI 10.24432/C5DP5D, CC BY 4.0. Expanded research data and publication are attributed in the experiment report. Educational links are provided to their original publishers. No clinical validation is claimed.
