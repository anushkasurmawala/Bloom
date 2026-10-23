# Bloom on Netlify

The hosted prototype uses **Netlify Functions + Supabase Auth + PostgreSQL**. It does not need the Python server, a local SQLite database, or your laptop to stay on. The existing Python preview remains available for earlier local accounts; those accounts are separate from hosted accounts.

## What is implemented

- Sign-in-first flow, registration, password confirmation and show/hide controls.
- Email verification, resend verification, forgot-password email, email callback and new-password screen.
- Supabase-managed passwords and sessions. Browser JavaScript never stores access or refresh tokens in localStorage. The backend seals sessions in Secure, HttpOnly cookies, refreshes expired access tokens, checks request origin and CSRF tokens, and returns persistent, readable form errors.
- Account journals in PostgreSQL with row-level security. Each user can read and modify only their own row. Journal bodies are encrypted using AES-256-GCM before storage; the owner's ID is authenticated with the ciphertext.
- Revision checks prevent a stale tab overwriting another tab's changes. Import/export and account deletion work with the hosted API.
- The deployed six-input risk model is unchanged. The 98.84% eight-input research artifact remains separate.

## Connected Supabase project

Project **bloom**, reference **hjqkwgxwlpdxaddgbmcx**, in the **anushka** organization. Database migration `supabase/migrations/202610230001_bloom_journals.sql` has been applied. Existing Supabase projects and local journals have not been migrated or changed.

## Netlify setup

1. In Netlify, import the GitHub repository `anushkasurmawala/Bloom`.
2. Use the repository root as base directory. `netlify.toml` sets the publish directory to `dist`, functions directory to `netlify/functions` and build command to `npm run check`. Node 22 is required. **Do not just drag the dist folder into Netlify**; that omits the account backend.
3. Add four environment variables from `.env.example` in Netlify's environment-variable settings: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (use the publishable key), `APP_URL`, and `BLOOM_DATA_KEY`. The last value is a secret: a random 32-byte key written as 64 hexadecimal characters. The key is used only in server-side functions. Save a private backup and keep it stable. Never put it in a frontend file, GitHub, screenshots or chat.
4. Set `APP_URL` to the exact stable HTTPS site URL (for example `https://your-site.netlify.app`) without a trailing slash. Branch/deploy-preview URLs require their own intentional configuration; they do not inherit approval for the production origin.
5. Deploy. Check `/api/health`; it should say `ready`, `hosted: true`. If configuration is missing, the account page explains that setup is incomplete; it does not silently fall back to browser storage.

## Supabase email setup — required for recovery

In Supabase > Authentication > URL Configuration:

- Site URL: your exact Netlify `APP_URL`.
- Redirect allowlist: `https://your-site.netlify.app/**` (replace the hostname with your real stable site hostname).

Keep Confirm email enabled. The default Supabase confirmation and recovery templates work through the email callback in `accounts.js`. Use the default `{{ .ConfirmationURL }}` link; Supabase redirects to `/#auth-callback` for signup or `/#reset-password` for recovery. The app immediately removes callback tokens from the visible URL, exchanges the refresh token server-side, and stores the session in an encrypted HttpOnly cookie. Optional custom templates using `/#token_hash={{ .TokenHash }}&type=recovery` are supported too.

Supabase's built-in email service is restricted and rate-limited; it generally sends only to authorized organization addresses. To test with other addresses, configure a transactional SMTP provider under Authentication > Email > SMTP settings. Configure the sender there, not in frontend code. The SMTP secret remains in Supabase. No SMTP provider has been connected by this project automatically. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

No actual verification or reset email has been sent during automated tests. Until the Netlify URL and email configuration are connected, live delivery is unverified.

## Verify once configured

1. Register a fictional test account using an inbox you control. Verify it using the actual email.
2. Sign in, save a profile and sample measurement, refresh and confirm they remain.
3. Sign out, select Forgot password, open the received link, choose a new password, and sign in with it. Confirm the old password fails.
4. Create a second test account; it must start with an empty journal.
5. Open two tabs, save in one, and confirm stale writes are blocked in the other.
6. Export before deleting test accounts. Account deletion removes the auth user and current journal; independent exports/backups are not erased.

Supabase manages token expiry and refresh-token revocation. Previously issued access tokens can remain valid until expiry; configure an appropriate JWT lifetime in Supabase. This prototype does not claim immediate global invalidation of every already-issued JWT or password-reset link after a single use at our API boundary; Supabase controls the email-token lifecycle.

## Development checks

```sh
npm run check
npm test
```

The automated hosted API tests use a simulated Supabase transport. They check cookie handling, encryption, owner scoping, CSRF/origin rejection, revision conflicts, recovery, password changes, session refresh and deletion. They do not prove real email delivery or a successful live Netlify deployment. Database owner isolation has also been exercised against the selected Supabase project inside a rolled-back transaction containing only synthetic test rows.

The database advisor identifies `delete_own_bloom_account()` as intentionally callable by authenticated users with SECURITY DEFINER privileges. It has no user-ID argument, uses an empty search path, requires `auth.uid()` and deletes only that caller. No service-role key is used by this app.

For prototype testing, use fictional health data. Clinic booking, generative AI chat, background push delivery and two-way calendar synchronization remain separate integrations; hosting does not connect them automatically.
