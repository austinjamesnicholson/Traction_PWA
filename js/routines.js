import { uid, now } from "./model.js";
export const BUILTIN_ROUTINES = [
  {
    id: "austin",
    name: "Austin's Routine",
    subtitle: "Push / Pull / Legs",
    templateIDs: ["Austin Push", "Austin Pull", "Austin Legs"],
  },
  {
    id: "lizzie",
    name: "Lizzie's Routine",
    subtitle: "Push / Pull / Legs / Wednesday Cycle",
    templateIDs: [
      "Lizzie Push",
      "Lizzie Pull",
      "Lizzie Legs",
      "Lizzie Wednesday Cycle",
    ],
  },
];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const FORMATS = [
  {
    id: "fullbody",
    name: "Full body",
    detail: "Train a little of everything each session.",
    count: 3,
    names: ["Full Body A", "Full Body B", "Full Body C"],
    focus: ["Full Body"],
  },
  {
    id: "ppl",
    name: "Push, Pull, Legs",
    detail: "A familiar split, built around movement.",
    count: 3,
    names: ["Push", "Pull", "Legs"],
    focus: ["Push", "Pull", "Legs"],
  },
  {
    id: "upperlower",
    name: "Upper / Lower",
    detail: "Alternate upper- and lower-body sessions.",
    count: 4,
    names: ["Upper A", "Lower A", "Upper B", "Lower B"],
    focus: ["Full Body", "Legs"],
  },
  {
    id: "split",
    name: "Body-part split",
    detail: "Give each session a different focus.",
    count: 5,
    names: ["Chest", "Back", "Legs", "Shoulders", "Arms"],
    focus: ["Push", "Pull", "Legs", "Push", "Pull"],
  },
  {
    id: "custom",
    name: "Custom format",
    detail: "Start with a blank week and make it yours.",
    count: 3,
    names: [],
    focus: ["Full Body"],
  },
];
const defaultDays = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};
const text = (x, max) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
const unique = (rows, key) =>
  new Set(rows.map((r) => r?.[key])).size === rows.length;
