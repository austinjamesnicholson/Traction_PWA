import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createJournalSync,
  cloudDocument,
  mergeDocuments,
} from "../js/sync.js";
import { freshState, STORAGE_KEY } from "../js/store.js";
const exercises = JSON.parse(
  readFileSync(new URL("../data/exercises.json", import.meta.url)),
);
const templates = JSON.parse(
  readFileSync(new URL("../data/templates.json", import.meta.url)),
);
const user = { id: "a", email: "a@example.invalid" },
  other = { id: "b", email: "b@example.invalid" };
function disk() {
  const map = new Map();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
function backend() {
  const docs = new Map();
  return {
    docs,
    async read(id) {
      return structuredClone(docs.get(id) || null);
    },
    async save(id, revision, data) {
      const current = docs.get(id);
      if ((current?.revision || 0) !== revision)
        throw Object.assign(new Error("stale"), { code: "40001" });
      const row = { data: structuredClone(data), revision: revision + 1 };
      docs.set(id, row);
      return structuredClone(row);
    },
  };
}
function engine(t, remote, storage = disk(), extra = {}) {
  const e = createJournalSync({
    storage,
    exercises,
    templates,
    remote,
    ...extra,
  });
  t.after(() => e.dispose());
  return e;
}
const workout = (id) => ({
  sessionID: id,
  templateName: "Austin Push",
  startedAt: "2026-11-25T10:00:00Z",
  endedAt: null,
});
test("signed-in accounts start separate from local-only records and other accounts", async (t) => {
  const d = disk(),
    r = backend(),
    e = engine(t, r, d);
  e.store.update((s) => s.sessions.push(workout("guest")));
  e.attach(user);
  assert.equal(e.store.state.sessions.length, 0);
  e.store.update((s) => s.sessions.push(workout("a-workout")));
  await e.sync();
  e.attach(other);
  assert.equal(e.store.state.sessions.length, 0);
  e.attach(user);
  assert.equal(e.store.state.sessions[0].sessionID, "a-workout");
  e.attach(null);
  assert.equal(e.store.state.sessions[0].sessionID, "guest");
});
test("a second device loads saved cloud workouts and profile fields", async (t) => {
  const r = backend(),
    a = engine(t, r),
    b = engine(t, r);
  a.attach(user);
  a.store.update((s) => {
    s.sessions.push(workout("w"));
    s.profile.age = "30";
  });
  await a.sync();
  b.attach(user);
  await b.sync();
  assert.equal(b.store.state.sessions[0].sessionID, "w");
  assert.equal(b.store.state.profile.age, "30");
  assert.equal(b.status.state, "synced");
});
test("offline edits survive reopening and sync after reconnection", async (t) => {
  const d = disk(),
    r = backend();
  let online = false;
  const a = engine(t, r, d, { online: () => online });
  a.attach(user);
  a.store.update((s) => {
    s.profile.age = "31";
  });
  await a.sync();
  assert.equal(a.status.state, "offline");
  a.dispose();
  const b = engine(t, r, d, { online: () => online });
  b.attach(user);
  assert.equal(b.store.state.profile.age, "31");
  online = true;
  await b.sync();
  assert.equal(r.docs.get("a").data.profile.age, "31");
  assert(!b.pending);
});
test("concurrent changes to different fields combine automatically", async (t) => {
  const r = backend(),
    a = engine(t, r),
    b = engine(t, r);
  a.attach(user);
  await a.sync();
  b.attach(user);
  await b.sync();
  a.store.update((s) => {
    s.profile.age = "32";
  });
  b.store.update((s) => {
    s.profile.weight = "180";
  });
  await a.sync();
  await b.sync();
  assert.equal(b.store.state.profile.age, "32");
  assert.equal(b.store.state.profile.weight, "180");
  assert.equal(r.docs.get("a").data.profile.age, "32");
});
test("same-field conflicts require an explicit choice and never silently overwrite", async (t) => {
  const r = backend(),
    a = engine(t, r),
    b = engine(t, r);
  a.attach(user);
  await a.sync();
  b.attach(user);
  await b.sync();
  a.store.update((s) => {
    s.profile.age = "32";
  });
  b.store.update((s) => {
    s.profile.age = "33";
  });
  await a.sync();
  await b.sync();
  assert.equal(b.status.state, "conflict");
  assert.equal(r.docs.get("a").data.profile.age, "32");
  await b.sync("local");
  assert.equal(r.docs.get("a").data.profile.age, "33");
});
test("choosing cloud keeps non-conflicting changes from this device", async (t) => {
  const r = backend(),
    a = engine(t, r),
    b = engine(t, r);
  a.attach(user);
  await a.sync();
  b.attach(user);
  await b.sync();
  a.store.update((s) => {
    s.profile.age = "32";
  });
  b.store.update((s) => {
    s.profile.age = "33";
    s.profile.weight = "170";
  });
  await a.sync();
  await b.sync("cloud");
  assert.equal(b.store.state.profile.age, "32");
  assert.equal(b.store.state.profile.weight, "170");
});
test("draft rows remain on the originating device and are excluded from cloud payloads", async (t) => {
  const r = backend(),
    a = engine(t, r),
    b = engine(t, r);
  a.attach(user);
  a.store.update((s) => {
    s.sessions.push(workout("w"));
    s.drafts["w|" + exercises[0].name] = [
      { id: "row", weight: "", reps: "", notes: "draft" },
    ];
  });
  await a.sync();
  assert.deepEqual(r.docs.get("a").data.drafts, {});
  assert.equal(Object.keys(a.store.state.drafts).length, 1);
  b.attach(user);
  await b.sync();
  assert.equal(Object.keys(b.store.state.drafts).length, 0);
});
test("edits made during a save stay pending and are sent by the next sync", async (t) => {
  const r = backend();
  let release, entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const original = r.save.bind(r);
  r.save = async (...args) => {
    entered();
    await gate;
    return original(...args);
  };
  const a = engine(t, r);
  a.attach(user);
  a.store.update((s) => {
    s.profile.age = "30";
  });
  const request = a.sync();
  await started;
  a.store.update((s) => {
    s.profile.weight = "180";
  });
  release();
  await request;
  assert.equal(a.store.state.profile.weight, "180");
  assert(a.pending);
  await a.sync();
  assert.equal(r.docs.get("a").data.profile.weight, "180");
  assert(!a.pending);
});
test("a response arriving after switching accounts cannot replace the next account", async (t) => {
  const r = backend();
  r.docs.set("a", {
    data: {
      ...freshState(),
      profile: { feet: "", inches: "", weight: "", age: "99" },
    },
    revision: 1,
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const read = r.read.bind(r);
  r.read = async (id) => {
    await gate;
    return read(id);
  };
  const a = engine(t, r);
  a.attach(user);
  const request = a.sync();
  a.attach(other);
  release();
  await request;
  assert.equal(a.account.id, "b");
  assert.equal(a.store.state.profile.age, "");
  assert(!r.docs.has("b"));
});
test("revision conflicts are retried after reading a newer document", async (t) => {
  const r = backend();
  let first = true;
  const original = r.save.bind(r);
  r.save = async (id, rev, data) => {
    if (first) {
      first = false;
      r.docs.set(id, {
        data: { ...freshState(), routine: "lizzie" },
        revision: 1,
      });
      throw Object.assign(new Error("stale"), { code: "40001" });
    }
    return original(id, rev, data);
  };
  const a = engine(t, r);
  a.attach(user);
  a.store.update((s) => {
    s.profile.age = "40";
  });
  await a.sync();
  assert.equal(r.docs.get("a").data.routine, "lizzie");
  assert.equal(r.docs.get("a").data.profile.age, "40");
});
test("two tabs with the same account cannot overwrite one another’s local queue", async (t) => {
  const d = disk(),
    r = backend(),
    a = engine(t, r, d),
    b = engine(t, r, d);
  a.attach(user);
  b.attach(user);
  a.store.update((s) => {
    s.profile.age = "40";
  });
  assert.throws(
    () =>
      b.store.update((s) => {
        s.profile.age = "41";
      }),
    /Another tab/,
  );
});
test("deleting a record conflicts with editing it on another device", () => {
  const base = freshState();
  base.sessions = [workout("w")];
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.sessions = [];
  remote.sessions[0].endedAt = "2026-11-25T11:00:00Z";
  const merge = mergeDocuments(base, local, remote);
  assert.deepEqual(merge.conflicts, ["sessions/w"]);
});
test("failed cloud saves leave the durable local queue intact", async (t) => {
  const r = backend();
  r.save = async () => {
    throw new Error("Server unavailable");
  };
  const d = disk(),
    a = engine(t, r, d);
  a.attach(user);
  a.store.update((s) => {
    s.profile.age = "41";
  });
  await a.sync();
  assert.equal(a.status.state, "error");
  assert(a.pending);
  const saved = JSON.parse(d.getItem(STORAGE_KEY + ":account:a"));
  assert.equal(saved.data.profile.age, "41");
  assert(saved.dirty);
});
