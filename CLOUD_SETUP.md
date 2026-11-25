# Traction Supabase connection

Project: **Traction_PWA** (`etngmfpdzialjzucuzvd`)

API URL: `https://etngmfpdzialjzucuzvd.supabase.co`

The public publishable key and URL are already in `js/config.js`. The journal schema has been applied to this project. No service-role key is shipped to the browser. No changes were made to Waypoint’s Supabase project or the original Traction project.

## Email redirects

In [Authentication → URL Configuration](https://supabase.com/dashboard/project/etngmfpdzialjzucuzvd/auth/url-configuration), use:

- **Site URL:** `https://austinjamesnicholson.github.io/Traction_PWA/`
- **Redirect URLs:** `https://austinjamesnicholson.github.io/Traction_PWA/` and, if testing locally, `http://localhost:4173/`

The client passes the current app’s base URL for account confirmation and password recovery. Supabase must allow that URL. The connected database tools do not expose Auth configuration updates, so the hosted redirect settings were not changed or verified. If confirmation redirects to localhost, set these values in the dashboard and request a fresh email.

Email authentication and sign-up were checked live: both are enabled, and email confirmation is required. Real email delivery, SMTP configuration, confirmation-link completion, and password-reset email completion have not been verified. For wider public use, configure your own supported SMTP provider and check Supabase’s email limits.

## Database design and privacy

`public.traction_documents` stores one JSON journal per account, with a revision and update time. Its primary key is the account’s user ID. Row-level security permits a signed-in, non-anonymous user to select, create, and update only their own row. Public/unsigned access is denied; no direct delete permission is granted.

The client saves through `save_traction_document(expected_revision, document, owner_id)`. The function runs with the caller’s database permissions and checks that `owner_id` matches the signed-in user. This prevents a request saving into a different account after a switch. Stale revisions are rejected with SQLSTATE `40001`, so devices reread and merge before retrying. Documents are limited to 10 MB and do not include exercise drafts.

`supabase/schema.sql` is the deployed schema snapshot. It is for a new empty database, not for rerunning over existing tables. Hosted migration history records the initial schema and owner guard. Older AI function/quota files are retained for reference; they were **not deployed** to this project. The site’s AI switch is false and its controls are absent.

## Offline behavior

Each account has a separate local envelope containing its working journal, last cloud baseline, cloud revision, and pending flag. Saving writes the envelope atomically before scheduling an upload. A fresh account never imports the device-only journal automatically. Drafts remain in the account’s device cache and are excluded from cloud payloads.

The app retries on reconnection, when returning to the app, periodically while visible, or through **Sync now**. Another tab changing the same local account causes a reload warning before further saves/sync. Responses that finish after sign-out cannot replace the next account’s data. Account caches remain on the device after sign-out; the app does not encrypt them at rest.

## Verification

Live checks exercised authenticated save/read/update, cross-account read/update denial, anonymous-user denial, unsigned denial, stale revisions, and the owner guard. Test records and temporary users were rolled back. Security and performance advisors returned no notices. The public Data API returned HTTP 401 to an unsigned request.

Automated tests cover auth adapter contracts and simulated two-device behavior. After configuring email URLs, create your account, confirm the email, sign in on two devices, save a workout, and confirm it appears on the other device. Then test offline save/reconnect, sign-out, and password reset.
