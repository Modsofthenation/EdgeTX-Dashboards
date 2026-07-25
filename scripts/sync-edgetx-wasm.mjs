#!/usr/bin/env node
/**
 * Download EdgeTX WASM simulator firmware (TX15 / 480×320) for Radio sim preview.
 * Run: npm run sync-wasm
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncSimFirmware } from "./lib/sync-edgetx-wasm-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const status = await syncSimFirmware(ROOT, {
  onProgress: (event) => {
    if (event.phase === "download") {
      process.stdout.write(`[${event.step}/${event.total}] ${event.message}\n`);
    } else if (event.phase === "done") {
      console.log(`\n${event.message}`);
    }
  },
});

console.log(`Synced EdgeTX WASM to apps/web/public/sim/`);
console.log(
  `Default firmware: ${status.defaultVersion} (${status.files.find((f) => f.name.includes(status.defaultVersion?.replace(/\./g, "-") ?? ""))?.size ?? "?"} bytes)`,
);
