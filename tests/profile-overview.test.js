import test from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../js/views/dashboard.js";
import { profile, bindProfile } from "../js/views/settings.js";
import { freshState } from "../js/store.js";

test("Overview starts a new workout or resumes the active one and omits the removed cards", () => {
  const state = freshState(),
    ctx = { store: { state }, exercises: [] };
  const idle = dashboard(ctx);
  assert.match(idle, /href="#workouts">＋ Start workout/);
  assert.doesNotMatch(
    idle,
    /class="hero"|class="stats"|Completed workouts|Saved sets|Make your next/,
  );
  assert.match(idle, /Your week at a glance/);
  state.sessions.push({
    sessionID: "active/id",
    templateName: "Push",
    startedAt: new Date().toISOString(),
    endedAt: null,
  });
  const active = dashboard(ctx);
  assert.match(
    active,
    /class="primary" href="#session\/active%2Fid">Resume workout/,
  );
  assert.doesNotMatch(active, /Start workout/);
  state.sessions[0].endedAt = new Date().toISOString();
  assert.match(dashboard(ctx), /Start workout/);
});

test("Profile includes metrics before sign-in, signed-in sync, conflicts, and password recovery", () => {
  const ctx = {
    store: { state: freshState() },
    cloud: {
      account: null,
      status: { state: "signed-out", message: "Device only" },
    },
  };
  for (const mode of ["signin", "signedin", "conflict", "recovery"]) {
    ctx.cloud.account =
      mode === "signin"
        ? null
        : { id: "mock", email: "tester@example.invalid" };
    ctx.cloud.status.state = mode === "conflict" ? "conflict" : "synced";
    ctx.cloud.recovery = mode === "recovery";
    const html = profile(ctx);
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.ok(html.indexOf("profile-form") < html.indexOf("profile-account"));
    assert.match(html, /Account &amp; sync/);
    assert.match(
      html,
      mode === "signin"
        ? /id="auth-form"/
        : mode === "recovery"
          ? /id="password-form"/
          : /id="sync-now"/,
    );
    if (mode === "conflict") assert.match(html, /data-resolve="cloud"/);
  }
});

test("combined Profile binds the profile form and the existing sync action", async () => {
  const profileForm = {},
    syncButton = {};
  let synced = 0,
    rendered = 0;
  globalThis.document = {
    querySelector: (selector) =>
      ({ "#profile-form": profileForm, "#sync-now": syncButton })[selector] ||
      null,
    querySelectorAll: () => [],
  };
  const ctx = {
    cloud: {
      sync: async () => {
        synced++;
      },
    },
    render: () => rendered++,
  };
  try {
    bindProfile(ctx);
    assert.equal(typeof profileForm.onsubmit, "function");
    await syncButton.onclick();
    assert.equal(synced, 1);
    assert.equal(rendered, 1);
  } finally {
    delete globalThis.document;
  }
});
