import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newDraft, draftRows, commitExerciseSets } from "../js/exercise-log.js";
import { ordered, sessionSets } from "../js/model.js";
import { freshState } from "../js/store.js";
import { mergeDocuments, createJournalSync } from "../js/sync.js";
const exercises = JSON.parse(
    readFileSync(new URL("../data/exercises.json", import.meta.url)),
  ),
  templates = JSON.parse(
    readFileSync(new URL("../data/templates.json", import.meta.url)),
  );
const exerciseName = exercises[0].name,
  sessionID = "session";
function state() {
  const s = freshState();
  s.sessions = [
    {
      sessionID,
      templateName: "Austin Legs",
      startedAt: "2026-11-27T10:00:00Z",
      endedAt: null,
    },
  ];
  return s;
}
function rows() {
  const result = [];
  for (const weight of [100, 40, 75]) {
    const row = newDraft(result, [], Date.parse("2026-11-27T10:01:00Z"));
    Object.assign(row, { weight: String(weight), reps: "10" });
    result.push(row);
  }
  return result;
}
test("several unsaved rows retain entry order and get distinct creation timestamps even within one millisecond", () => {
  const draft = rows();
  assert.deepEqual(
    draft.map((s) => s.weight),
    ["100", "40", "75"],
  );
  assert.equal(new Set(draft.map((s) => s.timestamp)).size, 3);
  assert.deepEqual(
    ordered(draft).map((s) => s.weight),
    ["100", "40", "75"],
  );
});
test("batch save order survives cloud merging, reload and timestamp sorting regardless of UUID or weight", () => {
  const s = state();
  commitExerciseSets(s, sessionID, exerciseName, rows());
  s.sets.forEach((s, i) => {
    s.setID = ["z", "a", "m"][i];
  });
  const cloud = mergeDocuments(freshState(), s, freshState()).data;
  const reloaded = JSON.parse(JSON.stringify(cloud));
  assert.deepEqual(
    sessionSets(reloaded, sessionID, exerciseName).map((s) => s.weight),
    [100, 40, 75],
  );
});
test("editing a saved set preserves its original timestamp and position", () => {
  const s = state();
  commitExerciseSets(s, sessionID, exerciseName, rows());
  const before = sessionSets(s, sessionID, exerciseName);
  const draft = draftRows(
    before.map((s) => ({
      id: s.setID,
      setID: s.setID,
      weight: s.weight,
      reps: s.reps,
      notes: s.notes,
    })),
    before,
  );
  draft[0].weight = "20";
  commitExerciseSets(s, sessionID, exerciseName, draft);
  const after = sessionSets(s, sessionID, exerciseName);
  assert.deepEqual(
    after.map((s) => s.timestamp),
    before.map((s) => s.timestamp),
  );
  assert.deepEqual(
    after.map((s) => s.weight),
    [20, 40, 75],
  );
});
test("legacy timestamp ties use recorded entry order, never weight", () => {
  const stamp = "2026-11-27T10:00:00Z";
  assert.deepEqual(
    ordered([
      { weight: 20, timestamp: stamp, entryOrder: 1 },
      { weight: 100, timestamp: stamp, entryOrder: 0 },
    ]).map((s) => s.weight),
    [100, 20],
  );
});
test("legacy drafts without timestamps receive timestamps without changing the draft list", () => {
  const draft = rows().map(({ timestamp, ...row }) => row);
  const restored = draftRows(draft, [], Date.parse("2026-11-27T10:05:00Z"));
  assert.deepEqual(
    restored.map((s) => s.weight),
    ["100", "40", "75"],
  );
  assert.equal(new Set(restored.map((s) => s.timestamp)).size, 3);
});
test("unchanged saved rows do not request a second success chime", () => {
  const s = state();
  assert(commitExerciseSets(s, sessionID, exerciseName, rows()));
  const draft = draftRows(
    sessionSets(s, sessionID, exerciseName).map((s) => ({ ...s, id: s.setID })),
    s.sets,
  );
  assert.equal(commitExerciseSets(s, sessionID, exerciseName, draft), false);
  draft[0].notes = "Good set";
  assert(commitExerciseSets(s, sessionID, exerciseName, draft));
});
test("an actual second account cache receives sets in entry order after sync", async (t) => {
  const storage = () => {
    const values = new Map();
    return {
      getItem: (k) => values.get(k) || null,
      setItem: (k, v) => values.set(k, v),
    };
  };
  let cloud = null;
  const remote = {
    async read() {
      return structuredClone(cloud);
    },
    async save(id, revision, data) {
      cloud = { data: structuredClone(data), revision: revision + 1 };
      return structuredClone(cloud);
    },
  };
  const a = createJournalSync({
      storage: storage(),
      exercises,
      templates,
      remote,
    }),
    b = createJournalSync({ storage: storage(), exercises, templates, remote });
  t.after(() => {
    a.dispose();
    b.dispose();
  });
  a.attach({ id: "user" });
  a.store.replace(state());
  a.store.update((s) => commitExerciseSets(s, sessionID, exerciseName, rows()));
  await a.sync();
  b.attach({ id: "user" });
  await b.sync();
  assert.deepEqual(
    sessionSets(b.store.state, sessionID, exerciseName).map((s) => s.weight),
    [100, 40, 75],
  );
});
