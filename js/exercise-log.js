import { uid, validSet, sessionSets } from "./model.js";
// A separate creation time for each row prevents batch saves from acquiring
// identical timestamps and changing order after cloud merges.
export function draftRows(rows, saved = [], clock = Date.now()) {
  let latest = Math.max(
    clock - 1,
    ...saved.map((s) => Date.parse(s.timestamp)).filter(Number.isFinite),
    ...rows.map((r) => Date.parse(r.timestamp)).filter(Number.isFinite),
  );
  return rows.map((row) => {
    const existing = row.setID
      ? saved.find((s) => s.setID === row.setID)
      : null;
    const timestamp = row.timestamp || existing?.timestamp;
    return {
      ...row,
      timestamp: Number.isFinite(Date.parse(timestamp))
        ? timestamp
        : new Date(++latest).toISOString(),
    };
  });
}
export function newDraft(rows = [], saved = [], clock = Date.now()) {
  return draftRows(
    [{ id: uid(), setID: null, weight: "", reps: "", notes: "" }],
    [...saved, ...rows],
    clock,
  )[0];
}
export function commitExerciseSets(state, sessionID, exerciseName, rows) {
  if (rows.some((r) => !validSet(r.weight, r.reps)))
    throw new Error(
      "Enter a valid weight and whole-number rep count for every set.",
    );
  const before = sessionSets(state, sessionID, exerciseName);
  const normalized = draftRows(rows, before);
  const kept = new Set(normalized.map((r) => r.setID).filter(Boolean));
  state.sets = state.sets.filter(
    (r) =>
      r.sessionID !== sessionID ||
      r.exerciseName !== exerciseName ||
      kept.has(r.setID),
  );
  let changed = before.length !== rows.length;
  for (const [index, row] of normalized.entries()) {
    const existing = state.sets.find(
      (s) =>
        s.setID === row.setID &&
        s.sessionID === sessionID &&
        s.exerciseName === exerciseName,
    );
    const values = {
      weight: Number(row.weight),
      reps: Number(row.reps),
      notes: row.notes,
    };
    if (existing) {
      if (
        existing.weight !== values.weight ||
        existing.reps !== values.reps ||
        existing.notes !== values.notes
      )
        changed = true;
      Object.assign(existing, values, { entryOrder: index });
    } else {
      changed = true;
      state.sets.push({
        setID: uid(),
        sessionID,
        exerciseName,
        ...values,
        timestamp: row.timestamp,
        entryOrder: index,
      });
    }
  }
  delete state.drafts[sessionID + "|" + exerciseName];
  return changed;
}