export function newWorkout(index = 0, name, focus = "Full Body") {
  return {
    id: "custom-" + uid(),
    name: name || `Workout ${index + 1}`,
    type: "weightlifting",
    exerciseType: focus,
    items: [],
  };
}
export function createRoutine(
  format = "fullbody",
  count = 3,
  name = "My routine",
) {
  const spec = FORMATS.find((f) => f.id === format);
  if (!spec || !Number.isInteger(count) || count < 1 || count > 7)
    throw new Error("Choose one to seven workouts per week.");
  const workouts = Array.from({ length: count }, (_, i) =>
    newWorkout(
      i,
      spec.names.length
        ? spec.names[i % spec.names.length] +
            (i >= spec.names.length
              ? " " + (Math.floor(i / spec.names.length) + 1)
              : "")
        : undefined,
      spec.focus[i % spec.focus.length],
    ),
  );
  const days = Array(7).fill(null);
  defaultDays[count].forEach((day, i) => {
    days[day] = workouts[i].id;
  });
  return {
    id: "routine-" + uid(),
    name,
    format,
    workouts,
    days,
    createdAt: now(),
    updatedAt: now(),
  };
}
export function listRoutines(state) {
  return [
    ...BUILTIN_ROUTINES,
    ...(state?.customRoutines || []).map((r) => ({
      ...r,
      subtitle: `${r.workouts.length} workouts · ${FORMATS.find((f) => f.id === r.format)?.name || "Custom"}`,
      templateIDs: r.workouts.map((w) => w.id),
      custom: true,
    })),
  ];
}
export function asTemplate(workout, routine) {
  return {
    id: workout.id,
    name: workout.name,
    subtitle: routine?.name || "Custom workout",
    exerciseType: workout.exerciseType,
    type: workout.type,
    items: structuredClone(workout.items),
  };
}
export function listTemplates(state, builtin) {
  return [
    ...builtin,
    ...(state?.customRoutines || []).flatMap((r) =>
      r.workouts.map((w) => asTemplate(w, r)),
    ),
  ];
}
export function sessionTemplate(session, templates) {
  return (
    session.templateSnapshot ||
    templates.find((t) => t.id === session.templateID) ||
    templates.find((t) => t.name === session.templateName)
  );
}
export function validateTemplate(
  template,
  exercises,
  { allowEmpty = false } = {},
) {
  if (
    !template ||
    !text(template.id, 100) ||
    !(allowEmpty
      ? typeof template.name === "string" && template.name.length <= 80
      : text(template.name, 80)) ||
    !text(template.exerciseType, 80) ||
    !Array.isArray(template.items) ||
    template.items.length > 40
  )
    throw new Error("A workout has an invalid name or exercise list.");
  if (!unique(template.items, "id"))
    throw new Error("A workout contains duplicate exercise blocks.");
  const names = [];
  for (const block of template.items) {
    if (
      !block ||
      !text(block.id, 100) ||
      !text(block.title, 160) ||
      !["singleExercise", "exerciseOptions", "circuit"].includes(block.kind) ||
      !Array.isArray(block.exercises) ||
      block.exercises.length < 1 ||
      block.exercises.length > 8 ||
      block.exercises.some((name) => !exercises.some((e) => e.name === name))
    )
      throw new Error("Choose valid exercises for every block.");
    if (block.kind === "singleExercise" && block.exercises.length !== 1)
      throw new Error("An exercise block has an invalid option count.");
    names.push(...block.exercises);
  }
  if (new Set(names).size !== names.length)
    throw new Error(
      "Use each exercise once per workout; place alternatives in the same block.",
    );
}
export function validateRoutines(
  routines,
  exercises,
  { allowEmpty = false } = {},
) {
  if (
    !Array.isArray(routines) ||
    routines.length > 50 ||
    !unique(routines, "id")
  )
    throw new Error("The routine library is invalid.");
  const workoutIDs = [];
  for (const r of routines) {
    if (
      !r ||
      !text(r.id, 100) ||
      !r.id.startsWith("routine-") ||
      !(allowEmpty
        ? typeof r.name === "string" && r.name.length <= 80
        : text(r.name, 80)) ||
      !FORMATS.some((f) => f.id === r.format) ||
      !Array.isArray(r.workouts) ||
      r.workouts.length < 1 ||
      r.workouts.length > 7 ||
      !Array.isArray(r.days) ||
      r.days.length !== 7 ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      !Number.isFinite(Date.parse(r.updatedAt))
    )
      throw new Error(
        "A routine needs a name and one to seven workouts in a seven-day week.",
      );
    for (const w of r.workouts) {
      if (
        !w ||
        !["weightlifting", "cardio", "other"].includes(w.type) ||
        typeof w.id !== "string" ||
        !w.id.startsWith("custom-")
      )
        throw new Error("Choose a valid workout type.");
      validateTemplate(w, exercises, { allowEmpty });
      if (!allowEmpty && w.type === "weightlifting" && !w.items.length)
        throw new Error(`Add at least one exercise to ${w.name}.`);
      workoutIDs.push(w.id);
    }
    const scheduled = r.days.filter(Boolean);
    if (
      scheduled.length !== r.workouts.length ||
      new Set(scheduled).size !== scheduled.length ||
      scheduled.some((id) => !r.workouts.some((w) => w.id === id)) ||
      r.days.some((id) => id !== null && typeof id !== "string")
    )
      throw new Error(
        "Schedule every workout once in the week. Empty days are rest days.",
      );
  }
  if (new Set(workoutIDs).size !== workoutIDs.length)
    throw new Error("Workouts must have unique IDs.");
  return routines;
}
export function assignDay(routine, index, id) {
  if (id !== null && !routine.workouts.some((w) => w.id === id))
    throw new Error("Workout not found.");
  const previous = routine.days[index],
    other = id === null ? -1 : routine.days.indexOf(id);
  if (other !== -1 && other !== index) routine.days[other] = previous;
  routine.days[index] = id;
}
export function addWorkout(routine) {
  if (routine.workouts.length >= 7)
    throw new Error("A weekly routine supports up to seven workouts.");
  const w = newWorkout(routine.workouts.length);
  routine.workouts.push(w);
  routine.days[routine.days.indexOf(null)] = w.id;
  return w;
}
export function removeWorkout(routine, id) {
  if (routine.workouts.length === 1)
    throw new Error("Keep at least one workout in your routine.");
  routine.workouts = routine.workouts.filter((w) => w.id !== id);
  routine.days = routine.days.map((value) => (value === id ? null : value));
}
export function addExercise(workout, name, blockID, optionIndex) {
  if (
    workout.items.some((block) =>
      block.exercises.some(
        (n, i) => n === name && (block.id !== blockID || i !== optionIndex),
      ),
    )
  )
    throw new Error("That exercise is already in this workout.");
  if (!blockID) {
    if (workout.items.length >= 40)
      throw new Error("Use up to 40 exercise blocks per workout.");
    workout.items.push({
      id: "block-" + uid(),
      title: name,
      subtitle: "",
      kind: "singleExercise",
      exercises: [name],
    });
    return;
  }
  const block = workout.items.find((b) => b.id === blockID);
  if (!block) throw new Error("Exercise block not found.");
  if (optionIndex !== undefined) block.exercises[optionIndex] = name;
  else {
    if (block.exercises.length >= 8)
      throw new Error("Use up to eight alternatives in one block.");
    block.exercises.push(name);
  }
  if (block.kind !== "circuit")
    block.kind =
      block.exercises.length > 1 ? "exerciseOptions" : "singleExercise";
  block.title =
    block.kind === "singleExercise"
      ? block.exercises[0]
      : block.kind === "circuit"
        ? block.title
        : "Choose one exercise";
}
export function removeExercise(workout, blockID, index) {
  const block = workout.items.find((b) => b.id === blockID);
  if (!block) return;
  block.exercises.splice(index, 1);
  if (!block.exercises.length)
    workout.items = workout.items.filter((b) => b !== block);
  else if (block.kind !== "circuit") {
    block.kind =
      block.exercises.length > 1 ? "exerciseOptions" : "singleExercise";
    block.title =
      block.kind === "singleExercise"
        ? block.exercises[0]
        : "Choose one exercise";
  }
}
export function moveBlock(workout, id, target) {
  const from = workout.items.findIndex((b) => b.id === id);
  if (from < 0) return;
  const to = Math.max(0, Math.min(workout.items.length - 1, target));
  const [block] = workout.items.splice(from, 1);
  workout.items.splice(to, 0, block);
}
const normalize = (value) =>
  Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, normalize(value[k])]),
        )
      : value;
