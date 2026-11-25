# Optional AI recommendations

Workout logging, history, charts, installation, and offline use work without a backend.

The client is compatible with the original Traction `workout-recommendation` Supabase Edge Function. Use your **Traction project**, not the Waypoint project. No hosted project was modified during this rebuild.

1. In `js/config.js`, fill in `supabaseUrl` and `supabasePublicKey`. Use only the public/publishable client key (or legacy anon key). Never put a service-role key or OpenAI API key in browser code.
2. In the Traction Supabase dashboard, enable anonymous sign-ins. The browser creates an anonymous session only when requesting AI guidance.
3. If the original server is already deployed and working, reuse it. Otherwise apply the existing `supabase/migrations/20260805000000_ai_recommendation_rate_limits.sql` to that project, configure `OPENAI_API_KEY` as an Edge Function secret, and deploy the included function using your installed CLI’s current deployment instructions. Verify the target project before any deployment. The original SQL and server function are copied for compatibility, not automatically applied.
4. Confirm the deployed function accepts browser CORS preflight requests. The included function handles OPTIONS and allows authorization, apikey, content-type, and x-client-info headers. Keep authentication and the per-user hourly quota enabled.
5. Redeploy the PWA after editing configuration. Increment `sw.js`’s cache version so installed clients receive the change.
6. On a real device, start a workout, open an exercise, and request guidance. Test initial anonymous authentication, a second request with saved sets, explicit refresh, an expired session, offline errors, and the hourly limit. Check the function logs if a request fails.

The original function enforces 20 requests per anonymous user per hour through `consume_ai_recommendation_quota`. Anonymous-user quotas can be bypassed by creating new users, so monitor usage and apply the project’s supported abuse protection before broad public use.

The PWA sends the original compact payload shape: exercise/type/muscles/template, current sets, previous session, up to three older session groups from the most recent 12 positive-weight sets, plus current skips and alternates. It accepts warm-up/working recommendations in lb or kg but does not automatically log or apply them. Logged weights remain in pounds, matching the original app.

Auth tokens are stored separately from workout backups. Restoring a workout backup does not restore an anonymous AI identity. AI errors are shown as errors; this implementation does not fabricate an offline AI answer.

References verified for this implementation: [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [browser CORS](https://supabase.com/docs/guides/functions/cors), and [Supabase changelog](https://supabase.com/changelog).
