# Review of the original Traction

This describes parity at the initial rebuild. The current PWA now adds Supabase accounts and workout cloud storage, with signed-in AI guidance reconnected. See CLOUD_SETUP.md for the current connection.

Reviewed on November 25, 2026. Original GitHub HEAD verified with `git ls-remote`: `12ac2dcadcb653182f857d5f8d7fa240a510e3a4` (PLIST CORRECTION). This matches the local checkout used for the code review. No original files or Git settings were changed.

The original is a native SwiftUI/SwiftData iOS prototype, not a website. `Traction__0_1_App.swift` opens `MainMenuView`; the Xcode-generated `ContentView` and `Item` are not the actual workout workflow. `CardioExercisie.swift` has no implemented model. The roadmap describes proposed features beyond the implemented screens.

| Original source                                 | Behavior                                                                                               | PWA implementation                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| MainMenuView                                    | Seven-day window centered on today, totals, muscle volume, recent completed workouts                   | Overview; also resumes unfinished workouts                                      |
| Routine, DatabaseSeeder, SettingsView           | Austin/Lizzie routine selection persisted across launches                                              | Settings and workout selection                                                  |
| WorkoutTemplateLibrary                          | 10 templates, ordered single/option/circuit blocks                                                     | Exact definitions extracted into data/templates.json                            |
| exerciseLibrary.json                            | 66 exercises with type, muscles, setup notes                                                           | data/exercises.json and searchable exercise library                             |
| WorkoutTemplateSelectionView                    | Create a workout with a start time and selected template                                               | Workouts and persistent session records                                         |
| SelectionView                                   | Exercise choices, completed/skipped/alternate statuses, end confirmation                               | Workout screen; statuses are scoped to the workout                              |
| AlternateExerciseSelectionView                  | Recommended alternates share muscles and exercise type; other alternates share type                    | Alternate selector with recommended and other groups                            |
| SkippedExerciseEntry / ExerciseReplacementEntry | Per-session changes and optional skip note                                                             | Per-session stored records and history review                                   |
| HubView                                         | Previous session, draft sets, saved state, save validation, add rows, notes                            | Exercise log; additionally persists drafts and allows row removal               |
| HubView Charts                                  | Weight vs reps scatter, set-number vs volume fatigue lines                                             | Accessible SVG charts, native point tooltips, shared session colors             |
| VolumeSummaryHelper                             | Primary muscle 1 set, secondary muscle 0.5 sets; rolling 7 days                                        | Same weights; missing/unknown muscles excluded                                  |
| DatabaseDebugView                               | Exercise/session groups, set correction, skips, alternates                                             | Database review and history editing                                             |
| UserProfileView                                 | Height in ft/in, body weight in lb, age                                                                | Profile with validated numeric fields                                           |
| AIRecommendationBuilder / Service               | Compact history and session context; anonymous Supabase auth; cached recommendations; explicit refresh | Compatible payload, auth/refresh, cache, validation, timeout and visible errors |
| setEntryLibrary / seeder                        | Bundled personal history auto-imported into native app                                                 | User-selected JSON import; private records are not shipped in public code       |

## Distinctions from future roadmap items

Circuits in the original only display a preview and cannot open a logging Hub. This PWA retains the block structure and supports individual exercise logging, but does not implement automatic circuit rotation. Cardio, Full Body, and Group Fitness use the original type filter; if the library has no exercises matching a type, the session is empty and can still be finished. No invented exercise or measurement data is added.

Custom routine builders, drop sets, partial reps, bodyweight progress charts, watch/HealthKit integration, GPS, streaks, and full interactive chart selection are roadmap work. Chart SVG tooltips expose point values without implementing the proposed linked selection feature.

The existing Supabase integration provides **AI**, not workout cloud storage. This PWA preserves that distinction: it does not connect to or modify Waypoint’s Supabase project, and it does not claim to offer two-device workout sync.
