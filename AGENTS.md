# Traction PWA development

- Keep the original Traction repository unchanged; implement PWA changes here.
- Explain changes simply; the user's coding experience is limited.
- Any test data written to the live Supabase project must belong to the existing `tester1` account. Do not add test workouts, routines, profile changes, or other test records to personal accounts. Do not create temporary live test users. If `tester1` cannot be identified unambiguously, use isolated local mocks until its identity is confirmed.
- Automated tests may use isolated in-memory fixtures. They must not contact the live database or create real accounts.