export const routineEqual = (a, b) =>
  JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
export function saveRoutine(
  state,
  routine,
  exercises,
  { activate = true, expected = null } = {},
) {
  validateRoutines([routine], exercises);
  state.customRoutines ||= [];
  const current = state.customRoutines.find((r) => r.id === routine.id);
  if (expected && !routineEqual(current, expected))
    throw new Error(
      "This routine changed elsewhere. Reopen its editor before saving, so newer changes are preserved.",
    );
  if (!expected && current)
    throw new Error("This routine already exists. Reopen it to edit.");
  const saved = {
    ...structuredClone(routine),
    name: routine.name.trim(),
    updatedAt: now(),
  };
  state.customRoutines = state.customRoutines.filter(
    (r) => r.id !== routine.id,
  );
  state.customRoutines.push(saved);
  if (activate) state.routine = saved.id;
}
export function deleteRoutine(state, id) {
  state.customRoutines = (state.customRoutines || []).filter(
    (r) => r.id !== id,
  );
  if (state.routine === id) state.routine = "austin";
}
export function copyRoutine(source, templates) {
  const result = createRoutine(
    "custom",
    source.templateIDs.length,
    source.name + " copy",
  );
  result.workouts = source.templateIDs.map((id, i) => {
    const t = templates.find((t) => t.id === id),
      w = newWorkout(i, t.name, t.exerciseType);
    w.type =
      t.type ||
      (t.exerciseType === "Cardio"
        ? "cardio"
        : t.exerciseType === "Group Fitness"
          ? "other"
          : "weightlifting");
    w.items = t.items.map((block) => ({
      ...structuredClone(block),
      id: "block-" + uid(),
    }));
    return w;
  });
  result.days = source.days
    ? source.days.map((id) =>
        id ? result.workouts[source.templateIDs.indexOf(id)]?.id || null : null,
      )
    : Array(7).fill(null);
  if (!source.days)
    defaultDays[result.workouts.length].forEach((day, i) => {
      result.days[day] = result.workouts[i].id;
    });
  return result;
}
