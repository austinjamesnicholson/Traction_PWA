import {
  heading,
  esc,
  date,
  time,
  number,
  empty,
  modal,
  notify,
} from "../ui.js";
import { sessionSets, validSet } from "../model.js";
export function history(ctx, id) {
  const state = ctx.store.state;
  if (id) {
    const session = state.sessions.find((s) => s.sessionID === id);
    if (!session) return empty("Workout not found");
    const sets = sessionSets(state, id);
    const names = [...new Set(sets.map((s) => s.exerciseName))];
    const changes = [
      ...state.skips
        .filter((s) => s.sessionID === id)
        .map(
          (s) =>
            `<div class="change-row"><span class="badge">Skipped</span><div><strong>${esc(s.exerciseName)}</strong><p>${esc(s.note) || "No note"}</p></div></div>`,
        ),
      ...state.replacements
        .filter((r) => r.sessionID === id)
        .map(
          (r) =>
            `<div class="change-row"><span class="badge">Alternate</span><div><strong>${esc(r.replacementExerciseName)}</strong><p>Replaced ${esc(r.originalBlockName)}</p></div></div>`,
        ),
    ];
    return (
      heading(
        "YOUR WORKOUT JOURNAL",
        session.templateName,
        `${date(session.startedAt)} · ${time(session.startedAt)} · ${session.endedAt ? "Completed" : "In progress"}`,
        `<a class="secondary" href="#history">All history</a>`,
      ) +
      `<div class="stats"><article class="stat"><span>Saved sets</span><strong>${sets.length}</strong></article><article class="stat"><span>Exercises</span><strong>${names.length}</strong></article><article class="stat"><span>Total volume</span><strong>${number(sets.reduce((sum, s) => sum + s.weight * s.reps, 0))}<em> lb</em></strong></article></div>` +
      names
        .map(
          (name) =>
            `<section class="card"><div class="section-head"><h2>${esc(name)}</h2><span class="muted">${sets.filter((s) => s.exerciseName === name).length} sets</span></div>${setTable(sets.filter((s) => s.exerciseName === name))}</section>`,
        )
        .join("") +
      (!sets.length ? empty("No sets in this workout") : "") +
      (changes.length
        ? `<section class="card"><h2>Session changes</h2>${changes.join("")}</section>`
        : "")
    );
  }
  return (
    heading(
      "YOUR WORKOUT JOURNAL",
      "Every session, recorded.",
      "Review workouts and correct saved entries.",
    ) +
    `<div class="filters"><label class="search-label">Search workouts<input type="search" id="history-search" placeholder="Workout or exercise name"></label><label>Status<select id="history-status"><option value="">All workouts</option value="completed">Completed</option><option value="active">In progress</option></select></label><a class="secondary" href="#database">Review database</a></div><div id="history-list"></div>`
  );
}
function setTable(sets) {
  return `<div class="table-scroll"><table><thead><tr><th>Set</th><th>Weight (lb)</th><th>Reps</th><th>Notes</th><th>Time</th><th>Action</th></tr></thead><tbody>${sets.map((s, i) => `<tr><td>${i + 1}</td><td>${s.weight}</td><td>${s.reps}</td><td>${esc(s.notes) || "—"}</td><td>${time(s.timestamp)}</td><td><button class="quiet" data-edit="${esc(s.setID)}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}
export function bindHistory(ctx, id) {
  const list = document.querySelector("#history-list");
  if (list) {
    const show = () => {
      const query = document
        .querySelector("#history-search")
        .value.toLowerCase();
      const status = document.querySelector("#history-status").value;
      const sessions = [...ctx.store.state.sessions]
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
        .filter(
          (s) =>
            (!status || (status === "completed" ? s.endedAt : !s.endedAt)) &&
            (s.templateName.toLowerCase().includes(query) ||
              sessionSets(ctx.store.state, s.sessionID).some((set) =>
                set.exerciseName.toLowerCase().includes(query),
              )),
        );
      list.innerHTML =
        sessions
          .map(
            (s) =>
              `<a class="card workout-row" href="#${s.endedAt ? "history" : "session"}/${encodeURIComponent(s.sessionID)}"><span class="workout-icon">${s.endedAt ? "✓" : "◷"}</span><div><h2>${esc(s.templateName)}</h2><p>${date(s.startedAt)} · ${time(s.startedAt)} · ${sessionSets(ctx.store.state, s.sessionID).length} sets</p></div><span class="badge ${s.endedAt ? "success" : ""}">${s.endedAt ? "Completed" : "Resume"}</span></a>`,
          )
          .join("") ||
        empty(
          "No workouts found",
          "Start a workout or import your existing Traction history in Settings.",
        );
    };
    document.querySelector("#history-search").oninput = show;
    document.querySelector("#history-status").onchange = show;
    show();
  }
  bindEdit(ctx);
}
export function database(ctx) {
  const s = ctx.store.state;
  return (
    heading(
      "YOUR SAVED DATA",
      "Database",
      "Review sets grouped by exercise and session. Changes update your charts and volume summaries.",
    ) +
    `<div class="stats"><article class="stat"><span>Exercises</span><strong>${ctx.exercises.length}</strong></article><article class="stat"><span>Saved sets</span><strong>${s.sets.length}</strong></article><article class="stat"><span>Skips / alternates</span><strong>${s.skips.length} / ${s.replacements.length}</strong></article></div>` +
    `<section class="card">${ctx.exercises
      .map((e) => {
        const sets = s.sets.filter((x) => x.exerciseName === e.name);
        return `<details><summary>${esc(e.name)} <span class="muted">${sets.length} sets</span></summary>${
          [
            ...new Set(
              [...sets]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((x) => x.sessionID),
            ),
          ]
            .map((id) => {
              const session = s.sessions.find((x) => x.sessionID === id);
              return `<details class="nested"><summary>${esc(session.templateName)} · ${date(session.startedAt)}</summary>${setTable(sessionSets(s, id, e.name))}</details>`;
            })
            .join("") || "<p>No saved sets.</p>"
        }</details>`;
      })
      .join(
        "",
      )}</section><section class="card"><h2>Skips and alternates</h2>${s.skips.map((x) => `<p><strong>Skipped ${esc(x.exerciseName)}</strong> · ${date(x.timestamp)} · ${esc(x.templateName)}<br>${esc(x.note)}</p>`).join("")}${s.replacements.map((x) => `<p><strong>${esc(x.replacementExerciseName)}</strong> replaced ${esc(x.originalBlockName)} · ${date(x.timestamp)} · ${esc(x.templateName)}</p>`).join("")}${!s.skips.length && !s.replacements.length ? "<p>No session changes recorded.</p>" : ""}</section>`
  );
}
export function bindEdit(ctx) {
  document.querySelectorAll("[data-edit]").forEach(
    (button) =>
      (button.onclick = () => {
        const set = ctx.store.state.sets.find(
          (s) => s.setID === button.dataset.edit,
        );
        modal(
          "Edit saved set",
          `<p>${esc(set.exerciseName)} · ${date(set.timestamp)}</p><div class="form-grid"><label>Weight (lb)<input type="number" name="weight" required min="0" max="5000" step="any" value="${set.weight}"></label><label>Reps<input type="number" name="reps" required min="1" max="1000" step="1" value="${set.reps}"></label></div><label>Notes<textarea name="notes" maxlength="2000">${esc(set.notes)}</textarea></label>`,
          (data) => {
            if (!validSet(data.get("weight"), data.get("reps")))
              throw new Error(
                "Enter a valid weight and whole-number rep count.",
              );
            const drafts = Object.keys(ctx.store.state.drafts).filter(
              (k) => k === set.sessionID + "|" + set.exerciseName,
            );
            if (drafts.length)
              throw new Error(
                "This exercise has a draft. Save or discard it in the workout before editing its history.",
              );
            ctx.store.update((s) =>
              Object.assign(
                s.sets.find((x) => x.setID === set.setID),
                {
                  weight: Number(data.get("weight")),
                  reps: Number(data.get("reps")),
                  notes: data.get("notes"),
                },
              ),
            );
            ctx.render();
            notify("Set updated.");
          },
        );
      }),
  );
}
