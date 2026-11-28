import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCloud } from "../js/cloud.js";
import { freshState } from "../js/store.js";
import { recommend } from "../js/recommendations.js";
const exercises = JSON.parse(
  readFileSync(new URL("../data/exercises.json", import.meta.url)),
);
const templates = JSON.parse(
  readFileSync(new URL("../data/templates.json", import.meta.url)),
);
function fixture(t) {
  const values = new Map(),
    calls = [],
    docs = new Map();
  let session = null,
    listener,
    options;
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const user = {
    id: "test-user",
    email: "test@example.invalid",
    is_anonymous: false,
  };
  const sdk = {
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() {
        return { data: { session }, error: null };
      },
      async signInWithPassword(args) {
        calls.push(["signin", args]);
        session = { user };
        return { data: { session }, error: null };
      },
      async signUp(args) {
        calls.push(["signup", args]);
        return { data: { session: null, user }, error: null };
      },
      async resetPasswordForEmail(...args) {
        calls.push(["reset", ...args]);
        return { data: {}, error: null };
      },
      async updateUser(args) {
        calls.push(["password", args]);
        return { data: { user }, error: null };
      },
      async signOut(args) {
        calls.push(["signout", args]);
        session = null;
        return { error: null };
      },
    },
    from(name) {
      return {
        select() {
          return this;
        },
        eq(column, id) {
          this.id = id;
          return this;
        },
        maybeSingle() {
          return this;
        },
        async abortSignal() {
          return { data: docs.get(this.id) || null, error: null };
        },
      };
    },
    rpc(name, args) {
      calls.push(["rpc", name, args]);
      const row = {
        data: structuredClone(args.document),
        revision: args.expected_revision + 1,
      };
      docs.set(args.owner_id, row);
      return {
        async abortSignal() {
          return { data: row, error: null };
        },
      };
    },
  };
  globalThis.supabase = {
    createClient(url, key, opts) {
      options = opts;
      return sdk;
    },
  };
  globalThis.location = {
    href: "https://austinjamesnicholson.github.io/Traction_PWA/#account",
    hash: "#account",
  };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  globalThis.document = { hidden: false, addEventListener() {} };
  const cloud = createCloud({ storage, exercises, templates });
  t.after(() => cloud.dispose());
  return {
    cloud,
    calls,
    values,
    docs,
    sdk,
    user,
    get options() {
      return options;
    },
    emit(event) {
      listener(event, session);
    },
  };
}
test("sign-in uses the configured project, private session storage, and an owner-bound save", async (t) => {
  const f = fixture(t);
  await f.cloud.start();
  await f.cloud.signIn("test@example.invalid", "test-password-123");
  assert.equal(f.options.auth.storageKey, "traction-account-auth-v1");
  assert.equal(f.cloud.account.id, "test-user");
  assert.equal(f.docs.size, 1);
  const rpc = f.calls.find((c) => c[0] === "rpc");
  assert.equal(rpc[2].owner_id, "test-user");
  assert.equal(rpc[1], "save_traction_document");
  assert(![...f.values.values()].join("").includes("test-password-123"));
});
test("sign-up handles confirmation without treating an unconfirmed user as signed in", async (t) => {
  const f = fixture(t);
  await f.cloud.start();
  assert.equal(
    await f.cloud.signUp("new@example.invalid", "password-123"),
    false,
  );
  assert.equal(f.cloud.account, null);
  const call = f.calls.find((c) => c[0] === "signup");
  assert.equal(
    call[1].options.emailRedirectTo,
    "https://austinjamesnicholson.github.io/Traction_PWA/",
  );
});
test("password reset uses the app URL and recovery must be established before updating", async (t) => {
  const f = fixture(t);
  await f.cloud.start();
  await f.cloud.resetPassword("test@example.invalid");
  assert.equal(
    f.calls.find((c) => c[0] === "reset")[2].redirectTo,
    "https://austinjamesnicholson.github.io/Traction_PWA/",
  );
  await assert.rejects(
    () => f.cloud.updatePassword("password-456"),
    /reset link/,
  );
  await f.cloud.signIn("test@example.invalid", "password-123");
  f.emit("PASSWORD_RECOVERY");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(f.cloud.recovery);
  assert.equal(location.hash, "#profile");
  await f.cloud.updatePassword("password-456");
  assert(!f.cloud.recovery);
  assert(f.calls.some((c) => c[0] === "password"));
});
test("sign-out returns to device-only data and leaves unsynced account changes separated", async (t) => {
  const f = fixture(t);
  await f.cloud.start();
  f.cloud.store.update((s) => {
    s.profile.age = "20";
  });
  await f.cloud.signIn("test@example.invalid", "password-123");
  f.cloud.store.update((s) => {
    s.profile.age = "30";
  });
  await f.cloud.signOut();
  assert.equal(f.cloud.account, null);
  assert.equal(f.cloud.store.state.profile.age, "20");
  assert.equal(f.calls.find((c) => c[0] === "signout")[1].scope, "local");
  await f.cloud.signIn("test@example.invalid", "password-123");
  assert.equal(f.cloud.store.state.profile.age, "30");
});
test("AI requires a signed-in account before calling a service", async () => {
  await assert.rejects(
    () => recommend(freshState(), exercises[0], {}),
    /Sign in/,
  );
});
test("AI uses the existing signed-in Supabase client rather than creating an anonymous account", async (t) => {
  const f = fixture(t);
  await f.cloud.start();
  await f.cloud.signIn("test@example.invalid", "password-123");
  let requested = false;
  f.sdk.functions = {
    async invoke(name, options) {
      requested = true;
      assert.equal(name, "workout-recommendation");
      assert.equal(options.body.exercise, "Bench press");
      return { data: { headline: "Guidance" }, error: null };
    },
  };
  const result = await f.cloud.requestRecommendation({
    exercise: "Bench press",
  });
  assert.equal(result.headline, "Guidance");
  assert(requested);
  assert(!f.calls.some((c) => c[0] === "signup"));
});
test("AI server errors are shown with their actionable message", async (t) => {
  const f = fixture(t);
  await f.cloud.start();
  await f.cloud.signIn("test@example.invalid", "password-123");
  f.sdk.functions = {
    async invoke() {
      return {
        data: null,
        error: { context: Response.json({ error: "AI setup is incomplete." }) },
      };
    },
  };
  await assert.rejects(
    () => f.cloud.requestRecommendation({}),
    /AI setup is incomplete/,
  );
});
