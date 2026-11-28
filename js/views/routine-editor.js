import { esc, modal, notify } from "../ui.js";
import {
  DAYS,
  assignDay,
  addWorkout,
  removeWorkout,
  addExercise,
  removeExercise,
  moveBlock,
} from "../routines.js";
import { icon } from "../icons.js";
import { pickExercise } from "./exercise-picker.js";
import { bindBlockDrag } from "../routine-drag.js";
export function routineEditorMarkup(ctx, draft) {
  const routine = draft.routine,
    workout =
      routine.workouts.find((w) => w.id === draft.selectedWorkout) ||
      routine.workouts[0];
  draft.selectedWorkout = workout.id;
  return `<section class="card routine-planner"><div class="section-head"><div><p class="eyebrow">MAKE ROOM FOR YOUR TRAINING</p><h2>Your weekly rhythm</h2></div><span class="badge">${routine.workouts.length} workouts · ${7 - routine.workouts.length} rest days</span></div><label class="routine-name">Routine name<input id="builder-name" maxlength="80" value="${esc(routine.name)}" required></label><div class="routine-week editable-week">${routine.days.map((id, i) => `<label class="plan-day"><span>${DAYS[i]}</span><select data-day="${i}" aria-label="${DAYS[i]} workout"><option value="">Rest day</option>${routine.workouts.map((w) => `<option value="${esc(w.id)}" ${w.id === id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label>`).join("")}</div><p class="fine-print">Schedule each workout once. Choosing a workout already on another day swaps the two days.</p></section>
    <section class="workout-builder"><div class="section-head"><div><p class="eyebrow">BUILD EACH SESSION</p><h2>Workouts</h2></div><button class="secondary icon-label" id="add-workout" ${routine.workouts.length === 7 ? "disabled" : ""}>${icon("plus")} Add workout</button></div><div class="workout-tabs" role="tablist" aria-label="Workouts in this routine">${routine.workouts.map((w) => `<button role="tab" aria-selected="${w.id === workout.id}" aria-controls="workout-editor" data-workout="${esc(w.id)}" class="workout-tab ${w.id === workout.id ? "selected" : ""}"><span>${esc(w.name)}</span><small>${w.items.length} blocks</small></button>`).join("")}</div>
    <section class="card workout-editor" id="workout-editor" role="tabpanel" aria-label="${esc(workout.name)} editor"><div class="workout-heading"><div class="workout-fields"><label>Workout name<input id="workout-name" maxlength="80" value="${esc(workout.name)}" required></label><label>Session type<select id="workout-type">${[
      ["weightlifting", "Weightlifting"],
      ["cardio", "Cardio"],
      ["other", "Other / group fitness"],
    ]
      .map(
        ([id, label]) =>
          `<option value="${id}" ${workout.type === id ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Movement focus<select id="workout-focus">${["Full Body", "Push", "Pull", "Legs", "Core", "Cardio", "Group Fitness"].map((type) => `<option ${workout.exerciseType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label></div><button id="remove-workout" class="quiet icon-button delete-choice" aria-label="Remove ${esc(workout.name)}">${icon("trash")}</button></div>
    ${workout.type !== "weightlifting" ? '<p class="setup-note">You can save this as an open session or add exercises. Distance, GPS, and cardio-specific logging are future features.</p>' : ""}
    <p class="builder-hint">Each row is one exercise block. Add alternatives to choose between on workout day. Drag the grip to reorder, or use Up and Down.</p><div id="routine-blocks" class="routine-blocks">${workout.items
      .map(
        (block, index) =>
          `<article class="routine-exercise-block" data-block-id="${esc(block.id)}"><div class="block-choices">${block.exercises
            .map((name, option) => {
              const e = ctx.exercises.find((e) => e.name === name);
              return `<div class="exercise-choice"><div class="choice-tools"><button class="quiet icon-button" data-edit-block="${esc(block.id)}" data-option="${option}" aria-label="Change ${esc(name)}">${icon("edit")}</button><button class="quiet icon-button delete-choice" data-remove-choice="${esc(block.id)}" data-option="${option}" aria-label="Remove ${esc(name)}">${icon("trash")}</button></div><strong>${esc(name)}</strong><small>${esc(e?.majorMuscle || "")}${block.kind === "circuit" ? " · Circuit" : block.exercises.length > 1 ? " · Alternative" : ""}</small></div>`;
            })
            .join(
              "",
            )}<button class="add-choice" data-option-block="${esc(block.id)}" ${block.exercises.length === 8 ? "disabled" : ""}><span>${block.kind === "circuit" ? "Add movement" : "Add option"}</span>${icon("plus")}</button></div><div class="block-order-controls"><button class="quiet grip" data-grip="${esc(block.id)}" aria-label="Drag to reorder block ${index + 1}. Keyboard: use the up and down arrow keys.">${icon("grip")}</button><div class="reorder-shortcuts"><button class="quiet" data-up="${esc(block.id)}" ${index === 0 ? "disabled" : ""} aria-label="Move block ${index + 1} up">Up</button><button class="quiet" data-down="${esc(block.id)}" ${index === workout.items.length - 1 ? "disabled" : ""} aria-label="Move block ${index + 1} down">Down</button></div></div></article>`,
      )
      .join(
        "",
      )}</div><div class="add-exercise-row"><button id="add-exercise" class="add-exercise"><span>${icon("plus")}</span><span><strong>Add exercise</strong><small>Find the next movement for this workout</small></span></button></div></section></section>`;
}
export function bindRoutineEditor(ctx, draft, persist) {
  const routine = draft.routine,
    workout =
      routine.workouts.find((w) => w.id === draft.selectedWorkout) ||
      routine.workouts[0];
  const mutate = (change) => {
    try {
      change();
      persist();
      ctx.render();
    } catch (error) {
      notify(error.message);
    }
  };
  document.querySelector("#builder-name").oninput = (event) => {
    routine.name = event.target.value;
    draft.name = routine.name;
    persist();
  };
  document.querySelector("#workout-name").oninput = (event) => {
    workout.name = event.target.value;
    persist();
    document.querySelectorAll("[data-workout]").forEach((button) => {
      if (button.dataset.workout === workout.id)
        button.querySelector("span").textContent = workout.name;
    });
    document.querySelectorAll("[data-day] option").forEach((option) => {
      if (option.value === workout.id) option.textContent = workout.name;
    });
  };
  document.querySelector("#workout-type").onchange = (event) =>
    mutate(() => {
      workout.type = event.target.value;
      workout.exerciseType =
        workout.type === "cardio"
          ? "Cardio"
          : workout.type === "other"
            ? "Group Fitness"
            : ["Cardio", "Group Fitness"].includes(workout.exerciseType)
              ? "Full Body"
              : workout.exerciseType;
    });
  document.querySelector("#workout-focus").onchange = (event) =>
    mutate(() => {
      workout.exerciseType = event.target.value;
    });
  document
    .querySelectorAll("[data-day]")
    .forEach(
      (select) =>
        (select.onchange = () =>
          mutate(() =>
            assignDay(
              routine,
              Number(select.dataset.day),
              select.value || null,
            ),
          )),
    );
  document.querySelectorAll("[data-workout]").forEach(
    (button) =>
      (button.onclick = () =>
        mutate(() => {
          draft.selectedWorkout = button.dataset.workout;
        })),
  );
  document.querySelector("#add-workout").onclick = () =>
    mutate(() => {
      const w = addWorkout(routine);
      draft.selectedWorkout = w.id;
      draft.count = routine.workouts.length;
    });
  document.querySelector("#remove-workout").onclick = () => {
    if (routine.workouts.length === 1) {
      notify("Keep at least one workout in this routine.");
      return;
    }
    modal(
      "Remove " + workout.name + "?",
      `<p>This removes the workout from this routine draft. Saved workout history stays in your journal.</p>`,
      () =>
        mutate(() => {
          removeWorkout(routine, workout.id);
          draft.selectedWorkout = routine.workouts[0].id;
          draft.count = routine.workouts.length;
        }),
      "Remove workout",
    );
  };
  const choose = (blockID, optionIndex) =>
    pickExercise(ctx, {
      workout,
      blockID,
      optionIndex,
      onPick: (name) => {
        addExercise(workout, name, blockID, optionIndex);
        persist();
        ctx.render();
      },
    });
  document.querySelector("#add-exercise").onclick = () => choose();
  document
    .querySelectorAll("[data-option-block]")
    .forEach(
      (button) => (button.onclick = () => choose(button.dataset.optionBlock)),
    );
  document
    .querySelectorAll("[data-edit-block]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          choose(button.dataset.editBlock, Number(button.dataset.option))),
    );
  document
    .querySelectorAll("[data-remove-choice]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          mutate(() =>
            removeExercise(
              workout,
              button.dataset.removeChoice,
              Number(button.dataset.option),
            ),
          )),
    );
  const move = (id, delta) =>
    mutate(() => {
      const index = workout.items.findIndex((b) => b.id === id);
      moveBlock(workout, id, index + delta);
    });
  document
    .querySelectorAll("[data-up]")
    .forEach((button) => (button.onclick = () => move(button.dataset.up, -1)));
  document
    .querySelectorAll("[data-down]")
    .forEach((button) => (button.onclick = () => move(button.dataset.down, 1)));
  document.querySelectorAll("[data-grip]").forEach(
    (handle) =>
      (handle.onkeydown = (event) => {
        if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const id = handle.dataset.grip;
        move(id, event.key === "ArrowUp" ? -1 : 1);
        [...document.querySelectorAll("[data-grip]")]
          .find((node) => node.dataset.grip === id)
          ?.focus();
      }),
  );
  bindBlockDrag(document.querySelector("#routine-blocks"), (ids) =>
    mutate(() => {
      const byID = new Map(workout.items.map((b) => [b.id, b]));
      workout.items = ids.map((id) => byID.get(id));
    }),
  );
}
