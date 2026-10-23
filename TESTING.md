# Live testing — 23 October 2026

Target: https://bloom-maternacare-anushka.netlify.app

This is a prototype integration check, not clinical validation or a complete native-browser end-to-end certification.

## Results

- 14 automated account/API, model parity and regression tests passed (`npm test`).
- 7 independent live HTTP checks passed against Netlify and Supabase: sign-in, owner isolation, stale-write rejection, cross-account identity rejection, CSRF rejection, logout/re-login persistence, and deletion of both disposable test accounts.
- 20 DOM integration scenarios passed using deployed assets and the real backend: profile persistence, three risk outputs, rejected-input handling, symptoms, wellbeing, medication tracking, appointments, visit questions, birth preparation, growth/food content, movement/contraction logging, curated chat, postpartum mode, export/import, model results, notification fallback, and sign-out/re-login.
- 5 additional DOM scenarios were blocked or failed because of harness readiness/setup errors: stale-tab save, failed-save retry, second-account startup, mixed-account tabs, and the combined clear/delete UI flow. Backend equivalents for concurrency, account isolation, identity rejection and deletion passed independently; these UI scenarios remain unverified.

## Fixes deployed

1. Postpartum mode could crash the risk page because it tried to update an absent metrics element. Rendering now checks for that element; regression coverage added.
2. Invalid blood-pressure submission could leave a previous risk estimate visible. New submissions clear the previous result before validation; regression coverage added.

The service-worker cache was advanced to bloom-v8. Deployment: 6adb5027a52e2352d04d4e5a.

## Limits and remaining checks

Chrome could not launch in this execution environment. DOM execution is not a real-browser test: visual/mobile layout, real service-worker offline behavior, native notifications, and actual calendar imports have not been verified. Downloads were inspected as generated content.

Synthetic accounts were preconfirmed, so email verification and password-reset delivery were bypassed. Actual inbox delivery, confirmation links and the full reset-password journey remain unverified. The owner has not tried these emails yet. Both synthetic accounts were deleted through the live API; a subsequent database query confirmed zero remaining test users.

Risk checks verify software behavior only. They do not establish medical accuracy, safety or suitability for clinical decisions. The chat feature tested here is curated content, not proof of a connected generative-AI service.

## Follow-up: real in-app browser and exposure review

The in-app browser became available after the initial blocked Chrome attempt. On the deployed site, a disposable preconfirmed account was used to exercise sign-in, profile saving, low/mid/high risk inputs, invalid-pressure rejection and result clearing, saved-measurement trends, symptom notes, wellbeing summaries, week selection, food filtering, medication schedules/taken status, appointment planning, birth preferences, hospital-bag progress, movement timestamps, contraction start/stop and persistence across reload, visit questions/completion, timeline/countdown, educational resources, curated chat, postpartum transition/recovery notes, postpartum prediction restriction, model evaluation and notification-disabled feedback. A second browser tab restored the session and a stale save was rejected with “Not saved”. Calendar export was clicked; actual calendar import was not verified.

Two more issues were fixed and deployed: profile feedback now says that saving is queued rather than claiming immediate persistence, and the postpartum overview no longer shows a pregnancy countdown. The corrected postpartum overview was verified after a browser reload. Final deployment: 6adb7f98e080935ac82af9b9; cache bloom-v10.

The selected six-input Random Forest (uci-comparison-2) matched all 452 saved Python reference labels with zero mismatches. This is implementation parity, not 100% medical accuracy: the live model’s recorded original holdout accuracy is 75.28%, with 14/16 high-risk cases identified. The expanded research model reporting higher accuracy is not the model used by this interface.

Public asset scanning found zero matches for the actual private encryption key or configured private-secret values. Environment files, Git configuration and backend source paths returned 404; unauthenticated state/session requests returned 401. Public scripts/model data matched local deployed sources. Netlify injects its badge into HTML, so those HTML files are not byte-identical. Public GitHub file names and the project archive contained no private environment files, key files or local databases. This check covers the current repository tree, not a forensic scan of every historical commit.

The live database journal table has row-level security enabled, with select/insert/update ownership checks against auth.uid(). Anonymous callers cannot invoke the account-deletion function; it accepts no target user and deletes only auth.uid(). Advisor warnings remain for its intentionally privileged execution and disabled breached-password screening. References: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Journal encryption is performed by the server; it is not end-to-end encryption from the server operator.

The owner confirmed receipt of a password-reset email. Authentication records showed the existing account was already verified, and the repeat signup was recorded as a repeat registration; a new verification email is not required for that account. Actual password-change completion remains for the owner to test. No real account password was read or changed. The follow-up disposable account was deleted through the live API, and database counts confirmed zero remaining user or journal rows for that fixture.

Remaining limits: mobile and cross-browser coverage, actual OS notification delivery, calendar imports, full offline/service-worker recovery, failed-network UI retry, mixed-account UI switching and the full password-reset journey are not certified. The earlier DOM report is retained as historical evidence; its harness failures have not been relabelled as passes. Appointment planning does not contact clinics, chat is rule-based, educational articles are external resources, and reliable background push/automatic calendar synchronization are not connected.
