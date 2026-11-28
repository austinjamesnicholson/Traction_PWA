# Traction PWA

A workout journal you can install on your phone or computer. Log workouts offline and sign in to keep saved training history in your private Supabase account.

**App:** https://austinjamesnicholson.github.io/Traction_PWA/

This is a separate implementation of the original Traction iPhone app. The original repository is unchanged.

## Accounts and cloud storage

Open **Profile** and scroll to **Account & sync** beneath your body metrics.

1. Choose **Create account** and enter your email and a password of at least eight characters.
2. Confirm your email, then sign in.
3. Use the same account on your other devices.

Saved workout sessions, set entries, skip notes, alternate exercises, profile metrics, custom routines, and routine selection sync automatically. Changes save locally first and upload when connected. **Sync now** checks immediately. The Profile tab reports pending changes, offline use, errors, and successful cloud saves.

Different records changed on different devices combine automatically. If both devices change the same record, **Profile > Account & sync** asks which conflicting edits to keep. Export a backup before resolving a conflict for an extra copy.

**Exercise drafts stay on the device where you type them.** Press **Save sets** to include them in your saved workout and cloud sync.

Existing device-only workouts stay separate when signing in. To copy them into an account, export a backup while signed out, sign in, then import it in Settings. Nothing is uploaded from another app or old iPhone automatically.

Signing out opens your separate device-only journal. Account caches, including pending changes, stay in this browser for the next sign-in. Use your own device. Clearing browser storage can remove unsynced changes and drafts.

**AI guidance is available for signed-in accounts.** Open an exercise and tap **Get recommendation** to request suggested weights and rep ranges. Relevant saved workout history and notes are sent through Supabase to OpenAI only when requested. Drafts and profile metrics are excluded; guidance never automatically changes logged sets. See [AI_SETUP.md](AI_SETUP.md).

## Workout features

- Dashboard with a rolling seven-day calendar, recent sessions, weighted primary/secondary muscle volume, and a Start/Resume workout button.
- Austin's and Lizzie's routines, all ten original templates, and all 66 exercise definitions.
- Compact workout cards have a top-right Select workout button and expandable numbered exercise previews. Start/resume/finish workouts, select variations, choose alternates, and skip blocks with notes.
- Log pounds, reps, and notes; add/remove rows; recover drafts; see saved/modified/unsaved states. New rows keep chronological entry order through batch saves and cloud sync. Changed exercise saves play a short positive chime.
- Previous-session sets and optional copying into the current draft.
- Weight-versus-reps and fatigue charts with consistent session colors.
- History switches between workouts and exercises, with compact filtered exercise cards, progress charts, and editable saved records.
- Mobile navigation stays at the bottom; icon-only Settings and Profile controls sit at the top right. Skipped workout blocks have orange borders and swapped blocks bright blue borders.
- JSON backup/restore and duplicate-safe import of the original setEntryLibrary.json.

The original circuit and cardio features were placeholders. Individual exercise logging inside circuit blocks is available, but not automatic circuit rotation, GPS, watch/HealthKit integration, or cardio distance entry. See [REVIEW.md](REVIEW.md).

## Build a routine

Open **Routines > New routine**.

1. Name the routine, then choose Full Body, Push/Pull/Legs, Upper/Lower, Body-part Split, or Custom. The routine name is edited only on this first step.
2. Use **Add workout** to create additional variations (up to 50). Rename individual workouts or mark them as weightlifting, cardio, or other.
3. Tap **Add exercise** and search or filter by body part, region, and movement. **Add option** stays beside the selected exercises and adds an alternative in the same block; choose one when training. The pencil changes a selection and the trash icon removes it.
4. Drag a block's grip to reorder it, or use its Up/Down buttons. Review and save, optionally making it active.

Custom routine cards support edit, copy, activate, and delete. The Routines page always offers New routine; when a draft exists it also offers Continue draft. Starting new asks before discarding the draft. Original routines can be copied into an editable plan. Started workouts retain their original exercise plan even if you edit or delete the routine. Unfinished builder drafts restore on the same device and remain separate for each account; only saved routines sync. Day scheduling is hidden for now; its code and previously saved assignments are retained for future use.

For an existing Supabase installation, apply [supabase/routine-schema.sql](supabase/routine-schema.sql) once; new installations use the updated schema.sql. The hosted Traction_PWA project already has this change.

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

The GitHub Actions workflow runs checks when main changes and respects the existing Pages publishing mode. With branch publishing, GitHub publishes main automatically. With Actions publishing, the workflow uploads and deploys the checked public files.

## Code layout

- index.html and css/styles.css: navigation, app shell, responsive styling.
- js/app.js and js/views/: routing and individual screens, including accounts.
- js/cloud.js: authentication and network adapter.
- js/sync.js: account caches, offline queue, three-way merging.
- js/store.js: journal validation and device-only storage.
- js/routines.js, js/routine-draft.js, js/exercise-catalog.js, js/routine-drag.js, and css/routines.css: routine plans, private device drafts, exercise filters, reordering, and builder styling.
- js/model.js and js/charts.js: workout calculations and charts.
- js/config.js: public project settings and AI feature switch.
- js/vendor/: pinned Supabase SDK and MIT license.
- data/: 66 exercises and ten templates.
- sw.js and js/pwa.js: offline installation and updates.
- supabase/schema.sql: cloud schema and account access rules.
- tests/: workout, account, sync, and offline checks.

After changing app files, increment the cache version in sw.js and include new runtime files in its asset list. See [CLOUD_SETUP.md](CLOUD_SETUP.md) and [VALIDATION.md](VALIDATION.md).
