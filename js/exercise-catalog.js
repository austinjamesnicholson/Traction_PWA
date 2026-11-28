export function exerciseCategory(exercise) {
  const muscle = exercise.majorMuscle.toLowerCase();
  let part = "Other";
  if (/pec|chest/.test(muscle)) part = "Chest";
  else if (/delt|shoulder/.test(muscle)) part = "Shoulders";
  else if (/bicep|tricep|forearm/.test(muscle)) part = "Arms";
  else if (/lat|rhomboid|trap|back/.test(muscle)) part = "Back";
  else if (
    /quad|hamstring|glute|calf|calves|adductor/.test(muscle) ||
    exercise.type === "Legs"
  )
    part = "Legs";
  else if (/abs|oblique|core/.test(muscle) || exercise.type === "Core")
    part = "Core";
  return {
    part,
    region:
      part === "Legs"
        ? "Lower"
        : part === "Core"
          ? "Core"
          : ["Chest", "Shoulders", "Arms", "Back"].includes(part)
            ? "Upper"
            : "Other",
    function: exercise.type,
  };
}
export function filterExercises(
  exercises,
  { query = "", part = "", region = "", function: type = "" } = {},
  excluded = [],
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return exercises
    .filter((e) => {
      const category = exerciseCategory(e),
        haystack = [
          e.name,
          e.majorMuscle,
          e.minorMuscle,
          e.type,
          category.part,
          category.region,
        ]
          .join(" ")
          .toLowerCase();
      return (
        !excluded.includes(e.name) &&
        (!part || category.part === part) &&
        (!region || category.region === region) &&
        (!type || e.type === type) &&
        words.every((word) => haystack.includes(word))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
