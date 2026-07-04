#!/usr/bin/env node
/**
 * Sync EdgeTX LuaLS stubs from JeffreyChix/edgetx-stubs for dev-kit integration.
 * Run: npm run sync-stubs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const BASE = "https://raw.githubusercontent.com/JeffreyChix/edgetx-stubs/main";
const VERSION = process.env.EDGETX_STUB_VERSION ?? "2.11";

const FILES = [
  "edgetx.globals.d.lua",
  "edgetx.lcd.d.lua",
  "edgetx.model.d.lua",
  "edgetx.bitmap.d.lua",
  "edgetx.constants.d.lua",
  "edgetx.scripts.d.lua",
  "edgetx.lvgl.d.lua",
  "bit32.d.lua",
  "edgetx-lua-api.json",
  "edgetx-script-types.json",
];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.text();
}

async function main() {
  const outDir = join(ROOT, "stubs", VERSION);
  await mkdir(outDir, { recursive: true });

  const manifestUrl = `${BASE}/manifest.json`;
  const manifest = await fetchText(manifestUrl);
  await writeFile(join(outDir, "manifest.json"), manifest);
  console.log("Wrote manifest.json");

  for (const file of FILES) {
    const url = `${BASE}/stubs/${VERSION}/${file}`;
    process.stdout.write(`Fetching ${file}... `);
    const text = await fetchText(url);
    await writeFile(join(outDir, file), text);
    console.log("ok");
  }

  console.log(`\nSynced EdgeTX ${VERSION} stubs to stubs/${VERSION}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
