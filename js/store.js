import { validSet } from "./model.js";
export const STORAGE_KEY = "traction-pwa-v1";
export function freshState() {
  return {
    version: 1,
    revision: 0,
    routine: "austin",
    sessions: [],
    sets: [],
    skips: [],
    replacements: [],
    drafts: {},
    profile: { feet: "", inches: "", weight: "", age: "" },
  };
}
export function validateState(state, exercises, templates) {
  if (
    !state ||
    state.version !== 1 ||
    !["austin", "lizzie"].includes(state.routine) ||
    !["sessions", "sets", "skips", "replacements"].every((k) =>
      Array.isArray(state[k]),
    ) ||
    !state.profile ||
    typeof state.profile !== "object" ||
    !state.drafts ||
    typeof state.drafts !== "object" ||
    Array.isArray(state.drafts)
  )
    throw new Error("This is not a supported Traction backup.");
  const unique = (rows, key) =>
    rows.every((r) => r && typeof r[key] === "string" && r[key]) &&
    new Set(rows.map((r) => r[key])).size === rows.length;
  if (
    !unique(state.sessions, "sessionID") ||
    !unique(state.sets, "setID") ||
    !unique(state.skips, "skipID") ||
    !unique(state.replacements, "replacementID")
  )
    throw new Error("Backup contains missing or duplicate IDs.");
  const sessionIDs = new Set(state.sessions.map((s) => s.sessionID));
  if (
    state.sessions.some(
      (s) =>
        typeof s.templateName !== "string" ||
        !Number.isFinite(Date.parse(s.startedAt)) ||
        (s.endedAt != null &&
          (!Number.isFinite(Date.parse(s.endedAt)) ||
            new Date(s.endedAt) < new Date(s.startedAt))),
    )
  )
    throw new Error("Backup contains an invalid workout.");
  if (
    state.sets.some(
      (s) =>
        !sessionIDs.has(s.sessionID) ||
        !exercises.some((e) => e.name === s.exerciseName) ||
        !validSet(s.weight, s.reps) ||
        (s.entryOrder != null &&
          (!Number.isSafeInteger(s.entryOrder) || s.entryOrder < 0)) ||
        typeof s.notes !== "string" ||
        !Number.isFinite(Date.parse(s.timestamp)),
    )
  )
    throw new Error("Backup contains an invalid set.");
  if (
    [...state.skips, ...state.replacements].some(
      (r) =>
        !sessionIDs.has(r.sessionID) ||
        typeof r.templateItemID !== "string" ||
        !Number.isFinite(Date.parse(r.timestamp)),
    )
  )
    throw new Error("Backup contains an invalid session change.");
  if (
    state.skips.some(
      (r) => typeof r.exerciseName !== "string" || typeof r.note !== "string",
    ) ||
    state.replacements.some(
      (r) =>
        typeof r.originalBlockName !== "string" ||
        !exercises.some((e) => e.name === r.replacementExerciseName),
    )
  )
    throw new Error("Backup contains an invalid session change.");
  for (const [key, rows] of Object.entries(state.drafts)) {
    const [sessionID, ...name] = key.split("|");
    if (
      !sessionIDs.has(sessionID) ||
      !exercises.some((e) => e.name === name.join("|")) ||
      !Array.isArray(rows) ||
      rows.some(
        (r) =>
          !r ||
          typeof r.id !== "string" ||
          typeof r.notes !== "string" ||
          !["string", "number"].includes(typeof r.weight) ||
          !["string", "number"].includes(typeof r.reps),
      )
    )
      throw new Error("Backup contains invalid drafts.");
  }
  for (const key of ["feet", "inches", "weight", "age"])
    if (!["string", "number"].includes(typeof state.profile[key]))
      throw new Error("Backup contains invalid profile fields.");
  if (
    state.sessions.some(
      (s) => !s.endedAt && !templates.some((t) => t.name === s.templateName),
    )
  )
    throw new Error("Backup has an active workout with an unknown template.");
  return state;
}
export function createStore(storage, exercises, templates) {
  let state;
  const raw = storage.getItem(STORAGE_KEY);
  try {
    state = raw
      ? validateState(JSON.parse(raw), exercises, templates)
      : freshState();
  } catch {
    throw new Error(
      "Saved data could not be opened. Export the stored data before replacing it; it has not been overwritten.",
    );
  }
  let knownRaw = raw;
  return {
    get state() {
      return state;
    },
    update(change) {
      if (storage.getItem(STORAGE_KEY) !== knownRaw)
        throw new Error(
          "Traction changed in another tab. Reload this tab before saving.",
        );
      const next = structuredClone(state);
      change(next);
      next.revision = (state.revision || 0) + 1;
      validateState(next, exercises, templates);
      const nextRaw = JSON.stringify(next);
      try {
        storage.setItem(STORAGE_KEY, nextRaw);
      } catch {
        throw new Error(
          "Your device could not save this change. Free some browser storage and try again.",
        );
      }
      state = next;
      knownRaw = nextRaw;
      return state;
    },
    replace(next) {
      validateState(next, exercises, templates);
      return this.update((draft) => {
        for (const k of Object.keys(draft)) delete draft[k];
        Object.assign(draft, structuredClone(next));
      });
    },
  };
}
