#!/usr/bin/env node
/**
 * Build a slim EdgeTX API catalog for the in-browser Lua source editor.
 * Run: node scripts/build-edgetx-completions.mjs
 * Also invoked from npm run sync-stubs.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const VERSION = process.env.EDGETX_STUB_VERSION ?? "2.11";

function slimDesc(d) {
  if (!d) return "";
  return String(d)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/#+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

const api = JSON.parse(
  readFileSync(join(ROOT, "stubs", VERSION, "edgetx-lua-api.json"), "utf8"),
);

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

const outDir = join(ROOT, "apps/web/src/app/editor/lib");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "edgetxCompletionsData.json");
const payload = {
  version: api.version ?? VERSION,
  generated: new Date().toISOString(),
  source: `stubs/${VERSION}/edgetx-lua-api.json`,
  items,
};
writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
console.log(
  `Wrote ${items.length} completions → apps/web/src/app/editor/lib/edgetxCompletionsData.json`,
);
