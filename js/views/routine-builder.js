import { heading, esc, empty, modal, notify } from "../ui.js";
import {
  FORMATS,
  DAYS,
  SHOW_ROUTINE_SCHEDULE,
  createRoutine,
  validateRoutines,
  saveRoutine,
  deleteRoutine,
  copyRoutine,
} from "../routines.js";
import {
  openRoutineDraft,
  draftKey,
  discardRoutineDraft,
} from "../routine-draft.js";
import { routineEditorMarkup, bindRoutineEditor } from "./routine-editor.js";
import { icon } from "../icons.js";
const scope = (ctx) => ctx.cloud?.account?.id || "device";
function editorFor(ctx, action, id) {
  const target = action === "edit" ? id : "new",
    key = draftKey(scope(ctx), target);
  if (ctx.routineEditor?.key === key) return ctx.routineEditor;
  const existing =
    action === "edit"
      ? (ctx.store.state.customRoutines || []).find((r) => r.id === id)
      : null;
  if (action === "edit" && !existing)
    throw new Error(
      "This custom routine no longer exists. Open Routines to choose another.",
    );
  const initial = {
    phase: existing ? 2 : 1,
    name: existing?.name || "My routine",
    format: existing?.format || "fullbody",
    count: existing?.workouts.length || FORMATS[0].count,
    routine: existing ? structuredClone(existing) : null,
    original: existing ? structuredClone(existing) : null,
    selectedWorkout: existing?.workouts[0].id || null,
    activate: existing ? ctx.store.state.routine === id : true,
  };
  ctx.routineEditor = openRoutineDraft(
    localStorage,
    scope(ctx),
    target,
    ctx.exercises,
    initial,
  );
  if (ctx.routineEditor.value.routine && !SHOW_ROUTINE_SCHEDULE)
    ctx.routineEditor.value.routine.scheduleEnabled = false;
  return ctx.routineEditor;
}
function library(ctx) {
  const routines = ctx.routines,
    hasDraft = Boolean(localStorage.getItem(draftKey(scope(ctx))));
  return (
    heading(
      "YOUR PLAN, YOUR PACE",
      "Routines",
      "Build workouts you look forward to showing up for.",
      `<div class="actions routine-entry-actions"><button class="primary" id="new-routine">New routine</button>${hasDraft ? '<a class="secondary" href="#routines/new">Continue draft</a>' : ""}</div>`,
    ) +
    `<div class="routine-library">${routines
      .map(
        (r) =>
          `<article class="card routine-card ${ctx.store.state.routine === r.id ? "active-routine" : ""}"><div class="section-head"><h2>${esc(r.name)}</h2><span class="badge ${ctx.store.state.routine === r.id ? "success" : ""}">${ctx.store.state.routine === r.id ? "Active routine" : r.custom ? "Your routine" : "Original routine"}</span></div><p class="routine-description">${esc(r.subtitle)}</p>${
            r.custom && SHOW_ROUTINE_SCHEDULE
              ? `<div class="routine-miniweek">${r.days.map((id, i) => `<span class="${id ? "training-day" : ""}" title="${DAYS[i]}: ${esc(r.workouts.find((w) => w.id === id)?.name || "Rest")}">${DAYS[i].slice(0, 1)}</span>`).join("")}</div>`
              : `<div class="routine-workout-names">${r.templateIDs
                  .slice(0, 3)
                  .map(
                    (id) =>
                      `<span>${esc(ctx.templates.find((t) => t.id === id)?.name || id)}</span>`,
                  )
                  .join(
                    "",
                  )}${r.templateIDs.length > 3 ? `<span>+${r.templateIDs.length - 3} more</span>` : ""}</div>`
          }<div class="actions"><button class="${ctx.store.state.routine === r.id ? "secondary" : "primary"}" data-activate="${esc(r.id)}" ${ctx.store.state.routine === r.id ? "disabled" : ""}>${ctx.store.state.routine === r.id ? "Currently active" : "Use routine"}</button>${r.custom ? `<a class="secondary icon-label" href="#routines/edit/${encodeURIComponent(r.id)}">${icon("edit")} Edit</a>` : ""}<button class="quiet icon-button" data-copy-routine="${esc(r.id)}" aria-label="Make a copy of ${esc(r.name)}">${icon("copy")}</button>${r.custom ? `<button class="quiet icon-button delete-choice" data-delete-routine="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">${icon("trash")}</button>` : ""}</div></article>`,
      )
      .join(
        "",
      )}</div><p class="fine-print">Saved routines sync with your signed-in account. Unfinished builder drafts stay on this device. Editing a routine never changes a workout you already started.</p>`
  );
}
function setup(draft) {
  return `<form id="routine-setup" class="routine-setup"><section class="card setup-details"><p class="eyebrow">MAKE IT YOURS</p><h2>Name your routine</h2><label>Routine name<input name="name" value="${esc(draft.name)}" maxlength="80" required></label><p>Choose a starting format below. Add more variations with Add workout in the next step.</p></section><section class="card setup-intro"><p class="eyebrow">START WITH A LITTLE STRUCTURE</p><h2>How do you like to train?</h2><p>Choose a starting format. Every workout starts empty, ready for your exercises.</p><div class="routine-format-grid">${FORMATS.map((f) => `<button type="button" class="format-choice ${draft.format === f.id ? "selected" : ""}" data-format="${f.id}" aria-pressed="${draft.format === f.id}"><span class="format-symbol">${f.id === "custom" ? icon("plus") : icon("calendar")}</span><strong>${esc(f.name)}</strong><small>${esc(f.detail)}</small><span class="format-check">${draft.format === f.id ? icon("check") : ""}</span></button>`).join("")}</div><button class="primary setup-build" type="submit">Build workouts</button></section></form>`;
}

