// Increment the version after changing app-shell files.
const CACHE = "traction-shell-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./css/routines.css",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./data/exercises.json",
  "./data/templates.json",
  "./js/app.js",
  "./js/store.js",
  "./js/model.js",
  "./js/routines.js",
  "./js/routine-draft.js",
  "./js/routine-drag.js",
  "./js/exercise-catalog.js",
  "./js/icons.js",
  "./js/views/routine-builder.js",
  "./js/views/routine-editor.js",
  "./js/views/exercise-picker.js",
  "./js/exercise-log.js",
  "./js/sounds.js",
  "./js/views/recommendation-card.js",
  "./js/ui.js",
  "./js/pwa.js",
  "./js/charts.js",
  "./js/config.js",
  "./js/cloud.js",
  "./js/sync.js",
  "./js/vendor/supabase.js",
  "./js/views/account.js",
  "./js/recommendations.js",
  "./js/views/dashboard.js",
  "./js/views/workouts.js",
  "./js/views/hub.js",
  "./js/views/history.js",
  "./js/views/library.js",
  "./js/views/settings.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const prefix = new URL(self.registration.scope).pathname;
      const keys = await caches.keys();
      // Cache Storage is origin-wide; never delete another app's caches (e.g. Waypoint).
      for (const key of keys)
        if (key.startsWith("traction-shell-") && key !== CACHE) {
          const cache = await caches.open(key);
          const entries = await cache.keys();
          if (
            entries.some((request) =>
              new URL(request.url).pathname.startsWith(prefix),
            )
          )
            await caches.delete(key);
        }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const base = new URL(self.registration.scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
    return;
  // Never cache authentication or AI responses; only the explicit app shell.
  const relative = "./" + url.pathname.slice(base.pathname.length);
  if (!ASSETS.includes(relative) && event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (event.request.mode === "navigate")
        return (
          (await cache.match(new URL("./index.html", base))) ||
          fetch(event.request)
        );
      return (
        (await cache.match(event.request, { ignoreSearch: true })) ||
        fetch(event.request)
      );
    })(),
  );
});
