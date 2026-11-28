import { heading, esc, empty, modal, notify } from "../ui.js";
import {
  uid,
  now,
  blocksFor,
  blockStatus,
  replaceBlock,
  skipBlock,
  sessionSets,
} from "../model.js";
import { sessionTemplate, DAYS, SHOW_ROUTINE_SCHEDULE } from "../routines.js";
export function workouts(ctx) {
  const { store, templates, routines } = ctx;
  const routine = routines.find((r) => r.id === store.state.routine);
  const active = store.state.sessions.filter((s) => !s.endedAt);
  return (
    heading(
      "YOUR NEXT SESSION",
      "Let’s get to work.",
      routine.name + " · " + routine.subtitle,
      `<a class="secondary" href="#routines">Manage routines</a>`,
    ) +
    active
      .map(
        (s) =>
          `<a class="resume-banner" href="#session/${encodeURIComponent(s.sessionID)}"><span>◷ <strong>${esc(s.templateName)}</strong> is in progress</span><span>Resume workout</span></a>`,
      )
      .join("") +
    (routine.custom && SHOW_ROUTINE_SCHEDULE
      ? `<section class="card"><div class="section-head"><h2>Your weekly plan</h2><a href="#routines/edit/${encodeURIComponent(routine.id)}">Edit routine</a></div><div class="routine-week">${routine.days.map((id, i) => `<div class="plan-day ${i === (new Date().getDay() + 6) % 7 ? "today" : ""}"><span>${DAYS[i]}</span><strong>${esc(routine.workouts.find((w) => w.id === id)?.name || "Rest")}</strong></div>`).join("")}</div></section>`
      : "") +
    `<div class="template-grid">${templates
      .filter((t) => routine.templateIDs.includes(t.id))
      .map(
        (t) =>
          `<article class="card template-card"><span class="workout-icon">${t.exerciseType === "Push" ? "↗" : t.exerciseType === "Pull" ? "≋" : "⌁"}</span><p class="eyebrow">${esc(t.exerciseType.toUpperCase())}</p><h2>${esc(t.name)}</h2><p>${esc(t.subtitle)}</p><div class="template-bottom"><span class="muted">${t.items.length ? t.items.length + " exercise blocks" : "Open session"}</span><button class="primary" data-start="${esc(t.id)}">Start workout</button></div></article>`,
      )
      .join(
        "",
      )}</div><details class="card"><summary>Other workout templates</summary><div class="list">${templates
      .filter((t) => !routine.templateIDs.includes(t.id))
      .map(
        (t) =>
          `<div class="row between"><div><h3>${esc(t.name)}</h3><p>${esc(t.subtitle)}</p></div><button class="secondary" data-start="${esc(t.id)}">Start</button></div>`,
      )
      .join("")}</div></details>`
  );
}
export function bindWorkouts(ctx) {
  document.querySelectorAll("[data-start]").forEach(
    (b) =>
      (b.onclick = () => {
        if (ctx.store.state.sessions.some((s) => !s.endedAt)) {
          notify(
            "Resume and finish your current workout before starting another.",
          );
          return;
        }
        const session = {
          sessionID: uid(),
          templateName: ctx.templates.find((t) => t.id === b.dataset.start)
            .name,
          templateID: b.dataset.start,
          routineID: ctx.store.state.routine,
          templateSnapshot: structuredClone(
            ctx.templates.find((t) => t.id === b.dataset.start),
          ),
          startedAt: now(),
          endedAt: null,
        };
        ctx.store.update((s) => s.sessions.push(session));
        location.hash = "#session/" + encodeURIComponent(session.sessionID);
      }),
  );
}
export function session(ctx, id) {
  const s = ctx.store.state.sessions.find((s) => s.sessionID === id);
  if (!s) return empty("Workout not found");
  if (s.endedAt)
    return empty(
      "This workout is complete",
      "Open History to review or correct its saved sets.",
    );
  const template = sessionTemplate(s, ctx.templates);
  const blocks = blocksFor(template, ctx.exercises);
  const done = blocks.filter((b) =>
    ["Completed", "Skipped"].includes(blockStatus(ctx.store.state, id, b)),
  ).length;
  return (
    heading(
      "WORKOUT IN PROGRESS",
      s.templateName,
      `${done} of ${blocks.length} blocks completed or skipped · ${sessionSets(ctx.store.state, id).length} saved sets`,
      `<button class="danger" id="end-workout">Finish workout</button>`,
    ) +
    `<div class="progress-track"><span style="width:${blocks.length ? (done / blocks.length) * 100 : 0}%"></span></div><div class="session-list">${
      blocks
        .map((b, i) => {
          const status = blockStatus(ctx.store.state, id, b);
          const replacement = ctx.store.state.replacements.find(
            (r) => r.sessionID === id && r.templateItemID === b.id,
          );
          const names = replacement
            ? [replacement.replacementExerciseName]
            : b.exercises;
          const skip = ctx.store.state.skips.find(
            (r) => r.sessionID === id && r.templateItemID === b.id,
          );
          return `<article class="card block ${status === "Completed" ? "completed" : ""}"><div class="section-head"><div class="row"><span class="block-index">${String(i + 1).padStart(2, "0")}</span><div><h2>${esc(b.kind === "singleExercise" ? names[0] : b.title)}</h2><p>${esc(replacement ? "Alternate for " + b.title : b.kind === "circuit" ? "Circuit preview · individual set logging available" : b.subtitle)}</p></div></div><span class="badge ${status === "Completed" ? "success" : ""}">${status}</span></div>${b.kind === "singleExercise" ? `<a class="exercise-link" href="#hub/${encodeURIComponent(id)}/${encodeURIComponent(names[0])}">Open exercise log</a>` : `<div class="exercise-choices">${names.map((n) => `<a class="secondary" href="#hub/${encodeURIComponent(id)}/${encodeURIComponent(n)}">${esc(n)}</a>`).join("")}</div>`}${skip ? `<p class="muted">${esc(skip.note || "Skipped for this session")}</p>` : ""}<div class="actions small-actions">${!["Completed", "Skipped"].includes(status) ? `${b.kind !== "circuit" ? `<button class="quiet" data-alternate="${esc(b.id)}">Choose alternate</button>` : ""}<button class="quiet" data-skip="${esc(b.id)}">Skip block</button>` : ""}${replacement ? `<button class="quiet" data-reset="${esc(b.id)}">Clear alternate</button>` : ""}${skip ? `<button class="quiet" data-unskip="${esc(b.id)}">Undo skip</button>` : ""}</div></article>`;
        })
        .join("") ||
      empty(
        "No matching exercises yet",
        "You can finish this open session. Cardio and group tracking were placeholders in the original app.",
      )
    }</div>`
  );
}
export function bindSession(ctx, id) {
  const s = ctx.store.state.sessions.find((s) => s.sessionID === id);
  if (!s || s.endedAt) return;
  const blocks = blocksFor(sessionTemplate(s, ctx.templates), ctx.exercises);
  const find = (b) => blocks.find((x) => x.id === b);
  document.querySelector("#end-workout").onclick = () => {
    if (
      Object.keys(ctx.store.state.drafts).some((key) =>
        key.startsWith(id + "|"),
      )
    ) {
      notify(
        "Save or discard your exercise drafts before finishing this workout.",
      );
      return;
    }
    modal(
      "Finish this workout?",
      `<p>Saved sets, skip notes, and alternates will stay in your history.</p>`,
      () => {
        ctx.store.update((state) => {
          state.sessions.find((x) => x.sessionID === id).endedAt = now();
          for (const key of Object.keys(state.drafts))
            if (key.startsWith(id + "|")) delete state.drafts[key];
        });
        location.hash = "#history/" + encodeURIComponent(id);
        notify("Workout completed. Nice work.");
      },
      "Finish workout",
    );
  };
  document.querySelectorAll("[data-skip]").forEach(
    (b) =>
      (b.onclick = () =>
        modal(
          "Skip " + find(b.dataset.skip).title,
          `<label>Optional note<textarea name="note" maxlength="2000" placeholder="What changed today?"></textarea></label>`,
          (data) => {
            ctx.store.update((state) =>
              skipBlock(
                state,
                s,
                find(b.dataset.skip),
                data.get("note").trim(),
              ),
            );
            ctx.render();
          },
          "Skip block",
        )),
  );
  document.querySelectorAll("[data-unskip]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.store.update((state) => {
          state.skips = state.skips.filter(
            (x) => x.sessionID !== id || x.templateItemID !== b.dataset.unskip,
          );
        });
        ctx.render();
      }),
  );
  document.querySelectorAll("[data-reset]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.store.update((state) => {
          state.replacements = state.replacements.filter(
            (x) => x.sessionID !== id || x.templateItemID !== b.dataset.reset,
          );
        });
        ctx.render();
      }),
  );
  document.querySelectorAll("[data-alternate]").forEach(
    (b) =>
      (b.onclick = () => {
        const block = find(b.dataset.alternate),
          originals = ctx.exercises.filter((e) =>
            block.exercises.includes(e.name),
          );
        const muscles = new Set(
          originals
            .flatMap((e) => [e.majorMuscle, e.minorMuscle])
            .filter(Boolean),
        );
        const preferredTypes = new Set(originals.map((e) => e.type));
        const all = ctx.exercises.filter(
          (e) =>
            (preferredTypes.size
              ? preferredTypes.has(e.type)
              : e.type === sessionTemplate(s, ctx.templates).exerciseType) &&
            !block.exercises.includes(e.name),
        );
        const recommended = all.filter(
          (e) => muscles.has(e.majorMuscle) || muscles.has(e.minorMuscle),
        );
        const options = (list) =>
          list
            .map(
              (e) => `<option value="${esc(e.name)}">${esc(e.name)}</option>`,
            )
            .join("");
        modal(
          "Choose an alternate",
          `<p>This changes only this workout.</p><label>Replacement exercise<select name="exercise" required>${recommended.length ? `<optgroup label="Recommended · matching muscles">${options(recommended)}</optgroup>` : ""}<optgroup label="Other exercises">${options(all.filter((e) => !recommended.includes(e)))}</optgroup></select></label>`,
          (data) => {
            if (!all.length)
              throw new Error("No alternate exercises available.");
            ctx.store.update((state) =>
              replaceBlock(state, s, block, data.get("exercise")),
            );
            ctx.render();
          },
          "Use alternate",
        );
      }),
  );
}
