# Live testing — 23 October 2026

Target: https://bloom-maternacare-anushka.netlify.app

This is a prototype integration check, not clinical validation or a complete native-browser end-to-end certification.

## Results

- 12 automated account/API and regression tests passed (`npm test`).
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
