import { STORAGE_KEY } from "./store.js";
import { createCloud } from "./cloud.js";
import { account, bindAccount } from "./views/account.js";
import { clearRecommendations } from "./recommendations.js";
import { empty, notify, download } from "./ui.js";
import { setupPWA, activateUpdate } from "./pwa.js";
import { dashboard } from "./views/dashboard.js";
import {
  workouts,
  bindWorkouts,
  session,
  bindSession,
} from "./views/workouts.js";
import { hub, bindHub, hasUnsavedChanges, clearDirty } from "./views/hub.js";
import { history, bindHistory, database, bindEdit } from "./views/history.js";
import { library, bindLibrary } from "./views/library.js";
import {
  profile,
  bindProfile,
  settings,
  bindSettings,
} from "./views/settings.js";
const routines = [
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
const main = document.querySelector("#main");
try {
  const [exercises, templates] = await Promise.all(
    ["exercises", "templates"].map(async (name) => {
      const response = await fetch("./data/" + name + ".json");
      if (!response.ok)
        throw new Error(
          "Exercise library unavailable. Open the app online and try again.",
        );
      return response.json();
    }),
  );
  exercises.sort((a, b) => a.name.localeCompare(b.name));
  const ctx = {
    store: null,
    cloud: null,
    exercises,
    templates,
    routines,
    render,
    activateUpdate,
    routeKey: "",
  };
  const routes = {
    dashboard: [dashboard],
    workouts: [workouts, bindWorkouts],
    session: [session, bindSession],
    hub: [hub, bindHub],
    history: [history, bindHistory],
    database: [database, bindEdit],
    library: [library, bindLibrary],
    profile: [profile, bindProfile],
    settings: [settings, bindSettings],
    account: [account, bindAccount],
  };
  let started = false,
    owner = null,
    lastConflict = false;
  const cloud = createCloud({
    storage: localStorage,
    exercises,
    templates,
    onData() {
      if (!started) return;
      const next = cloud.account?.id || null;
      if (owner !== next) {
        clearRecommendations();
        owner = next;
        clearDirty();
        location.hash = "#account";
      }
      render();
    },
    onStatus(status) {
      document.querySelector("#cloud-status").textContent = status.message;
      document.querySelector("#account-link").textContent = ctx.cloud?.account
        ? "Account & sync"
        : "Sign in";
      const node = document.querySelector("#account-status");
      if (node) node.textContent = status.message;
      const conflict = status.state === "conflict";
      if (
        started &&
        ctx.routeKey === "account" &&
        cloud.account &&
        conflict !== lastConflict
      )
        render();
      lastConflict = conflict;
    },
  });
  ctx.cloud = cloud;
  ctx.store = cloud.store;
  function render() {
    try {
      let rawRoute = location.hash.slice(1);
      if (/^(access_token|error|refresh_token|type)=/.test(rawRoute)) {
        globalThis.history.replaceState(
          null,
          "",
          location.pathname + location.search + "#account",
        );
        rawRoute = "account";
      }
      const [page, ...args] = (rawRoute || "dashboard")
        .split("/")
        .map(decodeURIComponent);
      ctx.routeKey = [page, ...args].join("/");
      if (page !== "hub") clearDirty();
      const route = routes[page];
      main.innerHTML = route
        ? route[0](ctx, ...args)
        : empty("Page not found", "Choose a page from the navigation.");
      route?.[1]?.(ctx, ...args);
      const current = ["session", "hub"].includes(page)
        ? "workouts"
        : page === "database"
          ? "history"
          : page;
      document.querySelectorAll("[data-page]").forEach((a) => {
        if (a.dataset.page === current) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      document.querySelector("#breadcrumb").textContent =
        "Training / " +
        ({
          dashboard: "Overview",
          workouts: "Workouts",
          session: "Active workout",
          hub: "Exercise log",
          history: "History",
          library: "Exercise library",
          profile: "Profile",
          settings: "Settings",
          database: "Database",
          account: "Account & sync",
        }[page] || "Page");
      document.title =
        (page === "dashboard"
          ? "Overview"
          : page[0].toUpperCase() + page.slice(1)) + " · Traction";
    } catch (error) {
      main.innerHTML = empty("This page could not open", error.message);
    }
  }
  window.addEventListener("hashchange", () => {
    document.querySelector("#modal").close();
    render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY)
      notify(
        "Another tab changed your journal. Reload this tab before saving.",
      );
  });
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  window.addEventListener("error", (event) => {
    if (event.error) notify(event.error.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    notify(event.reason?.message || "This action could not be completed.");
  });
  window.addEventListener("traction-account-change", () => {
    clearDirty();
    location.hash = "#account";
    render();
  });
  await cloud.start();
  owner = cloud.account?.id || null;
  started = true;
  render();
  setupPWA();
} catch (error) {
  main.innerHTML = `${empty("Your journal could not open", error.message)}<button class="secondary" id="recover">Export stored data</button><button class="secondary" id="retry">Reload app</button>`;
  document.querySelector("#recover").onclick = () =>
    download(
      "traction-recovery.json",
      localStorage.getItem(STORAGE_KEY) || "{}",
    );
  document.querySelector("#retry").onclick = () => location.reload();
}
