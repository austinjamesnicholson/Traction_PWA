import { heading, esc, modal, notify, download } from "../ui.js";
import { importLegacy } from "../model.js";
import { validateState } from "../store.js";
export function profile(ctx) {
  const p = ctx.store.state.profile;
  return (
    heading(
      "YOUR TRAINING CONTEXT",
      "Your profile",
      "Your body metrics are private to your journal. Sign in to sync them across devices.",
    ) +
    `<section class="card narrow"><h2>Body metrics</h2><form id="profile-form"><div class="form-grid"><label>Height (feet)<input type="number" name="feet" min="0" max="9" step="1" value="${esc(p.feet)}"></label><label>Height (inches)<input type="number" name="inches" min="0" max="11" step="1" value="${esc(p.inches)}"></label><label>Body weight (lb)<input type="number" name="weight" min="0" max="1500" step="any" value="${esc(p.weight)}"></label><label>Age (years)<input type="number" name="age" min="1" max="120" step="1" value="${esc(p.age)}"></label></div><div class="actions"><button class="primary">Save profile</button></div></form></section>`
  );
}
export function bindProfile(ctx) {
  document.querySelector("#profile-form").onsubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    ctx.store.update((s) => {
      s.profile = data;
    });
    notify("Profile saved.");
  };
}
export function settings(ctx) {
  return (
    heading("MAKE IT YOURS", "Settings", "Your routine, your data, your app.") +
    `<div class="settings-grid"><section class="card"><p class="eyebrow">THE PLAN YOU FOLLOW</p><h2>Active routine</h2><label>Choose your routine<select id="routine">${ctx.routines.map((r) => `<option value="${r.id}" ${r.id === ctx.store.state.routine ? "selected" : ""}>${esc(r.name)} — ${esc(r.subtitle)}</option>`).join("")}</select></label><p>Changes the workouts shown first. Existing workout history stays together.</p></section>
    <section class="card"><p class="eyebrow">KEEP YOUR HISTORY CLOSE</p><h2>Backup & import</h2><p>Sign in to sync saved workouts across devices. Export a backup for an extra copy. Unsaved drafts stay on this device.</p><div class="actions"><button class="secondary" id="export">Export backup</button><label class="secondary file-button">Import JSON<input type="file" id="import" accept=".json,application/json"></label></div><p class="fine-print">Accepts a PWA backup or the original setEntryLibrary.json. Legacy imports merge sets and ignore duplicates; backups replace this device’s data after confirmation.</p><a href="#database">Review saved database</a></section>
    <section class="card"><p class="eyebrow">ON YOUR HOME SCREEN</p><h2>Install Traction</h2><p>On iPhone, open this app in Safari, tap Share, then Add to Home Screen. In Chrome or Edge, use the browser’s Install app option.</p><p>Open the app online once before using it offline. Workout logging, history, and charts work offline.</p><button class="secondary" id="check-update">Check for app update</button><p id="update-status" role="status"></p></section>
    <section class="card"><p class="eyebrow">YOUR ACCOUNT</p><h2>Accounts & cloud storage</h2><p>Sign in to save workouts, routine settings, and profile metrics in your private Traction account.</p><a class="primary" href="#account">Open account & sync</a><p class="fine-print">Signed-in users can request AI guidance from an exercise log. Saved history and notes are sent only when you request it.</p></section></div>`
  );
}
export function bindSettings(ctx) {
  document.querySelector("#routine").onchange = (event) => {
    ctx.store.update((s) => {
      s.routine = event.target.value;
    });
    notify("Active routine updated.");
  };
  document.querySelector("#export").onclick = () =>
    download(
      "traction-backup-" + new Date().toISOString().slice(0, 10) + ".json",
      JSON.stringify(ctx.store.state, null, 2),
    );
  document.querySelector("#import").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Choose a JSON file smaller than 20 MB.");
      const input = JSON.parse(await file.text());
      if (Array.isArray(input.setEntries)) {
        const result = importLegacy(ctx.store.state, input, ctx.exercises);
        modal(
          "Import workout history?",
          `<p>Add ${result.count} sets from ${esc(file.name)}? Existing sets will stay in place.</p>`,
          () => {
            const latest = importLegacy(ctx.store.state, input, ctx.exercises);
            ctx.store.replace(latest.state);
            ctx.render();
            notify(`${latest.count} sets imported.`);
          },
          "Import history",
        );
      } else {
        validateState(input, ctx.exercises, ctx.templates);
        modal(
          "Restore this backup?",
          `<p>This replaces workouts, profile metrics, and drafts in your current journal with ${input.sets.length} sets from ${esc(file.name)}. Export a backup of your current data first if you want to keep it.</p>`,
          () => {
            ctx.store.replace(input);
            ctx.render();
            notify("Backup restored.");
          },
          "Replace with backup",
        );
      }
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? "This file is not valid JSON. No data was changed."
          : error.message,
      );
    }
    event.target.value = "";
  };
  document.querySelector("#check-update").onclick = async () => {
    const status = document.querySelector("#update-status");
    try {
      if (!navigator.onLine) throw new Error("Reconnect to check for updates.");
      if (!("serviceWorker" in navigator))
        throw new Error("App updates need HTTPS or localhost.");
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration)
        throw new Error(
          "Offline setup is not ready. Reload online and try again.",
        );
      await registration.update();
      if (registration.waiting) {
        await ctx.activateUpdate(registration);
      } else
        status.textContent =
          "Update check completed. A new version will be offered if available.";
    } catch (error) {
      status.textContent = error.message;
    }
  };
}
