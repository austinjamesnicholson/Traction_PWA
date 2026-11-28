import { previousSets, sessionSets, ordered } from "./model.js";
import { config } from "./config.js";
const cache = new Map();
const pending = new Map();
export function recommendationPayload(state, exercise, session) {
  const current = sessionSets(state, session.sessionID, exercise.name);
  const previous = previousSets(state, exercise.name, session.sessionID);
  const excluded = new Set([session.sessionID, previous[0]?.sessionID]);
  const recent = [...state.sets]
    .filter(
      (s) => s.exerciseName === exercise.name && s.weight >= 0 && s.reps > 0,
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 12)
    .filter((s) => !excluded.has(s.sessionID));
  const compact = (label, date, sets) => ({
    label,
    date: new Date(date).toLocaleDateString("en-CA"),
    sets: ordered(sets).map((s, i) => ({
      set: i + 1,
      time: new Date(s.timestamp).toLocaleTimeString("en-GB"),
      weight: s.weight,
      reps: s.reps,
      note: s.notes.trim().slice(0, 2000) || null,
    })),
  });
  return {
    exercise: exercise.name,
    type: exercise.type,
    majorMuscle: exercise.majorMuscle,
    minorMuscle: exercise.minorMuscle,
    template: session.templateName,
    currentSession: compact("current", session.startedAt, current),
    previousSession: previous.length
      ? compact("previous", previous[0].timestamp, previous)
      : null,
    recentSessions: [...new Set(recent.map((s) => s.sessionID))]
      .slice(0, 3)
      .map((id, i) => {
        const sets = recent.filter((s) => s.sessionID === id);
        return compact("recent-" + (i + 1), sets[0].timestamp, sets);
      }),
    sessionChanges: {
      alternates: state.replacements
        .filter((r) => r.sessionID === session.sessionID)
        .map((r) => ({
          block: r.originalBlockName,
          used: r.replacementExerciseName,
        })),
      skips: state.skips
        .filter((s) => s.sessionID === session.sessionID)
        .map((s) => ({ block: s.exerciseName, note: s.note || null })),
    },
  };
}
export function validRecommendation(r) {
  return (
    r &&
    ["headline", "summary", "sessionSuggestion"].every(
      (k) => typeof r[k] === "string" && r[k].trim() && r[k].length <= 2000,
    ) &&
    Array.isArray(r.sets) &&
    r.sets.length > 0 &&
    r.sets.length <= 8 &&
    r.sets.every(
      (s) =>
        ["warmUp", "working"].includes(s.setType) &&
        s.unit === "lb" &&
        Number.isFinite(s.weight) &&
        s.weight >= 0 &&
        s.weight <= 5000 &&
        Number.isInteger(s.repsMin) &&
        Number.isInteger(s.repsMax) &&
        s.repsMin >= 1 &&
        s.repsMax <= 100 &&
        s.repsMin <= s.repsMax,
    )
  );
}

export const recommendationFingerprint = (state, exercise, session) =>
  JSON.stringify(recommendationPayload(state, exercise, session));
export function cachedRecommendation(accountID, sessionID, exerciseName) {
  return cache.get(accountID + "|" + sessionID + "|" + exerciseName);
}
export function pendingRecommendation(accountID, sessionID, exerciseName) {
  return pending.get(accountID + "|" + sessionID + "|" + exerciseName);
}
export function clearRecommendations() {
  cache.clear();
}
export async function recommend(
  state,
  exercise,
  session,
  cloud,
  force = false,
) {
  if (!config.aiEnabled) throw new Error("AI recommendations are disabled.");
  const owner = cloud?.account?.id;
  if (!owner)
    throw new Error("Sign in to your Traction account to request guidance.");
  const key = owner + "|" + session.sessionID + "|" + exercise.name;
  if (pending.has(key)) return pending.get(key);
  if (!force && cache.has(key)) return cache.get(key);
  if (globalThis.navigator?.onLine === false)
    throw new Error(
      "AI guidance needs an internet connection. Your saved workouts are still available offline.",
    );
  const payload = recommendationPayload(state, exercise, session);
  const task = (async () => {
    const result = await cloud.requestRecommendation(payload);
    if (cloud.account?.id !== owner)
      throw new Error(
        "Your account changed. Reopen the exercise to request guidance.",
      );
    if (!validRecommendation(result))
      throw new Error(
        "The AI response did not contain valid set targets. Please retry.",
      );
    const entry = {
      result,
      fingerprint: JSON.stringify(payload),
      generatedAt: new Date().toISOString(),
    };
    cache.set(key, entry);
    return entry;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
