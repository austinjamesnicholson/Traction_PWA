import { notify, modal } from "./ui.js";
export async function activateUpdate(registration) {
  modal(
    "Update Traction?",
    "<p>Your workout data and saved drafts will stay on this device. The app will reload to use the new version.</p>",
    () => {
      if (!registration.waiting) {
        notify("The update is no longer waiting. Check again.");
        return;
      }
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    },
    "Update and reload",
  );
}
export function setupPWA() {
  let prompt = null;
  const install = document.querySelector("#install");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event;
    install.hidden = false;
  });
  install.onclick = async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      prompt = null;
      install.hidden = true;
    }
  };
  window.addEventListener("appinstalled", () => {
    install.hidden = true;
    notify("Traction installed.");
  });
  const connected = () => {
    document.querySelector("#connection").textContent = navigator.onLine
      ? "On-device journal"
      : "Offline · ready to train";
  };
  window.addEventListener("online", connected);
  window.addEventListener("offline", connected);
  connected();
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        location.reload();
      }
    });
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        const offer = () => {
          if (navigator.serviceWorker.controller && registration.waiting)
            activateUpdate(registration);
        };
        if (registration.waiting) offer();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed") offer();
          });
        });
      })
      .catch(() => notify("Offline setup failed. Reopen online to try again."));
  }
}
