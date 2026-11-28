import { readFile, readdir, access } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const walk = async (dir) =>
  (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true }))
        .filter((e) => e.name !== ".git" && e.name !== "node_modules")
        .map((e) =>
          e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)],
        ),
    )
  ).flat();
const files = await walk(root);
for (const file of files.filter((f) => /\.(js|mjs|ts)$/.test(f))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g))
    if (match[1].startsWith(".")) await access(resolve(file, "..", match[1]));
}
// Supabase rejects a byte-order mark in deno.json even when some editors accept it.
JSON.parse(
  await readFile(
    resolve(root, "supabase/functions/workout-recommendation/deno.json"),
    "utf8",
  ),
);
const manifest = JSON.parse(
  await readFile(resolve(root, "manifest.webmanifest"), "utf8"),
);
for (const icon of manifest.icons) {
  await access(resolve(root, icon.src));
  const data = await readFile(resolve(root, icon.src));
  const [width, height] = icon.sizes.split("x").map(Number);
  if (data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== height)
    throw new Error("Wrong icon dimensions");
}
const sw = await readFile(resolve(root, "sw.js"), "utf8");
const cacheList = sw.slice(
  sw.indexOf("const ASSETS"),
  sw.indexOf("self.addEventListener"),
);
const assets = [...cacheList.matchAll(/["']\.\/([^"']*)["']/g)].map(
  (m) => m[1] || "index.html",
);
for (const asset of assets) await access(resolve(root, asset));
for (const file of files.filter(
  (f) =>
    f.endsWith(".js") &&
    relative(root, f).replaceAll("\\", "/").startsWith("js/"),
))
  if (!assets.includes(relative(root, file).replaceAll("\\", "/")))
    throw new Error("Missing from offline cache: " + file);
const exercises = JSON.parse(
  await readFile(resolve(root, "data/exercises.json"), "utf8"),
);
const templates = JSON.parse(
  await readFile(resolve(root, "data/templates.json"), "utf8"),
);
if (exercises.length !== 66 || templates.length !== 10)
  throw new Error("Source library parity failed");
for (const template of templates)
  for (const item of template.items)
    for (const name of item.exercises)
      if (!exercises.some((e) => e.name === name))
        throw new Error("Unknown template exercise: " + name);
console.log(
  `Checks passed: syntax, module imports, ${assets.length} offline assets, install icons, 66 exercises, 10 templates.`,
);
