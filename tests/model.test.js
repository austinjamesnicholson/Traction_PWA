import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  freshState,
  createStore,
  validateState,
  STORAGE_KEY,
} from "../js/store.js";
import {
  validSet,
  previousSets,
  recentVolume,
  replaceBlock,
  skipBlock,
  blockStatus,
  importLegacy,
} from "../js/model.js";
import {
  recommendationPayload,
  validRecommendation,
} from "../js/recommendations.js";
const exercises = JSON.parse(
  readFileSync(new URL("../data/exercises.json", import.meta.url)),
);
const templates = JSON.parse(
  readFileSync(new URL("../data/templates.json", import.meta.url)),
);
const exercise = exercises.find((e) => e.name === "Dumbbell Incline Press");
const session = (id, day) => ({
  sessionID: id,
  templateName: "Austin Push",
  startedAt: `2026-11-${day}T10:00:00Z`,
  endedAt: id === "current" ? null : `2026-11-${day}T11:00:00Z`,
});
const set = (id, sid, day, weight = 50, reps = 10) => ({
  setID: id,
  sessionID: sid,
  exerciseName: exercise.name,
  weight,
  reps,
  notes: "",
  timestamp: `2026-11-${day}T10:10:00Z`,
});
function fixture() {
  const s = freshState();
  s.sessions = [
    session("old", "20"),
    session("previous", "23"),
    session("current", "25"),
  ];
  s.sets = [
    set("a", "old", "20"),
    set("b", "previous", "23"),
    set("c", "current", "25"),
  ];
  return s;
}
function memory() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
test("set validation accepts bodyweight and rejects blank, fractional reps and nonfinite input", () => {
  assert(validSet(0, 10));
  assert(validSet("2.5", "8"));
  for (const pair of [
    ["", 2],
    [null, 2],
    [1, ""],
    [-1, 2],
    [1, 1.5],
    [Infinity, 3],
    [1, 0],
    [5001, 2],
  ])
    assert.equal(validSet(...pair), false);
});
test("previous session excludes active sets and groups the latest session", () => {
  const s = fixture();
  s.sets.push(set("d", "previous", "23"));
  assert.deepEqual(
    previousSets(s, exercise.name, "current").map((s) => s.setID),
    ["b", "d"],
  );
});
test("volume counts primary once and secondary half per set within rolling seven days", () => {
  const s = fixture();
  s.sets.push(set("ancient", "old", "01"));
  const volume = recentVolume(s, exercises, new Date("2026-11-25T12:00:00Z"));
  assert.equal(
    volume.find((v) => v.muscle === exercise.majorMuscle).primary,
    3,
  );
  assert.equal(
    volume.find((v) => v.muscle === exercise.minorMuscle).secondary,
    1.5,
  );
});
test("substitution and skip apply only to their session and replace each other", () => {
  const s = fixture(),
    block = templates[0].items[1];
  replaceBlock(s, s.sessions[2], block, "Dips");
  assert.equal(blockStatus(s, "current", block), "Alternate selected");
  assert.equal(blockStatus(s, "old", block), "Ready");
  skipBlock(s, s.sessions[2], block, "Busy machine");
  assert.equal(s.replacements.length, 0);
  assert.equal(blockStatus(s, "current", block), "Skipped");
  replaceBlock(s, s.sessions[2], block, exercise.name);
  assert.equal(s.skips.length, 0);
  assert.equal(blockStatus(s, "current", block), "Completed");
});
test("legacy history import preserves IDs, repairs session boundaries and is idempotent", () => {
  const input = {
    setEntries: [
      { ...set("b", "legacy", "23"), templateName: "Push" },
      { ...set("a", "legacy", "20"), templateName: "Push" },
    ],
  };
  const result = importLegacy(freshState(), input, exercises);
  assert.equal(result.count, 2);
  assert.equal(result.state.sessions.length, 1);
  assert.equal(
    result.state.sessions[0].startedAt,
    input.setEntries[1].timestamp,
  );
  assert.equal(importLegacy(result.state, input, exercises).count, 0);
  assert.equal(result.state.sets[0].setID, "b");
});
test("invalid legacy import is atomic", () => {
  const s = freshState();
  assert.throws(() =>
    importLegacy(
      s,
      {
        setEntries: [
          { ...set("x", "y", "20"), templateName: "Push" },
          { bad: true },
        ],
      },
      exercises,
    ),
  );
  assert.equal(s.sets.length, 0);
});
test("store writes and reloads workouts, drafts, history edits and profile", () => {
  const disk = memory(),
    store = createStore(disk, exercises, templates);
  store.replace(fixture());
  store.update((s) => {
    s.profile.age = "35";
    s.drafts["current|" + exercise.name] = [
      { id: "draft", setID: null, weight: "40", reps: "8", notes: "unsaved" },
    ];
    s.sets[0].reps = 12;
  });
  const reloaded = createStore(disk, exercises, templates);
  assert.equal(reloaded.state.profile.age, "35");
  assert.equal(reloaded.state.sets[0].reps, 12);
  assert.equal(
    reloaded.state.drafts["current|" + exercise.name][0].notes,
    "unsaved",
  );
});
test("storage failures never report changes saved", () => {
  const disk = memory(),
    store = createStore(disk, exercises, templates);
  disk.setItem = () => {
    throw new Error("QuotaExceeded");
  };
  assert.throws(
    () =>
      store.update((s) => {
        s.routine = "lizzie";
      }),
    /could not save/,
  );
  assert.equal(store.state.routine, "austin");
});
test("concurrent tabs cannot overwrite one another", () => {
  const disk = memory(),
    a = createStore(disk, exercises, templates),
    b = createStore(disk, exercises, templates);
  a.update((s) => {
    s.routine = "lizzie";
  });
  assert.throws(
    () =>
      b.update((s) => {
        s.routine = "austin";
      }),
    /another tab/,
  );
});
test("corrupt storage stays untouched", () => {
  const disk = memory();
  disk.setItem(STORAGE_KEY, "bad json");
  assert.throws(
    () => createStore(disk, exercises, templates),
    /not been overwritten/,
  );
  assert.equal(disk.getItem(STORAGE_KEY), "bad json");
});
test("restore rejects duplicate IDs, broken relationships and invalid sets", () => {
  for (const mutate of [
    (s) => s.sets.push(s.sets[0]),
    (s) => {
      s.sets[0].sessionID = "missing";
    },
    (s) => {
      s.sets[0].reps = -2;
    },
    (s) => {
      s.sessions[0].endedAt = "bad";
    },
  ]) {
    const s = fixture();
    mutate(s);
    assert.throws(() => validateState(s, exercises, templates));
  }
});
test("AI payload separates current, previous and older history without leaking profile", () => {
  const s = fixture();
  s.profile.weight = "180";
  const p = recommendationPayload(s, exercise, s.sessions[2]);
  assert.equal(p.currentSession.sets.length, 1);
  assert.equal(p.previousSession.sets.length, 1);
  assert.equal(p.recentSessions.length, 1);
  assert(!JSON.stringify(p).includes("180"));
});
test("AI response validation rejects unsafe malformed values", () => {
  const r = {
    headline: "Next session",
    summary: "A summary",
    sessionSuggestion: "Take your time",
    sets: [
      { setType: "working", weight: 20, unit: "lb", repsMin: 8, repsMax: 12 },
    ],
  };
  assert(validRecommendation(r));
  r.sets[0].repsMax = 1;
  assert(!validRecommendation(r));
});
test("all ten source templates reference the 66-exercise library", () => {
  assert.equal(exercises.length, 66);
  assert.equal(templates.length, 10);
  for (const t of templates)
    for (const b of t.items)
      for (const n of b.exercises) assert(exercises.some((e) => e.name === n));
});
