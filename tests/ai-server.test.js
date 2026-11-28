import test from "node:test";
import assert from "node:assert/strict";
import {
  createHandler,
  validPayload,
} from "../supabase/functions/workout-recommendation/handler.js";
const payload = {
  exercise: "Bench press",
  type: "Push",
  majorMuscle: "Chest",
  minorMuscle: "Triceps",
  template: "Austin Push",
  currentSession: { label: "current", date: "2026-11-27", sets: [] },
  previousSession: null,
  recentSessions: [],
  sessionChanges: { alternates: [], skips: [] },
};
const result = {
  headline: "Build steadily",
  summary: "Use your previous sets as a starting point.",
  sets: [
    { setType: "working", weight: 50, unit: "lb", repsMin: 8, repsMax: 12 },
  ],
  sessionSuggestion: "Adjust based on how the first set feels.",
};
function fixture(options = {}) {
  const calls = [];
  const env = {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "public",
    OPENAI_API_KEY: options.missingKey ? "" : "secret-not-to-be-returned",
  };
  const handle = createHandler({
    getEnv: (name) => env[name],
    fetch: async (url, request) => {
      calls.push({ url, request });
      if (url.endsWith("/auth/v1/user"))
        return Response.json(
          { id: "user", is_anonymous: options.anonymous || false },
          { status: options.authStatus || 200 },
        );
      if (url.endsWith("/consume_ai_recommendation_quota"))
        return Response.json(options.quota !== false);
      return Response.json(
        {
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(options.modelResult || result),
                },
              ],
            },
          ],
        },
        { status: options.modelStatus || 200 },
      );
    },
  });
  const request = (data = payload, extra = {}) =>
    new Request(
      "https://project.supabase.co/functions/v1/workout-recommendation",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer signed-user",
          Origin: "https://austinjamesnicholson.github.io",
          "Content-Type": "application/json",
          ...extra,
        },
        body: JSON.stringify(data),
      },
    );
  return { handle, calls, request };
}
test("AI validates a signed-in caller, consumes quota, and returns structured guidance without storing OpenAI responses", async () => {
  const f = fixture(),
    response = await f.handle(f.request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  assert.equal(f.calls.length, 3);
  const outgoing = JSON.parse(f.calls[2].request.body);
  assert.equal(outgoing.store, false);
  assert.equal(outgoing.text.format.strict, true);
  assert.equal(outgoing.model, "gpt-5-mini");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(f.calls[0].request.headers.Authorization, "Bearer signed-user");
});
test("unsigned or expired callers never reach OpenAI", async () => {
  let f = fixture();
  assert.equal(
    (await f.handle(new Request("https://function", { method: "POST" })))
      .status,
    401,
  );
  assert.equal(f.calls.length, 0);
  f = fixture({ authStatus: 401 });
  assert.equal((await f.handle(f.request())).status, 401);
  assert.equal(f.calls.length, 1);
});
test("anonymous users cannot request recommendations", async () => {
  const f = fixture({ anonymous: true });
  assert.equal((await f.handle(f.request())).status, 403);
  assert.equal(f.calls.length, 1);
});
test("missing OpenAI secret shows setup instructions without consuming quota or exposing secrets", async () => {
  const f = fixture({ missingKey: true }),
    response = await f.handle(f.request());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
  assert.equal(f.calls.length, 1);
});
test("quota exhaustion blocks the model request", async () => {
  const f = fixture({ quota: false });
  assert.equal((await f.handle(f.request())).status, 429);
  assert.equal(f.calls.length, 2);
});
test("malformed or oversized workout payloads are rejected before model invocation", async () => {
  const f = fixture();
  assert.equal((await f.handle(f.request({ exercise: "Bad" }))).status, 400);
  assert.equal(
    (await f.handle(f.request({ ...payload, extra: "x".repeat(31000) })))
      .status,
    413,
  );
  assert(f.calls.every((c) => !c.url.includes("api.openai.com")));
});
test("invalid model output and upstream failures are visible errors, never fabricated advice", async () => {
  let f = fixture({
    modelResult: { ...result, sets: [{ ...result.sets[0], weight: -1 }] },
  });
  assert.equal((await f.handle(f.request())).status, 502);
  f = fixture({ modelStatus: 429 });
  assert.equal((await f.handle(f.request())).status, 503);
});
test("browser preflight is supported and other origins are blocked", async () => {
  const f = fixture(),
    preflight = await f.handle(
      new Request("https://function", {
        method: "OPTIONS",
        headers: { Origin: "https://austinjamesnicholson.github.io" },
      }),
    );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("Access-Control-Allow-Origin"),
    "https://austinjamesnicholson.github.io",
  );
  assert.equal(
    (
      await f.handle(
        f.request(payload, { Origin: "https://unrelated.invalid" }),
      )
    ).status,
    403,
  );
  assert.equal(f.calls.length, 0);
});
test("bodyweight history and zero current sets are valid context", () => {
  assert(validPayload(payload));
  const p = structuredClone(payload);
  p.currentSession.sets = [
    { set: 1, time: "10:00:00", weight: 0, reps: 10, note: null },
  ];
  assert(validPayload(p));
});
