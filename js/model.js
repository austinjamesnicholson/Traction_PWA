export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const ordered = (sets) =>
  [...sets].sort(
    (a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp) ||
      (a.entryOrder ?? 0) - (b.entryOrder ?? 0),
  );
export function sessionSets(state, sessionID, exerciseName) {
  return ordered(
    state.sets.filter(
      (s) =>
        s.sessionID === sessionID &&
        (!exerciseName || s.exerciseName === exerciseName),
    ),
  );
}
export function previousSets(state, exerciseName, activeID) {
  const sets = state.sets.filter(
    (s) => s.exerciseName === exerciseName && s.sessionID !== activeID,
  );
  const latest = [...sets].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  )[0];
  return latest
    ? ordered(sets.filter((s) => s.sessionID === latest.sessionID))
    : [];
}
export function validSet(weight, reps) {
  return (
    weight !== "" &&
    weight != null &&
    reps !== "" &&
    reps != null &&
    Number.isFinite(Number(weight)) &&
    Number(weight) >= 0 &&
    Number(weight) <= 5000 &&
    Number.isInteger(Number(reps)) &&
    Number(reps) > 0 &&
    Number(reps) <= 1000
  );
}
export function recentVolume(state, exercises, at = new Date()) {
  const cutoff = new Date(at);
  cutoff.setDate(cutoff.getDate() - 7);
  const totals = new Map();
  const add = (name, field, value) => {
    name = name.trim();
    if (!name || name.toLowerCase() === "unknown") return;
    const total = totals.get(name) || {
      muscle: name,
      primary: 0,
      secondary: 0,
    };
    total[field] += value;
    totals.set(name, total);
  };
  for (const set of state.sets) {
    if (
      new Date(set.timestamp) < cutoff ||
      new Date(set.timestamp) > at ||
      !validSet(set.weight, set.reps)
    )
      continue;
    const exercise = exercises.find((e) => e.name === set.exerciseName);
    if (!exercise) continue;
    add(exercise.majorMuscle, "primary", 1);
    add(exercise.minorMuscle, "secondary", 0.5);
  }
  return [...totals.values()]
    .map((v) => ({ ...v, total: v.primary + v.secondary }))
    .sort((a, b) => b.total - a.total || a.muscle.localeCompare(b.muscle));
}
export function blocksFor(template, exercises) {
  return template.items.length
    ? template.items
    : exercises
        .filter((e) => e.type === template.exerciseType)
        .map((e) => ({
          id: e.id,
          title: e.name,
          subtitle: "",
          kind: "singleExercise",
          exercises: [e.name],
        }));
}
export function blockStatus(state, sessionID, block) {
  const replacement = state.replacements.find(
    (r) => r.sessionID === sessionID && r.templateItemID === block.id,
  );
  const names = [...block.exercises, replacement?.replacementExerciseName];
  if (
    state.sets.some(
      (s) => s.sessionID === sessionID && names.includes(s.exerciseName),
    )
  )
    return "Completed";
  if (
    state.skips.some(
      (s) => s.sessionID === sessionID && s.templateItemID === block.id,
    )
  )
    return "Skipped";
  return replacement ? "Alternate selected" : "Ready";
}
export function replaceBlock(state, session, block, name) {
  state.skips = state.skips.filter(
    (s) => s.sessionID !== session.sessionID || s.templateItemID !== block.id,
  );
  state.replacements = state.replacements.filter(
    (r) => r.sessionID !== session.sessionID || r.templateItemID !== block.id,
  );
  state.replacements.push({
    replacementID: uid(),
    sessionID: session.sessionID,
    templateName: session.templateName,
    originalBlockName: block.title,
    templateItemID: block.id,
    replacementExerciseName: name,
    timestamp: now(),
  });
}
export function skipBlock(state, session, block, note) {
  state.replacements = state.replacements.filter(
    (r) => r.sessionID !== session.sessionID || r.templateItemID !== block.id,
  );
  state.skips = state.skips.filter(
    (s) => s.sessionID !== session.sessionID || s.templateItemID !== block.id,
  );
  state.skips.push({
    skipID: uid(),
    sessionID: session.sessionID,
    templateName: session.templateName,
    exerciseName:
      block.kind === "singleExercise" ? block.exercises[0] : block.title,
    templateItemID: block.id,
    note,
    timestamp: now(),
  });
}
export function importLegacy(current, input, exercises) {
  if (!input || !Array.isArray(input.setEntries))
    throw new Error("Choose a Traction setEntryLibrary JSON file.");
  const next = structuredClone(current);
  let count = 0;
  const seen = new Set(next.sets.map((s) => s.setID));
  for (const row of input.setEntries) {
    if (
      !row.setID ||
      !row.sessionID ||
      !exercises.some((e) => e.name === row.exerciseName) ||
      !validSet(row.weight, row.reps) ||
      !Number.isFinite(Date.parse(row.timestamp)) ||
      !row.templateName
    )
      throw new Error(
        "Import contains an invalid set or unknown exercise. No data was changed.",
      );
    if (seen.has(row.setID)) continue;
    next.sets.push({
      ...row,
      weight: Number(row.weight),
      reps: Number(row.reps),
      notes: String(row.notes || ""),
    });
    seen.add(row.setID);
    count++;
    let session = next.sessions.find((s) => s.sessionID === row.sessionID);
    if (!session) {
      session = {
        sessionID: row.sessionID,
        templateName: row.templateName,
        startedAt: row.timestamp,
        endedAt: row.timestamp,
      };
      next.sessions.push(session);
    } else if (!session.endedAt)
      throw new Error("Import conflicts with an active workout.");
    if (new Date(row.timestamp) < new Date(session.startedAt))
      session.startedAt = row.timestamp;
    if (new Date(row.timestamp) > new Date(session.endedAt))
      session.endedAt = row.timestamp;
  }
  return { state: next, count };
}
