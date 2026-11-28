import test from "node:test";
import assert from "node:assert/strict";
import { workoutCard, bindWorkoutPreviews } from "../js/views/workout-card.js";
import { routinePage, bindRoutinePage } from "../js/views/routine-builder.js";
import { draftKey } from "../js/routine-draft.js";
import { freshState } from "../js/store.js";
import { BUILTIN_ROUTINES } from "../js/routines.js";

test("workout preview groups alternatives in recorded order and starts collapsed", () => {
  const t = {
    id: "custom / test",
    name: "Push <A>",
    exerciseType: "Push",
    items: [
      { id: "one", kind: "singleExercise", exercises: ["Bench"] },
      { id: "two", kind: "exerciseOptions", exercises: ["Dips", "Flyes"] },
    ],
  };
  const html = workoutCard(t, [], "My routine");
  assert.match(html, /Select workout/);
  assert.match(html, /Push &lt;A&gt;/);
  assert.match(html, /class="workout-preview" hidden/);
  assert.match(html, /aria-expanded="false"/);
  assert.ok(html.indexOf("Bench") < html.indexOf("Dips"));
  assert.ok(html.indexOf("Dips") < html.indexOf("Flyes"));
  assert.match(
    html,
    /<div class="preview-options"><span>Dips<\/span><span>Flyes<\/span>/,
  );
  assert.doesNotMatch(html, /workout-icon/);
});

test("preview toggle expands and collapses without selecting a workout", () => {
  const panel = { hidden: true },
    button = {
      dataset: { preview: "p" },
      setAttribute(k, v) {
        this[k] = v;
      },
    };
  bindWorkoutPreviews({
    querySelectorAll: () => [button],
    getElementById: () => panel,
  });
  button.onclick();
  assert.equal(panel.hidden, false);
  assert.equal(button["aria-expanded"], "true");
  button.onclick();
  assert.equal(panel.hidden, true);
  assert.equal(button["aria-expanded"], "false");
});

test("New routine warns before discarding a draft, protects changes from other tabs, and leaves other accounts alone", async () => {
  const values = new Map(),
    key = draftKey("tester"),
    otherKey = draftKey("other");
  values.set(key, "existing draft");
  values.set(otherKey, "other account draft");
  globalThis.localStorage = {
    getItem: (k) => values.get(k) ?? null,
    removeItem: (k) => values.delete(k),
  };
  globalThis.location = { hash: "#routines" };
  const newButton = {},
    form = {},
    dialog = {
      innerHTML: "",
      querySelector: () => form,
      querySelectorAll: () => [],
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
    };
  globalThis.document = {
    querySelector: (s) => (s === "#new-routine" ? newButton : dialog),
    querySelectorAll: () => [],
  };
  const ctx = {
    cloud: { account: { id: "tester" } },
    store: { state: freshState() },
    routines: BUILTIN_ROUTINES,
    templates: [],
    routineEditor: { old: true },
  };
  try {
    const html = routinePage(ctx);
    assert.match(html, /New routine/);
    assert.match(html, /Continue draft/);
    bindRoutinePage(ctx);
    newButton.onclick();
    assert.equal(dialog.open, true);
    assert.match(dialog.innerHTML, /will be discarded/);
    dialog.close();
    assert.equal(values.get(key), "existing draft");
    assert.equal(location.hash, "#routines");
    newButton.onclick();
    values.set(key, "changed in another tab");
    // modal displays failures as a toast; call the pure guard through the form after providing it.
    const toast = { classList: { add() {}, remove() {} } };
    const original = document.querySelector;
    document.querySelector = (s) => (s === "#toast" ? toast : original(s));
    await form.onsubmit({ preventDefault() {}, target: undefined });
    assert.equal(values.get(key), "changed in another tab");
    assert.match(toast.textContent, /another tab/);
    newButton.onclick();
    await form.onsubmit({ preventDefault() {}, target: undefined });
    assert.equal(values.has(key), false);
    assert.equal(values.get(otherKey), "other account draft");
    assert.equal(location.hash, "#routines/new");
    assert.equal(ctx.routineEditor, null);
    assert.doesNotMatch(routinePage(ctx), /Continue draft/);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.location;
    delete globalThis.document;
  }
});