function review(ctx, draft) {
  const r = draft.routine;
  return `<section class="card review-intro"><p class="eyebrow">YOUR ROUTINE, READY TO GO</p><h2>${esc(r.name)}</h2>${SHOW_ROUTINE_SCHEDULE ? `<div class="routine-week">${r.days.map((id, i) => `<div class="plan-day"><span>${DAYS[i]}</span><strong>${esc(r.workouts.find((w) => w.id === id)?.name || "Rest day")}</strong></div>`).join("")}</div>` : ""}<label class="check-label"><input type="checkbox" id="activate-routine" ${draft.activate ? "checked" : ""}><span>Make this my active routine</span></label></section><div class="routine-review-grid">${r.workouts.map((w) => `<section class="card"><div class="section-head"><div><span class="eyebrow">${esc(w.type)}</span><h2>${esc(w.name)}</h2></div><button class="quiet icon-label" data-review-edit="${esc(w.id)}">${icon("edit")} Edit</button></div><ol class="review-exercises">${w.items.map((b) => `<li><strong>${b.exercises.map(esc).join(b.kind === "circuit" ? " + " : ' <span class="muted">or</span> ')}</strong>${b.exercises.length > 1 ? `<small>${b.kind === "circuit" ? "Circuit movements" : "Choose one when training"}</small>` : ""}</li>`).join("") || "<li>Open session · no exercise blocks</li>"}</ol></section>`).join("")}</div>`;
}
export function routinePage(ctx, action, id) {
  if (!action) return library(ctx);
  if (!["new", "edit"].includes(action)) return empty("Routine page not found");
  const editor = editorFor(ctx, action, id),
    draft = editor.value;
  return (
    heading(
      "TRAINING BUILT AROUND YOU",
      action === "edit" ? "Edit your routine." : "Build your next routine.",
      "A little structure. Room to make it your own.",
      `<a class="secondary" href="#routines">All routines</a>`,
    ) +
    `<div class="builder-progress" aria-label="Routine builder steps">${["Choose format", "Build workouts", "Review & save"].map((label, index) => `<button data-step="${index + 1}" class="${draft.phase === index + 1 ? "current" : draft.phase > index + 1 ? "complete" : ""}" ${!draft.routine && index > 0 ? "disabled" : ""} ${draft.phase === index + 1 ? 'aria-current="step"' : ""}><span>${draft.phase > index + 1 ? icon("check") : index + 1}</span>${label}</button>`).join("")}<span class="draft-indicator" id="routine-draft-status">${editor.recovered ? "Draft restored on this device" : "Draft stays on this device"}</span></div><div id="builder-notice" role="status" class="form-error"></div>` +
    (draft.phase === 1
      ? setup(draft)
      : draft.phase === 2
        ? routineEditorMarkup(ctx, draft)
        : review(ctx, draft)) +
    `<div class="builder-actions"><button class="quiet" id="discard-routine">Discard draft</button>${draft.phase > 1 ? `<button class="secondary" id="builder-back">${draft.phase === 2 ? "Back to format" : "Back to workouts"}</button><button class="primary" id="builder-next">${draft.phase === 2 ? "Review routine" : "Save routine"}</button>` : ""}</div>`
  );
}
export function bindRoutinePage(ctx, action, id) {
  if (!action) {
    document.querySelector("#new-routine").onclick = () => {
      const owner = scope(ctx),
        key = draftKey(owner),
        existing = localStorage.getItem(key);
      const start = () => {
        if (scope(ctx) !== owner)
          throw new Error(
            "Your account changed. Reopen Routines before starting a new routine.",
          );
        discardRoutineDraft(localStorage, key, existing);
        ctx.routineEditor = null;
        location.hash = "#routines/new";
      };
      if (existing !== null)
        modal(
          "Start a new routine?",
          "<p>Your current unfinished new-routine draft will be discarded. Saved routines and workout history will stay unchanged.</p>",
          start,
          "Discard draft and start new",
        );
      else start();
    };
    document.querySelectorAll("[data-activate]").forEach(
      (button) =>
        (button.onclick = () => {
          ctx.store.update((s) => {
            s.routine = button.dataset.activate;
          });
          ctx.render();
          notify("Active routine updated.");
        }),
    );
    document.querySelectorAll("[data-delete-routine]").forEach(
      (button) =>
        (button.onclick = () => {
          const r = ctx.routines.find(
            (r) => r.id === button.dataset.deleteRoutine,
          );
          modal(
            "Delete " + r.name + "?",
            `<p>This removes the saved routine. Workout history and any already-started workout stay in your journal.${ctx.store.state.routine === r.id ? " Austin’s Routine will become active." : ""}</p>`,
            () => {
              ctx.store.update((s) => deleteRoutine(s, r.id));
              ctx.render();
            },
            "Delete routine",
          );
        }),
    );
    document.querySelectorAll("[data-copy-routine]").forEach(
      (button) =>
        (button.onclick = () => {
          const copy = () => {
            const source = ctx.routines.find(
                (r) => r.id === button.dataset.copyRoutine,
              ),
              routine = copyRoutine(source, ctx.templates);
            const editor = openRoutineDraft(
              localStorage,
              scope(ctx),
              "new",
              ctx.exercises,
              {
                phase: 2,
                name: routine.name,
                format: routine.format,
                count: routine.workouts.length,
                routine,
                original: null,
                selectedWorkout: routine.workouts[0].id,
                activate: true,
              },
            );
            Object.assign(editor.value, {
              phase: 2,
              name: routine.name,
              format: routine.format,
              count: routine.workouts.length,
              routine,
              original: null,
              selectedWorkout: routine.workouts[0].id,
              activate: true,
            });
            editor.save();
            ctx.routineEditor = editor;
            location.hash = "#routines/new";
          };
          if (localStorage.getItem(draftKey(scope(ctx))))
            modal(
              "Replace the unfinished new routine?",
              "<p>Your saved routines are unchanged. This replaces only the new routine draft on this device.</p>",
              copy,
              "Replace draft",
            );
          else copy();
        }),
    );
    return;
  }
  if (!["new", "edit"].includes(action)) return;
  const editor = editorFor(ctx, action, id),
    draft = editor.value;
  const persist = () => {
    try {
      editor.save();
      document.querySelector("#routine-draft-status").textContent =
        "Draft saved on this device";
      document.querySelector("#builder-notice").textContent = "";
    } catch (error) {
      document.querySelector("#builder-notice").textContent = error.message;
      throw error;
    }
  };
  const step = (phase) => {
    try {
      if (draft.routine && !SHOW_ROUTINE_SCHEDULE)
        draft.routine.scheduleEnabled = false;
      if (phase === 3) validateRoutines([draft.routine], ctx.exercises);
      draft.phase = phase;
      persist();
      ctx.render();
      window.scrollTo(0, 0);
    } catch (error) {
      notify(error.message);
    }
  };
  document
    .querySelectorAll("[data-step]")
    .forEach(
      (button) => (button.onclick = () => step(Number(button.dataset.step))),
    );
  document.querySelector("#discard-routine").onclick = () =>
    modal(
      "Discard this routine draft?",
      "<p>Your saved routines and workout history will stay as they were.</p>",
      () => {
        editor.clear();
        ctx.routineEditor = null;
        location.hash = "#routines";
      },
      "Discard draft",
    );
  if (draft.phase === 1) {
    document.querySelectorAll("[data-format]").forEach(
      (button) =>
        (button.onclick = () => {
          draft.format = button.dataset.format;
          draft.count = FORMATS.find((f) => f.id === draft.format).count;
          persist();
          ctx.render();
        }),
    );
    const form = document.querySelector("#routine-setup");
    form.elements.name.oninput = () => {
      draft.name = form.elements.name.value;
      if (draft.routine) draft.routine.name = draft.name;
      persist();
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      draft.name = form.elements.name.value.trim();
      const build = () => {
        if (!draft.routine || draft.routine.format !== draft.format) {
          const next = createRoutine(
            draft.format,
            FORMATS.find((f) => f.id === draft.format).count,
            draft.name,
          );
          if (draft.original) {
            next.id = draft.original.id;
            next.createdAt = draft.original.createdAt;
          }
          draft.routine = next;
        } else draft.routine.name = draft.name;
        draft.count = draft.routine.workouts.length;
        draft.selectedWorkout = draft.routine.workouts[0].id;
        step(2);
      };
      if (
        draft.routine?.workouts.some((w) => w.items.length) &&
        draft.routine.format !== draft.format
      )
        modal(
          "Replace the workout structure?",
          "<p>This creates blank workouts for the new format. The exercise choices in this draft will be removed.</p>",
          build,
          "Create blank workouts",
        );
      else build();
    };
    return;
  }
  document.querySelector("#builder-back").onclick = () => step(draft.phase - 1);
  document.querySelector("#builder-next").onclick = () => {
    if (draft.phase === 2) {
      step(3);
      return;
    }
    try {
      if (editor.key !== draftKey(scope(ctx), action === "edit" ? id : "new"))
        throw new Error("Your account changed. Reopen the routine editor.");
      ctx.store.update((s) =>
        saveRoutine(s, draft.routine, ctx.exercises, {
          activate: draft.activate,
          expected: draft.original,
        }),
      );
      try {
        editor.clear();
      } catch {
        /* the saved journal is authoritative; a stale draft is harmless */
      }
      ctx.routineEditor = null;
      location.hash = "#routines";
      notify(
        draft.activate ? "Routine saved and activated." : "Routine saved.",
      );
    } catch (error) {
      document.querySelector("#builder-notice").textContent = error.message;
      notify(error.message);
    }
  };
  if (draft.phase === 2) bindRoutineEditor(ctx, draft, persist);
  else {
    document.querySelector("#activate-routine").onchange = (event) => {
      draft.activate = event.target.checked;
      persist();
    };
    document.querySelectorAll("[data-review-edit]").forEach(
      (button) =>
        (button.onclick = () => {
          draft.selectedWorkout = button.dataset.reviewEdit;
          step(2);
        }),
    );
  }
}
