import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { history, bindHistory } from "../js/views/history.js";
import { session } from "../js/views/workouts.js";
import { freshState } from "../js/store.js";
import { blocksFor, replaceBlock, skipBlock } from "../js/model.js";
const exercises = JSON.parse(
  readFileSync(new URL("../data/exercises.json", import.meta.url)),
);
const templates = JSON.parse(
  readFileSync(new URL("../data/templates.json", import.meta.url)),
);

test("History switches between workouts and exercise progress, with saved sets grouped by session", () => {
  const state = freshState(),
    name = exercises[0].name;
  state.sessions = [
    {
      sessionID: "first",
      templateName: "Earlier workout",
      startedAt: "2026-11-26T10:00:00Z",
      endedAt: "2026-11-26T11:00:00Z",
    },
    {
      sessionID: "second",
      templateName: "Later workout",
      startedAt: "2026-11-27T10:00:00Z",
      endedAt: "2026-11-27T11:00:00Z",
    },
  ];
  state.sets = state.sessions.map((s, i) => ({
    setID: "set" + i,
    sessionID: s.sessionID,
    exerciseName: name,
    weight: 100,
    reps: 8,
    notes: "<private note>",
    timestamp: s.startedAt,
  }));
  const ctx = { store: { state }, exercises, templates };
  assert.match(history(ctx), /By workout/);
  assert.match(history(ctx), /href="#history\/exercises"/);
  assert.match(history(ctx, "exercises"), /id="exercise-results"/);
  const detail = history(ctx, "exercises", name);
  assert.match(detail, /Saved sets/);
  assert.match(detail, /data-edit="set0"/);
  assert.match(detail, /data-edit="set1"/);
  assert.ok(
    detail.indexOf("Later workout") < detail.indexOf("Earlier workout"),
  );
  assert.match(detail, /&lt;private note&gt;/);
  assert.doesNotMatch(detail, /<private note>/);
  assert.match(history(ctx, "exercises", "Unknown"), /Exercise not found/);
});

test("History exercise filtering keeps compact progress links and set counts", () => {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id))
      nodes.set(id, { value: "", innerHTML: "", addEventListener() {} });
    return nodes.get(id);
  };
  globalThis.document = {
    querySelector: (selector) => node(selector.slice(1)),
    getElementById: node,
    querySelectorAll: () => [],
  };
  try {
    node("exercise-search").value = exercises[0].name;
    bindHistory(
      { store: { state: freshState() }, exercises, templates },
      "exercises",
    );
    const html = node("exercise-results").innerHTML;
    assert.ok(
      html.includes(
        "#history/exercises/" + encodeURIComponent(exercises[0].name),
      ),
    );
    assert.match(html, /0 sets/);
    assert.doesNotMatch(html, /View progress/);
  } finally {
    delete globalThis.document;
  }
});

test("workout cards restore orange skipped and blue swapped classes and clear them when undone", () => {
  const state = freshState(),
    template = templates.find((t) => t.id === "Austin Push");
  const workout = {
    sessionID: "test",
    templateName: template.name,
    templateSnapshot: template,
    startedAt: "2026-11-27T10:00:00Z",
    endedAt: null,
  };
  state.sessions.push(workout);
  const block = blocksFor(template, exercises)[0];
  const ctx = { store: { state }, templates, exercises };
  assert.doesNotMatch(
    session(ctx, "test"),
    /class="card block (skipped|swapped)"/,
  );
  skipBlock(state, workout, block, "Test skip");
  assert.match(session(ctx, "test"), /class="card block skipped"/);
  replaceBlock(
    state,
    workout,
    block,
    exercises.find((e) => !block.exercises.includes(e.name)).name,
  );
  assert.match(session(ctx, "test"), /class="card block swapped"/);
  assert.doesNotMatch(session(ctx, "test"), /class="card block skipped"/);
  state.replacements = [];
  assert.doesNotMatch(
    session(ctx, "test"),
    /class="card block (skipped|swapped)"/,
  );
});
