import { esc, date, number, empty } from "./ui.js";
import { ordered } from "./model.js";
const palette = [
  "#71a5ff",
  "#4bd4c1",
  "#f3ac68",
  "#bb9cff",
  "#ef84a7",
  "#d2d66b",
];
export function charts(sets) {
  sets = sets.filter((s) => s.weight > 0 && s.reps > 0);
  if (!sets.length)
    return empty(
      "Your progress starts here",
      "Save sets with weight and reps to see your charts.",
    );
  const groups = [
    ...new Set(
      [...sets]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map((s) => s.sessionID),
    ),
  ].map((id) => ordered(sets.filter((s) => s.sessionID === id)));
  const maxWeight = Math.max(...sets.map((s) => s.weight)) * 1.1;
  const maxReps = Math.max(...sets.map((s) => s.reps)) * 1.1;
  const maxVolume = Math.max(...sets.map((s) => s.weight * s.reps)) * 1.1;
  const maxSet = Math.max(2, ...groups.map((g) => g.length));
  const x = (value, max) => 52 + (value / max) * 470,
    y = (value, max) => 224 - (value / max) * 194;
  function plot(fatigue) {
    const ymax = fatigue ? maxVolume : maxReps,
      xmax = fatigue ? maxSet : maxWeight;
    const grid = Array.from({ length: 5 }, (_, i) => {
      const v = (i * ymax) / 4;
      return `<line x1="52" y1="${y(v, ymax)}" x2="530" y2="${y(v, ymax)}" stroke="#ffffff16"/><text x="44" y="${y(v, ymax) + 4}" text-anchor="end">${number(v)}</text>`;
    }).join("");
    return `<svg class="chart" viewBox="0 0 560 270" role="img" aria-label="${fatigue ? "Fatigue: set number versus weight times reps" : "Weight in pounds versus reps"}">${grid}${Array.from(
      { length: 5 },
      (_, i) => {
        const v = (i * xmax) / 4;
        return `<text x="${x(v, xmax)}" y="245" text-anchor="middle">${number(v)}</text>`;
      },
    ).join(
      "",
    )}<text x="290" y="266" text-anchor="middle">${fatigue ? "Set number" : "Weight (lb)"}</text><text x="15" y="18">${fatigue ? "Volume (lb × reps)" : "Reps"}</text>${groups
      .map((g, idx) => {
        const color = palette[idx % palette.length];
        const points = g.map((s, i) => [
          x(fatigue ? i + 1 : s.weight, xmax),
          y(fatigue ? s.weight * s.reps : s.reps, ymax),
        ]);
        return `${fatigue ? `<polyline points="${points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>` : ""}${g.map((s, i) => `<circle cx="${points[i][0]}" cy="${points[i][1]}" r="4.5" fill="${color}"><title>${esc(date(s.timestamp) + " · Set " + (i + 1) + " · " + s.weight + " lb × " + s.reps + " reps · " + s.notes)}</title></circle>`).join("")}`;
      })
      .reverse()
      .join("")}</svg>`;
  }
  const legend = `<div class="chart-legend">${groups.map((g, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${date(g[0].timestamp)} · ${esc(g[0].sessionID.slice(0, 4))}</span>`).join("")}</div>`;
  return `<div class="charts-grid"><section class="card"><h2>Weight vs. reps</h2><p>Each color is a workout session.</p>${plot(false)}${legend}</section><section class="card"><h2>Fatigue</h2><p>Weight × reps across sets in each session.</p>${plot(true)}${legend}</section></div>`;
}
