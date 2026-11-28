import { heading, esc, date, time, empty, notify, modal } from "../ui.js";
import { uid, sessionSets, previousSets, validSet } from "../model.js";
import { draftRows, newDraft, commitExerciseSets } from "../exercise-log.js";
import { prepareSaveSound, playSaveChime } from "../sounds.js";
import {
  recommendationCard,
  bindRecommendation,
} from "./recommendation-card.js";
import { charts } from "../charts.js";
let dirty = false;
export const hasUnsavedChanges = () => dirty;
export const clearDirty = () => {
  dirty = false;
};
const blank = () => newDraft();
export function hub(ctx, id, name) {
  const session = ctx.store.state.sessions.find((s) => s.sessionID === id),
    exercise = ctx.exercises.find((e) => e.name === name);
  if (!session || !exercise || session.endedAt)
    return empty(
      "Exercise log unavailable",
      "Open an exercise from your active workout.",
    );
  const previous = previousSets(ctx.store.state, name, id);
  const saved = sessionSets(ctx.store.state, id, name);
  const key = id + "|" + name;
  ctx.draftKey = key;
  ctx.rows = draftRows(
    structuredClone(
      ctx.store.state.drafts[key] ||
        (saved.length
          ? saved.map((s) => ({
              id: s.setID,
              setID: s.setID,
              weight: s.weight,
              reps: s.reps,
              notes: s.notes,
            }))
          : [blank()]),
    ),
    saved,
  );
  dirty = Boolean(ctx.store.state.drafts[key]);
  return (
    heading(
      exercise.type.toUpperCase(),
      name,
      `${exercise.majorMuscle}${exercise.minorMuscle ? " · " + exercise.minorMuscle : ""}`,
      `<a class="secondary" href="#session/${encodeURIComponent(id)}">Back to workout</a>`,
    ) +
    (exercise.setupNotes
      ? `<p class="setup-note"><strong>Setup notes</strong> ${esc(exercise.setupNotes)}</p>`
      : "") +
    `<div class="hub-top"><section class="card"><div class="section-head"><div><p class="eyebrow">YOUR LAST SESSION</p><h2>Previous sets</h2></div><span class="muted">${previous.length ? date(previous[0].timestamp) : ""}</span></div>${previous.length ? `<div class="table-scroll"><table><thead><tr><th>Set</th><th>Weight (lb)</th><th>Reps</th><th>Notes</th></tr></thead><tbody>${previous.map((s, i) => `<tr><td>${i + 1}</td><td>${s.weight}</td><td>${s.reps}</td><td>${esc(s.notes) || "—"}</td></tr>`).join("")}</tbody></table></div><button class="quiet" id="copy-previous">Use previous sets as a starting point</button>` : empty("No previous sets", "Your next session will have something to build on.")}</section>${recommendationCard(ctx, id, name)}</div>
    <section class="card logging-card"><div class="section-head"><div><p class="eyebrow">THE WORK HAPPENS HERE</p><h2>Current session</h2></div><span class="badge" id="draft-status">${dirty ? "Draft restored" : "Ready to log"}</span></div><form id="sets-form"><div id="set-rows"></div><p class="form-error" id="set-error" role="alert"></p><div class="actions"><button type="button" id="add-set" class="secondary">＋ Add set</button><button type="button" id="discard" class="quiet">Discard changes</button><button type="submit" class="primary">Save sets</button></div></form><p class="fine-print">Drafts stay on this device until you save or discard them. Use 0 lb for bodyweight sets.</p></section>${charts(ctx.store.state.sets.filter((s) => s.exerciseName === name))}`
  );
}
export function bindHub(ctx, id, name) {
  const session = ctx.store.state.sessions.find((s) => s.sessionID === id),
    exercise = ctx.exercises.find((e) => e.name === name);
  if (!session || !exercise || session.endedAt) return;
  const rowsNode = document.querySelector("#set-rows");
  const rowState = (row) => {
    const saved = ctx.store.state.sets.find((s) => s.setID === row.setID);
    return !saved
      ? "Unsaved"
      : String(saved.weight) === String(row.weight) &&
          String(saved.reps) === String(row.reps) &&
          saved.notes === row.notes
        ? "Saved"
        : "Modified";
  };
  const persist = () => {
    dirty = true;
    ctx.store.update((s) => {
      s.drafts[ctx.draftKey] = structuredClone(ctx.rows);
    });
    document.querySelector("#draft-status").textContent = "Draft on device";
  };
  function drawRows() {
    rowsNode.innerHTML =
      ctx.rows
        .map(
          (r, i) =>
            `<div class="set-row" data-row="${esc(r.id)}"><div class="set-number"><span>SET ${i + 1}</span><small data-state class="${rowState(r) === "Saved" ? "saved" : ""}">${rowState(r)}</small></div><label>Weight (lb)<input name="weight" type="number" inputmode="decimal" min="0" max="5000" step="any" required value="${esc(r.weight)}" aria-label="Set ${i + 1} weight in pounds"></label><label>Reps<input name="reps" type="number" inputmode="numeric" min="1" max="1000" step="1" required value="${esc(r.reps)}" aria-label="Set ${i + 1} reps"></label><label class="notes-label">Notes<input name="notes" maxlength="2000" value="${esc(r.notes)}" placeholder="How did it feel?" aria-label="Set ${i + 1} notes"></label><button type="button" class="quiet remove-set" data-remove="${esc(r.id)}" aria-label="Remove set ${i + 1}">✕</button></div>`,
        )
        .join("") || '<p class="muted">No rows. Add a set to begin.</p>';
    rowsNode.querySelectorAll("input").forEach(
      (input) =>
        (input.oninput = () => {
          const container = input.closest("[data-row]"),
            row = ctx.rows.find((r) => r.id === container.dataset.row);
          row[input.name] = input.value;
          const status = container.querySelector("[data-state]");
          status.textContent = rowState(row);
          status.classList.toggle("saved", rowState(row) === "Saved");
          try {
            persist();
            document.querySelector("#set-error").textContent = "";
          } catch (error) {
            document.querySelector("#set-error").textContent = error.message;
          }
        }),
    );
    rowsNode.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          ctx.rows = ctx.rows.filter((r) => r.id !== b.dataset.remove);
          persist();
          drawRows();
        }),
    );
  }
  drawRows();
  bindRecommendation(ctx, id, name);
  document.querySelector("#add-set").onclick = () => {
    ctx.rows.push(newDraft(ctx.rows, sessionSets(ctx.store.state, id, name)));
    persist();
    drawRows();
    rowsNode.querySelector(".set-row:last-child input").focus();
  };
  document.querySelector("#sets-form").onsubmit = (event) => {
    event.preventDefault();
    if (ctx.rows.some((r) => !validSet(r.weight, r.reps))) {
      document.querySelector("#set-error").textContent =
        "Enter a weight of 0–5,000 lb and a whole-number rep count of 1–1,000 for every row.";
      return;
    }
    try {
      const sound = prepareSaveSound();
      let changed = false;
      ctx.store.update((state) => {
        changed = commitExerciseSets(state, id, name, ctx.rows);
      });
      if (changed) playSaveChime(sound);
      dirty = false;
      ctx.render();
      notify("Sets saved.");
    } catch (error) {
      document.querySelector("#set-error").textContent = error.message;
    }
  };
  document.querySelector("#discard").onclick = () =>
    modal(
      "Discard these changes?",
      "<p>Your saved sets will stay as they were.</p>",
      () => {
        ctx.store.update((s) => {
          delete s.drafts[ctx.draftKey];
        });
        dirty = false;
        ctx.render();
      },
      "Discard changes",
    );
  const copy = document.querySelector("#copy-previous");
  if (copy)
    copy.onclick = () =>
      modal(
        "Use your previous sets?",
        "<p>This replaces the current draft rows. Nothing is saved as a completed set until you select Save sets.</p>",
        () => {
          ctx.rows = draftRows(
            previousSets(ctx.store.state, name, id).map((s) => ({
              id: uid(),
              setID: null,
              weight: s.weight,
              reps: s.reps,
              notes: "",
            })),
            sessionSets(ctx.store.state, id, name),
          );
          persist();
          drawRows();
        },
        "Use previous sets",
      );
}
