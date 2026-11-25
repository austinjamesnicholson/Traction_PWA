import { heading, esc, date, number, empty } from "../ui.js";
import { recentVolume, sessionSets } from "../model.js";
export function dashboard({ store, exercises, routines }) {
  const state = store.state;
  const completed = state.sessions
    .filter((s) => s.endedAt)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  const active = state.sessions.filter((s) => !s.endedAt);
  const volume = recentVolume(state, exercises);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i - 3);
    return d;
  });
  const daySessions = (d) =>
    state.sessions.filter(
      (s) => new Date(s.startedAt).toDateString() === d.toDateString(),
    );
  return (
    heading(
      "YOUR TRAINING, IN MOTION",
      "Keep showing up.",
      "Small steps. Stronger every session.",
      `<a class="primary" href="#workouts">＋ Start workout</a>`,
    ) +
    `<section class="hero"><div class="hero-copy"><span class="tag">${esc(routines.find((r) => r.id === state.routine).name)}</span><h2>Make your next<br>session count.</h2><p>Your plan is ready. Pick up where you left off<br class="desktop"> or start a fresh workout.</p><a class="light-button" href="${active.length ? "#session/" + encodeURIComponent(active[0].sessionID) : "#workouts"}">${active.length ? "Resume workout" : "Choose a workout"}</a></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-mark">t<span>.</span></div><span class="art-caption">ONE SESSION AT A TIME</span></div></section>
    <div class="stats"><article class="stat"><span>Completed workouts</span><strong>${completed.length}</strong><small>Every session adds up</small></article><article class="stat"><span>Saved sets</span><strong>${state.sets.length}</strong><small>Your work, recorded</small></article><article class="stat"><span>Last 7 days</span><strong>${completed.filter((s) => new Date(s.startedAt) >= new Date(today.getTime() - 7 * 86400000)).length}<em> workouts</em></strong><small>Keep building momentum</small></article></div>
    <div class="dashboard-grid"><section class="card"><div class="section-head"><div><p class="eyebrow">BUILD YOUR CONSISTENCY</p><h2>Your week at a glance</h2></div><span class="muted">${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><div class="week">${days
      .map((d, i) => {
        const sessions = daySessions(d);
        const done = sessions.filter((s) => s.endedAt).length;
        return `<div class="day ${i === 3 ? "today" : ""}"><span>${esc(d.toLocaleDateString(undefined, { weekday: "short" }))}</span><strong>${d.getDate()}</strong><span class="day-status ${done ? "done" : ""}">${done || (sessions.length ? "◷" : "·")}</span></div>`;
      })
      .join(
        "",
      )}</div><p class="legend"><span class="legend-dot"></span> Completed workout <span class="muted">◷ In progress</span></p></section>
    <section class="card volume-card"><div class="section-head"><div><p class="eyebrow">BALANCE YOUR TRAINING</p><h2>Recent muscle volume</h2></div><span class="muted">7 days</span></div>${volume.length ? `<div class="volume-list">${volume.map((v) => `<div><div class="row between"><strong>${esc(v.muscle)}</strong><span>${number(v.total)} sets</span></div><div class="volume-bar"><span style="width:${(v.primary / volume[0].total) * 100}%"></span><i style="width:${(v.secondary / volume[0].total) * 100}%"></i></div><small>Primary ${number(v.primary)} · Secondary ${number(v.secondary)}</small></div>`).join("")}</div><p class="legend"><span class="legend-dot blue"></span> Primary <span class="legend-dot"></span> Secondary (½ set)</p>` : empty("Your effort will show here", "Log sets to see your muscle balance.")}</section>
    <section class="card recent-card"><div class="section-head"><div><p class="eyebrow">THE WORK YOU PUT IN</p><h2>Recent workouts</h2></div><a href="#history">View history</a></div>${active.map((s) => `<a class="workout-row" href="#session/${encodeURIComponent(s.sessionID)}"><span class="workout-icon">◷</span><div><h3>${esc(s.templateName)}</h3><p>In progress · ${date(s.startedAt)}</p></div><span class="badge">Resume</span></a>`).join("")}${
      completed.length
        ? completed
            .slice(0, 5)
            .map(
              (s) =>
                `<a class="workout-row" href="#history/${encodeURIComponent(s.sessionID)}"><span class="workout-icon">✓</span><div><h3>${esc(s.templateName)}</h3><p>${date(s.startedAt)} · ${sessionSets(state, s.sessionID).length} sets</p></div><span class="muted">${Math.max(1, Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000))} min</span></a>`,
            )
            .join("")
        : empty(
            "A fresh start",
            "Finish your first workout to start your history.",
          )
    }</section></div>`
  );
}
