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

/** Doc-only macro fragments / mangled names that are not real Lua globals. */
const DOC_ARTIFACT_CONSTANTS = new Set([
  "FIRST",
  "LONG",
  "REPEAT",
  "BREAK",
  "VIRTUAL",
  "SLIDE",
]);

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

/** True when sinceVersion is newer than the stub folder major.minor. */
function sinceNewerThanCatalog(sinceVersion, catalogVersion) {
  if (!sinceVersion) return false;
  const since = String(sinceVersion).match(/^(\d+)\.(\d+)/);
  const catalog = String(catalogVersion).match(/^(\d+)\.(\d+)/);
  if (!since || !catalog) return false;
  const s = Number(since[1]) * 1000 + Number(since[2]);
  const c = Number(catalog[1]) * 1000 + Number(catalog[2]);
  return s > c;
}

function isDocArtifactConstant(name) {
  if (DOC_ARTIFACT_CONSTANTS.has(name)) return true;
  // Mangled EVT_TOUCH___* fragments from incomplete preprocessor expansion.
  return /^EVT_TOUCH___/.test(name);
}

function buildItems(api, catalogVersion) {
  const items = [];

  for (const f of api.functions ?? []) {
    if (!f?.name) continue;
    if (sinceNewerThanCatalog(f.sinceVersion, catalogVersion)) continue;
    const mod = f.module && f.module !== "general" ? f.module : null;
    const label = mod ? `${mod}.${f.name}` : f.name;
    // Only required params in the insert text — optional markers like [flags]
    // are invalid Lua if accepted as-is. Keep the full signature in detail.
    const required = (f.parameters ?? [])
      .filter((p) => !p.optional)
      .map((p) => p.name)
      .join(", ");
    items.push({
      kind: "function",
      label,
      insert: `${f.name}(${required})`,
      detail: f.signature || label,
      info: slimDesc(f.description),
      ...(mod ? { module: mod } : {}),
      name: f.name,
    });
  }

  for (const c of api.constants ?? []) {
    if (!c?.name) continue;
    if (isDocArtifactConstant(c.name)) continue;
    if (sinceNewerThanCatalog(c.sinceVersion, catalogVersion)) continue;
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
  const items = buildItems(api, version);
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
  versions: catalogs,
};
// Pretty-print so Prettier fmt:check stays clean after regen.
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Wrote ${Object.keys(catalogs).length} version catalog(s) → apps/web/src/app/editor/lib/edgetxCompletionsData.json`,
);
