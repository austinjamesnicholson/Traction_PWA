import { esc, modal, notify } from "../ui.js";
import { filterExercises } from "../exercise-catalog.js";
import { icon } from "../icons.js";
export function pickExercise(ctx, { workout, blockID, optionIndex, onPick }) {
  const block = workout.items.find((b) => b.id === blockID);
  const replacing = optionIndex !== undefined;
  const excluded = workout.items.flatMap((b) =>
    b.exercises.filter((name, i) => b.id !== blockID || i !== optionIndex),
  );
  const title = replacing
    ? "Change exercise"
    : blockID
      ? "Add an alternative"
      : "Add an exercise";
  const functions = [...new Set(ctx.exercises.map((e) => e.type))].sort();
  const preferred = functions.includes(workout.exerciseType)
    ? workout.exerciseType
    : "";
  const dialog = modal(
    title,
    `<p>${replacing ? "Choose a replacement for " + esc(block.exercises[optionIndex]) + "." : blockID ? "Add another choice to this block. You’ll choose one when training." : "Find the next movement for " + esc(workout.name) + "."}</p><div class="picker-filters"><label class="picker-search">Search exercises<input id="picker-query" type="search" placeholder="Exercise or muscle name" autocomplete="off"></label><label>Body part<select id="picker-part"><option value="">All body parts</option>${["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"].map((s) => `<option>${s}</option>`).join("")}</select></label><label>Body region<select id="picker-region"><option value="">All regions</option><option>Upper</option><option>Lower</option><option>Core</option></select></label><label>Movement<select id="picker-function"><option value="">All movements</option>${functions.map((s) => `<option ${s === preferred ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label></div><div class="row between"><p id="picker-count" class="muted" role="status"></p><button type="button" class="quiet" id="picker-clear">Clear filters</button></div><div id="picker-results" class="picker-results"></div><p class="fine-print">Exercises already used elsewhere in this workout are hidden.</p>`,
    null,
  );
  dialog.classList.add("exercise-picker");
  dialog.addEventListener(
    "close",
    () => dialog.classList.remove("exercise-picker"),
    { once: true },
  );
  const render = () => {
    const matches = filterExercises(
      ctx.exercises,
      {
        query: dialog.querySelector("#picker-query").value,
        part: dialog.querySelector("#picker-part").value,
        region: dialog.querySelector("#picker-region").value,
        function: dialog.querySelector("#picker-function").value,
      },
      excluded,
    );
    dialog.querySelector("#picker-count").textContent =
      `${matches.length} exercises`;
    dialog.querySelector("#picker-results").innerHTML =
      matches
        .map(
          (e) =>
            `<button class="picker-exercise" type="button" data-pick="${esc(e.name)}"><span><strong>${esc(e.name)}</strong><small>${esc(e.majorMuscle)}${e.minorMuscle ? " · " + esc(e.minorMuscle) : ""}</small></span><span class="row"><span class="badge">${esc(e.type)}</span>${icon("plus")}</span></button>`,
        )
        .join("") ||
      '<div class="empty"><h3>No matching exercises</h3><p>Try another search or clear the filters.</p></div>';
    dialog.querySelectorAll("[data-pick]").forEach(
      (button) =>
        (button.onclick = () => {
          try {
            onPick(button.dataset.pick);
            dialog.close();
          } catch (error) {
            notify(error.message);
          }
        }),
    );
  };
  ["picker-query", "picker-part", "picker-region", "picker-function"].forEach(
    (id) => dialog.querySelector("#" + id).addEventListener("input", render),
  );
  dialog.querySelector("#picker-clear").onclick = () => {
    ["picker-query", "picker-part", "picker-region", "picker-function"].forEach(
      (id) => {
        dialog.querySelector("#" + id).value = "";
      },
    );
    render();
  };
  render();
  dialog.querySelector("#picker-query").focus();
}
