# Mobile navigation and unified History

- Mobile main navigation is fixed to the bottom with home-indicator padding. Settings and Profile use labeled, icon-only links at the top right; Profile uses a human-bust icon. Content, toasts, and routine-builder actions reserve space above bottom navigation.
- History switches between workout and exercise views. Exercise progress keeps search and movement/muscle filters, charts, setup notes, and saved sets grouped by session with existing edit controls. Old library links redirect to History's exercise view. The separate Exercise Library navigation entry is removed.
- Exercise cards have compact padding and no fixed minimum height. On phones they use two columns and wrap their contents.
- Skipped workout blocks use orange borders; swaps use bright blue, including after logging the alternate. Undoing a skip or clearing a swap removes its state border.
- npm test: 81 tests pass; new coverage checks History modes, per-session exercise data, edit controls, filtering/progress links, and skipped/swapped states. npm run check verifies 41 offline assets; cache version v8.
- Only isolated local fixtures were used. No live account or journal records were changed. Physical iPhone layout remains unverified.

# Routine builder refinements

- Routine naming appears above format selection and is editable only in the first step. No workouts-per-week input is needed. Formats supply their distinct starting workouts; Add workout creates more variations, up to 50 rather than a seven-day limit.
- Day scheduling is hidden across builder, review, routine cards, and workout selection. SHOW_ROUTINE_SCHEDULE keeps the implementation available for future use. Existing day assignments remain stored; saving unscheduled variations does not require assigning days.
- Exercise blocks use a shrinking grid: selected choices on the left, Add option always on the right. Alternatives wrap inside their block. Workout tabs and mobile navigation wrap instead of scrolling sideways.
- npm test: 78 passing tests, including name-first setup without a count field, preserving variations when returning to setup, drafts/save/copy with more than seven variations, and existing scheduling helpers and data compatibility. npm run check verifies all 41 offline assets. Cache version v7.
- Only isolated mock test data was used; no live account or journal changes were made. Browser preview access remains unavailable, so physical iPhone layout/dragging still requires device verification.

# Profile and Overview simplification

- Combined Profile and Account & sync, with metrics first and account controls beneath. Existing #account links redirect to Profile; sign-in, sign-out, recovery, sync status, and conflict resolution use the combined page.
- Removed the global account banner and the Overview hero and three summary cards. Overview's primary action resumes an in-progress workout or starts a new one when none is active.
- Live test data is restricted to the existing tester1 account, as recorded in AGENTS.md. This change used only isolated local fixtures and made no live account or journal changes.
- npm test: 76 passing tests, including Overview start/resume behavior, combined Profile controls, and password-recovery navigation. npm run check passes for all 41 offline assets.
- Service-worker cache v6 includes these updates. Browser visual and physical-device verification remain unavailable in this session.

# Verification of the routine builder

## Completed in this update

- npm test: 73 passing tests. New coverage includes all five formats and workout counts, weekly day swaps and rest days, exercise alternatives/edit/remove/reorder, combined search filters, routine save/edit conflicts/delete, copying original circuit/cardio plans, legacy journal compatibility, JSON round-trip, two-device sync and account separation, simultaneous routine edits, draft recovery and cross-tab protection, and rendering all builder phases.
- npm run check: syntax, imports, all 41 offline assets, icons, 66 exercises, and ten original templates. Service-worker cache is v5.
- Supabase migration accepts custom routine libraries while retaining existing journal validation, RLS ownership policies, and revision checks. A live rolled-back test verified legacy and custom saves, stale-write rejection, missing-active-routine rejection, and foreign-owner denial. It used synthetic accounts and left no test records.
- Each newly started session stores its own template snapshot. Tests verify that renaming, changing, or deleting a routine preserves active and completed workouts.
- Saved routines use the existing account sync and backups. Builder drafts stay on the originating device in account-separated keys. Concurrent drafts and saved edits cannot silently overwrite newer changes.

## Verification limits

The browser access host was unavailable, so visual browser QA and physical iPhone touch dragging are not verified. Reorder buttons and keyboard controls provide alternatives to dragging. Cardio and other workout days can be planned, but dedicated distance/GPS logging and automatic circuit rotation remain future features.

﻿## Previous AI and exercise-log verification

## Completed

- npm test: 62 passing tests, including timestamp ordering across draft/batch save/cloud merge/reload, legacy timestamp ties, unchanged-save detection, short audio behavior, signed-in AI invocation, account-scoped caches, stale responses, duplicate request coalescing, server validation, CORS, quota, missing configuration, and upstream errors.
- npm run check: syntax/imports, complete 32-entry offline shell, icon dimensions, 66 exercises and ten templates.
- AI Edge Function deployed with JWT verification enabled in etngmfpdzialjzucuzvd.
- Live synthetic sign-in returned HTTP 200; the Supabase-to-OpenAI request returned HTTP 200 and four suggested sets; test sign-out returned HTTP 204. Temporary test account and quota were removed. No actual training data was used.
- Live rolled-back database checks verified: requests 1-20 allowed, request 21 denied, expired quota reset, independent account quotas, anonymous denial, unsigned denial, and prevention of direct counter reset.
- New draft rows have distinct creation timestamps, even when added in the same millisecond. Existing saved timestamps are preserved on edits. Equal legacy timestamps use recorded entryOrder when available; historical ordering already lost before this update cannot be reconstructed automatically.
- Mobile sticky navigation includes the iPhone's top safe-area inset. Browser layouts use zero inset when the browser provides no reserved top area.
- Exercise saves play a short two-note Web Audio chime only after a successful changed-set save, not while typing drafts or on background sync. Unsupported/muted audio cannot prevent saving.
- Service-worker cache bumped to v3; new UI, ordering, and sound modules are included.

## Remaining verification and project advisory

Physical iPhone testing of Dynamic Island spacing, audible playback, installation, and offline use remains unverified. Sound depends on device/browser volume and playback policies. Email confirmation and password-reset delivery retain the previous verification limits; see CLOUD_SETUP.md.

The security advisor reports the project's existing [leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth security settings were changed in this update. The new quota table has RLS, an explicit deny policy, and no client table privileges.

The original Traction repository remains unchanged.
