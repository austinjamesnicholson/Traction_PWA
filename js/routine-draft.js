import { validateRoutines } from "./routines.js";
export const draftKey = (scope, target = "new") =>
  `traction-routine-draft-v1:${scope || "device"}:${target}`;
export function openRoutineDraft(storage, scope, target, exercises, initial) {
  const key = draftKey(scope, target),
    raw = storage.getItem(key);
  let value = raw ? JSON.parse(raw) : structuredClone(initial);
  if (
    !value ||
    ![1, 2, 3].includes(value.phase) ||
    typeof value.name !== "string" ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 7
  )
    throw new Error(
      "This routine draft could not be opened. It has not been overwritten.",
    );
  if (value.routine)
    validateRoutines([value.routine], exercises, { allowEmpty: true });
  let known = raw;
  return {
    key,
    value,
    recovered: Boolean(raw),
    save() {
      if (storage.getItem(key) !== known)
        throw new Error(
          "This routine draft changed in another tab. Reopen the editor before continuing.",
        );
      const next = JSON.stringify(value);
      storage.setItem(key, next);
      known = next;
    },
    clear() {
      if (storage.getItem(key) !== known)
        throw new Error(
          "Another tab changed this draft. Reopen the editor before discarding it.",
        );
      storage.removeItem(key);
      known = null;
    },
  };
}
