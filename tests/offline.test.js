import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, access } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const source = await readFile(new URL("sw.js", root), "utf8");
function worker() {
  const listeners = {},
    stores = new Map(),
    network = [];
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const map = stores.get(name);
      return {
        addAll: async (assets) => {
          for (const asset of assets) {
            await access(new URL(asset || "index.html", root));
            map.set(new URL(asset, "https://example.test/Traction_PWA/").href, {
              asset,
            });
          }
        },
        match: async (request) =>
          map.get(
            (typeof request === "string"
              ? request
              : request.url || request.href
            ).split("?")[0],
          ),
        keys: async () => [...map.keys()].map((url) => ({ url })),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  const self = {
    registration: { scope: "https://example.test/Traction_PWA/" },
    clients: { claim: async () => {} },
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    skipWaiting: () => {
      self.skipped = true;
    },
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    fetch: async (request) => {
      network.push(request);
      throw new Error("Offline");
    },
  });
  const fire = async (type, extra = {}) => {
    let result;
    listeners[type]({
      ...extra,
      waitUntil: (p) => {
        result = p;
      },
      respondWith: (p) => {
        result = p;
      },
    });
    return result;
  };
  return { fire, stores, network, self };
}
test("service worker precaches every shell file and serves navigation and JS offline under a subpath", async () => {
  const w = worker();
  await w.fire("install");
  const page = await w.fire("fetch", {
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/Traction_PWA/",
    },
  });
  assert.equal(page.asset, "./index.html");
  const module = await w.fire("fetch", {
    request: {
      method: "GET",
      mode: "cors",
      url: "https://example.test/Traction_PWA/js/views/hub.js",
    },
  });
  assert.equal(module.asset, "./js/views/hub.js");
  assert.equal(w.network.length, 0);
});
test("service worker ignores AI, auth, other apps and non-GET requests", async () => {
  const w = worker();
  for (const request of [
    { method: "POST", url: "https://example.test/Traction_PWA/ai" },
    { method: "GET", url: "https://project.supabase.co/auth/v1/signup" },
    { method: "GET", url: "https://example.test/Waypoint/" },
    { method: "GET", url: "https://example.test/Traction_PWA/private.json" },
  ])
    assert.equal(await w.fire("fetch", { request }), undefined);
  assert.equal(w.network.length, 0);
});
test("activation removes only old Traction caches and preserves Waypoint", async () => {
  const w = worker();
  w.stores.set("waypoint-v5", new Map());
  w.stores.set(
    "traction-shell-old",
    new Map([["https://example.test/Traction_PWA/index.html", {}]]),
  );
  await w.fire("install");
  await w.fire("activate");
  assert(w.stores.has("waypoint-v5"));
  assert(!w.stores.has("traction-shell-old"));
  assert(w.stores.has("traction-shell-v1"));
});
test("updates wait until explicitly activated", async () => {
  const w = worker();
  await w.fire("install");
  assert.equal(w.self.skipped, undefined);
  await w.fire("message", { data: { type: "SKIP_WAITING" } });
  assert.equal(w.self.skipped, true);
});
