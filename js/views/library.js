import { heading, esc, empty } from "../ui.js";
import { charts } from "../charts.js";
export function library(ctx, name) {
  if (name) {
    const exercise = ctx.exercises.find((e) => e.name === name);
    if (!exercise) return empty("Exercise not found");
    return (
      heading(
        exercise.type.toUpperCase(),
        name,
        `${exercise.majorMuscle}${exercise.minorMuscle ? " · " + exercise.minorMuscle : ""}`,
        `<a class="secondary" href="#library">Exercise library</a>`,
      ) +
      `<section class="card"><h2>Setup notes</h2><p>${esc(exercise.setupNotes) || "No setup notes for this exercise."}</p></section>` +
      charts(ctx.store.state.sets.filter((s) => s.exerciseName === name))
    );
  }
  return (
    heading(
      "KNOW YOUR MOVEMENTS",
      "Exercise library",
      `${ctx.exercises.length} exercises from the original Traction library.`,
    ) +
    `<div class="filters"><label class="search-label">Find an exercise<input type="search" id="exercise-search" placeholder="Search exercises or muscles"></label><label>Workout type<select id="exercise-type"><option value="">All types</option>${[
      ...new Set(ctx.exercises.map((e) => e.type)),
    ]
      .sort()
      .map((t) => `<option>${esc(t)}</option>`)
      .join(
        "",
      )}</select></label><label>Primary muscle<select id="exercise-muscle"><option value="">All muscles</option>${[
      ...new Set(ctx.exercises.map((e) => e.majorMuscle)),
    ]
      .filter(Boolean)
      .sort()
      .map((t) => `<option>${esc(t)}</option>`)
      .join(
        "",
      )}</select></label></div><div id="exercise-results" class="library-grid"></div>`
  );
}
export function bindLibrary(ctx, name) {
  if (name) return;
  const render = () => {
    const query = document
        .querySelector("#exercise-search")
        .value.toLowerCase(),
      type = document.querySelector("#exercise-type").value,
      muscle = document.querySelector("#exercise-muscle").value;
    const exercises = ctx.exercises.filter(
      (e) =>
        (!type || e.type === type) &&
        (!muscle || e.majorMuscle === muscle) &&
        [e.name, e.majorMuscle, e.minorMuscle]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
    document.querySelector("#exercise-results").innerHTML =
      exercises
        .map(
          (e) =>
            `<a class="card exercise-card" href="#library/${encodeURIComponent(e.name)}"><span class="eyebrow">${esc(e.type)}</span><h2>${esc(e.name)}</h2><p>${esc(e.majorMuscle)}${e.minorMuscle ? " · " + esc(e.minorMuscle) : ""}</p><span class="exercise-link">View progress</span></a>`,
        )
        .join("") ||
      empty("No matching exercises", "Try a different search or filter.");
  };
  ["exercise-search", "exercise-type", "exercise-muscle"].forEach((id) =>
    document.getElementById(id).addEventListener("input", render),
  );
  render();
}
