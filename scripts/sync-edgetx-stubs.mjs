#!/usr/bin/env node
/**
 * Sync EdgeTX LuaLS stubs from JeffreyChix/edgetx-stubs for dev-kit integration.
 * Run: npm run sync-stubs
 *
 * Syncs every major.minor exposed in the Studio EdgeTX picker (2.10 / 2.11 / 2.12)
 * unless EDGETX_STUB_VERSIONS is set (comma-separated, e.g. "2.11,2.12").
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const BASE = "https://raw.githubusercontent.com/JeffreyChix/edgetx-stubs/main";
const DEFAULT_VERSIONS = ["2.10", "2.11", "2.12"];

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

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.text();
}

async function syncVersion(version) {
  const outDir = join(ROOT, "stubs", version);
  await mkdir(outDir, { recursive: true });

  for (const file of FILES) {
    const url = `${BASE}/stubs/${version}/${file}`;
    process.stdout.write(`  ${version}/${file}... `);
    try {
      const text = await fetchText(url);
      await writeFile(join(outDir, file), text);
      console.log("ok");
    } catch (err) {
      // Older stub trees may omit lvgl / bit32 — skip missing optional files.
      if (
        file === "edgetx.lvgl.d.lua" ||
        file === "bit32.d.lua" ||
        file === "edgetx-script-types.json"
      ) {
        console.log("skip (missing)");
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const versions = resolveVersions();
  const manifestUrl = `${BASE}/manifest.json`;
  const manifest = await fetchText(manifestUrl);
  // Keep a copy at stubs/ root-adjacent default folder for tooling that expects it.
  await mkdir(join(ROOT, "stubs", "2.11"), { recursive: true });
  await writeFile(join(ROOT, "stubs", "2.11", "manifest.json"), manifest);
  console.log("Wrote stubs/2.11/manifest.json");

  console.log(`Syncing EdgeTX stubs: ${versions.join(", ")}`);
  for (const version of versions) {
    console.log(`\n→ ${version}`);
    await syncVersion(version);
  }

  const gen = spawnSync(
    process.execPath,
    [join(ROOT, "scripts/build-edgetx-completions.mjs")],
    {
      stdio: "inherit",
      env: { ...process.env, EDGETX_STUB_VERSIONS: versions.join(",") },
    },
  );
  if (gen.status !== 0) {
    throw new Error("Failed to rebuild EdgeTX completions catalog");
  }

  console.log(`\nSynced EdgeTX stubs → stubs/{${versions.join(",")}}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
