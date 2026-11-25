import { previousSets, sessionSets, ordered } from "./model.js";
import { config } from "./config.js";
const cache = new Map();
let auth = null;
export function recommendationPayload(state, exercise, session) {
  const current = sessionSets(state, session.sessionID, exercise.name);
  const previous = previousSets(state, exercise.name, session.sessionID);
  const excluded = new Set([session.sessionID, previous[0]?.sessionID]);
  const recent = [...state.sets]
    .filter(
      (s) => s.exerciseName === exercise.name && s.weight > 0 && s.reps > 0,
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
      note: s.notes.trim() || null,
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
        ["lb", "kg"].includes(s.unit) &&
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
async function jsonRequest(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? "Recommendation limit reached. Please try again later."
        : body.error_description ||
            body.msg ||
            body.error ||
            `Request failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}
async function accessToken(force = false) {
  const base = config.supabaseUrl.replace(/\/$/, "");
  if (!auth) {
    try {
      auth = JSON.parse(localStorage.getItem("traction-ai-auth") || "null");
    } catch {
      auth = null;
    }
  }
  if (!force && auth?.access_token && auth.expires_at > Date.now() / 1000 + 60)
    return auth.access_token;
  const refresh = auth?.refresh_token;
  try {
    auth = await jsonRequest(
      base +
        (refresh
          ? "/auth/v1/token?grant_type=refresh_token"
          : "/auth/v1/signup"),
      {
        method: "POST",
        headers: {
          apikey: config.supabasePublicKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(refresh ? { refresh_token: refresh } : {}),
      },
    );
  } catch (error) {
    if (refresh && [400, 401, 403].includes(error.status)) {
      auth = null;
      localStorage.removeItem("traction-ai-auth");
      return accessToken();
    }
    throw error;
  }
  if (!auth.access_token)
    throw new Error(
      "Anonymous sign-in failed. Check your Supabase Auth settings.",
    );
  auth.expires_at = auth.expires_at || Date.now() / 1000 + auth.expires_in;
  localStorage.setItem("traction-ai-auth", JSON.stringify(auth));
  return auth.access_token;
}
export function cachedRecommendation(sessionID, exerciseName) {
  return cache.get(sessionID + "|" + exerciseName);
}
export async function recommend(state, exercise, session, force = false) {
  const key = session.sessionID + "|" + exercise.name;
  if (!force && cache.has(key)) return cache.get(key);
  if (!config.supabaseUrl || !config.supabasePublicKey)
    throw new Error(
      "AI is not connected yet. Add your Traction Supabase project URL and public key in js/config.js. Workout logging works without AI.",
    );
  if (!navigator.onLine)
    throw new Error(
      "You’re offline. Saved workouts and charts are available; AI needs an internet connection.",
    );
  const call = async (token) =>
    jsonRequest(
      config.supabaseUrl.replace(/\/$/, "") +
        "/functions/v1/workout-recommendation",
      {
        method: "POST",
        headers: {
          apikey: config.supabasePublicKey,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recommendationPayload(state, exercise, session)),
      },
    );
  let result;
  try {
    result = await call(await accessToken());
  } catch (error) {
    if (error.status !== 401) throw error;
    result = await call(await accessToken(true));
  }
  if (!validRecommendation(result))
    throw new Error("The recommendation response was invalid. Please retry.");
  const entry = {
    result,
    setCount: sessionSets(state, session.sessionID, exercise.name).length,
  };
  cache.set(key, entry);
  return entry;
}
