import test from "node:test";
import assert from "node:assert/strict";
import { freshState } from "../js/store.js";
import {
  recommend,
  cachedRecommendation,
  clearRecommendations,
  recommendationFingerprint,
} from "../js/recommendations.js";
const exercise = {
    name: "Bench press",
    type: "Push",
    majorMuscle: "Chest",
    minorMuscle: "Triceps",
  },
  session = {
    sessionID: "workout",
    templateName: "Austin Push",
    startedAt: "2026-11-27T10:00:00Z",
  };
const result = {
  headline: "Build steadily",
  summary: "Start with a manageable load.",
  sets: [
    { setType: "working", weight: 50, unit: "lb", repsMin: 8, repsMax: 12 },
  ],
  sessionSuggestion: "Adjust based on how it feels.",
};
test("AI uses the existing account and caches per account, session and exercise", async () => {
  clearRecommendations();
  let calls = 0;
  const cloud = {
    account: { id: "a" },
    async requestRecommendation(p) {
      calls++;
      assert.equal(p.exercise, exercise.name);
      return result;
    },
  };
  const state = freshState();
  await recommend(state, exercise, session, cloud);
  await recommend(state, exercise, session, cloud);
  assert.equal(calls, 1);
  assert(cachedRecommendation("a", session.sessionID, exercise.name));
  cloud.account = { id: "b" };
  assert.equal(
    cachedRecommendation("b", session.sessionID, exercise.name),
    undefined,
  );
  await recommend(state, exercise, session, cloud);
  assert.equal(calls, 2);
});
test("changed saved notes mark guidance stale even when set count is unchanged; drafts are not sent", async () => {
  clearRecommendations();
  const state = freshState();
  state.sessions = [session];
  state.sets = [
    {
      setID: "set",
      sessionID: session.sessionID,
      exerciseName: exercise.name,
      weight: 0,
      reps: 10,
      notes: "First",
      timestamp: "2026-11-27T10:01:00Z",
    },
  ];
  state.drafts = { private: [{ notes: "draft-only-marker" }] };
  const cloud = {
    account: { id: "a" },
    async requestRecommendation(p) {
      assert(!JSON.stringify(p).includes("draft-only-marker"));
      return result;
    },
  };
  const entry = await recommend(state, exercise, session, cloud);
  state.sets[0].notes = "Updated";
  assert.notEqual(
    entry.fingerprint,
    recommendationFingerprint(state, exercise, session),
  );
});
test("a response arriving after sign-out is not cached", async () => {
  clearRecommendations();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const cloud = {
    account: { id: "a" },
    async requestRecommendation() {
      await gate;
      return result;
    },
  };
  const request = recommend(freshState(), exercise, session, cloud, true);
  cloud.account = null;
  release();
  await assert.rejects(request, /account changed/);
  assert.equal(
    cachedRecommendation("a", session.sessionID, exercise.name),
    undefined,
  );
});
test("duplicate requests during a page redraw share one provider call", async () => {
  clearRecommendations();
  let release,
    calls = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const cloud = {
    account: { id: "a" },
    async requestRecommendation() {
      calls++;
      await gate;
      return result;
    },
  };
  const a = recommend(freshState(), exercise, session, cloud, true),
    b = recommend(freshState(), exercise, session, cloud, true);
  release();
  await Promise.all([a, b]);
  assert.equal(calls, 1);
});
test("bad recommendations are rejected instead of being cached or applied", async () => {
  clearRecommendations();
  const cloud = {
    account: { id: "a" },
    async requestRecommendation() {
      return { ...result, sets: [{ ...result.sets[0], weight: -20 }] };
    },
  };
  await assert.rejects(
    () => recommend(freshState(), exercise, session, cloud, true),
    /valid set targets/,
  );
  assert.equal(
    cachedRecommendation("a", session.sessionID, exercise.name),
    undefined,
  );
});
