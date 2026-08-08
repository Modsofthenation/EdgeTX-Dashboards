#!/usr/bin/env node
/**
 * Ensure EdgeTX WASM sim assets exist under apps/web/public/sim/.
 * Downloads via sync-edgetx-wasm.mjs only when manifest or blobs are missing.
 *
 * Hooked from postinstall, npm run dev, and npm run build (before web).
 * Set SKIP_WASM_SYNC=1 to skip network fetch (CI without sim, etc.).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIM_DIR = join(ROOT, "apps", "web", "public", "sim");
const MANIFEST_PATH = join(SIM_DIR, "manifest.json");
const LEGACY_WASM = "edgetx-tx15-simulator.wasm";

function wasmFilesFromManifest(manifest) {
  const files = new Set([LEGACY_WASM]);
  if (manifest.versions) {
    for (const entry of Object.values(manifest.versions)) {
      if (entry?.wasm) files.add(entry.wasm);
    }
  }
  if (manifest.radios) {
    for (const radio of Object.values(manifest.radios)) {
      if (radio?.wasm) files.add(radio.wasm);
    }
  }
  return [...files];
}

export function isSimWasmReady() {
  if (!existsSync(MANIFEST_PATH)) return false;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return false;
  }

  for (const wasm of wasmFilesFromManifest(manifest)) {
    const path = join(SIM_DIR, wasm);
    if (!existsSync(path)) return false;
    const { size } = statSync(path);
    if (size < 1024) return false;
  }

  return true;
}

function runSync() {
  const script = join(ROOT, "scripts", "sync-edgetx-wasm.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  if (process.env.SKIP_WASM_SYNC === "1") {
    if (!isSimWasmReady()) {
      console.warn(
        "SKIP_WASM_SYNC=1 and EdgeTX WASM sim assets are missing — Radio sim tab will not work.",
      );
    }
    return;
  }

  if (isSimWasmReady()) {
    console.log("EdgeTX WASM sim assets: ok");
    return;
  }

  console.log("EdgeTX WASM sim assets missing — downloading…");
  runSync();
}

main();
