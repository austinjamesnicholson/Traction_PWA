import {
  createStore,
  freshState,
  validateState,
  STORAGE_KEY,
} from "./store.js";
const copy = (value) => structuredClone(value);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
export const equal = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function cloudDocument(state) {
  return { ...copy(state), revision: 0, drafts: {} };
}
const collections = {
  sessions: "sessionID",
  sets: "setID",
  skips: "skipID",
  replacements: "replacementID",
};
export function mergeDocuments(base, local, remote, prefer) {
  const conflicts = [];
  function choose(before, ours, theirs, path) {
    if (equal(ours, theirs) || equal(before, theirs)) return ours;
    if (equal(before, ours)) return theirs;
    conflicts.push(path);
    return prefer === "cloud" ? theirs : ours;
  }
  const result = cloudDocument(remote);
  for (const [name, id] of Object.entries(collections)) {
    const maps = [base, local, remote].map(
      (s) => new Map(s[name].map((r) => [r[id], r])),
    );
    result[name] = [...new Set(maps.flatMap((m) => [...m.keys()]))]
      .sort()
      .map((key) => choose(...maps.map((m) => m.get(key)), name + "/" + key))
      .filter(Boolean)
      .map(copy);
  }
  result.routine = choose(
    base.routine,
    local.routine,
    remote.routine,
    "routine",
  );
  result.profile = {};
  for (const field of ["feet", "inches", "weight", "age"])
    result.profile[field] = choose(
      base.profile[field],
      local.profile[field],
      remote.profile[field],
      "profile/" + field,
    );
  return { data: result, conflicts };
}
export function createJournalSync({
  storage,
  exercises,
  templates,
  remote,
  onStatus = () => {},
  onData = () => {},
  online = () => true,
}) {
  const guest = createStore(storage, exercises, templates);
  let account = null,
    envelope = null,
    known = null,
    key = null,
    generation = 0,
    busy = null,
    timer = null;
  let status = {
    state: "signed-out",
    message: "Device only · Sign in to sync",
  };
  const validate = (data) => validateState(data, exercises, templates);
  const emit = (state, message, conflicts = []) => {
    status = { state, message, conflicts };
    onStatus(status);
  };
  function persist(next) {
    if (storage.getItem(key) !== known)
      throw new Error(
        "Another tab changed this account. Reload before saving or syncing.",
      );
    validate(next.data);
    validate(next.base);
    const raw = JSON.stringify(next);
    try {
      storage.setItem(key, raw);
    } catch {
      throw new Error(
        "Could not save on this device. Free browser storage and retry.",
      );
    }
    envelope = next;
    known = raw;
  }
  function schedule() {
    clearTimeout(timer);
    if (account) timer = setTimeout(() => sync(), 800);
  }
  function update(change) {
    if (!account) return guest.update(change);
    const next = copy(envelope);
    change(next.data);
    next.data.revision = (envelope.data.revision || 0) + 1;
    next.dirty = !equal(cloudDocument(next.data), next.base);
    persist(next);
    emit(
      next.dirty || !next.serverRevision ? "pending" : "synced",
      next.dirty || !next.serverRevision
        ? "Changes saved on device · waiting to sync"
        : "Saved to cloud",
    );
    schedule();
    return next.data;
  }
  const store = {
    get state() {
      return account ? envelope.data : guest.state;
    },
    update,
    replace(next) {
      validate(next);
      return update((draft) => {
        for (const k of Object.keys(draft)) delete draft[k];
        Object.assign(draft, copy(next));
      });
    },
  };
  function attach(user) {
    if (account?.id === user?.id) return;
    generation++;
    clearTimeout(timer);
    busy = null;
    account = null;
    envelope = null;
    key = null;
    known = null;
    if (user) {
      const nextKey = STORAGE_KEY + ":account:" + user.id,
        raw = storage.getItem(nextKey);
      let loaded;
      try {
        loaded = raw
          ? JSON.parse(raw)
          : {
              data: freshState(),
              base: freshState(),
              serverRevision: 0,
              dirty: false,
            };
        validate(loaded.data);
        validate(loaded.base);
        if (
          !Number.isSafeInteger(loaded.serverRevision) ||
          loaded.serverRevision < 0
        )
          throw new Error("Invalid revision");
      } catch {
        emit(
          "error",
          "This account’s device cache could not be opened. It has not been overwritten.",
        );
        onData();
        throw new Error(
          "Unreadable account cache. Export its stored contents before restoring a backup.",
        );
      }
      account = { id: user.id, email: user.email };
      key = nextKey;
      known = raw;
      envelope = loaded;
      emit(
        loaded.dirty ? "pending" : "ready",
        loaded.dirty
          ? "Unsynced changes on this device"
          : "Account ready · checking cloud",
      );
    } else emit("signed-out", "Device only · Sign in to sync");
    onData();
    if (account) schedule();
  }
  async function sync(prefer) {
    if (!account) return;
    if (busy) return busy;
    if (!online()) {
      emit("offline", "Offline · changes stay on this device");
      return;
    }
    const epoch = generation,
      user = copy(account);
    const current = () => epoch === generation && account?.id === user.id;
    const task = (async () => {
      try {
        emit("syncing", "Syncing your journal…");
        for (let attempt = 0; attempt < 4; attempt++) {
          if (storage.getItem(key) !== known)
            throw new Error(
              "Another tab changed this account. Reload before syncing.",
            );
          const row = await remote.read(user.id);
          if (!current()) return;
          const cloud = row ? validate(cloudDocument(row.data)) : freshState();
          const revision = row?.revision || 0;
          const snapshot = cloudDocument(envelope.data);
          let merged = mergeDocuments(envelope.base, snapshot, cloud, prefer);
          try {
            validate(merged.data);
          } catch {
            merged = {
              data: prefer === "cloud" ? cloud : cloudDocument(envelope.data),
              conflicts: ["Related workout records changed on both devices"],
            };
          }
          if (merged.conflicts.length && !prefer) {
            emit(
              "conflict",
              "Two devices changed the same data. Choose which edits to keep.",
              merged.conflicts,
            );
            return;
          }
          const sent = copy(merged.data);
          let saved;
          if (row && equal(sent, cloud)) saved = { data: cloud, revision };
          else {
            if (!current()) return;
            if (storage.getItem(key) !== known)
              throw new Error(
                "Another tab changed this account. Reload before syncing.",
              );
            try {
              saved = await remote.save(user.id, revision, sent);
            } catch (error) {
              if (error.code === "40001") {
                prefer = undefined;
                continue;
              }
              throw error;
            }
          }
          if (!current()) return;
          const accepted = validate(cloudDocument(saved.data));
          // Rebase edits made during the request onto the acknowledged document.
          const latest = cloudDocument(envelope.data);
          const result = validate(
            mergeDocuments(snapshot, latest, accepted, "local").data,
          );
          const next = {
            data: {
              ...result,
              revision: envelope.data.revision,
              drafts: copy(envelope.data.drafts),
            },
            base: accepted,
            serverRevision: Number(saved.revision),
            dirty: !equal(result, accepted),
          };
          for (const draftKey of Object.keys(next.data.drafts))
            if (
              !next.data.sessions.some((s) =>
                draftKey.startsWith(s.sessionID + "|"),
              )
            )
              delete next.data.drafts[draftKey];
          const changed = !equal(envelope.data, next.data);
          persist(next);
          emit(
            next.dirty ? "pending" : "synced",
            next.dirty
              ? "New changes saved on device · syncing next"
              : "Saved to cloud",
          );
          if (changed) onData();
          if (next.dirty) schedule();
          return;
        }
        emit(
          "pending",
          "Another device is busy. Your changes are safe here; retry sync.",
        );
      } catch (error) {
        if (current())
          emit(
            "error",
            error.message ||
              "Sync failed. Your changes are still on this device.",
          );
      }
    })();
    busy = task;
    try {
      return await task;
    } finally {
      if (busy === task) busy = null;
    }
  }
  return {
    store,
    attach,
    sync,
    schedule,
    get account() {
      return account;
    },
    get status() {
      return status;
    },
    get pending() {
      return Boolean(envelope?.dirty);
    },
    dispose() {
      generation++;
      clearTimeout(timer);
      account = null;
      busy = null;
    },
  };
}
