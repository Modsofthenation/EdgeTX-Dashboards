#!/usr/bin/env node
/**
 * Build slim EdgeTX API catalogs for the in-browser Lua source editor.
 * Run: node scripts/build-edgetx-completions.mjs
 * Also invoked from npm run sync-stubs.
 *
 * Writes one JSON file keyed by major.minor stub folder (2.10 / 2.11 / 2.12)
 * so autocomplete can follow the selected EdgeTX version.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const DEFAULT_VERSIONS = ["2.10", "2.11", "2.12"];
const DEFAULT_VERSION = "2.11";

function resolveVersions() {
  const raw =
    process.env.EDGETX_STUB_VERSIONS ?? process.env.EDGETX_STUB_VERSION;
  if (!raw) return DEFAULT_VERSIONS;
  return [
    ...new Set(
      raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => {
          const m = v.match(/^(\d+)\.(\d+)/);
          return m ? `${m[1]}.${m[2]}` : v;
        }),
    ),
  ];
}

function slimDesc(d) {
  if (!d) return "";
  return String(d)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/#+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function buildItems(api) {
  const items = [];

  for (const f of api.functions ?? []) {
    if (!f?.name) continue;
    const mod = f.module && f.module !== "general" ? f.module : null;
    const label = mod ? `${mod}.${f.name}` : f.name;
    const params = (f.parameters ?? [])
      .map((p) => (p.optional ? `[${p.name}]` : p.name))
      .join(", ");
    items.push({
      kind: "function",
      label,
      insert: `${f.name}(${params})`,
      detail: f.signature || label,
      info: slimDesc(f.description),
      ...(mod ? { module: mod } : {}),
      name: f.name,
    });
  }

  for (const c of api.constants ?? []) {
    if (!c?.name) continue;
    items.push({
      kind: "constant",
      label: c.name,
      insert: c.name,
      detail: c.type || "constant",
      info: slimDesc(c.description),
      name: c.name,
    });
  }

  return items;
}

const versions = resolveVersions();
const catalogs = {};

for (const version of versions) {
  const apiPath = join(ROOT, "stubs", version, "edgetx-lua-api.json");
  if (!existsSync(apiPath)) {
    console.warn(`Skipping ${version}: missing ${apiPath}`);
    continue;
  }
  const api = JSON.parse(readFileSync(apiPath, "utf8"));
  const items = buildItems(api);
  catalogs[version] = {
    version: api.version ?? version,
    source: `stubs/${version}/edgetx-lua-api.json`,
    items,
  };
  console.log(`  ${version}: ${items.length} items`);
}

if (Object.keys(catalogs).length === 0) {
  console.error("No stub catalogs found — run npm run sync-stubs first");
  process.exit(1);
}

const outDir = join(ROOT, "apps/web/src/app/editor/lib");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "edgetxCompletionsData.json");
const payload = {
  defaultVersion: catalogs[DEFAULT_VERSION]
    ? DEFAULT_VERSION
    : Object.keys(catalogs)[0],
  generated: new Date().toISOString(),
  versions: catalogs,
};
writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
console.log(
  `Wrote ${Object.keys(catalogs).length} version catalog(s) → apps/web/src/app/editor/lib/edgetxCompletionsData.json`,
);
