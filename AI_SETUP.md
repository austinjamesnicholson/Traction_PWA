# AI recommendations

Traction uses the signed-in account to request exercise guidance through the new Supabase project, etngmfpdzialjzucuzvd. The workout-recommendation Edge Function is deployed with JWT verification enabled.

## How it works

1. Open an exercise during an active workout.
2. Save any sets you want included in the analysis.
3. Tap **Get recommendation**. The app sends that exercise's saved history and the current workout's skips/alternates through Supabase to OpenAI.
4. Review suggested warm-up/working weights and rep ranges. Nothing is automatically added to your workout.

AI requires internet access and a signed-in email account. It reuses the normal Traction login; it does not create anonymous accounts. Profile metrics and unsaved draft rows are not sent. Returned recommendations are cached in memory per account, workout, and exercise. A changed workout shows a refresh reminder; navigating or syncing does not automatically buy another request. Concurrent requests for the same exercise share one in-flight call.

## Server settings

In [Edge Function Secrets](https://supabase.com/dashboard/project/etngmfpdzialjzucuzvd/functions/secrets):

- OPENAI_API_KEY: the API key from your OpenAI API project, with API billing enabled.
- OPENAI_MODEL: optional; defaults to gpt-5-mini.

The key is read only by the server. Never put it in js/config.js, GitHub, or chat. The public Supabase project key in js/config.js is separate and is safe for client configuration.

Each signed-in account is limited to 20 requests in a rolling one-hour window. A private quota table and a narrowly scoped server function prevent clients resetting their counters. Failed provider attempts can consume a request. The server validates login, input size/shape, and returned set targets. Unsigned and anonymous callers are rejected. OpenAI requests set store:false; this does not promise zero retention by the provider.

## Source and deployment

- supabase/functions/workout-recommendation/index.ts: runtime entry point.
- supabase/functions/workout-recommendation/handler.js: authentication, quota, OpenAI handoff, and response validation.
- supabase/ai-schema.sql: deployed quota schema snapshot.
- js/recommendations.js: compact workout context and account-scoped cache.
- js/views/recommendation-card.js: exercise guidance UI.

The quota schema and function have been deployed to the new project. Changing a production secret does not require a PWA rebuild. Changing app code requires a deployment and service-worker cache version update.

A live synthetic test successfully signed in, received four recommended sets from OpenAI, and signed out. The temporary test account and quota were removed. No actual workout history was used for that test.
