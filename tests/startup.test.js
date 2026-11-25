import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("opening the bare app URL renders Overview instead of an empty route", async () => {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector))
      nodes.set(selector, {
        innerHTML: "",
        textContent: "",
        classList: { add() {}, remove() {} },
        focus() {},
      });
    return nodes.get(selector);
  };
  globalThis.document = {
    querySelector: node,
    querySelectorAll: () => [],
    title: "",
  };
  globalThis.location = { hash: "" };
  globalThis.window = { addEventListener() {} };
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
  };
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      JSON.parse(
        await readFile(
          new URL("../" + url.replace(/^\.\//, ""), import.meta.url),
          "utf8",
        ),
      ),
  });
  await import("../js/app.js");
  assert.match(node("#main").innerHTML, /Keep showing up/);
  assert.equal(document.title, "Overview · Traction");
  assert.equal(node("#breadcrumb").textContent, "Training / Overview");
});
