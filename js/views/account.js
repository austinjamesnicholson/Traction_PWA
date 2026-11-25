import { heading, esc, notify, modal, download } from "../ui.js";
export function account(ctx) {
  const cloud = ctx.cloud,
    user = cloud.account;
  if (cloud.recovery)
    return (
      heading(
        "ACCOUNT RECOVERY",
        "Choose a new password.",
        "Use a strong password for your Traction account.",
      ) +
      `<section class="card narrow"><form id="password-form"><label>New password<input type="password" name="password" autocomplete="new-password" minlength="8" required></label><label>Confirm password<input type="password" name="confirm" autocomplete="new-password" minlength="8" required></label><button class="primary">Save new password</button><p id="auth-message" role="status"></p></form></section>`
    );
  if (user)
    return (
      heading(
        "YOUR ACCOUNT",
        "Your journal, everywhere.",
        user.email || "Signed in",
      ) +
      `<section class="card narrow"><h2>Cloud storage</h2><p id="account-status" role="status">${esc(cloud.status.message)}</p><p>Saved workouts, sets, profile metrics, and routine settings sync to your account. Exercise drafts stay on this device until saved.</p>${cloud.status.state === "conflict" ? `<div class="conflict-panel"><h3>Choose which edits to keep</h3><p>Different records will be combined. For records changed on both devices, choose a version. Export this device’s backup before choosing if you want a copy.</p><button id="conflict-backup" class="secondary">Export this device’s backup</button><div class="actions"><button class="secondary" data-resolve="local">Keep this device’s conflicting edits</button><button class="secondary" data-resolve="cloud">Keep cloud’s conflicting edits</button></div></div>` : ""}<div class="actions"><button class="primary" id="sync-now">Sync now</button><button class="secondary" id="sign-out">Sign out</button></div><p class="fine-print">Signing out opens your separate device-only journal. Unsynced account changes stay in this browser for the next time you sign in to this account. Use your own device; signing out does not erase its offline account cache.</p></section>`
    );
  return (
    heading(
      "YOUR TRACTION ACCOUNT",
      "Train here. Pick up anywhere.",
      "Sign in to save your journal online and use it on your phone and computer.",
    ) +
    `<section class="card narrow"><div class="account-tabs"><button class="secondary" data-auth-mode="signin" aria-pressed="true">Sign in</button><button class="quiet" data-auth-mode="signup" aria-pressed="false">Create account</button></div><form id="auth-form"><label>Email<input type="email" name="email" autocomplete="email" required></label><label id="password-label">Password<input type="password" name="password" autocomplete="current-password" required minlength="8"></label><button class="primary" id="auth-submit">Sign in</button><button type="button" class="quiet" id="forgot-password">Forgot password?</button><p id="auth-message" role="status" aria-live="polite"></p></form><p class="fine-print">Your cloud account starts with its own journal. Device-only workouts are kept separate. To copy them, export a backup before signing in, then import it into your account in Settings.</p><p class="warning">${cloud.status.state === "error" ? esc(cloud.status.message) : ""}</p></section>`
  );
}
export function bindAccount(ctx) {
  const cloud = ctx.cloud;
  const recovery = document.querySelector("#password-form");
  async function busy(form, action, success) {
    const message = document.querySelector("#auth-message");
    form.querySelectorAll("button").forEach((b) => (b.disabled = true));
    message.textContent = "Please wait…";
    try {
      const outcome = await action();
      if (document.querySelector("#auth-message") === message)
        message.textContent =
          typeof outcome === "string" ? outcome : success || "";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      form.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  }
  if (recovery) {
    recovery.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(recovery);
      if (data.get("password") !== data.get("confirm")) {
        document.querySelector("#auth-message").textContent =
          "Passwords do not match.";
        return;
      }
      busy(
        recovery,
        () => cloud.updatePassword(data.get("password")),
        "Password updated.",
      );
    };
    return;
  }
  const form = document.querySelector("#auth-form");
  if (form) {
    let mode = "signin";
    document.querySelectorAll("[data-auth-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.authMode;
          document.querySelectorAll("[data-auth-mode]").forEach((x) => {
            x.setAttribute("aria-pressed", String(x === b));
            x.className = x === b ? "secondary" : "quiet";
          });
          form.elements.password.autocomplete =
            mode === "signup" ? "new-password" : "current-password";
          document.querySelector("#auth-submit").textContent =
            mode === "signup" ? "Create account" : "Sign in";
          document.querySelector("#auth-message").textContent = "";
        }),
    );
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      busy(form, async () => {
        if (mode === "signup") {
          const signedIn = await cloud.signUp(
            data.get("email").trim(),
            data.get("password"),
          );
          if (!signedIn) {
            form.elements.password.value = "";
            return "Check your email to confirm your account, then sign in. If you already have an account, use Sign in.";
          }
        } else
          await cloud.signIn(data.get("email").trim(), data.get("password"));
        ctx.render();
      });
    };
    document.querySelector("#forgot-password").onclick = () => {
      if (!form.elements.email.reportValidity()) return;
      busy(
        form,
        () => cloud.resetPassword(form.elements.email.value.trim()),
        "If this account exists, a password reset email has been sent. Check your inbox.",
      );
    };
    return;
  }
  const sync = document.querySelector("#sync-now");
  if (sync)
    sync.onclick = async () => {
      sync.disabled = true;
      await cloud.sync();
      ctx.render();
    };
  document.querySelectorAll("[data-resolve]").forEach(
    (b) =>
      (b.onclick = () =>
        modal(
          "Resolve conflicting edits?",
          `<p>Keep ${b.dataset.resolve === "local" ? "this device’s" : "the cloud’s"} version of records changed on both devices? Other changes will be combined.</p>`,
          async () => {
            await cloud.sync(b.dataset.resolve);
            ctx.render();
          },
          "Resolve and sync",
        )),
  );
  const backup = document.querySelector("#conflict-backup");
  if (backup)
    backup.onclick = () =>
      download(
        "traction-before-conflict.json",
        JSON.stringify(ctx.store.state, null, 2),
      );
  const signout = document.querySelector("#sign-out");
  if (signout)
    signout.onclick = () =>
      modal(
        "Sign out on this device?",
        `<p>${cloud.pending ? "Some account changes are not in the cloud yet. They will stay in this browser and sync when you sign back in." : "Your journal is saved in your account."}</p>`,
        async () => {
          try {
            await cloud.signOut();
            location.hash = "#account";
            ctx.render();
            notify("Signed out. Device-only journal opened.");
          } catch (error) {
            ctx.render();
            notify(error.message);
          }
        },
        "Sign out",
      );
}
