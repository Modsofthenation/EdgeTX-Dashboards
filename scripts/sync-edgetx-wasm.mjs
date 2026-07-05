#!/usr/bin/env node
/**
 * Download EdgeTX WASM simulator firmware (TX15 / 480×320) for Radio sim preview.
 * Run: npm run sync-wasm
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WASM_BASE =
  process.env.EDGETX_WASM_BASE ??
  "https://ypwfws8ckruh03m1.public.blob.vercel-storage.com/wasm";
const VERSION = process.env.EDGETX_WASM_VERSION ?? "2.11";

/** Board targets used by this repo (480×320 color LCD). */
const RADIOS = [
  {
    id: "tx15",
    name: "RadioMaster TX15",
    wasm: "edgetx-tx15-simulator.wasm",
    display: { w: 480, h: 320, depth: 16 },
  },
];

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main() {
  const outDir = join(ROOT, "apps", "web", "public", "sim");
  await mkdir(outDir, { recursive: true });

  const manifest = {
    version: VERSION,
    source: WASM_BASE,
    syncedAt: new Date().toISOString(),
    radios: {},
  };

  for (const radio of RADIOS) {
    const url = `${WASM_BASE}/${radio.wasm}`;
    const outPath = join(outDir, radio.wasm);
    process.stdout.write(`Fetching ${radio.wasm}... `);

    let bytes;
    try {
      bytes = await fetchBytes(url);
    } catch (err) {
      console.error(`\nFailed to download ${url}`);
      throw err;
    }

    const hash = sha256Hex(bytes);
    const existing = await readFile(outPath).catch(() => null);
    if (existing && sha256Hex(existing) === hash) {
      console.log("unchanged");
    } else {
      await writeFile(outPath, bytes);
      console.log(`ok (${bytes.length} bytes)`);
    }

    const { size } = await stat(outPath);
    manifest.radios[radio.id] = {
      name: radio.name,
      wasm: radio.wasm,
      sha256: hash,
      size,
      display: radio.display,
    };
  }

  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nSynced EdgeTX WASM to apps/web/public/sim/`);
  console.log(`TX15 firmware: ${manifest.radios.tx15.size} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
