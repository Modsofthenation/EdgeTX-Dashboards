#!/usr/bin/env node
/**
 * Download EdgeTX WASM simulator firmware (TX15 / 480×320) for Radio sim preview.
 * Run: npm run sync-wasm
 *
 * Writes versioned blobs under apps/web/public/sim/ and a multi-version manifest.json.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, stat, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WASM_BASE =
  process.env.EDGETX_WASM_BASE ??
  "https://ypwfws8ckruh03m1.public.blob.vercel-storage.com/wasm";

/** semver key → blob host version folder / env hint */
const FIRMWARE_VERSIONS = [
  { id: "2.11.0", label: "2.11", fetchVersion: "2.11" },
  { id: "2.12.0", label: "2.12", fetchVersion: "2.12" },
];

const LEGACY_WASM = "edgetx-tx15-simulator.wasm";
const DISPLAY = { w: 480, h: 320, depth: 16 };

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function versionedWasmName(id) {
  const short = id.replace(/\.0$/, "").replace(/\./g, "-");
  return `edgetx-tx15-${short}-simulator.wasm`;
}

async function main() {
  const outDir = join(ROOT, "apps", "web", "public", "sim");
  await mkdir(outDir, { recursive: true });

  const manifest = {
    defaultVersion: "2.11.0",
    source: WASM_BASE,
    syncedAt: new Date().toISOString(),
    versions: {},
    radios: {
      tx15: {
        name: "RadioMaster TX15",
        wasm: LEGACY_WASM,
        display: DISPLAY,
      },
    },
  };

  const downloaded = new Map();

  for (const version of FIRMWARE_VERSIONS) {
    const wasmFile = versionedWasmName(version.id);
    const url = `${WASM_BASE}/${LEGACY_WASM}`;
    const outPath = join(outDir, wasmFile);
    process.stdout.write(`Fetching ${version.label} (${wasmFile})... `);

    let bytes;
    try {
      bytes = await fetchBytes(url);
    } catch (err) {
      console.error(`\nFailed to download ${url} for ${version.id}`);
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
    downloaded.set(version.id, { wasmFile, hash, size, label: version.label });
  }

  const hashToId = new Map();
  for (const [id, meta] of downloaded) {
    if (!hashToId.has(meta.hash)) hashToId.set(meta.hash, id);
  }

  for (const [id, meta] of downloaded) {
    const aliasOf = hashToId.get(meta.hash) !== id ? hashToId.get(meta.hash) : undefined;
    manifest.versions[id] = {
      label: meta.label,
      wasm: meta.wasmFile,
      sha256: meta.hash,
      size: meta.size,
      display: DISPLAY,
      ...(aliasOf ? { aliasOf } : {}),
    };
  }

  const defaultMeta = downloaded.get(manifest.defaultVersion);
  if (defaultMeta) {
    const legacyPath = join(outDir, LEGACY_WASM);
    await copyFile(join(outDir, defaultMeta.wasmFile), legacyPath);
    manifest.radios.tx15.sha256 = defaultMeta.hash;
    manifest.radios.tx15.size = defaultMeta.size;
  }

  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nSynced EdgeTX WASM to apps/web/public/sim/`);
  console.log(`Default firmware: ${manifest.defaultVersion} (${defaultMeta?.size ?? "?"} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
