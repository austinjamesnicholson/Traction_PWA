import { esc } from "../ui.js";
import {
  recommend,
  cachedRecommendation,
  recommendationFingerprint,
  pendingRecommendation,
} from "../recommendations.js";
function guidance(ctx, id, name, entry) {
  const exercise = ctx.exercises.find((e) => e.name === name),
    session = ctx.store.state.sessions.find((s) => s.sessionID === id);
  const result = entry.result;
  const stale =
    entry.fingerprint !==
    recommendationFingerprint(ctx.store.state, exercise, session);
  return `<h3>${esc(result.headline)}</h3><p>${esc(result.summary)}</p><ul class="recommendation-sets">${result.sets.map((s) => `<li><span>${s.setType === "warmUp" ? "Warm-up" : "Working"}</span><strong>${s.weight} lb × ${s.repsMin === s.repsMax ? s.repsMin : s.repsMin + "–" + s.repsMax} reps</strong></li>`).join("")}</ul><p>${esc(result.sessionSuggestion)}</p>${stale ? '<p class="warning">Your workout data changed. Refresh for updated guidance.</p>' : ""}`;
}
export function recommendationCard(ctx, id, name) {
  const user = ctx.cloud?.account;
  const entry = user ? cachedRecommendation(user.id, id, name) : null;
  return `<section class="card ai-card"><p class="eyebrow">A LITTLE DIRECTION</p><h2>AI session guidance</h2><div id="ai-result" aria-live="polite">${entry ? guidance(ctx, id, name, entry) : "<p>Get suggested warm-up and working sets based on your saved history and current workout.</p>"}</div>${user ? `<button class="secondary" id="recommend">${entry ? "Refresh recommendation" : "Get recommendation"}</button>` : '<a class="secondary" href="#account">Sign in for guidance</a>'}<p class="fine-print">When requested, relevant saved workout history and notes are sent through Supabase to OpenAI. Guidance is advisory; it does not change your logged sets. Unsaved drafts and profile metrics are not sent.</p></section>`;
}
export function bindRecommendation(ctx, id, name) {
  const button = document.querySelector("#recommend");
  if (!button) return;
  const run = async (inProgress) => {
    const exercise = ctx.exercises.find((e) => e.name === name),
      session = ctx.store.state.sessions.find((s) => s.sessionID === id),
      owner = ctx.cloud.account?.id;
    const node = document.querySelector("#ai-result");
    button.disabled = true;
    button.textContent = "Getting guidance…";
    const stillHere = () =>
      ctx.cloud.account?.id === owner &&
      document.querySelector("#ai-result") === node;
    try {
      const entry = await (inProgress ||
        recommend(ctx.store.state, exercise, session, ctx.cloud, true));
      if (stillHere()) node.innerHTML = guidance(ctx, id, name, entry);
    } catch (error) {
      if (stillHere())
        node.innerHTML = `<p class="warning">${esc(error.message)}</p>`;
    } finally {
      if (stillHere()) {
        button.disabled = false;
        button.textContent = "Refresh recommendation";
      }
    }
  };
  button.onclick = () => {
    if (!button.disabled) void run();
  };
  const inProgress = pendingRecommendation(ctx.cloud.account?.id, id, name);
  if (inProgress) void run(inProgress);
}
