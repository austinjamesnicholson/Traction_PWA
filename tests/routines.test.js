import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createRoutine,
  addExercise,
  removeExercise,
  moveBlock,
  assignDay,
  addWorkout,
  removeWorkout,
  saveRoutine,
  deleteRoutine,
  listTemplates,
  listRoutines,
  sessionTemplate,
  validateRoutines,
  copyRoutine,
  BUILTIN_ROUTINES,
} from "../js/routines.js";
import { freshState, validateState, createStore } from "../js/store.js";
import {
  mergeDocuments,
  cloudDocument,
  createJournalSync,
} from "../js/sync.js";
import { filterExercises, exerciseCategory } from "../js/exercise-catalog.js";
import { openRoutineDraft } from "../js/routine-draft.js";
import { routinePage } from "../js/views/routine-builder.js";
import { workouts, session } from "../js/views/workouts.js";
const exercises = JSON.parse(
  readFileSync(new URL("../data/exercises.json", import.meta.url)),
);
const templates = JSON.parse(
  readFileSync(new URL("../data/templates.json", import.meta.url)),
);
const names = exercises.slice(0, 4).map((e) => e.name);
function complete(format = "ppl", count = 3) {
  const r = createRoutine(format, count);
  r.workouts.forEach((w) => addExercise(w, names[0]));
  return r;
}
function disk() {
  const map = new Map();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}
