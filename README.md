# Traction PWA

A workout journal you can install on your phone or computer. Log workouts offline and sign in to keep saved training history in your private Supabase account.

**App:** https://austinjamesnicholson.github.io/Traction_PWA/

This is a separate implementation of the original Traction iPhone app. The original repository is unchanged.

## Accounts and cloud storage

Open **Account & sync** in the navigation or **Sign in** at the top of the page.

1. Choose **Create account** and enter your email and a password of at least eight characters.
2. Confirm your email, then sign in.
3. Use the same account on your other devices.

Saved workout sessions, set entries, skip notes, alternate exercises, profile metrics, and routine selection sync automatically. Changes save locally first and upload when connected. **Sync now** checks immediately. The account bar reports pending changes, offline use, errors, and successful cloud saves.

Different records changed on different devices combine automatically. If both devices change the same record, **Account & sync** asks which conflicting edits to keep. Export a backup before resolving a conflict for an extra copy.

**Exercise drafts stay on the device where you type them.** Press **Save sets** to include them in your saved workout and cloud sync.

Existing device-only workouts stay separate when signing in. To copy them into an account, export a backup while signed out, sign in, then import it in Settings. Nothing is uploaded from another app or old iPhone automatically.

Signing out opens your separate device-only journal. Account caches, including pending changes, stay in this browser for the next sign-in. Use your own device. Clearing browser storage can remove unsynced changes and drafts.

**AI guidance is available for signed-in accounts.** Open an exercise and tap **Get recommendation** to request suggested weights and rep ranges. Relevant saved workout history and notes are sent through Supabase to OpenAI only when requested. Drafts and profile metrics are excluded; guidance never automatically changes logged sets. See [AI_SETUP.md](AI_SETUP.md).

## Workout features

- Dashboard with a rolling seven-day calendar, completed workouts, saved sets, recent sessions, and weighted primary/secondary muscle volume.
- Austin's and Lizzie's routines, all ten original templates, and all 66 exercise definitions.
- Start/resume/finish workouts, select variations, choose alternates, and skip blocks with notes.
- Log pounds, reps, and notes; add/remove rows; recover drafts; see saved/modified/unsaved states. New rows keep chronological entry order through batch saves and cloud sync. Changed exercise saves play a short positive chime.
- Previous-session sets and optional copying into the current draft.
- Weight-versus-reps and fatigue charts with consistent session colors.
- Searchable history, filtered library, editable saved records, and profile metrics.
- JSON backup/restore and duplicate-safe import of the original setEntryLibrary.json.

The original circuit and cardio features were placeholders. Individual exercise logging inside circuit blocks is available, but not automatic circuit rotation, GPS, watch/HealthKit integration, or cardio distance entry. See [REVIEW.md](REVIEW.md).

## Install

On iPhone, open in **Safari > Share > Add to Home Screen**. In Chrome or Edge, use **Install app**. Open online once to cache the app. Sign in online before using your account offline. Mobile navigation reserves the iPhone status-area inset in installed mode.

## Run locally

With Node.js 22 or newer:

```sh
npm start
```

Open **http://localhost:4173**. No build or package installation is needed; the pinned Supabase browser library is included locally with its license.

```sh
npm test
npm run check
```

The GitHub Actions workflow tests and deploys the public files when main changes. GitHub Pages must use **GitHub Actions** as its source.

## Code layout

- index.html and css/styles.css: navigation, app shell, responsive styling.
- js/app.js and js/views/: routing and individual screens, including accounts.
- js/cloud.js: authentication and network adapter.
- js/sync.js: account caches, offline queue, three-way merging.
- js/store.js: journal validation and device-only storage.
- js/model.js and js/charts.js: workout calculations and charts.
- js/config.js: public project settings and AI feature switch.
- js/vendor/: pinned Supabase SDK and MIT license.
- data/: 66 exercises and ten templates.
- sw.js and js/pwa.js: offline installation and updates.
- supabase/schema.sql: cloud schema and account access rules.
- tests/: workout, account, sync, and offline checks.

After changing app files, increment the cache version in sw.js and include new runtime files in its asset list. See [CLOUD_SETUP.md](CLOUD_SETUP.md) and [VALIDATION.md](VALIDATION.md).
