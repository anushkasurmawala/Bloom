# Account backend (local development)

Run from the project directory:

```sh
python3 -m pip install -r backend/requirements.txt
python3 backend/server.py --port 8081
```

Open http://localhost:8081. Create your own account using a unique test password of at least 12 characters. Emails are account identifiers only; no email is sent, verified, or used for recovery.

## Storage

In this workspace the live database is `/Users/anushkasurmawala/Documents/Codex/2026-10-08/can/work/bloom-data/bloom.sqlite3`. The neighboring `encryption.key` is needed to decrypt journals. Both are outside the downloadable project and must never be published. When moving the project, choose storage explicitly:

```sh
python3 backend/server.py --database /private/path/bloom.sqlite3
```

The database holds users, salted scrypt password hashes, hashed session tokens, and encrypted per-account journal snapshots. Email identifiers are not encrypted. Passwords are never stored in plaintext. Session cookies are HttpOnly and SameSite=Strict, with 12-hour expiry; Secure is omitted solely because this loopback development server uses HTTP. Write operations need the session's CSRF token and reject unrelated origins/hosts. Updates use revision checks to prevent silent overwrites. Browser account records stay in memory and are not persisted in localStorage or service-worker caches.

## What is saved

Profiles, risk history, measurements, symptoms, medications, appointments, questions, wellbeing logs, birth plans, bag checklist, movement observations, contraction timers, and postpartum journals. Chat messages are not saved. Uploaded documents are not implemented. App-level notification preference is saved, but browser permission still belongs to each device.

## Previous browser data

The earlier preview at port 8080 used browser storage. It is not automatically migrated. Open http://localhost:8080/legacy-export.html while the old static server is running and download the earlier journal as JSON, then sign in at port 8081 and select the file under Profile & privacy. Import replaces the account's current records only after confirmation. The older browser copy remains until you deliberately remove it. Exporting/importing files can expose sensitive information; use fictional records for development.

## Save failures

The header shows Saving, Saved, or Not saved. A conflict or network error keeps edits in memory and offers retry/export. A revision conflict needs export then reload and reconciliation; retry alone cannot resolve it. Logging out is blocked while saves are pending. Do not close with unsaved edits.

## Release boundary

This standard-library HTTP server binds only to 127.0.0.1 and is for development. Do not expose it publicly. It is not compatible with Sites' Cloudflare Worker runtime. Cloud release requires either a supported hosted Worker backend with platform identity/D1, or a production Python deployment with managed identity, HTTPS, Secure cookies, robust rate limiting, encrypted persistent storage, backup/restore, key management, email verification/recovery, and a security review. Current local encryption key storage does not protect against someone who can access both database and key. There are no automated backups. Account deletion removes current database rows, not independent exports or backups.

Two-way calendar sync, background push delivery, generative AI, clinic integrations and document uploads remain unconnected.
