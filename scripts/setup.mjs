#!/usr/bin/env node
/**
 * One-shot dev setup: patch simulator-ui, sync assets, build workspaces.
 *
 *   npm run setup       — full first-time setup (stubs + WASM + build)
 *   npm run setup:sim   — Radio sim tab only (WASM + patch + sim-preview build)
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const simOnly = process.argv.includes("--sim");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status ?? 1})`);
    process.exit(result.status ?? 1);
  }
}

function runScript(label, scriptName) {
  run(label, process.execPath, [join(ROOT, "scripts", scriptName)]);
}

console.log(simOnly ? "EdgeTX setup (Radio sim)" : "EdgeTX setup (full dev environment)");

runScript("Patch @edgetx/simulator-ui env stubs", "patch-simulator-ui.mjs");

if (!simOnly) {
  runScript("Sync EdgeTX LuaLS stubs", "sync-edgetx-stubs.mjs");
}

runScript("Sync EdgeTX WASM firmware (TX15)", "sync-edgetx-wasm.mjs");

if (simOnly) {
  run("Build @widget-gen/sim-preview", npmCmd, ["run", "build", "-w", "@widget-gen/sim-preview"]);
} else {
  run("Build all workspaces", npmCmd, ["run", "build"]);
}

console.log("\n✓ Setup complete.");
if (simOnly) {
  console.log("  Restart the dev server and hard-refresh the browser, then open the Sim tab.");
} else {
  console.log("  Set CURSOR_API_KEY, then run: npm run dev");
  console.log("  Open http://localhost:3000 — use Preview (fast) or Sim (EdgeTX WASM) tabs.");
}