test("formats create named blank workouts and a seven-day plan", () => {
  const r = createRoutine("ppl", 3);
  assert.deepEqual(
    r.workouts.map((w) => w.name),
    ["Push", "Pull", "Legs"],
  );
  assert.deepEqual(
    r.days.map((id) => id && r.workouts.find((w) => w.id === id).name),
    ["Push", null, "Pull", null, "Legs", null, null],
  );
  assert.deepEqual(
    createRoutine("custom", 2).workouts.map((w) => w.name),
    ["Workout 1", "Workout 2"],
  );
  for (const format of ["fullbody", "ppl", "upperlower", "split", "custom"])
    for (let count = 1; count <= 7; count++)
      validateRoutines([createRoutine(format, count)], exercises, {
        allowEmpty: true,
      });
  assert.throws(() => validateRoutines([r], exercises), /at least one/);
});
test("exercise alternatives, edits, removal and block order match the workflow", () => {
  const w = createRoutine("custom", 1).workouts[0];
  addExercise(w, names[0]);
  const id = w.items[0].id;
  addExercise(w, names[1], id);
  assert.equal(w.items[0].kind, "exerciseOptions");
  addExercise(w, names[2], id, 0);
  assert.deepEqual(w.items[0].exercises, [names[2], names[1]]);
  assert.throws(() => addExercise(w, names[1]), /already/);
  addExercise(w, names[3]);
  moveBlock(w, id, 1);
  assert.equal(w.items[1].id, id);
  removeExercise(w, id, 1);
  assert.equal(w.items[1].kind, "singleExercise");
  removeExercise(w, id, 0);
  assert.equal(w.items.length, 1);
});
test("weekly reassignment swaps workouts and rejects unscheduled workouts", () => {
  const r = complete();
  const first = r.days[0],
    third = r.days[4];
  assignDay(r, 0, third);
  assert.equal(r.days[4], first);
  assignDay(r, 0, null);
  assert.throws(() => validateRoutines([r], exercises), /Schedule every/);
  assignDay(r, 6, third);
  validateRoutines([r], exercises);
  const added = addWorkout(r);
  assert.ok(r.days.includes(added.id));
  removeWorkout(r, added.id);
  validateRoutines([r], exercises);
});
test("search and body, region and movement filters combine and exclude used exercises", () => {
  const e = exercises.find((e) => e.type === "Push");
  const c = exerciseCategory(e);
  assert.ok(
    filterExercises(exercises, {
      query: e.name.toUpperCase(),
      part: c.part,
      region: c.region,
      function: "Push",
    }).some((x) => x.name === e.name),
  );
  assert.equal(
    filterExercises(exercises, { query: e.name }, [e.name]).some(
      (x) => x.name === e.name,
    ),
    false,
  );
  assert.equal(
    filterExercises(exercises, { region: "Lower", function: "Push" }).length,
    0,
  );
});
test("save, edit conflict protection and delete preserve active and completed workout snapshots", () => {
  const state = freshState(),
    r = complete("custom", 1);
  saveRoutine(state, r, exercises);
  const t = listTemplates(state, templates).find(
    (t) => t.id === r.workouts[0].id,
  );
  state.sessions.push({
    sessionID: "active",
    templateName: t.name,
    templateID: t.id,
    templateSnapshot: structuredClone(t),
    startedAt: "2026-11-27T10:00:00Z",
    endedAt: null,
  });
  state.sessions.push({
    ...structuredClone(state.sessions[0]),
    sessionID: "history",
    endedAt: "2026-11-27T11:00:00Z",
  });
  const before = structuredClone(state.sessions),
    expected = structuredClone(state.customRoutines[0]);
  r.workouts[0].name = "Renamed";
  saveRoutine(state, r, exercises, { expected });
  assert.throws(
    () => saveRoutine(state, r, exercises, { expected }),
    /changed elsewhere/,
  );
  assert.deepEqual(
    sessionTemplate(state.sessions[0], listTemplates(state, templates)),
    t,
  );
  deleteRoutine(state, r.id);
  assert.equal(state.routine, "austin");
  assert.deepEqual(state.sessions, before);
  validateState(state, exercises, templates);
});
test("original routines can be copied without sharing IDs, including cardio and circuit blocks", () => {
  for (const builtin of BUILTIN_ROUTINES) {
    const r = copyRoutine(builtin, templates);
    validateRoutines([r], exercises);
    assert.equal(r.workouts.length, builtin.templateIDs.length);
    assert.ok(r.workouts.every((w) => !builtin.templateIDs.includes(w.id)));
  }
});
test("legacy journals remain valid and exported custom journals reopen", () => {
  const old = freshState();
  delete old.customRoutines;
  validateState(old, exercises, templates);
  const d = disk(),
    store = createStore(d, exercises, templates);
  store.update((s) => saveRoutine(s, complete(), exercises));
  const reopened = createStore(d, exercises, templates);
  assert.deepEqual(reopened.state, JSON.parse(JSON.stringify(store.state)));
  validateState(reopened.state, exercises, templates);
});
test("routine merges combine independent additions, expose same-routine conflicts and handle deletion", () => {
  const base = freshState(),
    local = structuredClone(base),
    remote = structuredClone(base),
    a = complete(),
    b = complete();
  saveRoutine(local, a, exercises, { activate: false });
  saveRoutine(remote, b, exercises, { activate: false });
  const both = mergeDocuments(base, local, remote);
  assert.equal(both.data.customRoutines.length, 2);
  assert.deepEqual(both.conflicts, []);
  validateState(both.data, exercises, templates);
  const original = structuredClone(local),
    ours = structuredClone(original),
    theirs = structuredClone(original);
  ours.customRoutines[0].name = "Local";
  theirs.customRoutines[0].name = "Cloud";
  assert.deepEqual(mergeDocuments(original, ours, theirs).conflicts, [
    "customRoutines/" + a.id,
  ]);
  assert.equal(
    mergeDocuments(original, ours, theirs, "cloud").data.customRoutines[0].name,
    "Cloud",
  );
  original.routine = a.id;
  const deleted = structuredClone(original);
  deleteRoutine(deleted, a.id);
  assert.equal(
    mergeDocuments(original, original, deleted).data.routine,
    "austin",
  );
});
test("unfinished drafts restore blank names and alternatives while remaining account-separated", () => {
  const storage = disk(),
    r = complete("custom", 1);
  r.name = "";
  r.workouts[0].name = "";
  r.days = Array(7).fill(null);
  addExercise(r.workouts[0], names[1], r.workouts[0].items[0].id);
  const initial = {
    phase: 2,
    name: "",
    count: 1,
    format: "custom",
    routine: r,
  };
  const first = openRoutineDraft(storage, "a", "new", exercises, initial);
  first.save();
  const restored = openRoutineDraft(storage, "a", "new", exercises, initial);
  assert.ok(restored.recovered);
  assert.deepEqual(restored.value, initial);
  const other = openRoutineDraft(storage, "b", "new", exercises, {
    ...initial,
    name: "Other",
  });
  assert.equal(other.recovered, false);
  const tab = openRoutineDraft(storage, "a", "new", exercises, initial);
  restored.value.name = "Changed";
  restored.save();
  assert.throws(() => tab.save(), /another tab/);
  storage.setItem = () => {
    throw new Error("full");
  };
  assert.throws(() => restored.save(), /full/);
  assert.throws(() => validateRoutines([r], exercises), /name/);
});
test("custom routines synchronize between devices and stay inside their account", async (t) => {
  const rows = new Map(),
    remote = {
      async read(id) {
        return structuredClone(rows.get(id) || null);
      },
      async save(id, revision, data) {
        const old = rows.get(id);
        if ((old?.revision || 0) !== revision)
          throw Object.assign(new Error("stale"), { code: "40001" });
        const row = { revision: revision + 1, data: structuredClone(data) };
        rows.set(id, row);
        return row;
      },
    };
  const a = createJournalSync({
      storage: disk(),
      exercises,
      templates,
      remote,
    }),
    b = createJournalSync({ storage: disk(), exercises, templates, remote });
  t.after(() => {
    a.dispose();
    b.dispose();
  });
  a.attach({ id: "owner" });
  b.attach({ id: "owner" });
  a.store.update((s) => saveRoutine(s, complete(), exercises));
  await a.sync();
  await b.sync();
  assert.deepEqual(cloudDocument(b.store.state), cloudDocument(a.store.state));
  b.attach({ id: "another" });
  assert.equal(b.store.state.customRoutines.length, 0);
});
test("routine pages render every phase and workouts use the saved snapshot after deletion", () => {
  globalThis.localStorage = disk();
  const state = freshState(),
    r = complete("custom", 1);
  saveRoutine(state, r, exercises);
  const ctx = {
    store: { state },
    exercises,
    get templates() {
      return listTemplates(state, templates);
    },
    get routines() {
      return listRoutines(state);
    },
  };
  assert.match(routinePage(ctx), /New routine/);
  assert.match(routinePage(ctx, "new"), /Choose format/);
  ctx.routineEditor.value.routine = r;
  ctx.routineEditor.value.phase = 2;
  assert.match(routinePage(ctx, "new"), /Add option/);
  ctx.routineEditor.value.phase = 3;
  assert.match(routinePage(ctx, "new"), /Save routine/);
  assert.match(workouts(ctx), /Your weekly plan/);
  const template = ctx.templates.find((t) => t.id === r.workouts[0].id);
  state.sessions.push({
    sessionID: "s",
    templateName: template.name,
    templateSnapshot: template,
    startedAt: "2026-11-27T10:00:00Z",
  });
  deleteRoutine(state, r.id);
  assert.match(
    session(ctx, "s"),
    new RegExp(names[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  delete globalThis.localStorage;
});
