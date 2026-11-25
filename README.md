# Traction PWA

A new browser implementation of the Traction iPhone workout journal. Install it on your home screen, log workouts offline, and keep your training history on your device.

The original [Traction repository](https://github.com/austinjamesnicholson/Traction) is unchanged. This is a separate implementation for [Traction_PWA](https://github.com/austinjamesnicholson/Traction_PWA).

## Open the app

Once GitHub Pages is enabled and its deployment succeeds, the app will be at:

**https://austinjamesnicholson.github.io/Traction_PWA/**

In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included workflow checks the code and deploys the public app files when `main` changes. If needed, run **Actions → Check and deploy Traction PWA → Run workflow** after enabling Pages.

On iPhone, open the published app in **Safari → Share → Add to Home Screen**. On desktop or Android, use the browser’s **Install app** option. Open online once so the offline files can be saved.

## What it does

- Dashboard with a rolling seven-day calendar, completed-workout count, saved-set count, recent sessions, and muscle volume.
- Austin’s and Lizzie’s routines and all ten original workout templates, using all 66 original exercises.
- Start, resume, and finish a workout. Choose exercise variations, substitute matching exercises, and skip blocks with notes.
- Log weight in pounds, reps, and notes; add or remove rows; edit saved sets; see saved/modified/unsaved row states.
- Recover draft rows after leaving the page or reopening the app. Drafts do not count as completed sets.
- See the previous exercise session and copy its sets into a draft.
- Weight-versus-reps and fatigue (weight × reps by set number) charts with consistent session colors.
- Searchable workout history, an exercise library with filters, and an editable database grouped by exercise and workout.
- Profile fields for height, body weight, and age.
- JSON backup/restore and import of the original `setEntryLibrary.json`, with duplicate detection.
- Optional AI recommendations through the existing Supabase function, with anonymous authentication, token refresh, per-session caching, errors, and explicit refresh.

The original circuit blocks are previews; the PWA additionally lets you log their individual exercises. Automatic circuit rotation, cardio distance/duration entry, GPS, watch integration, custom routine building, and health integrations were roadmap items, not working features in the reviewed app. They are not implemented here.

## Your data

Workout records, draft rows, routine choice, and profile metrics are saved in this browser’s local storage. **They do not automatically sync between devices.** Export backups in Settings. Clearing site data, uninstalling some browsers, or using private browsing can remove local records.

The original app’s historical workout records are **not published in this public repository**. To bring them into the PWA, choose **Settings → Import JSON** and select the original `setEntryLibrary.json`. The importer preserves set/session IDs, reconstructs session start/end times, and skips already-imported sets. Nothing is imported automatically from Waypoint, SwiftData, or another browser.

If two tabs edit the same journal, the older tab will refuse to overwrite newer data and ask you to reload. If storage is full or damaged, errors are shown rather than claiming a save succeeded. An unreadable saved journal is not automatically erased; the recovery screen can export the original stored contents.

AI sends the selected exercise’s saved history, notes, and this session’s skip/substitution context only when you press the recommendation button. Profile metrics are not included. AI responses and authentication requests are not cached by the service worker. See [AI_SETUP.md](AI_SETUP.md).

## Run locally

Install Node.js 22 or newer, then from this folder:

```sh
npm start
```

Open **http://localhost:4173**. There is no build step and no package installation is needed.

```sh
npm test
npm run check
```

The source uses native JavaScript modules and hash navigation, so it also works under the `/Traction_PWA/` GitHub Pages subdirectory.

## Code layout

```text
index.html               App shell and navigation
css/styles.css           Responsive styling
js/app.js                Screen routing and startup
js/model.js              Workout rules and legacy import
js/store.js              Validated local storage and backup checks
js/views/                Dashboard, workouts, logging, history, library, settings
js/charts.js             SVG progress charts
js/recommendations.js    Optional Supabase AI client
js/config.js             Public AI connection settings
js/pwa.js                Installation and update prompts
data/                    Exercise library and templates
sw.js                    Explicit offline app shell
supabase/                Existing AI server function and quota SQL
tests/                   Data and offline behavior checks
```

When changing cached app files, update the cache version in `sw.js` and add new app files to its asset list. The app offers an update prompt; saved records stay on the device.

See [REVIEW.md](REVIEW.md) for source parity and [VALIDATION.md](VALIDATION.md) for checks and verification limits.
