# Validation

## Completed

- npm test: 37 passing tests covering workouts, imports, validation, authentication adapter behavior, password recovery events, AI disabled, account isolation, offline recovery, two-device merges, conflict choices, local drafts, edits during saving, stale revisions, late responses after switching accounts, same-account tabs, and failed-save durability.
- npm run check: JavaScript syntax/imports, complete 29-entry offline cache, PNG dimensions, 66 exercises, and ten templates.
- Live Supabase project healthy with no pre-existing public tables before setup.
- traction_documents schema deployed with row-level security, three ownership policies, and an owner/revision-bound save RPC.
- Live rolled-back database tests passed for own-user insert/read/update, increasing revisions, stale/wrong-owner rejection, cross-user read/update denial, anonymous denial, and unsigned denial. No test users or journals retained.
- Unsigned public Data API read returned HTTP 401. Email auth and sign-up enabled; email confirmation required.
- Security and performance advisors returned no notices.
- Supabase browser SDK 2.119.2 vendored with its MIT license; no runtime CDN dependency.
- AI controls removed and client disabled. No AI function deployed to the new project.
- GitHub's Ubuntu runner also passed all 37 tests and the file checks. HTTP checks of the public Pages site returned 200 for the updated app shell, the new Supabase config, and the v2 service worker. A metadata-readiness step handles the delayed artifact visibility observed during deployment.

## Remaining verification

Auth adapter and sync tests use simulated clients/devices. Real account confirmation, email delivery, password reset links, and physical phone/computer sync have not been completed. Hosted Auth redirect URLs cannot be edited by the connected database tools; see [CLOUD_SETUP.md](CLOUD_SETUP.md).

Browser visual testing and physical iPhone installation/offline testing remain unverified. The earlier rebuild could not access the browser host and approval review rejected an unrelated Chrome window; no unrelated browser contents were inspected.

The original Traction repository remains unchanged. GitHub Pages was enabled after the first rebuild; account updates deploy through the existing workflow when pushed to main.
