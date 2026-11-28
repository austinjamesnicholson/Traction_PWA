import { esc } from "../ui.js";
import { blocksFor } from "../model.js";
import { icon } from "../icons.js";

export function workoutCard(template, exercises, routineName) {
  const blocks = blocksFor(template, exercises);
  const previewID = "preview-" + encodeURIComponent(template.id);
  return `<article class="card workout-selection-card"><div class="workout-selection-heading"><div><p class="workout-parent">${esc(routineName || template.subtitle || template.exerciseType)}</p><h2>${esc(template.name)}</h2></div><button class="primary select-workout" data-start="${esc(template.id)}">Select workout</button></div><div id="${esc(previewID)}" class="workout-preview" hidden><ol class="preview-blocks">${blocks.map((b) => `<li><div class="preview-options">${b.exercises.map((name) => `<span>${esc(name)}</span>`).join("")}</div>${b.kind === "circuit" ? "<small>Circuit: complete each movement</small>" : b.exercises.length > 1 ? "<small>Choose one option</small>" : ""}</li>`).join("") || '<li class="open-preview">Open session &middot; no exercise blocks</li>'}</ol></div><button class="preview-toggle" data-preview="${esc(previewID)}" aria-controls="${esc(previewID)}" aria-expanded="false"><span class="preview-closed">${icon("down")} Preview workout ${icon("down")}</span><span class="preview-open">${icon("up")} Collapse ${icon("up")}</span></button></article>`;
}

export function bindWorkoutPreviews(root = document) {
  root.querySelectorAll("[data-preview]").forEach((button) => {
    button.onclick = () => {
      const panel = root.getElementById(button.dataset.preview);
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
    };
  });
}
